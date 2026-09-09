import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { Merchant, AuditLog } from '../models';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

router.post('/order-created', async (req: Request, res: Response): Promise<void> => {
  const merchantIdStr = typeof req.query.merchant_id === 'string' ? req.query.merchant_id : '';
  const authHeader = req.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  // Uniform 401 for missing/invalid/unknown merchant and bad token — no enumeration oracle.
  if (!merchantIdStr || !Types.ObjectId.isValid(merchantIdStr) || !token) {
    res.status(401).json({ error: 'Invalid API token' });
    return;
  }

  const merchant = await Merchant.findById(merchantIdStr).select('_id platformConfig.customApiSecret');
  if (!merchant) {
    res.status(401).json({ error: 'Invalid API token' });
    return;
  }

  // Per-merchant secret; fail closed if missing or undecryptable (never accept ciphertext as the token).
  let secret: string | undefined;
  if (merchant.platformConfig?.customApiSecret) {
    try {
      secret = encryptionService.decrypt(merchant.platformConfig.customApiSecret);
    } catch {
      logger.error('Custom API secret cannot be decrypted; merchant must regenerate it', { merchantId: merchantIdStr });
    }
  }
  if (!secret) {
    logger.warn('Custom API secret not configured for merchant', { merchantId: merchantIdStr });
    res.status(401).json({ error: 'Invalid API token' });
    return;
  }

  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    logger.warn('Custom API token verification failed', { merchantId: merchantIdStr });
    res.status(401).json({ error: 'Invalid API token' });
    return;
  }

  const body = req.body ?? {};
  const orderId = body.order_id;
  const total = typeof body.total === 'number' ? body.total : parseFloat(body.total);
  if (
    (typeof orderId !== 'string' && typeof orderId !== 'number') ||
    !Number.isFinite(total) || total <= 0 ||
    typeof body.payment_method !== 'string' ||
    typeof body.phone !== 'string' || !body.phone
  ) {
    res.status(400).json({ error: 'Invalid payload. Required fields: order_id, total, payment_method, phone' });
    return;
  }
  const externalOrderId = String(orderId).slice(0, 128);
  if (!/^[A-Za-z0-9_-]+$/.test(externalOrderId)) {
    res.status(400).json({ error: 'order_id may only contain letters, numbers, "-" and "_"' });
    return;
  }

  const eventId = req.get('X-Custom-Webhook-ID') || externalOrderId;
  const idemKey = IdempotencyGuard.key('custom', merchantIdStr, eventId);

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
    logger.info('Duplicate Custom webhook, skipping', { merchantId: merchantIdStr, eventId });
    res.status(200).json({ status: 'ignored', reason: 'duplicate' });
    return;
  }

  try {
    if (body.payment_method.toLowerCase() !== 'cod') {
      res.status(200).json({ status: 'ignored', reason: 'prepaid' });
      return;
    }

    await codConversionQueue.add(
      'convert-cod',
      {
        action: 'process_new_cod',
        merchantId: merchantIdStr,
        orderData: {
          externalOrderId,
          platform: 'custom',
          customerPhone: body.phone,
          customerName: typeof body.customer_name === 'string' ? body.customer_name.slice(0, 120) : 'Customer',
          orderValue: total,
          paymentMethod: 'cod',
        },
      },
      {
        jobId: makeJobId('cod', merchantIdStr, 'custom', externalOrderId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await AuditLog.create({
      merchantId: merchant._id,
      action: 'webhook_received',
      source: 'custom',
      payload: { eventId, orderId: externalOrderId, total },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(idemKey);
    res.status(200).json({ status: 'queued', message: 'Custom webhook queued successfully' });
  } catch (err: any) {
    logger.error('Failed to handle Custom webhook', { merchantId: merchantIdStr, eventId, error: err.message });
    await IdempotencyGuard.release(idemKey);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
