import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant, AuditLog } from '../models';
import { IdempotencyGuard } from '../utils/idempotency';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

router.post('/order-created', async (req: Request, res: Response): Promise<void> => {
  const merchantIdStr = req.query.merchant_id as string;
  const authHeader = req.get('Authorization');

  logger.info('Received Custom order-created webhook', { merchantId: merchantIdStr });

  if (!merchantIdStr) {
    res.status(400).json({ error: 'Missing merchant_id in query parameters' });
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Expected format: Bearer <token>' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const merchant = await Merchant.findById(merchantIdStr);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    // Verify Bearer token against customApiSecret
    let secret: string | undefined;
    try {
      if (merchant.platformConfig?.customApiSecret) {
        secret = encryptionService.decrypt(merchant.platformConfig.customApiSecret);
      }
    } catch (decErr) {
      secret = merchant.platformConfig?.customApiSecret;
    }

    if (!secret || token !== secret) {
      logger.warn('Custom API token verification failed', { merchantId: merchantIdStr });
      res.status(401).json({ error: 'Invalid API token' });
      return;
    }

    const body = req.body;
    
    // Validate required fields for the custom payload
    if (!body.order_id || !body.total || !body.payment_method || !body.phone) {
      res.status(400).json({ error: 'Invalid payload. Required fields: order_id, total, payment_method, phone' });
      return;
    }

    const webhookId = `custom_${body.order_id}_${Date.now()}`;

    // Check Idempotency
    const isProcessed = await IdempotencyGuard.isProcessed(webhookId);
    if (isProcessed) {
      logger.info('Duplicate Custom webhook, skipping', { webhookId });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    const isCOD = body.payment_method.toLowerCase() === 'cod';

    if (!isCOD) {
      logger.info('Custom order is prepaid, skipping conversion', { orderId: body.order_id });
      await IdempotencyGuard.markProcessed(webhookId);
      res.status(200).json({ status: 'ignored', reason: 'prepaid' });
      return;
    }

    // Add to BullMQ queue
    await codConversionQueue.add(
      'convert-cod',
      {
        action: 'process_new_cod',
        merchantId: merchantIdStr,
        orderData: {
          externalOrderId: body.order_id.toString(),
          platform: 'custom',
          customerPhone: body.phone,
          customerName: body.customer_name || 'Customer',
          orderValue: parseFloat(body.total),
          paymentMethod: 'cod',
        },
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    // Record Audit
    await AuditLog.create({
      merchantId: merchant._id,
      action: 'webhook_received',
      source: 'custom',
      payload: { webhookId, orderId: body.order_id, total: body.total },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(webhookId);

    res.status(200).json({ status: 'queued', message: 'Custom webhook queued successfully' });
  } catch (err: any) {
    logger.error('Failed to handle Custom webhook', { error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
