import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { Order, AuditLog } from '../models';
import { IdempotencyGuard } from '../utils/idempotency';
import { config } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();
const ndrRescueQueue = new Queue('ndr-rescue', { connection: redisConnection as any });

router.post('/ndr', async (req: Request, res: Response): Promise<void> => {
  const body = req.body;
  const awb = body.awb;
  const externalOrderId = body.order_id ? body.order_id.toString() : '';
  const reason = body.ndr_reason || body.reason || 'Customer Unavailable';
  const phone = body.customer_phone || body.phone;
  const signature = req.get('x-api-key') || req.get('x-shiprocket-signature') || req.get('x-shiprocket-token');

  if (!awb || !externalOrderId) {
    res.status(400).json({ error: 'Missing awb or order_id in payload' });
    return;
  }

  // Signature verification — MANDATORY
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET || config.shiprocket.password;
  if (secret) {
    if (!signature) {
      logger.warn('Shiprocket webhook missing signature header');
      res.status(401).json({ error: 'Missing Shiprocket signature header' });
      return;
    }
    const rawBody = (req as any).rawBody;
    if (req.get('x-shiprocket-signature') && rawBody) {
      const computedHmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      const computedBuf = Buffer.from(computedHmac, 'hex');
      const sigBuf = Buffer.from(signature, 'hex');
      if (computedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(computedBuf, sigBuf)) {
        logger.warn('Shiprocket signature verification failed');
        res.status(401).json({ error: 'Invalid Shiprocket signature' });
        return;
      }
    } else {
      const secretBuf = Buffer.from(secret);
      const sigBuf = Buffer.from(signature);
      if (secretBuf.length !== sigBuf.length || !crypto.timingSafeEqual(secretBuf, sigBuf)) {
        logger.warn('Shiprocket token verification failed');
        res.status(401).json({ error: 'Invalid Shiprocket signature' });
        return;
      }
    }
  } else {
    logger.warn('Shiprocket webhook secret not configured — rejecting webhook. Set SHIPROCKET_WEBHOOK_SECRET.');
    res.status(401).json({ error: 'Shiprocket webhook secret not configured' });
    return;
  }

  const webhookId = req.get('x-shiprocket-event-id') || req.get('x-event-id') || `shiprocket_${awb}_${body.current_status_id || body.order_id || 'ndr'}`;
  logger.info('Received Shiprocket NDR webhook', { awb, externalOrderId, reason, webhookId });

  try {
    // Check Idempotency
    const isProcessed = await IdempotencyGuard.isProcessed(webhookId);
    if (isProcessed) {
      logger.info('Duplicate Shiprocket NDR, skipping', { webhookId });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    // Look up merchant ID by matching the order in our system
    let merchantIdStr = req.query.merchant_id as string;
    let order = await Order.findOne({ awb });
    if (!order && externalOrderId) {
      order = await Order.findOne({ externalOrderId });
    }

    const merchantId = merchantIdStr ? new Types.ObjectId(merchantIdStr) : order?.merchantId;

    if (!merchantId) {
      logger.warn('Could not associate Shiprocket NDR with any merchant, skipping', { awb, externalOrderId });
      await IdempotencyGuard.markProcessed(webhookId);
      res.status(200).json({ status: 'ignored', reason: 'unknown_merchant' });
      return;
    }

    // Queue job
    await ndrRescueQueue.add(
      'ndr-rescue',
      {
        merchantId: merchantId.toString(),
        ndrData: {
          awb,
          externalOrderId,
          reason,
          phone,
          carrier: 'shiprocket',
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
      merchantId,
      orderId: order?._id || null,
      action: 'webhook_received',
      source: 'shiprocket',
      payload: { awb, orderId: externalOrderId, reason },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(webhookId);

    res.status(200).json({ status: 'queued', message: 'Shiprocket NDR registered' });
  } catch (err: any) {
    logger.error('Failed to handle Shiprocket webhook', { awb, error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
