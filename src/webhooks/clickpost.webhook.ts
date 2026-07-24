import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { Order, AuditLog } from '../models';
import { IdempotencyGuard } from '../utils/idempotency';
import { logger } from '../utils/logger';

const router = Router();
const ndrRescueQueue = new Queue('ndr-rescue', { connection: redisConnection as any });

router.post('/ndr', async (req: Request, res: Response): Promise<void> => {
  const body = req.body;
  
  // ClickPost typical webhook fields
  const awb = body.waybill || body.awb;
  const externalOrderId = body.order_id ? body.order_id.toString() : '';
  const reason = body.remarks || body.reason || 'Failed Delivery Attempt';
  const phone = body.customer_phone || body.phone;
  const status = (body.status || '').toLowerCase();
  const signature = req.get('x-clickpost-signature') || req.get('x-api-key') || req.get('authorization');

  if (!awb) {
    res.status(400).json({ error: 'Missing waybill/awb in payload' });
    return;
  }

  // Signature verification
  const secret = process.env.CLICKPOST_WEBHOOK_SECRET;
  if (secret) {
    if (!signature) {
      logger.warn('ClickPost webhook missing signature header');
      res.status(401).json({ error: 'Missing ClickPost signature header' });
      return;
    }
    const rawBody = (req as any).rawBody;
    if (req.get('x-clickpost-signature') && rawBody) {
      const computedHmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      const computedBuf = Buffer.from(computedHmac, 'hex');
      const sigBuf = Buffer.from(signature, 'hex');
      if (computedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(computedBuf, sigBuf)) {
        logger.warn('ClickPost signature verification failed');
        res.status(401).json({ error: 'Invalid ClickPost signature' });
        return;
      }
    } else {
      const cleanSig = signature.replace(/^Bearer\s+/i, '');
      const secretBuf = Buffer.from(secret);
      const sigBuf = Buffer.from(cleanSig);
      if (secretBuf.length !== sigBuf.length || !crypto.timingSafeEqual(secretBuf, sigBuf)) {
        logger.warn('ClickPost token verification failed');
        res.status(401).json({ error: 'Invalid ClickPost signature' });
        return;
      }
    }
  }

  const webhookId = req.get('x-clickpost-event-id') || req.get('x-event-id') || `clickpost_${awb}_${status || 'ndr'}`;

  try {
    const isProcessed = await IdempotencyGuard.isProcessed(webhookId);
    if (isProcessed) {
      logger.info('Duplicate ClickPost webhook, skipping', { webhookId });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    // Filter for NDR-relevant events (e.g. failed attempt)
    const isFailedAttempt = status.includes('failed') || 
                           status.includes('undelivered') || 
                           status.includes('ndr') || 
                           body.is_failed_attempt === true;

    if (!isFailedAttempt) {
      logger.info('ClickPost status updated but not failed delivery, skipping', { awb, status });
      await IdempotencyGuard.markProcessed(webhookId);
      res.status(200).json({ status: 'ignored', reason: 'not_failed_delivery' });
      return;
    }

    logger.info('Received ClickPost NDR webhook', { awb, externalOrderId, webhookId });

    let merchantIdStr = req.query.merchant_id as string;
    let order = await Order.findOne({ awb });
    if (!order && externalOrderId) {
      order = await Order.findOne({ externalOrderId });
    }

    const merchantId = merchantIdStr ? new Types.ObjectId(merchantIdStr) : order?.merchantId;

    if (!merchantId) {
      logger.warn('Could not associate ClickPost NDR with any merchant, skipping', { awb, externalOrderId });
      await IdempotencyGuard.markProcessed(webhookId);
      res.status(200).json({ status: 'ignored', reason: 'unknown_merchant' });
      return;
    }

    await ndrRescueQueue.add(
      'ndr-rescue',
      {
        merchantId: merchantId.toString(),
        ndrData: {
          awb,
          externalOrderId: externalOrderId || order?.externalOrderId || '',
          reason,
          phone,
          carrier: 'clickpost',
        },
      },
      {
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
      source: 'clickpost',
      payload: { awb, status, reason },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(webhookId);

    res.status(200).json({ status: 'queued', message: 'ClickPost NDR registered' });
  } catch (err: any) {
    logger.error('Failed to handle ClickPost webhook', { awb, error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
