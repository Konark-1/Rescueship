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
  const awb = body.awb;
  const externalOrderId = body.order_id ? body.order_id.toString() : '';
  const reason = body.ndr_reason || body.reason || 'Customer Unavailable';
  const phone = body.customer_phone || body.phone;

  const webhookId = `shiprocket_${awb}_${Date.now()}`;
  logger.info('Received Shiprocket NDR webhook', { awb, externalOrderId, reason });

  if (!awb || !externalOrderId) {
    res.status(400).json({ error: 'Missing awb or order_id in payload' });
    return;
  }

  try {
    // Check Idempotency
    const isProcessed = await IdempotencyGuard.isProcessed(awb); // Use AWB as idempotency key to prevent repeat messages for same NDR trigger
    if (isProcessed) {
      logger.info('Duplicate Shiprocket NDR, skipping', { awb });
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

    await IdempotencyGuard.markProcessed(awb);

    res.status(200).json({ status: 'queued', message: 'Shiprocket NDR registered' });
  } catch (err: any) {
    logger.error('Failed to handle Shiprocket webhook', { awb, error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
