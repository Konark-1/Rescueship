import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { paymentService } from '../services/payment.service';
import { config } from '../config/env';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { Order } from '../models';
import { encryptionService } from '../services/encryption.service';
import { subscriptionService } from '../services/subscription.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

function str(v: unknown, max = 128): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;
}

/**
 * POST /webhooks/razorpay/payment
 *
 * Two families of events arrive here:
 *   - payment_link.paid  → COD conversion for a merchant's customer. The link
 *     was created with the MERCHANT's Razorpay account, so their webhook secret
 *     (== their key secret unless they configured a dedicated one) signs it.
 *   - subscription.* / payment.captured / payment.failed → RescueShip's own
 *     billing, signed with the platform webhook secret. The merchant is resolved
 *     from the subscription/order id we stored at checkout, never from `notes`.
 *
 * Plan provisioning NEVER happens here: the intro payment is provisioned through
 * the authenticated /billing/checkout/verify path bound to the pending intent.
 */
router.post('/payment', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('X-Razorpay-Signature');
  const rawBuf: Buffer | undefined = (req as any).rawBody;
  const rawBody = rawBuf ? rawBuf.toString('utf8') : '';
  const eventHeaderId = req.get('x-razorpay-event-id');

  if (!signature || !rawBody) {
    res.status(401).json({ error: 'Missing X-Razorpay-Signature header' });
    return;
  }

  const body = req.body ?? {};
  const event = str(body.event, 64) || '';
  const paymentLinkId = str(body.payload?.payment_link?.entity?.id);

  // Build candidate secrets. For payment-link events, the owning merchant's secret first.
  const candidates: string[] = [];
  let ownerMerchantId: string | undefined;
  if (event === 'payment_link.paid' && paymentLinkId) {
    const order = await Order.findOne({ paymentLinkId }).select('merchantId').populate('merchantId', 'paymentConfig');
    const merchant: any = order?.merchantId;
    ownerMerchantId = merchant?._id?.toString();
    const pc = merchant?.paymentConfig;
    if ((pc?.provider || pc?.gateway) === 'razorpay') {
      for (const field of ['webhookSecret', 'keySecret'] as const) {
        if (pc[field]) { try { candidates.push(encryptionService.decrypt(pc[field])); } catch { /* skip undecryptable */ } }
      }
    }
  }
  if (config.razorpay.webhookSecret) candidates.push(config.razorpay.webhookSecret);

  if (candidates.length === 0) {
    logger.warn('Razorpay webhook rejected: no secret available to verify signature', { event });
    res.status(401).json({ error: 'Razorpay webhook secret not configured' });
    return;
  }
  const isValid = candidates.some((s) => paymentService.verifyRazorpayWebhook(rawBody, signature, s));
  if (!isValid) {
    logger.warn('Razorpay webhook signature verification failed', { event });
    res.status(401).json({ error: 'Invalid Razorpay signature' });
    return;
  }

  const paymentEntity = body.payload?.payment?.entity;
  const subEntity = body.payload?.subscription?.entity;
  const entityId = str(subEntity?.id) || str(paymentEntity?.id) || paymentLinkId || 'unknown';
  const eventId = eventHeaderId || `${event}_${entityId}_${body.created_at ?? ''}`;
  const idemKey = IdempotencyGuard.key('razorpay', ownerMerchantId || 'platform', eventId);

  let claim;
  try {
    claim = await IdempotencyGuard.claim(idemKey);
  } catch (err) {
    if (err instanceof IdempotencyUnavailableError) {
      res.status(503).json({ error: 'Temporarily unavailable, retry later' });
      return;
    }
    throw err;
  }
  if (claim === 'duplicate') {
    logger.info('Duplicate Razorpay webhook, skipping', { event, eventId });
    res.status(200).json({ status: 'ignored', reason: 'duplicate' });
    return;
  }

  try {
    switch (event) {
      case 'payment_link.paid': {
        if (!paymentLinkId) {
          res.status(400).json({ error: 'Missing payment_link id in payload' });
          return;
        }
        const linkEntity = body.payload?.payment_link?.entity;
        const amountPaid = Number(linkEntity?.amount_paid ?? paymentEntity?.amount ?? linkEntity?.amount);
        await codConversionQueue.add(
          'confirm-payment',
          { action: 'payment_confirmed', paymentLinkId, provider: 'razorpay', amountPaidPaise: Number.isFinite(amountPaid) ? amountPaid : undefined },
          { jobId: makeJobId('pay', 'razorpay', paymentLinkId), attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: true }
        );
        logger.info('Razorpay payment link paid event queued', { paymentLinkId });
        break;
      }

      case 'subscription.charged': {
        const subscriptionId = str(subEntity?.id);
        if (!subscriptionId) break;
        const amount = typeof paymentEntity?.amount === 'number' ? paymentEntity.amount : undefined;
        await subscriptionService.onRenewalCharged(subscriptionId, str(paymentEntity?.id), amount);
        break;
      }

      case 'payment.captured':
        // Intro payments are provisioned via the authenticated checkout/verify path.
        // Nothing to do here; acknowledged so Razorpay stops retrying.
        break;

      case 'subscription.paused': {
        const subscriptionId = str(subEntity?.id);
        if (subscriptionId) await subscriptionService.onSubscriptionPaused(subscriptionId);
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        const subscriptionId = str(subEntity?.id);
        if (subscriptionId) await subscriptionService.onSubscriptionCancelledOrExpired(subscriptionId, event === 'subscription.cancelled' ? 'cancelled' : 'expired');
        break;
      }

      case 'payment.failed': {
        await subscriptionService.onPaymentFailed(str(subEntity?.id), str(paymentEntity?.order_id), str(paymentEntity?.error_description, 256));
        break;
      }

      default:
        break;
    }

    await IdempotencyGuard.markProcessed(idemKey);
    res.status(200).json({ status: 'received' });
  } catch (err: any) {
    logger.error('Failed to handle Razorpay webhook', { event, eventId, error: err.message });
    await IdempotencyGuard.release(idemKey);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
