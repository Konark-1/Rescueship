/**
 * ndr-lifecycle.job.ts
 * Enterprise NDR Case Lifecycle & Multi-Stage Reminder Worker.
 *
 * Cadence:
 *   - T+4h:  Reminder 1 (if customer has not replied and order still failed)
 *   - T+12h: Reminder 2 (if still pending)
 *   - T+24h: Final reminder + notify merchant ops
 *   - T+48h: Automated case timeout -> mark NO_RESPONSE -> Close case
 *
 * Customer Responded SLA Exception:
 *   - If customer has replied (customerResponseType is set), do NOT timeout at T+48h.
 *   - T+72h without courier reattempt -> ESCALATED
 *   - T+96h without courier reattempt -> MERCHANT_REVIEW
 */

import { Worker, Job, Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { NdrCase, Order, Merchant, AuditLog, MessageLog } from '../models';
import { whatsAppDispatcherService } from '../services/whatsapp/whatsapp-dispatcher.service';
import { orderStateMachineService } from '../services/state-machine/order-state-machine.service';
import { realtimeService } from '../services/realtime.service';
import { logger, maskPhone } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

export const ndrLifecycleQueue = new Queue('ndr-lifecycle', { connection: redisConnection as any });

export interface ReminderStep {
  offsetHours: number;
  templateCategory: 'CUSTOMER_NOT_AVAILABLE';
  level: number;
}

export const REMINDER_SCHEDULE: ReminderStep[] = [
  { offsetHours: 4, templateCategory: 'CUSTOMER_NOT_AVAILABLE', level: 1 },
  { offsetHours: 12, templateCategory: 'CUSTOMER_NOT_AVAILABLE', level: 2 },
  { offsetHours: 24, templateCategory: 'CUSTOMER_NOT_AVAILABLE', level: 3 },
];

/**
 * Cancel all pending BullMQ reminder & escalation jobs for a given orderId
 */
export async function cancelJobsByOrderId(orderId: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const eq = new Queue('escalation', { connection: redisConnection as any });
    for (let level = 1; level <= 3; level++) {
      const jobId = makeJobId('escalation', orderId, level);
      const job = await eq.getJob(jobId);
      if (job) await job.remove();
    }
  } catch (err: any) {
    logger.warn('Failed to remove BullMQ jobs by orderId', { orderId, error: err?.message });
  }
}

/**
 * Evaluates open NDR cases, sends intermediate reminders, checks carrier reattempt SLAs,
 * and closes stale cases after 48h.
 */
export async function processNdrLifecycle(): Promise<{
  remindersSent: number;
  casesClosedNoResponse: number;
  casesEscalated: number;
}> {
  logger.info('Running NDR Case Lifecycle reconciliation sweep');
  const now = Date.now();
  let remindersSent = 0;
  let casesClosedNoResponse = 0;
  let casesEscalated = 0;

  // ─── 1. Query Active Open Cases ───
  const activeCases = await NdrCase.find({
    status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'CUSTOMER_RESPONDED'] },
  }).lean();

  for (const ndrCase of activeCases) {
    const order = await Order.findById(ndrCase.orderId);
    if (!order) continue;

    // Terminal guard: if order reached a terminal state, reconcile and close case
    if (orderStateMachineService.isTerminal(order.status)) {
      await NdrCase.findByIdAndUpdate(ndrCase._id, {
        $set: {
          status: order.status === 'delivered' ? 'DELIVERED' : 'CLOSED',
          outcome: order.status === 'delivered' ? 'DELIVERED' : 'RTO',
          closedAt: new Date(),
        },
      });
      await cancelJobsByOrderId(order._id.toString());
      continue;
    }

    const createdAtMs = new Date(ndrCase.createdAt).getTime();
    const ageHours = (now - createdAtMs) / (1000 * 60 * 60);

    // ─── 2. Branch A: Customer has NOT responded ───
    if (!ndrCase.customerResponseType) {
      // Check 72-Hour Hard Expiry -> Mark EXPIRED and Close
      if (ageHours >= 72) {
        logger.info('Auto-expiring stale NDR case unresolved after 72h', {
          caseId: ndrCase._id,
          orderId: order._id,
          ageHours,
        });

        await NdrCase.findByIdAndUpdate(ndrCase._id, {
          $set: {
            status: 'EXPIRED',
            outcome: 'RTO',
            closedAt: new Date(),
          },
        });

        await AuditLog.create({
          merchantId: ndrCase.merchantId,
          orderId: order._id,
          action: 'ndr_case_expired_72h',
          source: 'ndr_lifecycle_job',
          payload: { ageHours, caseId: ndrCase._id },
          status: 'success',
        });

        realtimeService.broadcast({
          type: 'ndr_case_expired',
          merchantId: ndrCase.merchantId.toString(),
          payload: { orderId: order.externalOrderId, awb: ndrCase.awb, status: 'EXPIRED' },
          timestamp: new Date().toISOString(),
        });

        await cancelJobsByOrderId(order._id.toString());
        casesClosedNoResponse++;
        continue;
      }

      // Check 48-Hour Timeout -> Mark NO_RESPONSE and Close
      if (ageHours >= 48) {
        logger.info('Closing stale NDR case after 48h no-response timeout', {
          caseId: ndrCase._id,
          orderId: order._id,
          ageHours,
        });

        await NdrCase.findByIdAndUpdate(ndrCase._id, {
          $set: {
            status: 'NO_RESPONSE',
            outcome: 'RTO',
            closedAt: new Date(),
          },
        });

        await AuditLog.create({
          merchantId: ndrCase.merchantId,
          orderId: order._id,
          action: 'ndr_case_timed_out_no_response',
          source: 'ndr_lifecycle_job',
          payload: { ageHours, caseId: ndrCase._id },
          status: 'success',
        });

        realtimeService.broadcast({
          type: 'ndr_case_expired',
          merchantId: ndrCase.merchantId.toString(),
          payload: { orderId: order.externalOrderId, awb: ndrCase.awb, status: 'NO_RESPONSE' },
          timestamp: new Date().toISOString(),
        });

        await cancelJobsByOrderId(order._id.toString());
        casesClosedNoResponse++;
        continue;
      }

      // Check Intermediate Reminders (T+4h, T+12h, T+24h)
      const merchant = await Merchant.findById(ndrCase.merchantId);
      if (!merchant) continue;

      const outboundCount = await MessageLog.countDocuments({
        merchantId: merchant._id,
        orderId: order._id,
        direction: 'OUTBOUND',
      });

      // Match reminder level based on elapsed age
      let targetLevel = 0;
      if (ageHours >= 24) targetLevel = 3;
      else if (ageHours >= 12) targetLevel = 2;
      else if (ageHours >= 4) targetLevel = 1;

      // Only send if targetLevel is greater than sent message count
      if (targetLevel > 0 && outboundCount < targetLevel + 1 && outboundCount < 3) {
        logger.info('Dispatching NDR intermediate reminder', {
          orderId: order._id,
          ageHours: Math.round(ageHours),
          targetLevel,
          phone: maskPhone(order.customerPhone),
        });

        const dispatchResult = await whatsAppDispatcherService.dispatchNdrRescue({
          merchantId: merchant._id.toString(),
          orderId: order._id.toString(),
          phone: order.customerPhone,
          category: (ndrCase.failureCategory as any) || 'CUSTOMER_NOT_AVAILABLE',
          variables: {
            customerName: order.customerName || 'Customer',
            externalOrderId: String(order.externalOrderId || ''),
            codAmount: String(order.orderValue || 0),
          },
        });

        if (dispatchResult.success) {
          remindersSent++;
          await AuditLog.create({
            merchantId: merchant._id,
            orderId: order._id,
            action: `ndr_reminder_dispatched_level_${targetLevel}`,
            source: 'ndr_lifecycle_job',
            payload: { level: targetLevel, ageHours },
            status: 'success',
          });
        }
      }
    } else {
      // ─── 3. Branch B: Customer HAS responded, carrier reattempt SLA monitoring ───
      // If customer requested reschedule / updated address, but carrier hasn't reattempted
      if (ageHours >= 96 && ndrCase.status !== 'MERCHANT_REVIEW') {
        logger.warn('NDR case reached 96h without delivery completion — marking MERCHANT_REVIEW', {
          caseId: ndrCase._id,
          orderId: order._id,
        });
        await NdrCase.findByIdAndUpdate(ndrCase._id, { $set: { status: 'MERCHANT_REVIEW' } });
        casesEscalated++;
      } else if (ageHours >= 72 && ndrCase.status !== 'ESCALATED' && ndrCase.status !== 'MERCHANT_REVIEW') {
        logger.warn('NDR case reached 72h without delivery completion — marking ESCALATED', {
          caseId: ndrCase._id,
          orderId: order._id,
        });
        await NdrCase.findByIdAndUpdate(ndrCase._id, { $set: { status: 'ESCALATED' } });
        casesEscalated++;
      }
    }
  }

  return { remindersSent, casesClosedNoResponse, casesEscalated };
}

/**
 * Explicit daily audit for open NDR cases unresolved after 72 hours.
 * Directly queries NdrCase where status is OPEN or WAITING_CUSTOMER,
 * marks them as EXPIRED, sets outcome to RTO, and removes pending BullMQ escalation jobs.
 */
export async function expireStaleNdrCases72h(): Promise<{ expiredCount: number }> {
  logger.info('Running explicit 72h stale NDR case auto-expiry audit');
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const staleCases = await NdrCase.find({
    status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'open'] as any },
    createdAt: { $lt: cutoff },
  }).lean();

  let expiredCount = 0;
  for (const ndrCase of staleCases) {
    try {
      await NdrCase.findByIdAndUpdate(ndrCase._id, {
        $set: {
          status: 'EXPIRED',
          outcome: 'RTO',
          closedAt: new Date(),
        },
      });

      await cancelJobsByOrderId(ndrCase.orderId.toString());

      await AuditLog.create({
        merchantId: ndrCase.merchantId,
        orderId: ndrCase.orderId,
        action: 'ndr_case_expired_72h',
        source: 'ndr_lifecycle_job',
        payload: { caseId: ndrCase._id, createdAt: ndrCase.createdAt },
        status: 'success',
      });

      realtimeService.broadcast({
        type: 'ndr_case_expired',
        merchantId: ndrCase.merchantId.toString(),
        payload: { awb: ndrCase.awb, status: 'EXPIRED' },
        timestamp: new Date().toISOString(),
      });

      expiredCount++;
    } catch (err: any) {
      logger.error('Failed to expire stale NDR case', { caseId: ndrCase._id, error: err?.message });
    }
  }

  logger.info('Completed 72h stale NDR auto-expiry audit', { expiredCount });
  return { expiredCount };
}

export const ndrLifecycleWorker = new Worker(
  'ndr-lifecycle',
  async (job: Job) => {
    logger.info(`Processing ndr-lifecycle job: ${job.id}`);
    try {
      if (job.name === 'ndr-lifecycle-daily-72h-expiry') {
        const result = await expireStaleNdrCases72h();
        return result;
      }
      const stats = await processNdrLifecycle();
      logger.info('NDR lifecycle job completed successfully', stats);
      return stats;
    } catch (err: any) {
      logger.error(`Error in ndr-lifecycle worker: ${err.message}`);
      throw err;
    }
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

export const scheduleNdrLifecycle = async (): Promise<void> => {
  try {
    // 1. Repeatable sweep every 15 minutes for intermediate reminders and operational tracking
    await ndrLifecycleQueue.add(
      'ndr-lifecycle-reconciliation',
      {},
      {
        repeat: {
          pattern: '*/15 * * * *',
        },
      }
    );
    // 2. Repeatable daily audit at midnight (0 0 * * *) for 72h stale auto-expiry
    await ndrLifecycleQueue.add(
      'ndr-lifecycle-daily-72h-expiry',
      {},
      {
        repeat: {
          pattern: '0 0 * * *',
        },
      }
    );
    logger.info('Scheduled repeatable NDR lifecycle reconciliation job (every 15 min) and daily 72h expiry (0 0 * * *)');
  } catch (err: any) {
    logger.error('Failed to schedule repeatable NDR lifecycle job', { error: err.message });
  }
};

