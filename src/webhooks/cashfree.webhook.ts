import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { paymentService } from '../services/payment.service';
import { config } from '../config/env';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { Order } from '../models';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

function str(v: unknown, max = 128): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : typeof v === 'number' ? String(v) : undefined;
}

router.post('/payment', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('x-webhook-signature');
  const timestamp = req.get('x-webhook-timestamp');
  const rawBuf: Buffer | undefined = (req as any).rawBody;
  const rawBody = rawBuf ? rawBuf.toString('utf8') : '';

  if (!signature || !rawBody) {
    res.status(401).json({ error: 'Missing Cashfree signature header' });
    return;
  }

  const body = req.body ?? {};
  const linkId = str(body.data?.link_id || body.link_id || body.data?.order?.order_id || body.order_id);

  // Candidate secrets: the merchant that owns this payment link (their own Cashfree
  // account signs their webhooks), then the platform account as fallback.
  const candidates: string[] = [];
  let ownerMerchantId: string | undefined;
  if (linkId) {
    const order = await Order.findOne({ paymentLinkId: linkId }).select('merchantId').populate('merchantId', 'paymentConfig');
    const merchant: any = order?.merchantId;
    ownerMerchantId = merchant?._id?.toString();
    const pc = merchant?.paymentConfig;
    if ((pc?.provider || pc?.gateway) === 'cashfree') {
      for (const field of ['webhookSecret', 'keySecret'] as const) {
        if (pc[field]) { try { candidates.push(encryptionService.decrypt(pc[field])); } catch { /* fail closed for this candidate */ } }
      }
    }
  }
  if (config.cashfree.clientSecret) candidates.push(config.cashfree.clientSecret);

  if (candidates.length === 0) {
    logger.warn('Cashfree webhook rejected: no secret available to verify signature');
    res.status(401).json({ error: 'Cashfree webhook secret not configured' });
    return;
  }

  const isValid = candidates.some((s) => paymentService.verifyCashfreeWebhook(rawBody, signature, s, timestamp));
  if (!isValid) {
    logger.warn('Cashfree webhook signature verification failed', { linkId });
    res.status(401).json({ error: 'Invalid Cashfree signature' });
    return;
  }

  // Cashfree Payment Links (2023-08-01) emit 	ype: PAYMENT_LINK_EVENT with data.link_status: PAID.
  // Older/other integrations use LINK_PAID / PAYMENT_SUCCESS_WEBHOOK. Accept every shape that
  // unambiguously indicates a completed payment; ignore everything else.
  const type = String(body.type || body.event || '');
  const linkStatus = String(body.data?.link_status || body.link_status || '').toUpperCase();
  const paymentStatus = String(body.data?.payment?.payment_status || body.data?.order?.order_status || '').toUpperCase();
  const isPaid =
    type === 'LINK_PAID' ||
    type === 'payment.success' ||
    type === 'PAYMENT_SUCCESS_WEBHOOK' ||
    (type === 'PAYMENT_LINK_EVENT' && (linkStatus === 'PAID' || linkStatus === 'PARTIALLY_PAID')) ||
    (type === 'PAYMENT_LINK_EVENT' && paymentStatus === 'SUCCESS');
  if (!isPaid) {
    res.status(200).json({ status: 'ignored', reason: 'event_not_handled' });
    return;
  }
  if (!linkId) {
    res.status(400).json({ error: 'Missing link_id in Cashfree payload' });
    return;
  }

  const eventId = req.get('x-webhook-id') || `${linkId}_${str(body.data?.payment?.cf_payment_id) || timestamp || ''}`;
  const idemKey = IdempotencyGuard.key('cashfree', ownerMerchantId || 'platform', eventId);

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
    logger.info('Duplicate Cashfree webhook, skipping', { eventId });
    res.status(200).json({ status: 'ignored', reason: 'duplicate' });
    return;
  }

  try {
    const rawAmount = Number(
      body.data?.payment?.payment_amount ??
      body.data?.link_amount_paid ??
      body.data?.order?.order_amount ??
      body.data?.link_amount ??
      body.link_amount_paid ??
      body.link_amount
    );
    const amountPaidPaise = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 100) : undefined;

    await codConversionQueue.add(
      'confirm-payment',
      { action: 'payment_confirmed', paymentLinkId: linkId, provider: 'cashfree', amountPaidPaise },
      {
        jobId: makeJobId('pay', 'cashfree', linkId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await IdempotencyGuard.markProcessed(idemKey);
    logger.info('Cashfree payment link paid event queued', { linkId, eventId });
    res.status(200).json({ status: 'received' });
  } catch (err: any) {
    logger.error('Failed to handle Cashfree webhook', { error: err.message, linkId });
    await IdempotencyGuard.release(idemKey);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
