import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { paymentService } from '../services/payment.service';
import { config } from '../config/env';
import { IdempotencyGuard } from '../utils/idempotency';
import { AuditLog, BillingEvent, Merchant } from '../models';
import { subscriptionService } from '../services/subscription.service';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

router.post('/payment', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('X-Razorpay-Signature');
  const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : '';

  logger.info('Received Razorpay webhook payment event');

  // Verify Signature — MANDATORY
  if (config.razorpay.webhookSecret) {
    if (!signature || !rawBody) {
      logger.warn('Razorpay webhook rejected: missing signature header or body', { hasSignature: !!signature, hasBody: !!rawBody });
      res.status(401).json({ error: 'Missing X-Razorpay-Signature header' });
      return;
    }
    const isValid = paymentService.verifyRazorpayWebhook(rawBody, signature, config.razorpay.webhookSecret);
    if (!isValid) {
      logger.warn('Razorpay webhook signature verification failed');
      res.status(401).json({ error: 'Invalid Razorpay signature' });
      return;
    }
  } else {
    logger.warn('Razorpay webhookSecret not configured — rejecting webhook. Set RAZORPAY_WEBHOOK_SECRET.');
    res.status(401).json({ error: 'Razorpay webhook secret not configured' });
    return;
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

      const amountPaid = paymentLinkEntity?.amount_paid || paymentLinkEntity?.amount || body.payload?.payment?.entity?.amount;
      // Add payment confirmation job to queue
      await codConversionQueue.add(
        'confirm-payment',
        {
          action: 'payment_confirmed',
          paymentLinkId,
          provider: 'razorpay',
          amountPaidPaise: amountPaid,
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
    } else if (event === 'subscription.charged' || event === 'payment.captured') {
      const entity = body.payload?.subscription?.entity || body.payload?.payment?.entity;
      const notes = entity?.notes || {};
      const merchantId = notes.merchantId || notes.merchant_id;
      const plan = notes.plan || notes.tier;
      const cycle = notes.cycle;
      const actualAmountPaise = entity?.amount || entity?.amount_paid || 0;

      if (merchantId) {
        const eventId = `razorpay_${event}_${entity?.id || Date.now()}`;
        const isProcessed = await IdempotencyGuard.isProcessed(eventId);
        if (!isProcessed) {
          if (plan) {
            const planLimits: Record<string, number> = { starter: 2000, growth: 10000, scale: 50000 };
            const PLAN_MONTHLY_PRICES: Record<string, Record<string, number>> = {
              starter: { quarterly: 1599, semi_annual: 1359, semi: 1359, annual: 1119 },
              growth: { quarterly: 3999, semi_annual: 3399, semi: 3399, annual: 2799 },
              scale: { quarterly: 9999, semi_annual: 8499, semi: 8499, annual: 6999 },
            };
            const cycleMonths: Record<string, number> = {
              quarterly: 3,
              semi_annual: 6,
              semi: 6,
              annual: 12,
            };

            const selectedCycle = cycle || 'quarterly';
            const priceConfig = PLAN_MONTHLY_PRICES[plan];
            if (priceConfig && priceConfig[selectedCycle]) {
              const expectedPaise = priceConfig[selectedCycle] * (cycleMonths[selectedCycle] || 3) * 100;
              // Reject if actual amount paid is less than 90% of expected price
              if (actualAmountPaise && actualAmountPaise < expectedPaise * 0.90) {
                logger.warn('Webhook amount mismatch - plan upgrade rejected', {
                  merchantId,
                  plan,
                  expectedPaise,
                  actualAmountPaise,
                });
                res.status(400).json({ error: 'Payment amount mismatch for requested plan' });
                return;
              }
            }

            const merchant = await Merchant.findById(merchantId);
            if (merchant) {
              const firstActivation = !merchant.billing.activatedAt;
              merchant.billing.plan = plan;
              merchant.billing.planOrderLimit = planLimits[plan] || 2000;
              (merchant as any).billing.status = 'active';
              if (firstActivation) merchant.billing.activatedAt = new Date();
              if (cycle) merchant.billing.billingCycle = cycle;
              await merchant.save();
              if (firstActivation) {
                void emailService.sendPlanActivated(merchant.email, merchant.name, plan).catch(() => {});
                void emailService.notifyOwner('Plan activated (webhook)', {
                  merchant: merchant.name,
                  email: merchant.email,
                  plan,
                  merchantId: merchant._id.toString(),
                  note: 'Consider reaching out for their setup call.',
                });
              }
            }
          }
          await subscriptionService.onRenewalCharged(merchantId);
          await IdempotencyGuard.markProcessed(eventId);
          logger.info('Subscription payment processed via Razorpay webhook', { merchantId, plan, cycle });
        }
      }
    } else if (event === 'subscription.paused') {
      const sub = body.payload?.subscription?.entity;
      const merchantId = sub?.notes?.merchantId;
      if (merchantId) await subscriptionService.onSubscriptionPaused(merchantId);
    } else if (event === 'subscription.cancelled') {
      const sub = body.payload?.subscription?.entity;
      const merchantId = sub?.notes?.merchantId;
      if (merchantId) await subscriptionService.onSubscriptionCancelledOrExpired(merchantId, 'cancelled');
    } else if (event === 'subscription.expired') {
      const sub = body.payload?.subscription?.entity;
      const merchantId = sub?.notes?.merchantId;
      if (merchantId) await subscriptionService.onSubscriptionCancelledOrExpired(merchantId, 'expired');
    } else if (event === 'payment.failed') {
      const pay = body.payload?.payment?.entity;
      const merchantId = pay?.notes?.merchantId;
      if (merchantId) await subscriptionService.onPaymentFailed(merchantId, pay?.error_description);
    }

    res.status(200).json({ status: 'received' });
  } catch (err: any) {
    logger.error('Failed to handle Razorpay webhook', { error: err.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
