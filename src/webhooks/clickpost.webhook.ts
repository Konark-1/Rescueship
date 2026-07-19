import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
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

  // Filter for NDR-relevant events (e.g. failed attempt)
  const isFailedAttempt = status.includes('failed') || 
                         status.includes('undelivered') || 
                         status.includes('ndr') || 
                         body.is_failed_attempt === true;

  if (!isFailedAttempt) {
    logger.info('ClickPost status updated but not failed delivery, skipping', { awb, status });
    res.status(200).json({ status: 'ignored', reason: 'not_failed_delivery' });
    return;
  }

  const webhookId = `clickpost_${awb}_${Date.now()}`;
  logger.info('Received ClickPost NDR webhook', { awb, externalOrderId });

  if (!awb) {
    res.status(400).json({ error: 'Missing waybill/awb in payload' });
    return;
  }

  try {
    const isProcessed = await IdempotencyGuard.isProcessed(awb);
    if (isProcessed) {
      logger.info('Duplicate ClickPost webhook, skipping', { awb });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    let merchantIdStr = req.query.merchant_id as string;
    let order = await Order.findOne({ awb });
    if (!order && externalOrderId) {
      order = await Order.findOne({ externalOrderId });
    }

    const merchantId = merchantIdStr ? new Types.ObjectId(merchantIdStr) : order?.merchantId;

    if (!merchantId) {
      logger.warn('Could not associate ClickPost NDR with any merchant, skipping', { awb, externalOrderId });
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

    await IdempotencyGuard.markProcessed(awb);

    res.status(200).json({ status: 'queued', message: 'ClickPost NDR registered' });
  } catch (err: any) {
    logger.error('Failed to handle ClickPost webhook', { awb, error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
