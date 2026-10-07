/**
 * subscription.service.ts
 * ─────────────────────────────────────────────────────────────
 * The price is computed HERE, server-side, before any charge. The
 * frontend mirrors these constants only to *display*; it never sets
 * the amount. Pattern:
 *   1. upfront INTRO order  = first cycle at the cycle price (one-time)
 *   2. RENEWAL subscription = recurring MONTHLY at the cycle price, first
 *      charge scheduled for the renewal date (start_at), so the customer is
 *      active NOW but only pays the renewal rate when the intro ends.
 *   3. on intro capture  → provision plan immediately (activatedAt = now);
 *      provisioning runs from the authenticated /billing/checkout/verify
 *      path AND from the payment.captured webhook fallback
 *      (reconcileIntroPayment) so a closed browser never loses a payment.
 *   4. on sub charged    → roll cycleStartDate forward AND advance
 *      nextInvoiceDate/accessExpiresAt by one month per monthly charge.
 *
 * PLATFORM BILLING IS RAZORPAY-ONLY BY DESIGN. Cashfree is wired exclusively
 * for per-merchant COD-conversion payment links (see payment.service.ts) —
 * it is deliberately NOT a second subscription gateway: recurring mandates,
 * dunning and subscription webhooks are standardised on Razorpay.
 */
import crypto from 'crypto';
import axios from 'axios';
import { Merchant, ProcessedPayment, Invoice, BillingEvent } from '../models';
import { emailService } from './email.service';
import { alertService } from './alert.service';
import { merchantDigestService } from './merchant-digest.service';
import { logger } from '../utils/logger';

export type Tier = 'starter' | 'growth' | 'scale' | 'fleet';
export type Cycle = 'quarterly' | 'semi' | 'annual';

const BASE: Record<Tier, number> = { starter: 4999, growth: 11999, scale: 24999, fleet: 44999 };
export const LIMIT: Record<Tier, number> = { starter: 1000, growth: 5000, scale: 12000, fleet: 25000 };
const MONTHS: Record<Cycle, number> = { quarterly: 3, semi: 6, annual: 12 };
const DISC: Record<Cycle, number> = { quarterly: 0, semi: 0.15, annual: 0.20 };
const PERIOD: Record<Cycle, 'monthly' | 'quarterly' | 'yearly'> = { quarterly: 'monthly', semi: 'monthly', annual: 'monthly' };
const DAY_MS = 24 * 3600 * 1000;

/** Self-serve rescue-credit top-up packs (server-authoritative pricing). */
export const CREDIT_PACKS: Record<string, { credits: number; priceInr: number; label: string }> = {
  pack_100: { credits: 100, priceInr: 499, label: '100 Rescues' },
  pack_500: { credits: 500, priceInr: 1999, label: '500 Rescues' },
  pack_2000: { credits: 2000, priceInr: 6999, label: '2,000 Rescues' },
};

/**
 * Record an issued invoice. Idempotent per Razorpay payment id (unique index);
 * duplicate recording is logged and swallowed.
 */
async function recordInvoice(entry: {
  merchantId: any;
  kind: 'intro' | 'renewal' | 'credits';
  amountPaise: number;
  description: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  periodStart?: Date;
  periodEnd?: Date;
}): Promise<void> {
  try {
    const year = new Date().getFullYear();
    await Invoice.create({
      merchantId: entry.merchantId,
      number: `RS-${year}-${entry.razorpayPaymentId.replace(/^pay_/, '').toUpperCase().slice(-8)}`,
      kind: entry.kind,
      status: 'paid',
      amountPaise: entry.amountPaise,
      currency: 'INR',
      description: entry.description,
      razorpayPaymentId: entry.razorpayPaymentId,
      razorpayOrderId: entry.razorpayOrderId,
      razorpaySubscriptionId: entry.razorpaySubscriptionId,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      paidAt: new Date(),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      logger.info('Invoice already recorded for payment', { paymentId: entry.razorpayPaymentId });
      return;
    }
    logger.error('Failed to record invoice (non-fatal)', { paymentId: entry.razorpayPaymentId, error: err?.message });
  }
}

export const TIERS: readonly Tier[] = ['starter', 'growth', 'scale', 'fleet'];
export const CYCLES: readonly Cycle[] = ['quarterly', 'semi', 'annual'];
/** Accept legacy 'semi_annual' stored values / old clients and map onto the canonical key. */
export function normalizeCycle(c: unknown): Cycle | null {
  if (c === 'semi_annual' || c === 'semi-annual' || c === 'half_yearly') return 'semi';
  return (CYCLES as readonly string[]).includes(String(c)) ? (c as Cycle) : null;
}
export const isTier = (v: unknown): v is Tier => typeof v === 'string' && (TIERS as readonly string[]).includes(v);
export const isCycle = (v: unknown): v is Cycle => typeof v === 'string' && (CYCLES as readonly string[]).includes(v);

export function priceFor(tier: Tier, cycle: Cycle) {
  const base = BASE[tier] ?? BASE.starter;
  const disc = DISC[cycle] ?? 0;
  const months = MONTHS[cycle] ?? 3;
  const monthly = Math.round(base * (1 - disc));
  const upfront = monthly * months;
  return {
    introMonthly: monthly,
    renewMonthly: monthly,
    introUpfront: upfront,
    renewalCharge: upfront,
    months,
  };
}

/** True when real Razorpay credentials are configured (no dummy placeholders). */
export function razorpayConfigured(): boolean {
  const id = process.env.RAZORPAY_KEY_ID || '';
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  return !!id && !!secret && !id.includes('dummy') && !secret.includes('dummy');
}

// No placeholder credentials: if Razorpay is not configured, every call fails loudly.
const rz = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  timeout: 15000,
  auth: { username: process.env.RAZORPAY_KEY_ID || '', password: process.env.RAZORPAY_KEY_SECRET || '' },
});

export class SubscriptionService {
  /** Build the upfront intro order + the deferred renewal subscription. */
  async createCheckout(merchantId: string, tier: Tier, cycle: Cycle) {
    if (!isTier(tier) || !isCycle(cycle)) throw new Error('Invalid tier or billing cycle');
    if (!razorpayConfigured()) throw new Error('Billing is not configured on this deployment (RAZORPAY_KEY_ID/SECRET).');
    const p = priceFor(tier, cycle);

    let orderId: string;
    let subscriptionId: string | undefined;

    try {
      // (1) upfront intro order — one-time, charged now
      const order = await rz.post('/orders', {
        amount: p.introUpfront * 100, currency: 'INR', receipt: `rs_${merchantId.slice(-6)}_${Date.now()}`,
        notes: { merchantId, tier, cycle, kind: 'intro_quarter' },
      });
      orderId = order.data.id;
    } catch (e: any) {
      logger.error('Razorpay API order creation failed', { error: e.response?.data || e.message });
      throw new Error('Payment gateway error. Please verify Razorpay keys or try again shortly.');
    }

    try {
      // (2) renewal subscription — first charge at the renewal date (if Subscriptions feature is enabled on Razorpay account)
      const planId = await this.ensurePlan(tier, cycle, p.renewMonthly);
      const startAt = Math.floor(Date.now() / 1000) + (MONTHS[cycle] || 3) * 30 * 24 * 3600;
      const subscription = await rz.post('/subscriptions', {
        plan_id: planId, total_count: 12, quantity: 1, start_at: startAt,
        notes: { merchantId, tier, cycle, kind: 'renewal' },
      });
      subscriptionId = subscription.data.id;
    } catch (subErr: any) {
      logger.warn('Razorpay recurring subscription mandate setup skipped (Subscriptions product not active on Razorpay account), proceeding with upfront order checkout', {
        error: subErr.response?.data || subErr.message,
      });
    }

    const billingUpdates: Record<string, any> = {
      'billing.pendingTier': tier, 'billing.pendingCycle': cycle,
      'billing.introOrderId': orderId,
      'billing.renewMonthly': p.renewMonthly,
      'billing.status': 'pending_payment',
    };
    if (subscriptionId) {
      billingUpdates['billing.razorpaySubscriptionId'] = subscriptionId;
    }
    await Merchant.findByIdAndUpdate(merchantId, { $set: billingUpdates });

    return { orderId, subscriptionId, amountInr: p.introUpfront * 100, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID };
  }

  /**
   * Verify a Razorpay checkout and PROVISION the plan.
   *
   * Security model (each check is independent and required):
   *   1. Signature HMAC(order_id|payment_id) proves Razorpay produced the pair.
   *   2. order_id MUST equal the pending intro order stored for THIS merchant
   *      (binds the payment to the tenant; prevents cross-merchant replay).
   *   3. tier/cycle are taken from the stored intent, never from the client.
   *   4. Payment is fetched from Razorpay and must be captured, INR, for the
   *      exact expected amount, and belong to the same order. Fail closed if
   *      Razorpay is unreachable.
   *   5. payment_id is recorded in a unique collection → provision exactly once.
   */
  async verifyAndProvision(merchantId: string, body: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string; tier?: Tier; cycle?: Cycle }) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayConfigured() || !keySecret) {
      throw new Error('Billing is not configured on this deployment');
    }
    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : '';
    if (!paymentId || !orderId || !signature || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^order_[A-Za-z0-9]+$/.test(orderId)) {
      throw new Error('Missing or malformed Razorpay payment verification parameters');
    }

    // (1) signature
    const expectedSig = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expectedSig, 'hex'), b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid payment signature');

    // (2)+(3) bind to this merchant's pending intent
    const merchant = await Merchant.findById(merchantId).select('billing accessExpiresAt').lean();
    const billing: any = (merchant as any)?.billing;
    if (!merchant || !billing) throw new Error('Merchant not found');
    if (!billing.introOrderId || billing.introOrderId !== orderId) {
      // The webhook fallback may have provisioned this payment already (browser
      // died after capture). Idempotent success for the legitimate owner.
      const prior = await ProcessedPayment.findOne({ provider: 'razorpay', externalId: paymentId }).select('merchantId').lean();
      if (prior && prior.merchantId.toString() === merchantId) return this.status(merchantId);
      logger.warn('Checkout verify rejected: order does not match pending intent', { merchantId, orderId });
      throw new Error('This payment does not belong to a pending checkout for your account');
    }
    const tier = billing.pendingTier;
    const cycle = billing.pendingCycle;
    if (!isTier(tier) || !isCycle(cycle)) throw new Error('Pending checkout is missing plan details; start checkout again');
    if (body.tier && body.tier !== tier) throw new Error('Plan mismatch with pending checkout');
    if (body.cycle && body.cycle !== cycle) throw new Error('Cycle mismatch with pending checkout');

    const p = priceFor(tier, cycle);
    const expectedPaise = p.introUpfront * 100;

    // (4) fetch payment; fail closed on any error
    const payment = await this.fetchCapturedPayment(paymentId, orderId, expectedPaise, merchantId);

    return this.provisionIntro(merchantId, orderId, tier, cycle, billing, (merchant as any).accessExpiresAt, payment);
  }

  /** Fetch a payment from Razorpay and fail closed unless captured/INR/exact amount for the order. */
  private async fetchCapturedPayment(paymentId: string, orderId: string, expectedPaise: number, merchantId: string): Promise<any> {
    let payment: any;
    try {
      payment = (await rz.get(`/payments/${encodeURIComponent(paymentId)}`)).data;
    } catch (apiErr: any) {
      logger.error('Razorpay payment lookup failed during verification', { merchantId, paymentId, error: apiErr.response?.data || apiErr.message });
      throw new Error('Payment verification is temporarily unavailable. Your payment is safe; please retry in a moment.');
    }
    if (payment?.order_id !== orderId) throw new Error('Payment does not belong to the checkout order');
    if (payment?.status !== 'captured') throw new Error(`Payment is not captured (status: ${payment?.status || 'unknown'})`);
    if (payment?.currency !== 'INR') throw new Error('Unexpected payment currency');
    if (typeof payment?.amount !== 'number' || payment.amount !== expectedPaise) {
      throw new Error(`Payment amount mismatch: expected ₹${expectedPaise / 100}`);
    }
    return payment;
  }

  /**
   * Shared provisioning for the intro plan payment: one-shot replay protection
   * via ProcessedPayment, seamless stacking of remaining days, invoice issue
   * and first-activation notifications. Used by /billing/checkout/verify AND
   * the payment.captured webhook fallback.
   */
  private async provisionIntro(
    merchantId: string,
    orderId: string,
    tier: Tier,
    cycle: Cycle,
    billing: any,
    accessExpiresAt: any,
    payment: any
  ) {
    const paymentId: string = payment.id;

    // one-shot: unique index rejects replays (same payment, any merchant)
    try {
      await ProcessedPayment.create({ provider: 'razorpay', externalId: paymentId, merchantId, kind: 'subscription_intro', amountPaise: payment.amount });
    } catch (err: any) {
      if (err?.code === 11000) {
        logger.warn('Intro provisioning replay rejected: payment already consumed', { merchantId, paymentId });
        // Idempotent success for the legitimate owner re-submitting; hard fail for anyone else.
        const prior = await ProcessedPayment.findOne({ provider: 'razorpay', externalId: paymentId }).select('merchantId').lean();
        if (prior && prior.merchantId.toString() === merchantId) return this.status(merchantId);
        throw new Error('This payment has already been used');
      }
      throw err;
    }

    const p = priceFor(tier, cycle);
    const now = new Date();
    const renewalMonths = MONTHS[cycle] || 3;

    // Seamless stacking: if current plan is active and has days remaining, stack renewal onto existing expiry
    const currentInvoiceDate = billing.nextInvoiceDate ? new Date(billing.nextInvoiceDate) : null;
    const currentExpiresAt = accessExpiresAt ? new Date(accessExpiresAt) : null;
    const activeExpiry = (currentInvoiceDate && currentInvoiceDate.getTime() > now.getTime())
      ? currentInvoiceDate
      : (currentExpiresAt && currentExpiresAt.getTime() > now.getTime())
      ? currentExpiresAt
      : now;

    const renewal = new Date(activeExpiry.getTime() + renewalMonths * 30 * DAY_MS);

    const prev = await Merchant.findOneAndUpdate(
      { _id: merchantId, 'billing.introOrderId': orderId },
      { $set: {
        'billing.plan': tier,
        'billing.planOrderLimit': LIMIT[tier],
        'billing.billingCycle': cycle,
        'billing.cycleStartDate': now,
        'billing.nextInvoiceDate': renewal,
        'billing.renewMonthly': p.renewMonthly,
        'billing.activatedAt': billing.activatedAt || now,
        'billing.status': 'active',
        'billing.lastPaymentError': null,
        'billing.cancelAtCycleEnd': false,
        accessExpiresAt: renewal,
        licenseStatus: 'ACTIVE',
      }, $unset: { 'billing.pendingTier': 1, 'billing.pendingCycle': 1, 'billing.introOrderId': 1 } }
    );
    logger.info('Plan provisioned via self-serve checkout', { merchantId, tier, cycle, paymentId });
    await merchantDigestService.clearMerchantQuotaAlerts(merchantId.toString());

    await recordInvoice({
      merchantId,
      kind: 'intro',
      amountPaise: payment.amount,
      description: `${tier} plan — ${cycle} cycle (${renewalMonths} months)`,
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      periodStart: now,
      periodEnd: renewal,
    });

    // Notify only on the FIRST activation — renewals/re-verifications stay silent.
    if (!(prev as any)?.billing?.activatedAt) {
      void this.notifyFirstActivation(merchantId, tier);
    }
    return this.status(merchantId);
  }

  /**
   * Webhook fallback for the intro payment: the customer's browser died after
   * Razorpay captured the order (modal closed / network lost) and the
   * authenticated /billing/checkout/verify call never arrived. The merchant is
   * resolved from the stored introOrderId — NEVER from webhook notes — and the
   * payment is re-fetched from Razorpay and validated exactly like the
   * authenticated path before provisioning (which is itself one-shot).
   */
  async reconcileIntroPayment(orderId: string, paymentId: string): Promise<void> {
    if (!razorpayConfigured()) return;
    if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) return;

    const merchant: any = await Merchant.findOne({ 'billing.introOrderId': orderId }).select('billing accessExpiresAt').lean();
    if (!merchant) {
      // Already provisioned (intent cleared) or a foreign order — nothing to do.
      return;
    }
    const billing = merchant.billing || {};
    const tier = billing.pendingTier;
    const cycle = normalizeCycle(billing.pendingCycle);
    if (!isTier(tier) || !isCycle(cycle)) {
      logger.warn('Intro reconcile skipped: pending intent missing plan details', { orderId });
      return;
    }
    const expectedPaise = priceFor(tier, cycle).introUpfront * 100;
    try {
      const payment = await this.fetchCapturedPayment(paymentId, orderId, expectedPaise, merchant._id.toString());
      await this.provisionIntro(merchant._id.toString(), orderId, tier, cycle, billing, merchant.accessExpiresAt, payment);
      logger.info('Intro payment provisioned via webhook fallback', { merchantId: merchant._id.toString(), orderId, paymentId });
    } catch (err: any) {
      // Webhook failures make Razorpay retry; surface the reason for the log trail.
      logger.warn('Intro payment reconcile failed (will retry on next webhook)', { orderId, paymentId, error: err.message });
      throw err;
    }
  }

  /**
   * First-activation side effects: congratulate merchant (with setup-call CTA)
   * and alert the operator. Idempotent — only fires when activatedAt was absent
   * before this activation, so renewals never re-notify.
   */
  private async notifyFirstActivation(merchantId: string, plan: string): Promise<void> {
    try {
      const merchant = await Merchant.findById(merchantId).lean();
      if (!merchant) return;
      await emailService.sendPlanActivated(merchant.email, merchant.name, plan);
      await emailService.notifyOwner('Plan activated (purchase)', {
        merchant: merchant.name,
        email: merchant.email,
        plan,
        merchantId: merchant._id.toString(),
        note: 'Consider reaching out for their setup call.',
      });
    } catch (err: any) {
      logger.error('First-activation notification failed (non-fatal)', { merchantId, error: err.message });
    }
  }

  /**
   * Resolve the merchant that owns a Razorpay subscription. The subscription id
   * was stored server-side at checkout — that is the authority, not webhook notes.
   */
  async merchantForSubscription(subscriptionId: string) {
    if (!subscriptionId || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return null;
    return Merchant.findOne({ 'billing.razorpaySubscriptionId': subscriptionId }).select('_id billing email name');
  }

  /**
   * Called from the subscription.charged webhook — roll the cycle forward AND
   * advance nextInvoiceDate/accessExpiresAt by one month (the Razorpay mandate
   * is a monthly plan), so a paying merchant is never wrongly suspended by the
   * daily watchdog. Also issues the renewal invoice.
   */
  async onRenewalCharged(subscriptionId: string, paymentId: string | undefined, amountPaise: number | undefined) {
    const merchant = await this.merchantForSubscription(subscriptionId);
    if (!merchant) {
      logger.warn('subscription.charged for unknown subscription id — ignored', { subscriptionId });
      return;
    }
    const b: any = merchant.billing || {};
    const tier = b.plan, cycle = normalizeCycle(b.billingCycle);
    if (isTier(tier) && isCycle(cycle) && typeof amountPaise === 'number') {
      // Renewal subscriptions are monthly plans; accept either the monthly or full-cycle amount.
      const p = priceFor(tier, cycle);
      const okAmounts = new Set([p.renewMonthly * 100, p.renewalCharge * 100]);
      if (!okAmounts.has(amountPaise)) {
        logger.error('Renewal charged with unexpected amount — not rolling cycle forward', { merchantId: merchant._id, subscriptionId, amountPaise, expected: [...okAmounts] });
        return;
      }
    }
    if (paymentId) {
      try {
        await ProcessedPayment.create({ provider: 'razorpay', externalId: paymentId, merchantId: merchant._id, kind: 'subscription_renewal', amountPaise });
      } catch (err: any) {
        if (err?.code === 11000) { logger.info('Renewal payment already processed', { paymentId }); return; }
        throw err;
      }
    }
    const now = new Date();
    // Stack onto any unexpired time; each successful monthly charge buys one more month.
    const currentExpiry = b.nextInvoiceDate ? new Date(b.nextInvoiceDate) : null;
    const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const nextInvoice = new Date(base.getTime() + 30 * DAY_MS);

    await Merchant.updateOne({ _id: merchant._id }, { $set: {
      'billing.cycleStartDate': now,
      'billing.status': 'active',
      'billing.lastPaymentError': null,
      'billing.cancelAtCycleEnd': false,
      'billing.nextInvoiceDate': nextInvoice,
      accessExpiresAt: nextInvoice,
      licenseStatus: 'ACTIVE',
    }});
    logger.info('Subscription renewal charged', { merchantId: merchant._id, subscriptionId, nextInvoice });

    if (paymentId) {
      await recordInvoice({
        merchantId: merchant._id,
        kind: 'renewal',
        amountPaise: amountPaise ?? 0,
        description: `${b.plan || 'plan'} renewal — 1 month`,
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: subscriptionId,
        periodStart: now,
        periodEnd: nextInvoice,
      });
    }
  }

  /** Called from subscription.paused webhook */
  async onSubscriptionPaused(subscriptionId: string) {
    const merchant = await this.merchantForSubscription(subscriptionId);
    if (!merchant) return;
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'billing.status': 'paused' } });
    logger.warn('Subscription paused', { merchantId: merchant._id });
    await alertService.sendBillingAlert(
      merchant._id.toString(),
      'subscription.paused',
      'Your recurring subscription was paused, so automated charges have stopped. ' +
      'Your plan keeps running until the current paid period ends. Resume or renew from the billing page to avoid interruption.'
    );
  }

  /** Called from subscription.cancelled or subscription.expired webhook */
  async onSubscriptionCancelledOrExpired(subscriptionId: string, status: 'cancelled' | 'expired') {
    const merchant = await this.merchantForSubscription(subscriptionId);
    if (!merchant) return;
    await Merchant.updateOne({ _id: merchant._id }, { $set: {
      'billing.plan': 'free_trial',
      'billing.planOrderLimit': 100,
      'billing.status': status,
      'billing.cancelAtCycleEnd': false,
    }});
    logger.warn(`Subscription ${status}`, { merchantId: merchant._id });
    await alertService.sendBillingAlert(
      merchant._id.toString(),
      `subscription.${status}`,
      status === 'cancelled'
        ? 'Your subscription has been cancelled. Automated WhatsApp rescues and COD conversions are suspended. Reactivate anytime from the billing page — your settings are preserved.'
        : 'Your subscription expired after exhausting its renewal cycle. Automated WhatsApp rescues and COD conversions are suspended. Reactivate anytime from the billing page — your settings are preserved.'
    );
  }

  /**
   * Called from payment.failed webhook (subscription payments carry the
   * subscription id). Marks the merchant past_due, records the failure reason
   * and fires the dunning sequence: branded email + in-app alert. Deduplicated
   * per Razorpay payment id, so each retry attempt notifies exactly once.
   */
  async onPaymentFailed(subscriptionId: string | undefined, orderId: string | undefined, errorReason?: string, paymentId?: string) {
    let merchant = subscriptionId ? await this.merchantForSubscription(subscriptionId) : null;
    if (!merchant && orderId && /^order_[A-Za-z0-9]+$/.test(orderId)) {
      merchant = await Merchant.findOne({ 'billing.introOrderId': orderId }).select('_id billing email name');
    }
    if (!merchant) return;

    const reason = (errorReason || 'Payment failed').slice(0, 256);
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'billing.status': 'past_due', 'billing.lastPaymentError': reason } });
    logger.error('Subscription payment failed', { merchantId: merchant._id, errorReason });

    // Dunning is one notification per failed attempt (Razorpay retries create new payment ids).
    if (paymentId && /^pay_[A-Za-z0-9]+$/.test(paymentId)) {
      try {
        await ProcessedPayment.create({ provider: 'razorpay', externalId: paymentId, merchantId: merchant._id, kind: 'payment_failed_alert', amountPaise: 0 });
      } catch (err: any) {
        if (err?.code === 11000) return; // already notified for this attempt
        throw err;
      }
    }

    const appUrl = process.env.FRONTEND_URL || 'https://rescueship.netlify.app';
    const plan = (merchant as any).billing?.plan || 'subscription';
    await emailService.sendPaymentFailedAlert((merchant as any).email, (merchant as any).name || 'Merchant', plan, reason, `${appUrl}/billing?renew=true`);
    await alertService.sendBillingAlert(
      merchant._id.toString(),
      'payment.failed',
      `A subscription charge failed: ${reason}. Razorpay will retry automatically. You can complete the payment yourself from the billing page to avoid an interruption.`,
      { email: false }
    );
  }

  /**
   * Called from subscription.halted — Razorpay stopped charging after repeated
   * payment failures. Merchant stays past_due; the watchdog suspends access
   * once the grace window closes.
   */
  async onSubscriptionHalted(subscriptionId: string) {
    const merchant = await this.merchantForSubscription(subscriptionId);
    if (!merchant) return;
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'billing.status': 'past_due', 'billing.lastPaymentError': 'Razorpay halted the subscription after repeated charge failures' } });
    logger.warn('Subscription halted by Razorpay', { merchantId: merchant._id });
    await alertService.sendBillingAlert(
      merchant._id.toString(),
      'subscription.halted',
      'Recurring charges were halted after repeated payment failures. Your account runs on the remaining grace period only — complete payment from the billing page to keep automated rescues running.'
    );
  }

  /** Called from subscription.resumed — recurring charges working again. */
  async onSubscriptionResumed(subscriptionId: string) {
    const merchant = await this.merchantForSubscription(subscriptionId);
    if (!merchant) return;
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'billing.status': 'active', 'billing.lastPaymentError': null } });
    logger.info('Subscription resumed', { merchantId: merchant._id });
    await alertService.sendBillingAlert(
      merchant._id.toString(),
      'subscription.resumed',
      'Recurring subscription charges have resumed successfully. Your plan is active again — no action needed.'
    );
  }

  async status(merchantId: string) {
    const m = await Merchant.findById(merchantId).lean();
    const b = (m as any)?.billing || {};
    const active = !!b.activatedAt && b.plan && b.plan !== 'free_trial';
    return {
      active, plan: b.plan, cycle: normalizeCycle(b.billingCycle) || b.billingCycle, limit: b.planOrderLimit,
      renewMonthly: b.renewMonthly, activatedAt: b.activatedAt, nextInvoice: b.nextInvoiceDate,
      status: b.status, credits: b.rescueCredits, cancelAtCycleEnd: !!b.cancelAtCycleEnd,
    };
  }

  /**
   * Self-serve cancellation: keeps access until the end of the paid period
   * (cancel_at_cycle_end on Razorpay) and flags the intent locally. The
   * subscription.cancelled webhook performs the actual downgrade at cycle end.
   */
  async cancelAtCycleEnd(merchantId: string): Promise<{ cancelled: boolean; accessUntil?: Date }> {
    if (!razorpayConfigured()) throw new Error('Billing is not configured on this deployment');
    const merchant = await Merchant.findById(merchantId).select('billing accessExpiresAt').lean();
    if (!merchant) throw new Error('Merchant not found');
    const b: any = (merchant as any)?.billing || {};
    if (b.status === 'cancelled') throw new Error('Subscription is already cancelled');

    const subId = b.razorpaySubscriptionId;
    if (subId) {
      try {
        await rz.post(`/subscriptions/${encodeURIComponent(subId)}/cancel`, null, { params: { cancel_at_cycle_end: 1 } });
      } catch (e: any) {
        logger.error('Razorpay cancel_at_cycle_end failed', { merchantId, subId, error: e.response?.data || e.message });
        throw new Error('Could not cancel the recurring mandate with the payment gateway. Please try again or contact support.');
      }
    }
    const accessUntil = b.nextInvoiceDate || (merchant as any).accessExpiresAt || undefined;
    await Merchant.updateOne({ _id: merchantId }, { $set: { 'billing.cancelAtCycleEnd': true } });
    logger.info('Subscription cancellation scheduled at cycle end', { merchantId, accessUntil });
    return { cancelled: true, accessUntil };
  }

  /**
   * Self-serve resume: un-pauses a paused subscription (Razorpay resume API)
   * or clears a scheduled cancel-at-cycle-end flag while still in the paid period.
   */
  async resume(merchantId: string): Promise<{ active: boolean }> {
    if (!razorpayConfigured()) throw new Error('Billing is not configured on this deployment');
    const merchant = await Merchant.findById(merchantId).select('billing accessExpiresAt').lean();
    if (!merchant) throw new Error('Merchant not found');
    const b: any = (merchant as any)?.billing || {};
    if (b.status !== 'paused' && !b.cancelAtCycleEnd) {
      throw new Error('Nothing to resume — the subscription is not paused and no cancellation is scheduled');
    }

    const subId = b.razorpaySubscriptionId;
    if (subId) {
      try {
        await rz.post(`/subscriptions/${encodeURIComponent(subId)}/resume`);
      } catch (e: any) {
        // Non-fatal for cancel-flag clears: Razorpay may reject resume for
        // already-cancelled mandates — the webhook remains the source of truth.
        logger.warn('Razorpay subscription resume call failed (continuing)', { merchantId, subId, error: e.response?.data || e.message });
      }
    }
    await Merchant.updateOne({ _id: merchantId }, { $set: { 'billing.status': 'active', 'billing.lastPaymentError': null, 'billing.cancelAtCycleEnd': false } });
    logger.info('Subscription resumed by merchant', { merchantId });
    return { active: true };
  }

  /** Create a one-time Razorpay order for a self-serve rescue-credit top-up pack. */
  async createCreditCheckout(merchantId: string, packKey: string) {
    if (!razorpayConfigured()) throw new Error('Billing is not configured on this deployment (RAZORPAY_KEY_ID/SECRET).');
    const pack = CREDIT_PACKS[packKey];
    if (!pack) throw new Error('Unknown credit pack');

    let orderId: string;
    try {
      const order = await rz.post('/orders', {
        amount: pack.priceInr * 100, currency: 'INR', receipt: `rs_cr_${merchantId.slice(-6)}_${Date.now()}`,
        notes: { merchantId, kind: 'credit_pack', pack: packKey },
      });
      orderId = order.data.id;
    } catch (e: any) {
      logger.error('Razorpay credit pack order creation failed', { error: e.response?.data || e.message });
      throw new Error('Payment gateway error. Please try again shortly.');
    }

    await Merchant.findByIdAndUpdate(merchantId, { $set: {
      'billing.pendingCreditPack': packKey,
      'billing.pendingCreditOrderId': orderId,
    }});
    return { orderId, amountInr: pack.priceInr * 100, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID, pack: { key: packKey, ...pack } };
  }

  /**
   * Verify a credit-pack payment and top up rescue credits.
   * Same security model as verifyAndProvision: signature over order|payment,
   * order bound to this merchant's stored intent, payment re-fetched from
   * Razorpay (captured / INR / exact amount), one-shot via ProcessedPayment.
   */
  async verifyCreditPurchase(merchantId: string, body: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayConfigured() || !keySecret) throw new Error('Billing is not configured on this deployment');

    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : '';
    if (!paymentId || !orderId || !signature || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^order_[A-Za-z0-9]+$/.test(orderId)) {
      throw new Error('Missing or malformed Razorpay payment verification parameters');
    }

    const expectedSig = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expectedSig, 'hex'), b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid payment signature');

    const merchant = await Merchant.findById(merchantId).select('billing').lean();
    const billing: any = (merchant as any)?.billing;
    if (!merchant || !billing) throw new Error('Merchant not found');
    if (billing.pendingCreditOrderId !== orderId) {
      const prior = await ProcessedPayment.findOne({ provider: 'razorpay', externalId: paymentId }).select('merchantId').lean();
      if (prior && prior.merchantId.toString() === merchantId) {
        return { credits: billing.rescueCredits };
      }
      throw new Error('This payment does not belong to a pending credit top-up for your account');
    }
    const pack = CREDIT_PACKS[billing.pendingCreditPack];
    if (!pack) throw new Error('Pending credit top-up is missing pack details; start again');

    const payment = await this.fetchCapturedPayment(paymentId, orderId, pack.priceInr * 100, merchantId);

    try {
      await ProcessedPayment.create({ provider: 'razorpay', externalId: paymentId, merchantId, kind: 'credit_pack', amountPaise: payment.amount });
    } catch (err: any) {
      if (err?.code === 11000) {
        const prior = await ProcessedPayment.findOne({ provider: 'razorpay', externalId: paymentId }).select('merchantId').lean();
        if (prior && prior.merchantId.toString() === merchantId) return { credits: billing.rescueCredits };
        throw new Error('This payment has already been used');
      }
      throw err;
    }

    const updated: any = await Merchant.findOneAndUpdate(
      { _id: merchantId, 'billing.pendingCreditOrderId': orderId },
      { $inc: { 'billing.rescueCredits': pack.credits }, $unset: { 'billing.pendingCreditPack': 1, 'billing.pendingCreditOrderId': 1 } },
      { new: true }
    );
    logger.info('Rescue credit pack purchased', { merchantId, pack: billing.pendingCreditPack, credits: pack.credits, paymentId });

    await BillingEvent.create({ merchantId, eventType: 'credits_purchased', creditsCost: 0 });
    await recordInvoice({
      merchantId,
      kind: 'credits',
      amountPaise: payment.amount,
      description: `${pack.label} top-up (${pack.credits} rescue credits)`,
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
    });

    return { credits: updated?.billing?.rescueCredits };
  }

  /** Create-or-find a Razorpay plan keyed by (tier+cycle) at the renewal monthly amount. */
  private async ensurePlan(tier: Tier, cycle: Cycle, monthly: number): Promise<string> {
    const key = `rs_plan_${tier}_${cycle}_${monthly}`;
    const { default: mongoose } = await import('mongoose');
    const db = mongoose.connection.db;
    if (db) {
      const col = db.collection('rs_plans');
      const doc = await col.findOne({ _id: key as any });
      if (doc?.planId) return doc.planId;
    }
    const { data } = await rz.post('/plans', { period: PERIOD[cycle], interval: 1, amount: monthly * 100, currency: 'INR', notes: { key } });
    await this.rememberPlan(key, data.id);
    return data.id;
  }
  private async rememberPlan(key: string, planId: string) {
    const { default: mongoose } = await import('mongoose');
    const db = mongoose.connection.db;
    if (db) {
      const col = db.collection('rs_plans');
      await col.updateOne({ _id: key as any }, { $set: { planId } }, { upsert: true });
    }
  }
}
export const subscriptionService = new SubscriptionService();
