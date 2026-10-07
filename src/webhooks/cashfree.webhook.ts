import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { redisConnection } from '../config/redis';
import { paymentService } from '../services/payment.service';
import { config } from '../config/env';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { Order, Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

function str(v: unknown, max = 128): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : typeof v === 'number' ? String(v) : undefined;
}

/**
 * Verify Cashfree Webhook Signature using HMAC SHA-256 and the raw request body.
 * Supports both base64 and hex formats, with optional timestamp prefixing.
 */
export function verifyCashfreeSignature(
  rawBody: string,
  signature: string,
  secret: string,
  timestamp?: string
): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const payloads = timestamp ? [`${timestamp}${rawBody}`, rawBody] : [rawBody];

    for (const payload of payloads) {
      // 1. Try Base64 digest comparison
      const b64Digest = crypto.createHmac('sha256', secret).update(payload).digest('base64');
      const b64Buf = Buffer.from(b64Digest);
      const sigBuf = Buffer.from(signature);

      if (b64Buf.length === sigBuf.length && crypto.timingSafeEqual(b64Buf, sigBuf)) {
        return true;
      }

      // 2. Try Hex digest comparison
      const hexDigest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const hexBuf = Buffer.from(hexDigest);

      if (hexBuf.length === sigBuf.length && crypto.timingSafeEqual(hexBuf, sigBuf)) {
        return true;
      }
    }

    return false;
  } catch (err: any) {
    logger.error('Error verifying Cashfree webhook signature', { error: err.message });
    return false;
  }
}

/**
 * POST /webhooks/cashfree and POST /webhooks/cashfree/payment
 *
 * Handles Cashfree webhook events (PAYMENT_SUCCESS_WEBHOOK, PAYMENT_LINK_EVENT, etc.)
 * Strictly enforces signature verification, idempotency, updates paid status,
 * and triggers RTO transit reversal ONLY after paid: true is confirmed.
 */
router.post(['/', '/payment'], async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('x-webhook-signature') || req.get('x-cashfree-signature');
  const timestamp = req.get('x-webhook-timestamp') || req.get('x-cashfree-timestamp');
  const rawBuf: Buffer | undefined = (req as any).rawBody;
  const rawBody = rawBuf ? rawBuf.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  if (!signature || !rawBody) {
    logger.warn('Cashfree webhook rejected: missing signature header or raw body');
    res.status(401).json({ error: 'Missing Cashfree signature header' });
    return;
  }

  const body = req.body ?? {};
  const cashfreeOrderId = str(
    body.data?.order?.order_id ||
    body.data?.order_id ||
    body.order_id ||
    body.data?.link_id ||
    body.link_id ||
    body.orderId
  );

  // Candidate secrets: the merchant who owns this order / payment link, then platform account fallback
  const candidates: string[] = [];
  let ownerMerchantId: string | undefined;

  if (cashfreeOrderId) {
    const orderQuery: any = {
      $or: [
        { cashfreeOrderId },
        { paymentLinkId: cashfreeOrderId },
        { externalOrderId: cashfreeOrderId },
        ...(Types.ObjectId.isValid(cashfreeOrderId) ? [{ _id: cashfreeOrderId }] : []),
      ],
    };

    const order = await Order.findOne(orderQuery).select('merchantId').populate('merchantId', 'paymentConfig');
    const merchant: any = order?.merchantId;
    ownerMerchantId = merchant?._id?.toString();
    const pc = merchant?.paymentConfig;

    if (pc && ((pc.provider || pc.gateway) === 'cashfree')) {
      for (const field of ['webhookSecret', 'keySecret'] as const) {
        if (pc[field]) {
          try {
            candidates.push(encryptionService.decrypt(pc[field]));
          } catch {
            /* fail closed for undecryptable candidate */
          }
        }
      }
    }
  }

  if (config.cashfree.clientSecret) {
    candidates.push(config.cashfree.clientSecret);
  }

  if (candidates.length === 0) {
    logger.warn('Cashfree webhook rejected: no secret configured to verify signature');
    res.status(401).json({ error: 'Cashfree webhook secret not configured' });
    return;
  }

  // Verify signature with local helper and paymentService
  const isValid = candidates.some(
    (secret) =>
      verifyCashfreeSignature(rawBody, signature, secret, timestamp) ||
      paymentService.verifyCashfreeWebhook(rawBody, signature, secret, timestamp)
  );

  if (!isValid) {
    logger.warn('Cashfree webhook signature verification failed', { cashfreeOrderId });
    res.status(401).json({ error: 'Invalid Cashfree signature' });
    return;
  }

  // Determine if this is a payment success event
  const type = String(body.type || body.event || '');
  const linkStatus = String(body.data?.link_status || body.link_status || '').toUpperCase();
  const paymentStatus = String(
    body.data?.payment?.payment_status ||
    body.data?.order?.order_status ||
    body.payment_status ||
    ''
  ).toUpperCase();

  const isPaid =
    type === 'PAYMENT_SUCCESS_WEBHOOK' ||
    type === 'LINK_PAID' ||
    type === 'payment.success' ||
    (type === 'PAYMENT_LINK_EVENT' && (linkStatus === 'PAID' || linkStatus === 'PARTIALLY_PAID')) ||
    (type === 'PAYMENT_LINK_EVENT' && paymentStatus === 'SUCCESS') ||
    paymentStatus === 'SUCCESS' ||
    linkStatus === 'PAID';

  if (!isPaid) {
    res.status(200).json({ status: 'ignored', reason: 'event_not_handled' });
    return;
  }

  if (!cashfreeOrderId) {
    res.status(400).json({ error: 'Missing cashfreeOrderId/link_id in Cashfree payload' });
    return;
  }

  const eventId =
    req.get('x-webhook-id') ||
    `${cashfreeOrderId}_${str(body.data?.payment?.cf_payment_id || body.cf_payment_id) || timestamp || Date.now()}`;
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
    // ─── 1. DATABASE UPDATE: Set paid: true & paymentGateway: 'cashfree' ───
    const updatedOrder = await Order.findOneAndUpdate(
      {
        $or: [
          { cashfreeOrderId },
          { paymentLinkId: cashfreeOrderId },
          { externalOrderId: cashfreeOrderId },
          ...(Types.ObjectId.isValid(cashfreeOrderId) ? [{ _id: cashfreeOrderId }] : []),
        ],
      },
      {
        $set: {
          paid: true,
          paymentGateway: 'cashfree',
          paymentMethod: 'prepaid',
          'codConversion.convertedAt': new Date(),
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      logger.warn('No order found to update for Cashfree webhook', { cashfreeOrderId });
      await IdempotencyGuard.markProcessed(idemKey);
      res.status(200).json({ status: 'ignored', reason: 'order_not_found' });
      return;
    }

    // ─── 2. CRUCIAL: Trigger RTO Transit Reversal Logic ONLY After paid: true is confirmed ───
    if (updatedOrder.paid === true) {
      const isRtoOrNdr =
        updatedOrder.status === 'rto' ||
        updatedOrder.status === 'rto_initiated' ||
        updatedOrder.rtoArrestStatus === 'TRIGGERED' ||
        (updatedOrder.status || '').startsWith('ndr_');

      if (isRtoOrNdr) {
        logger.info('Order verified as paid: true via Cashfree. Executing RTO transit reversal logic.', {
          orderId: updatedOrder._id,
          status: updatedOrder.status,
        });

        try {
          const { rtoArrestService } = require('../services/rto-arrest.service');
          await rtoArrestService.abortRtoAndReattempt({
            orderId: updatedOrder._id.toString(),
            reason: 'Payment confirmed via Cashfree webhook. RTO transit aborted.',
          });
        } catch (rtoErr: any) {
          logger.warn('Failed to abort RTO via rtoArrestService on Cashfree payment confirmation', {
            orderId: updatedOrder._id,
            error: rtoErr.message,
          });
        }
      }
    }

    // ─── 3. Queue downstream order and courier balance lifecycle updates ───
    const rawAmount = Number(
      body.data?.payment?.payment_amount ??
      body.data?.link_amount_paid ??
      body.data?.order?.order_amount ??
      body.data?.link_amount ??
      body.link_amount_paid ??
      body.link_amount ??
      body.order_amount
    );
    const amountPaidPaise = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 100) : undefined;

    await codConversionQueue.add(
      'confirm-payment',
      {
        action: 'payment_confirmed',
        paymentLinkId: cashfreeOrderId,
        provider: 'cashfree',
        amountPaidPaise,
      },
      {
        jobId: makeJobId('pay', 'cashfree', cashfreeOrderId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await IdempotencyGuard.markProcessed(idemKey);
    logger.info('Cashfree payment confirmed and RTO safeguards processed', { cashfreeOrderId, eventId });
    res.status(200).json({ status: 'received', paid: true });
  } catch (err: any) {
    logger.error('Failed to handle Cashfree webhook', { error: err.message, cashfreeOrderId });
    await IdempotencyGuard.release(idemKey);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
