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
import { Order, AuditLog } from '../models';
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
      if (!parsed.isNdr) {
        logger.info(`${provider} status update is not an NDR event, skipping`, { merchantId, awb: parsed.awb, status: parsed.status });
        res.status(200).json({ status: 'ignored', reason: 'not_failed_delivery' });
        return;
      }

      // Tenant-scoped order lookup: AWB first, then external order id.
      let order = await Order.findOne({ merchantId, awb: parsed.awb }).select('_id externalOrderId');
      if (!order && parsed.externalOrderId) {
        order = await Order.findOne({ merchantId, externalOrderId: parsed.externalOrderId }).select('_id externalOrderId');
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
