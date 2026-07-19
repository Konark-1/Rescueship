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
  const signature = req.get('x-webhook-signature');
  const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : '';

  logger.info('Received Cashfree webhook payment event');

  if (config.cashfree.clientSecret && signature && rawBody) {
    const isValid = paymentService.verifyCashfreeWebhook(rawBody, signature, config.cashfree.clientSecret);
    if (!isValid) {
      logger.warn('Cashfree webhook signature verification failed');
      res.status(401).json({ error: 'Invalid Cashfree signature' });
      return;
    }
  }

  try {
    const body = req.body;
    const type = body.type; // Cashfree uses type e.g., 'LINK_PAID' or 'payment.success'
    
    if (type === 'LINK_PAID' || type === 'payment.success' || body.event === 'LINK_PAID') {
      const linkId = body.data?.link_id || body.link_id;
      if (!linkId) {
        res.status(400).json({ error: 'Missing link_id in Cashfree payload' });
        return;
      }

      const eventId = `cashfree_${linkId}_${body.event_time || Date.now()}`;
      const isProcessed = await IdempotencyGuard.isProcessed(eventId);
      if (isProcessed) {
        logger.info('Duplicate Cashfree webhook, skipping', { linkId });
        res.status(200).json({ status: 'ignored', reason: 'duplicate' });
        return;
      }

      await codConversionQueue.add(
        'confirm-payment',
        {
          action: 'payment_confirmed',
          paymentLinkId: linkId,
          provider: 'cashfree',
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

      await IdempotencyGuard.markProcessed(eventId);
      logger.info('Cashfree payment link paid event queued', { linkId });
    }

    res.status(200).json({ status: 'received' });
  } catch (err: any) {
    logger.error('Failed to handle Cashfree webhook', { error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
