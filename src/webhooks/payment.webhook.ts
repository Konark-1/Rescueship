import { Router, Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { rtoArrestService } from '../services/rto-arrest.service';
import { config } from '../config/env';
import { Order } from '../models';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

const router = Router();

function str(v: unknown, max = 128): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;
}

/**
 * POST /webhooks/payment
 * Unified payment webhook endpoint supporting Razorpay and Cashfree.
 * Enforces strict HMAC verification before any business logic or RTO abort can execute.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const rzpSig = req.get('X-Razorpay-Signature');
  const cfSig = req.get('x-webhook-signature');
  const cfTs = req.get('x-webhook-timestamp');
  const rawBuf: Buffer | undefined = (req as any).rawBody;
  const rawBody = rawBuf ? rawBuf.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  // 1. Signature check: reject if missing signature
  if (!rzpSig && !cfSig) {
    logger.warn('Payment webhook rejected: missing signature header');
    res.status(401).json({ error: 'Missing payment webhook signature' });
    return;
  }

  const body = req.body ?? {};
  let isValid = false;

  if (rzpSig) {
    const candidates: string[] = [];
    const paymentLinkId = str(body.payload?.payment_link?.entity?.id || body.paymentLinkId);
    if (paymentLinkId) {
      try {
        const order = await Order.findOne({ paymentLinkId }).select('merchantId').populate('merchantId', 'paymentConfig');
        const merchant: any = order?.merchantId;
        const pc = merchant?.paymentConfig;
        if (pc && (pc.provider || pc.gateway) === 'razorpay') {
          for (const field of ['webhookSecret', 'keySecret'] as const) {
            if (pc[field]) {
              try { candidates.push(encryptionService.decrypt(pc[field])); } catch { /* skip */ }
            }
          }
        }
      } catch (err: any) {
        logger.warn('Failed resolving merchant secret for Razorpay webhook', { error: err.message });
      }
    }
    if (config.razorpay.webhookSecret) candidates.push(config.razorpay.webhookSecret);

    if (candidates.length > 0) {
      isValid = candidates.some((s) => paymentService.verifyRazorpayWebhook(rawBody, rzpSig, s));
    }
  } else if (cfSig) {
    const candidates: string[] = [];
    const linkId = str(body.data?.link_id || body.link_id || body.data?.order?.order_id || body.order_id);
    if (linkId) {
      try {
        const order = await Order.findOne({ paymentLinkId: linkId }).select('merchantId').populate('merchantId', 'paymentConfig');
        const merchant: any = order?.merchantId;
        const pc = merchant?.paymentConfig;
        if (pc && (pc.provider || pc.gateway) === 'cashfree') {
          for (const field of ['webhookSecret', 'keySecret'] as const) {
            if (pc[field]) {
              try { candidates.push(encryptionService.decrypt(pc[field])); } catch { /* skip */ }
            }
          }
        }
      } catch (err: any) {
        logger.warn('Failed resolving merchant secret for Cashfree webhook', { error: err.message });
      }
    }
    if (config.cashfree.clientSecret) candidates.push(config.cashfree.clientSecret);

    if (candidates.length > 0) {
      isValid = candidates.some((s) => paymentService.verifyCashfreeWebhook(rawBody, cfSig, s, cfTs));
    }
  }

  // 2. Reject if HMAC invalid
  if (!isValid) {
    logger.warn('Payment webhook rejected: invalid HMAC signature');
    res.status(401).json({ error: 'Invalid HMAC signature' });
    return;
  }

  // 3. Process payment only after verified
  try {
    const status = str(body.status || body.event || body.type || body.data?.link_status || body.payload?.payment?.entity?.status);
    const isCaptured = status === 'captured' || status === 'PAID' || status === 'payment.captured' || status === 'payment_link.paid';

    if (isCaptured) {
      const orderId = str(body.orderId || body.order_id || body.payload?.payment?.entity?.order_id || body.data?.order?.order_id);
      const paymentLinkId = str(body.paymentLinkId || body.linkId || body.data?.link_id || body.payload?.payment_link?.entity?.id);

      let order: any = null;
      if (orderId) {
        order = await Order.findOne({ $or: [{ _id: orderId }, { externalOrderId: orderId }] });
      }
      if (!order && paymentLinkId) {
        order = await Order.findOne({ paymentLinkId });
      }

      if (order && (order.status === 'rto_initiated' || order.status === 'rto' || order.rtoArrestStatus === 'TRIGGERED')) {
        await rtoArrestService.abortRtoAndReattempt({
          orderId: order._id.toString(),
          reason: 'Verified payment captured via webhook',
        });
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (err: any) {
    logger.error('Error handling verified payment webhook', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
