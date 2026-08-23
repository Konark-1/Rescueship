import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { Order, AuditLog, Merchant } from '../models';
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
  const signature = req.get('x-delhivery-signature') || req.get('x-api-key') || req.get('authorization');

  if (!awb) {
    res.status(400).json({ error: 'Missing waybill in payload' });
    return;
  }

  // Signature verification — no bypass in any environment
  const secret = process.env.DELHIVERY_WEBHOOK_SECRET;
  if (secret) {
    if (!signature) {
      logger.warn('Delhivery webhook missing signature header');
      res.status(401).json({ error: 'Missing Delhivery signature header' });
      return;
    }
    const rawBody = (req as any).rawBody;
    if (req.get('x-delhivery-signature') && rawBody) {
      const computedHmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      const computedBuf = Buffer.from(computedHmac, 'hex');
      const sigBuf = Buffer.from(signature, 'hex');
      if (computedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(computedBuf, sigBuf)) {
        logger.warn('Delhivery signature verification failed');
        res.status(401).json({ error: 'Invalid Delhivery signature' });
        return;
      }
    } else {
      const cleanSig = signature.replace(/^Bearer\s+/i, '');
      const secretBuf = Buffer.from(secret);
      const sigBuf = Buffer.from(cleanSig);
      if (secretBuf.length !== sigBuf.length || !crypto.timingSafeEqual(secretBuf, sigBuf)) {
        logger.warn('Delhivery token verification failed');
        res.status(401).json({ error: 'Invalid Delhivery signature' });
        return;
      }
    }
  }

  const webhookId = req.get('x-delhivery-event-id') || req.get('x-event-id') || `delhivery_${awb}_${status || 'ndr'}`;

  try {
    const isProcessed = await IdempotencyGuard.isProcessed(webhookId);
    if (isProcessed) {
      logger.info('Duplicate Delhivery webhook, skipping', { webhookId });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    // Check if status represents a failed attempt / NDR
    const isNDR = status.includes('ud') || 
                  status.includes('undelivered') || 
                  status.includes('failed') || 
                  remarks.toLowerCase().includes('not delivered') ||
                  remarks.toLowerCase().includes('address not found');

    if (!isNDR) {
      logger.info('Delhivery status update is not an NDR event, skipping', { awb, status });
      await IdempotencyGuard.markProcessed(webhookId);
      res.status(200).json({ status: 'ignored', reason: 'not_failed_delivery' });
      return;
    }

    logger.info('Received Delhivery NDR webhook', { awb, status, webhookId });

    let merchantIdStr = req.query.merchant_id as string;
    let order = await Order.findOne({ awb });
    if (!order && externalOrderId) {
      order = await Order.findOne({ externalOrderId });
    }

    let merchantId = merchantIdStr ? new Types.ObjectId(merchantIdStr) : order?.merchantId;
    if (!merchantId && process.env.NODE_ENV === 'development') {
      const devMerchant = await Merchant.findOne();
      merchantId = devMerchant?._id;
    }

    if (!merchantId) {
      logger.warn('Could not associate Delhivery NDR with any merchant, skipping', { awb });
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

    await IdempotencyGuard.markProcessed(webhookId);

    res.status(200).json({ status: 'queued', message: 'Delhivery NDR registered' });
  } catch (err: any) {
    logger.error('Failed to handle Delhivery webhook', { awb, error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
