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

router.post(['/', '/order-created'], async (req: Request, res: Response): Promise<void> => {
  const merchantIdStr = typeof req.query.merchant_id === 'string' ? req.query.merchant_id : '';
  const signature = req.get('X-WC-Webhook-Signature');
  const rawBody: Buffer | undefined = (req as any).rawBody;

  // Uniform 401 for missing/invalid/unknown merchant — no enumeration oracle.
  if (!merchantIdStr || !Types.ObjectId.isValid(merchantIdStr) || !signature || !rawBody) {
    res.status(401).json({ error: 'Invalid WooCommerce signature' });
    return;
  }

  const merchant = await Merchant.findById(merchantIdStr).select('_id platformConfig.woocommerceSecret platformConfig.woocommerceWebhookSecret');
  if (!merchant) {
    res.status(401).json({ error: 'Invalid WooCommerce signature' });
    return;
  }

  // Per-merchant webhook HMAC secret. Prefer the dedicated webhook secret (set by the
  // connect flow); fall back to the consumer secret for legacy manual setups.
  const pc = merchant.platformConfig || {};
  const secretCipher = pc.woocommerceWebhookSecret || pc.woocommerceSecret;
  let secret: string | undefined;
  if (secretCipher) {
    try {
      secret = encryptionService.decrypt(secretCipher);
    } catch {
      logger.error('WooCommerce secret cannot be decrypted; merchant must re-save platform settings', { merchantId: merchantIdStr });
    }
  }
  if (!secret) {
    logger.warn('WooCommerce webhook secret not configured for merchant — rejecting webhook', { merchantId: merchantIdStr });
    res.status(401).json({ error: 'Invalid WooCommerce signature' });
    return;
  }

  const computed = Buffer.from(crypto.createHmac('sha256', secret).update(rawBody).digest('base64'), 'base64');
  const presented = Buffer.from(signature, 'base64');
  if (computed.length !== presented.length || presented.length === 0 || !crypto.timingSafeEqual(computed, presented)) {
    logger.warn('WooCommerce signature verification failed', { merchantId: merchantIdStr });
    res.status(401).json({ error: 'Invalid WooCommerce signature' });
    return;
  }

  const body = req.body ?? {};
  // X-WC-Webhook-ID identifies the webhook *configuration* (constant); the per-delivery
  // id is X-WC-Webhook-Delivery-ID. Fall back to resource + order id.
  const deliveryId = req.get('X-WC-Webhook-Delivery-ID');
  const eventId = deliveryId || `${req.get('X-WC-Webhook-Topic') || 'order.created'}_${body.id ?? 'unknown'}`;
  const idemKey = IdempotencyGuard.key('woocommerce', merchantIdStr, eventId);

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
    logger.info('Duplicate WooCommerce webhook, skipping', { merchantId: merchantIdStr, eventId });
    res.status(200).json({ status: 'ignored', reason: 'duplicate' });
    return;
  }

  try {
    const isCOD = String(body.payment_method || '').toLowerCase() === 'cod';
    if (!isCOD) {
      res.status(200).json({ status: 'ignored', reason: 'prepaid' });
      return;
    }

    const phone = body.billing?.phone;
    if (!phone || typeof phone !== 'string') {
      res.status(200).json({ status: 'ignored', reason: 'no_phone' });
      return;
    }

    const orderValue = parseFloat(body.total);
    if (!Number.isFinite(orderValue) || orderValue <= 0 || body.id === undefined || body.id === null) {
      res.status(200).json({ status: 'ignored', reason: 'invalid_order' });
      return;
    }
    const externalOrderId = String(body.id);

    await codConversionQueue.add(
      'convert-cod',
      {
        action: 'process_new_cod',
        merchantId: merchantIdStr,
        orderData: {
          externalOrderId,
          platform: 'woocommerce',
          customerPhone: phone,
          customerName: `${body.billing?.first_name || ''} ${body.billing?.last_name || ''}`.trim() || 'Customer',
          orderValue,
          paymentMethod: 'cod',
        },
      },
      {
        jobId: makeJobId('cod', merchantIdStr, 'woocommerce', externalOrderId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await AuditLog.create({
      merchantId: merchant._id,
      action: 'webhook_received',
      source: 'woocommerce',
      payload: { eventId, orderId: body.id, total: body.total },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(idemKey);
    res.status(200).json({ status: 'queued', message: 'WooCommerce webhook queued' });
  } catch (err: any) {
    logger.error('Failed to handle WooCommerce webhook', { merchantId: merchantIdStr, eventId, error: err.message });
    await IdempotencyGuard.release(idemKey);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
