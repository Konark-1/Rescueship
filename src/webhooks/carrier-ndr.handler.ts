/**
 * carrier-ndr.handler.ts
 * ─────────────────────────────────────────────────────────────
 * One tenant-scoped NDR ingestion path shared by every carrier router.
 *
 * Invariants:
 *   - The merchant is fixed by authentication BEFORE any DB lookup.
 *   - Every Order lookup is scoped by { merchantId } — cross-tenant isolation.
 *   - Idempotency keys are namespaced by provider + merchant.
 *   - Terminal states (delivered, returned, cancelled, lost) strictly reject late failure events.
 *   - Unrecognized AWBs are cleanly routed to Shipment quarantine.
 */
import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { redisConnection } from '../config/redis';
import { Order, AuditLog, WebhookEvent, DeliveryAttempt, RescueLedger, Shipment } from '../models';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { authenticateCarrierWebhook, CarrierProvider } from './carrier-auth';
import { orderStateMachineService } from '../services/state-machine/order-state-machine.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

const ndrRescueQueue = new Queue('ndr-rescue', { connection: redisConnection as any });

export interface ParsedNdr {
  awb: string;
  externalOrderId: string;
  reason: string;
  phone?: string;
  status: string;
  /** false → acknowledged but not treated as a failed delivery */
  isNdr: boolean;
  /** Provider event id if the carrier supplies one */
  eventId?: string;
  attemptTime?: Date;
}

function str(v: unknown, max = 256): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '';
}

export function createCarrierNdrHandler(
  provider: CarrierProvider,
  platformSecret: () => string | undefined,
  parse: (req: Request) => ParsedNdr | { error: string }
) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = parse(req);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    if (!parsed.awb) {
      res.status(400).json({ error: 'Missing required field: AWB' });
      return;
    }

    const auth = await authenticateCarrierWebhook(req, provider, platformSecret());
    if (!auth.ok) {
      logger.warn(`${provider} webhook rejected`, { reason: auth.error, ip: req.ip });
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const merchantId: Types.ObjectId = auth.merchantId;

    const eventId = parsed.eventId || `${parsed.awb}_${parsed.status || 'ndr'}`;
    const idemKey = IdempotencyGuard.key(provider, merchantId.toString(), eventId);

    let claim;
    try {
      claim = await IdempotencyGuard.claim(idemKey);
    } catch (err) {
      if (err instanceof IdempotencyUnavailableError) {
        res.status(503).json({ error: 'Temporarily unavailable, retry later' });
        return;
      }
      throw err;
    }
    if (claim === 'duplicate') {
      logger.info(`Duplicate ${provider} webhook, skipping`, { merchantId, eventId });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    try {
      // 1. Durably record raw WebhookEvent
      try {
        await WebhookEvent.create({
          merchantId,
          source: (provider.toUpperCase() as any),
          topic: parsed.status,
          eventId,
          rawPayload: req.body,
          processed: true,
          duplicate: false,
          processedAt: new Date(),
        });
      } catch (logErr: any) {
        logger.warn('Failed to record WebhookEvent in carrier-ndr handler', { error: logErr?.message });
      }

      // Tenant-scoped order lookup: AWB first, then external order id.
      let order = await Order.findOne({ merchantId, awb: parsed.awb });
      if (!order && parsed.externalOrderId) {
        order = await Order.findOne({ merchantId, externalOrderId: parsed.externalOrderId });
      }

      // ─── 2. Shipment Registry Linking & Quarantine ───
      let shipment = await Shipment.findOne({ merchantId, awbNumber: parsed.awb });
      if (!shipment) {
        shipment = await Shipment.create({
          merchantId,
          orderId: order?._id || null,
          awbNumber: parsed.awb,
          carrier: provider,
          normalizedStatus: 'awb_generated',
          rawCarrierStatus: parsed.status,
          isQuarantined: !order,
          quarantineReason: !order ? 'UNKNOWN_AWB' : null,
          quarantinedAt: !order ? new Date() : null,
        });
        if (!order) {
          logger.warn(`Shipment AWB ${parsed.awb} not matched to any order — quarantined`, { merchantId, awb: parsed.awb });
        }
      } else {
        shipment.rawCarrierStatus = parsed.status;
        if (!shipment.orderId && order) {
          shipment.orderId = order._id;
          shipment.isQuarantined = false;
        }
        await shipment.save();
      }

      // ─── 3. Terminal State Rejection Guard ───
      if (order && orderStateMachineService.isTerminal(order.status)) {
        logger.info(`Rejecting carrier event: Order is already in terminal state '${order.status}'`, {
          merchantId,
          orderId: order._id,
          awb: parsed.awb,
          incomingStatus: parsed.status,
        });
        await AuditLog.create({
          merchantId,
          orderId: order._id,
          action: 'terminal_state_event_ignored',
          source: provider,
          payload: { incomingStatus: parsed.status, terminalStatus: order.status, awb: parsed.awb },
          status: 'success',
        });
        await IdempotencyGuard.markProcessed(idemKey);
        res.status(200).json({ status: 'ignored', reason: `Order is already terminal: ${order.status}` });
        return;
      }

      // ─── 4. Non-NDR Tracking Events (OUT_FOR_DELIVERY, DELIVERED, RTO, RETURNED, etc.) ───
      if (!parsed.isNdr) {
        logger.info(`${provider} tracking status update (non-NDR)`, { merchantId, awb: parsed.awb, status: parsed.status });
        if (order) {
          const normStatus = (parsed.status || '').toUpperCase();
          let targetStatus: string | null = null;

          if (normStatus === 'OUT_FOR_DELIVERY') {
            order.outForDeliveryAt = parsed.attemptTime || new Date();
            targetStatus = 'out_for_delivery';
          } else if (normStatus === 'DELIVERED') {
            targetStatus = 'delivered';
          } else if (normStatus.includes('RTO_INITIATED') || normStatus === 'RTO') {
            targetStatus = 'rto_initiated';
          } else if (normStatus === 'RETURNED') {
            targetStatus = 'returned';
          }

          if (targetStatus && targetStatus !== order.status) {
            await orderStateMachineService.transitionOrder(order, targetStatus, parsed.attemptTime || new Date());
          }

          // Trigger RTO Arrest if order transitioned to rto_initiated
          if (targetStatus === 'rto_initiated') {
            try {
              const { rtoArrestService } = require('../services/rto-arrest.service');
              await rtoArrestService.executeRtoArrest({
                merchantId: merchantId.toString(),
                orderId: order._id.toString(),
                awb: parsed.awb,
                reason: parsed.reason,
                carrier: provider,
              });
            } catch (arrestErr: any) {
              logger.error('Failed to trigger RTO Arrest flow', { error: arrestErr?.message, orderId: order._id });
            }
          }

          if (targetStatus === 'delivered') {
            await RescueLedger.reconcileOutcomes(merchantId.toString()).catch(() => {});
          }
        }

        await AuditLog.create({
          merchantId,
          orderId: order?._id || null,
          action: `tracking_${(parsed.status || 'unknown').toLowerCase()}`,
          source: provider,
          payload: { awb: parsed.awb, orderId: parsed.externalOrderId, status: parsed.status },
          status: 'success',
        });

        await IdempotencyGuard.markProcessed(idemKey);
        res.status(200).json({ status: 'success', message: `${provider} tracking updated`, currentStatus: parsed.status });
        return;
      }

      // ─── 5. Record DeliveryAttempt for Failed Delivery ───
      try {
        await DeliveryAttempt.create({
          merchantId,
          orderId: order?._id || null,
          awb: parsed.awb,
          status: parsed.status,
          remark: parsed.reason,
          attemptTime: parsed.attemptTime || new Date(),
          courierCode: provider,
          isFakeRemark: false,
          rawWebhook: req.body,
        });
      } catch (attemptErr: any) {
        logger.warn('Failed to record DeliveryAttempt', { error: attemptErr?.message });
      }

      // ─── 6. Queue for NDR Rescue ───
      await ndrRescueQueue.add(
        'ndr-rescue',
        {
          merchantId: merchantId.toString(),
          ndrData: {
            awb: parsed.awb,
            externalOrderId: parsed.externalOrderId || order?.externalOrderId || '',
            reason: parsed.reason,
            phone: parsed.phone,
            carrier: provider,
            attemptTime: parsed.attemptTime,
          },
        },
        {
          jobId: makeJobId('ndr', merchantId.toString(), provider, eventId),
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false, // DLQ: Keep failed jobs for inspection/replay
        }
      );

      await AuditLog.create({
        merchantId,
        orderId: order?._id || null,
        action: 'webhook_received',
        source: provider,
        payload: { awb: parsed.awb, orderId: parsed.externalOrderId, status: parsed.status, reason: parsed.reason },
        status: 'success',
      });

      await IdempotencyGuard.markProcessed(idemKey);
      res.status(200).json({ status: 'queued', message: `${provider} NDR registered` });
    } catch (err: any) {
      logger.error(`Failed to handle ${provider} webhook`, { merchantId, awb: parsed.awb, error: err.message });
      await IdempotencyGuard.release(idemKey);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  };
}

export { str as safeStr };
