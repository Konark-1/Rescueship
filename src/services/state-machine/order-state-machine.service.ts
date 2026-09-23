/**
 * order-state-machine.service.ts
 * Enterprise Order State Machine enforcing strict lifecycle transitions,
 * terminal state protection, stale timestamp rejection, and terminal reconciliation.
 */

import { Order, NdrCase, AuditLog, Merchant } from '../../models';
import { logger } from '../../utils/logger';
import { Queue } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { makeJobId } from '../../utils/job-id';

export const TERMINAL_STATES: readonly string[] = ['delivered', 'returned', 'cancelled', 'lost'];
export const SEMI_TERMINAL_STATES: readonly string[] = ['rto_initiated', 'rto'];

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  created:              ['new', 'cod_conversion_sent', 'converted_to_prepaid', 'shipped', 'cancelled', 'out_for_delivery'],
  pending:              ['new', 'cod_conversion_sent', 'converted_to_prepaid', 'shipped', 'cancelled'],
  new:                  ['cod_conversion_sent', 'converted_to_prepaid', 'shipped', 'out_for_delivery', 'cancelled'],
  cod_conversion_sent:  ['converted_to_prepaid', 'shipped', 'out_for_delivery', 'cancelled', 'new'],
  converted_to_prepaid: ['shipped', 'out_for_delivery', 'delivered', 'rto_initiated', 'cancelled'],
  shipped:              ['out_for_delivery', 'ndr_detected', 'delivered', 'cancelled', 'lost', 'rto_initiated'],
  out_for_delivery:     ['ndr_detected', 'delivered', 'rto_initiated', 'cancelled'],
  ndr_detected:         ['ndr_rescue_sent', 'ndr_pending_review', 'rto_initiated', 'delivered', 'cancelled', 'ndr_rescued', 'converted_to_prepaid'],
  ndr_rescue_sent:      ['ndr_rescued', 'rto_initiated', 'delivered', 'cancelled', 'ndr_detected', 'converted_to_prepaid'],
  ndr_pending_review:   ['ndr_rescue_sent', 'rto_initiated', 'cancelled', 'ndr_rescued', 'delivered'],
  ndr_rescued:          ['out_for_delivery', 'delivered', 'rto_initiated', 'cancelled', 'ndr_detected'],
  rto_initiated:        ['returned', 'rto', 'out_for_delivery', 'delivered', 'ndr_rescued', 'converted_to_prepaid'], // Rescueable via RTO arrest / payment
  rto:                  ['returned'],
  returned:             [], // Terminal
  delivered:            [], // Terminal
  cancelled:            [], // Terminal
  lost:                 [], // Terminal
};

export class OrderStateMachineService {
  private static instance: OrderStateMachineService;
  private escalationQueue: Queue | null = null;

  private constructor() {}

  public static getInstance(): OrderStateMachineService {
    if (!OrderStateMachineService.instance) {
      OrderStateMachineService.instance = new OrderStateMachineService();
    }
    return OrderStateMachineService.instance;
  }

  private getEscalationQueue(): Queue {
    if (!this.escalationQueue) {
      this.escalationQueue = new Queue('escalation', { connection: redisConnection as any });
    }
    return this.escalationQueue;
  }

  public isTerminal(status: string): boolean {
    return TERMINAL_STATES.includes(status);
  }

  public isSemiTerminal(status: string): boolean {
    return SEMI_TERMINAL_STATES.includes(status);
  }

  public canTransition(currentStatus: string, nextStatus: string): boolean {
    if (this.isTerminal(currentStatus)) {
      return false; // Terminal states can never transition to anything
    }
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed) {
      return false;
    }
    return allowed.includes(nextStatus);
  }

  public isStaleEvent(lastEventTimestamp?: Date | null, incomingTimestamp?: Date | null): boolean {
    if (!lastEventTimestamp || !incomingTimestamp) {
      return false;
    }
    return new Date(incomingTimestamp).getTime() < new Date(lastEventTimestamp).getTime();
  }

  /**
   * Transition order status with full validation, stale timestamp guard, and terminal reconciliation.
   */
  public async transitionOrder(
    order: any,
    nextStatus: string,
    eventTimestamp?: Date
  ): Promise<{ success: boolean; reason?: string }> {
    const currentStatus = order.status;

    // 1. Terminal Check
    if (this.isTerminal(currentStatus)) {
      logger.warn('State transition rejected: Order is already in terminal state', {
        orderId: order._id,
        currentStatus,
        nextStatus,
      });
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'state_transition_rejected_terminal',
        source: 'order_state_machine',
        payload: { currentStatus, nextStatus },
        status: 'failed',
        error: `Order is already in terminal state '${currentStatus}'`,
      }).catch(() => {});
      return {
        success: false,
        reason: `Order is already in terminal state '${currentStatus}'. Cannot transition to '${nextStatus}'.`,
      };
    }

    // 2. Transition Validity Check
    if (!this.canTransition(currentStatus, nextStatus)) {
      logger.warn('State transition rejected: Disallowed transition', {
        orderId: order._id,
        currentStatus,
        nextStatus,
      });
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'state_transition_rejected_illegal',
        source: 'order_state_machine',
        payload: { currentStatus, nextStatus },
        status: 'failed',
        error: `Disallowed transition from '${currentStatus}' to '${nextStatus}'`,
      }).catch(() => {});
      return {
        success: false,
        reason: `Disallowed transition from '${currentStatus}' to '${nextStatus}'.`,
      };
    }

    // 3. Stale Timestamp Check
    if (eventTimestamp && order.lastEventTimestamp) {
      if (this.isStaleEvent(order.lastEventTimestamp, eventTimestamp)) {
        logger.warn('State transition rejected: Stale out-of-order event', {
          orderId: order._id,
          lastEventTimestamp: order.lastEventTimestamp,
          incomingTimestamp: eventTimestamp,
        });
        await AuditLog.create({
          merchantId: order.merchantId,
          orderId: order._id,
          action: 'state_transition_rejected_stale_timestamp',
          source: 'order_state_machine',
          payload: { lastEventTimestamp: order.lastEventTimestamp, incomingTimestamp: eventTimestamp },
          status: 'failed',
          error: 'Stale out-of-order event timestamp',
        }).catch(() => {});
        return {
          success: false,
          reason: 'Stale out-of-order event timestamp.',
        };
      }
    }

    // 4. Apply Transition
    order.status = nextStatus;
    if (eventTimestamp) {
      order.lastEventTimestamp = eventTimestamp;
    }
    await order.save();

    // 5. Terminal Reconciliation
    if (this.isTerminal(nextStatus)) {
      await this.onTerminalTransition(order._id.toString(), nextStatus);
    }

    return { success: true };
  }

  /**
   * Terminal Reconciliation: When an order reaches delivered, returned, cancelled, or lost:
   * - Resolve active NdrCase records
   * - Cancel pending BullMQ escalation jobs
   * - Record terminal reconciliation AuditLog
   */
  public async onTerminalTransition(orderId: string, terminalStatus: string): Promise<void> {
    logger.info('Performing terminal state reconciliation', { orderId, terminalStatus });

    const caseOutcome = terminalStatus === 'delivered' ? 'DELIVERED' : terminalStatus === 'returned' ? 'RTO' : 'CANCELLED';
    const caseStatus = terminalStatus === 'delivered' ? 'DELIVERED' : 'CLOSED';

    try {
      let rtoFeeSaved = 0;
      if (terminalStatus === 'delivered') {
        const order = await Order.findById(orderId);
        if (order) {
          const hasNdr = await NdrCase.exists({ orderId });
          if (hasNdr || (order.status as string) === 'ndr_rescued' || order.rtoFeeSaved) {
            const merchant = await Merchant.findById(order.merchantId);
            rtoFeeSaved = (merchant as any)?.settings?.estimatedRtoLossPerOrder || 140;
            if (!order.rtoFeeSaved) {
              order.rtoFeeSaved = rtoFeeSaved;
              await order.save();
            }
          }
        }
      }

      await NdrCase.updateMany(
        { orderId, status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'CUSTOMER_RESPONDED', 'ADDRESS_RECEIVED', 'LOCATION_RECEIVED', 'REATTEMPT_REQUESTED'] } },
        {
          $set: {
            status: caseStatus,
            outcome: caseOutcome,
            closedAt: new Date(),
            ...(terminalStatus === 'delivered' && rtoFeeSaved > 0 && {
              rtoFeeSaved,
              estimatedLossPrevented: rtoFeeSaved,
            }),
          },
        }
      );

      // Cancel escalation jobs from BullMQ
      if (process.env.NODE_ENV !== 'test') {
        const eq = this.getEscalationQueue();
        const chain = [1, 2, 3];
        for (const level of chain) {
          try {
            const jobId = makeJobId('escalation', orderId, level);
            const job = await eq.getJob(jobId);
            if (job) await job.remove();
          } catch (jobErr) {}
        }
      }

      await AuditLog.create({
        orderId,
        action: 'terminal_state_reconciliation',
        source: 'order_state_machine',
        payload: { terminalStatus, caseOutcome, caseStatus },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed during terminal state reconciliation', { orderId, error: err.message });
    }
  }
}

export const orderStateMachineService = OrderStateMachineService.getInstance();
