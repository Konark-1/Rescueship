import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { paymentService } from '../services/payment.service';
import { config } from '../config/env';
import { IdempotencyGuard } from '../utils/idempotency';
import { logger } from '../utils/logger';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

router.post('/payment', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('X-Razorpay-Signature');
  const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : '';

  logger.info('Received Razorpay webhook payment event');

  // Verify Signature
  if (config.razorpay.webhookSecret && signature && rawBody) {
    const isValid = paymentService.verifyRazorpayWebhook(rawBody, signature, config.razorpay.webhookSecret);
    if (!isValid) {
      logger.warn('Razorpay webhook signature verification failed');
      res.status(401).json({ error: 'Invalid Razorpay signature' });
      return;
    }
  }

  try {
    const body = req.body;
    const event = body.event;

    // Check if it is a payment link completion event
    if (event === 'payment_link.paid') {
      const paymentLinkEntity = body.payload?.payment_link?.entity;
      const paymentLinkId = paymentLinkEntity?.id;
      
      if (!paymentLinkId) {
        res.status(400).json({ error: 'Missing payment_link_id in payload' });
        return;
      }

      // Check Idempotency
      const eventId = body.created_at ? `razorpay_${paymentLinkId}_${body.created_at}` : `razorpay_${paymentLinkId}`;
      const isProcessed = await IdempotencyGuard.isProcessed(eventId);
      if (isProcessed) {
        logger.info('Duplicate Razorpay webhook, skipping', { paymentLinkId });
        res.status(200).json({ status: 'ignored', reason: 'duplicate' });
        return;
      }

      // Add payment confirmation job to queue
      await codConversionQueue.add(
        'confirm-payment',
        {
          action: 'payment_confirmed',
          paymentLinkId,
          provider: 'razorpay',
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

      await IdempotencyGuard.markProcessed(eventId);
      logger.info('Razorpay payment link paid event queued', { paymentLinkId });
    }

    res.status(200).json({ status: 'received' });
  } catch (err: any) {
    logger.error('Failed to handle Razorpay webhook', { error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
