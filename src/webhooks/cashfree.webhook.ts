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

  // Verify Signature — MANDATORY when clientSecret is configured
  if (config.cashfree.clientSecret) {
    if (!signature || !rawBody) {
      logger.warn('Cashfree webhook missing signature or raw body');
      res.status(401).json({ error: 'Missing Cashfree signature header' });
      return;
    }
    const isValid = paymentService.verifyCashfreeWebhook(rawBody, signature, config.cashfree.clientSecret);
    if (!isValid) {
      logger.warn('Cashfree webhook signature verification failed');
      res.status(401).json({ error: 'Invalid Cashfree signature' });
      return;
    }
  } else {
    logger.warn('Cashfree clientSecret not configured — rejecting webhook. Set CASHFREE_CLIENT_SECRET.');
    res.status(401).json({ error: 'Cashfree webhook secret not configured' });
    return;
  }

  try {
    const body = req.body;
    const type = body.type; // Cashfree uses type e.g., 'LINK_PAID' or 'payment.success'
    const linkId = body.data?.link_id || body.link_id || body.data?.order?.order_id || body.order_id;
    const webhookId = req.get('x-webhook-id') || (linkId ? `cashfree_${linkId}` : `cashfree_${Date.now()}`);

    const isProcessed = await IdempotencyGuard.isProcessed(webhookId);
    if (isProcessed) {
      logger.info('Duplicate Cashfree webhook, skipping', { webhookId });
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }

    if (type === 'LINK_PAID' || type === 'payment.success' || body.event === 'LINK_PAID') {
      if (!linkId) {
        await IdempotencyGuard.markProcessed(webhookId);
        res.status(400).json({ error: 'Missing link_id in Cashfree payload' });
        return;
      }

      const rawAmount = body.data?.payment?.payment_amount || body.data?.order?.order_amount || body.link_amount || body.data?.link_amount;
      const amountPaidPaise = rawAmount ? Math.round(rawAmount * 100) : undefined;

      await codConversionQueue.add(
        'confirm-payment',
        {
          action: 'payment_confirmed',
          paymentLinkId: linkId,
          provider: 'cashfree',
          amountPaidPaise,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

      logger.info('Cashfree payment link paid event queued', { linkId, webhookId });
    }

    await IdempotencyGuard.markProcessed(webhookId);
    res.status(200).json({ status: 'received' });
  } catch (err: any) {
    logger.error('Failed to handle Cashfree webhook', { error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
