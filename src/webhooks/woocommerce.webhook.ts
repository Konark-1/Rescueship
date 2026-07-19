import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { Merchant, AuditLog } from '../models';
import { IdempotencyGuard } from '../utils/idempotency';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

router.post('/order-created', async (req: Request, res: Response): Promise<void> => {
  const webhookId = req.get('X-WC-Webhook-ID') || `wc_${req.body.id}_${Date.now()}`;
  const merchantIdStr = req.query.merchant_id as string;
  const signature = req.get('X-WC-Webhook-Signature');

  logger.info('Received WooCommerce order-created webhook', { webhookId, merchantId: merchantIdStr });

  if (!merchantIdStr) {
    res.status(400).json({ error: 'Missing merchant_id in query parameters' });
    return;
  }

  try {
    const merchant = await Merchant.findById(merchantIdStr);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    // Dynamic signature verification
    let secret: string | undefined;
    try {
      if (merchant.platformConfig?.woocommerceSecret) {
        secret = encryptionService.decrypt(merchant.platformConfig.woocommerceSecret);
      }
    } catch (decErr) {
      secret = merchant.platformConfig?.woocommerceSecret;
    }

    if (secret && signature && (req as any).rawBody) {
      const computedHmac = crypto
        .createHmac('sha256', secret)
        .update((req as any).rawBody)
        .digest('base64');

      const computedBuffer = Buffer.from(computedHmac, 'base64');
      const headerBuffer = Buffer.from(signature, 'base64');

      if (computedBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(computedBuffer, headerBuffer)) {
        logger.warn('WooCommerce signature verification failed', { merchantId: merchantIdStr });
        res.status(401).json({ error: 'Invalid WooCommerce signature' });
        return;
      }
    }

    // Check Idempotency
    const isProcessed = await IdempotencyGuard.isProcessed(webhookId);
    if (isProcessed) {
      logger.info('Duplicate WooCommerce webhook, skipping', { webhookId });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    const body = req.body;
    const isCOD = (body.payment_method || '').toLowerCase() === 'cod';

    if (!isCOD) {
      logger.info('WooCommerce order is prepaid, skipping conversion', { orderId: body.id });
      await IdempotencyGuard.markProcessed(webhookId);
      res.status(200).json({ status: 'ignored', reason: 'prepaid' });
      return;
    }

    const phone = body.billing?.phone;
    if (!phone) {
      logger.info('WooCommerce order lacks phone number, skipping', { orderId: body.id });
      await IdempotencyGuard.markProcessed(webhookId);
      res.status(200).json({ status: 'ignored', reason: 'no_phone' });
      return;
    }

    // Add to BullMQ queue
    await codConversionQueue.add(
      'convert-cod',
      {
        action: 'process_new_cod',
        merchantId: merchantIdStr,
        orderData: {
          externalOrderId: body.id.toString(),
          platform: 'woocommerce',
          customerPhone: phone,
          customerName: `${body.billing?.first_name || ''} ${body.billing?.last_name || ''}`.trim() || 'Customer',
          orderValue: parseFloat(body.total),
          paymentMethod: 'cod',
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    // Record Audit
    await AuditLog.create({
      merchantId: merchant._id,
      action: 'webhook_received',
      source: 'woocommerce',
      payload: { webhookId, orderId: body.id, total: body.total },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(webhookId);

    res.status(200).json({ status: 'queued', message: 'WooCommerce webhook queued' });
  } catch (err: any) {
    logger.error('Failed to handle WooCommerce webhook', { webhookId, error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
