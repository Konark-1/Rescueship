import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { paymentService } from '../services/payment.service';
import { Order } from '../models';
import { encryptionService } from '../services/encryption.service';
import { SecurityAlertService } from '../services/security-alert.service';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { makeJobId } from '../utils/job-id';
import { logger } from '../utils/logger';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

function str(v: unknown, max = 128): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;
}

/**
 * POST /webhooks/payment
 * Unified payment-link webhook for merchants' own Razorpay / Cashfree accounts.
 *
 * Tenant safety: the order is resolved ONLY from the gateway link id that RescueShip
 * created, and the signature must verify with THAT order's merchant secret. A body
 * signed with merchant A's secret can never act on merchant B's order. The order
 * state change itself happens only in orderService.handlePaymentSuccess (queued),
 * which validates the amount.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const rzpSig = req.get('X-Razorpay-Signature');
  const cfSig = req.get('x-webhook-signature');
  const cfTs = req.get('x-webhook-timestamp');
  const rawBuf: Buffer | undefined = (req as any).rawBody;

  const reject = (error: string, provider?: string) => {
    logger.warn('Payment webhook rejected', { error, provider, ip: req.ip });
    SecurityAlertService.sendCriticalAlert('INVALID_PAYMENT_HMAC_SIGNATURE', {
      ip: req.ip, path: req.originalUrl, provider, reason: error,
      hasRazorpaySig: Boolean(rzpSig), hasCashfreeSig: Boolean(cfSig),
    }).catch((err) => logger.warn('Failed to dispatch security alert', { error: err?.message }));
    res.status(401).json({ error });
  };

  if ((!rzpSig && !cfSig) || !rawBuf) {
    reject('Missing payment webhook signature');
    return;
  }
  const rawBody = rawBuf.toString('utf8');
  const body = req.body ?? {};
  const provider: 'razorpay' | 'cashfree' = rzpSig ? 'razorpay' : 'cashfree';

  const linkId = provider === 'razorpay'
    ? str(body.payload?.payment_link?.entity?.id)
    : str(body.data?.link_id || body.link_id);
  if (!linkId) {
    // Without a link id we minted, there is no merchant secret to verify against.
    reject('Invalid HMAC signature (unknown payment link)', provider);
    return;
  }

  const order = await Order.findOne({ $or: [{ paymentLinkId: linkId }, { depositPaymentLinkId: linkId }] })
    .select('merchantId')
    .populate('merchantId', 'paymentConfig');
  const merchant: any = order?.merchantId;
  const pc = merchant?.paymentConfig;
  const secrets: string[] = [];
  if (pc && (pc.provider || pc.gateway) === provider) {
    for (const field of ['webhookSecret', 'keySecret'] as const) {
      if (pc[field]) {
        try { secrets.push(encryptionService.decrypt(pc[field])); } catch { /* fail closed */ }
      }
    }
  }

  const isValid = secrets.length > 0 && secrets.some((s) => provider === 'razorpay'
    ? paymentService.verifyRazorpayWebhook(rawBody, rzpSig!, s)
    : paymentService.verifyCashfreeWebhook(rawBody, cfSig!, s, cfTs));

  if (!isValid) {
    reject('Invalid HMAC signature', provider);
    return;
  }

  const status = str(body.event || body.type || body.data?.link_status);
  const isPaid = provider === 'razorpay'
    ? status === 'payment_link.paid'
    : (status === 'PAID' || status === 'PAYMENT_SUCCESS_WEBHOOK' || status === 'LINK_PAID' || String(body.data?.link_status || '').toUpperCase() === 'PAID');
  if (!isPaid) {
    res.status(200).json({ status: 'ignored', reason: 'event_not_handled' });
    return;
  }

  const rawAmount = provider === 'razorpay'
    ? Number(body.payload?.payment_link?.entity?.amount_paid ?? body.payload?.payment?.entity?.amount)
    : Math.round(Number(body.data?.link_amount_paid ?? body.data?.payment?.payment_amount) * 100);
  const amountPaidPaise = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : undefined;

  const eventId = req.get('x-razorpay-event-id') || req.get('x-webhook-id') || `${linkId}_${status}`;
  const idemKey = IdempotencyGuard.key(`payment-${provider}`, String(merchant?._id), eventId);
  try {
    const claim = await IdempotencyGuard.claim(idemKey);
    if (claim === 'duplicate') {
      res.status(200).json({ status: 'ignored', reason: 'duplicate' });
      return;
    }
  } catch (err) {
    if (err instanceof IdempotencyUnavailableError) {
      res.status(503).json({ error: 'Temporarily unavailable, retry later' });
      return;
    }
    throw err;
  }

  try {
    await codConversionQueue.add(
      'confirm-payment',
      { action: 'payment_confirmed', paymentLinkId: linkId, provider, amountPaidPaise },
      { jobId: makeJobId('pay', provider, linkId), attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false }
    );
    await IdempotencyGuard.markProcessed(idemKey);
    res.status(200).json({ status: 'received' });
  } catch (err: any) {
    await IdempotencyGuard.release(idemKey);
    logger.error('Error queueing verified payment webhook', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
