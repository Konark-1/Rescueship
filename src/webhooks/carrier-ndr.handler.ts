/**
 * carrier-ndr.handler.ts
 * ─────────────────────────────────────────────────────────────
 * One tenant-scoped NDR ingestion path shared by every carrier router.
 *
 * Invariants:
 *   - The merchant is fixed by authentication BEFORE any DB lookup.
 *   - Every Order lookup is scoped by { merchantId } — an AWB or external
 *     order ID belonging to another tenant can never be matched.
 *   - Idempotency keys are namespaced by provider + merchant.
 *   - Redis outage → 503 (never a silent 200 ack).
 *   - No environment-specific "first merchant" or fake-phone fallbacks.
 */
import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { redisConnection } from '../config/redis';
import { Order, AuditLog, WebhookEvent, DeliveryAttempt, RescueLedger } from '../models';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { authenticateCarrierWebhook, CarrierProvider } from './carrier-auth';
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

      // Handle non-NDR tracking events (OUT_FOR_DELIVERY, DELIVERED, RTO, RETURNED, etc.)
      if (!parsed.isNdr) {
        logger.info(`${provider} tracking status update (non-NDR)`, { merchantId, awb: parsed.awb, status: parsed.status });
        if (order) {
          const normStatus = (parsed.status || '').toUpperCase();
          if (normStatus === 'OUT_FOR_DELIVERY') {
            order.outForDeliveryAt = parsed.attemptTime || new Date();
            if (['new', 'shipped'].includes(order.status)) {
              order.status = 'out_for_delivery';
            }
            await order.save();
          } else if (normStatus === 'DELIVERED') {
            order.status = 'delivered';
            if (order.ndr) {
              order.ndr.resolvedAt = new Date();
              order.ndr.resolution = 'rescheduled';
            }
            await order.save();
            await RescueLedger.reconcileOutcomes(merchantId.toString()).catch(() => {});
          } else if (normStatus.includes('RTO_INITIATED') || normStatus === 'RTO') {
            order.status = 'rto_initiated';
            if (order.ndr) {
              order.ndr.resolvedAt = new Date();
              order.ndr.resolution = 'cancelled';
            }
            await order.save();
          } else if (normStatus === 'RETURNED') {
            order.status = 'returned';
            await order.save();
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

      // Record DeliveryAttempt for failed delivery attempt
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
          removeOnFail: true,
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
