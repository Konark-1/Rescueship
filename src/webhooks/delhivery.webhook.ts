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

  // Delhivery typical webhook payload has waybill and status information
  const awb = body.waybill || body.awb;
  const status = (body.status || '').toLowerCase();
  const remarks = body.remarks || body.reason || 'Undelivered';
  const phone = body.phone || body.customer_phone;
  const externalOrderId = body.ref_id || body.order_id || '';

  // Check if status represents a failed attempt / NDR (Delhivery uses codes like "ud", "undelivered", "failed")
  const isNDR = status.includes('ud') || 
                status.includes('undelivered') || 
                status.includes('failed') || 
                remarks.toLowerCase().includes('not delivered');

  if (!isNDR) {
    logger.info('Delhivery status update is not an NDR event, skipping', { awb, status });
    res.status(200).json({ status: 'ignored', reason: 'not_failed_delivery' });
    return;
  }

  const webhookId = `delhivery_${awb}_${Date.now()}`;
  logger.info('Received Delhivery NDR webhook', { awb, status });

  if (!awb) {
    res.status(400).json({ error: 'Missing waybill in payload' });
    return;
  }

  try {
    const isProcessed = await IdempotencyGuard.isProcessed(awb);
    if (isProcessed) {
      logger.info('Duplicate Delhivery webhook, skipping', { awb });
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
      logger.warn('Could not associate Delhivery NDR with any merchant, skipping', { awb });
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
          reason: remarks,
          phone,
          carrier: 'delhivery',
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
      source: 'delhivery',
      payload: { awb, status, remarks },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(awb);

    res.status(200).json({ status: 'queued', message: 'Delhivery NDR registered' });
  } catch (err: any) {
    logger.error('Failed to handle Delhivery webhook', { awb, error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
