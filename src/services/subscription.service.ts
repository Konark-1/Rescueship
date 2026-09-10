/**
 * subscription.service.ts
 * ─────────────────────────────────────────────────────────────
 * The price is computed HERE, server-side, before any charge. The
 * frontend mirrors these constants only to *display*; it never sets
 * the amount. Pattern:
 *   1. upfront INTRO order  = first quarter at the −40% intro price (one-time)
 *   2. RENEWAL subscription = recurring at the cycle price, first charge
 *      scheduled for the renewal date (start_at), so the customer is
 *      active NOW but only pays the renewal rate when the intro ends.
 *   3. on intro capture  → provision plan immediately (activatedAt = now)
 *   4. on sub charged    → roll cycleStartDate forward
 *
 * If your repo's existing create-subscription route already builds the
 * Razorpay plan/subscription, point the frontend at it and drop this —
 * it only needs to return { orderId, subscriptionId, amountInr, currency, keyId }.
 */
import crypto from 'crypto';
import axios from 'axios';
import { Merchant, ProcessedPayment } from '../models';
import { emailService } from './email.service';
import { logger } from '../utils/logger';

export type Tier = 'starter' | 'growth' | 'scale' | 'fleet';
export type Cycle = 'quarterly' | 'semi' | 'annual';

const BASE: Record<Tier, number> = { starter: 1199, growth: 2899, scale: 5499, fleet: 9499 };
export const LIMIT: Record<Tier, number> = { starter: 1000, growth: 5000, scale: 12000, fleet: 25000 };
const MONTHS: Record<Cycle, number> = { quarterly: 3, semi: 6, annual: 12 };
const DISC: Record<Cycle, number> = { quarterly: 0, semi: 0.15, annual: 0.20 };
const PERIOD: Record<Cycle, 'monthly' | 'quarterly' | 'yearly'> = { quarterly: 'monthly', semi: 'monthly', annual: 'monthly' };

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
    let subscriptionId: string;

    try {
      // (1) upfront intro order — one-time, charged now
      const order = await rz.post('/orders', {
        amount: p.introUpfront * 100, currency: 'INR', receipt: `rs_${merchantId.slice(-6)}_${Date.now()}`,
        notes: { merchantId, tier, cycle, kind: 'intro_quarter' },
      });
      orderId = order.data.id;

      // (2) renewal subscription — first charge at the renewal date
      const planId = await this.ensurePlan(tier, cycle, p.renewMonthly);
      const startAt = Math.floor(Date.now() / 1000) + (MONTHS[cycle] || 3) * 30 * 24 * 3600;
      const subscription = await rz.post('/subscriptions', {
        plan_id: planId, total_count: 12, quantity: 1, start_at: startAt,
        notes: { merchantId, tier, cycle, kind: 'renewal' },
      });
      subscriptionId = subscription.data.id;
    } catch (e: any) {
      logger.error('Razorpay API subscription checkout failed', { error: e.response?.data || e.message });
      throw new Error('Payment gateway error. Please verify Razorpay keys or try again shortly.');
    }

    await Merchant.findByIdAndUpdate(merchantId, { $set: {
      'billing.pendingTier': tier, 'billing.pendingCycle': cycle,
      'billing.introOrderId': orderId, 'billing.razorpaySubscriptionId': subscriptionId,
      'billing.renewMonthly': p.renewMonthly,
      'billing.status': 'pending_payment',
    }});

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
    const merchant = await Merchant.findById(merchantId).select('billing').lean();
    const billing: any = (merchant as any)?.billing;
    if (!merchant || !billing) throw new Error('Merchant not found');
    if (!billing.introOrderId || billing.introOrderId !== orderId) {
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
      throw new Error(`Payment amount mismatch: expected ₹${expectedPaise / 100} for ${tier} (${cycle})`);
    }

    // (5) one-shot: unique index rejects replays (same payment, any merchant)
    try {
      await ProcessedPayment.create({ provider: 'razorpay', externalId: paymentId, merchantId, kind: 'subscription_intro', amountPaise: payment.amount });
    } catch (err: any) {
      if (err?.code === 11000) {
        logger.warn('Checkout verify replay rejected: payment already consumed', { merchantId, paymentId });
        // Idempotent success for the legitimate owner re-submitting; hard fail for anyone else.
        const prior = await ProcessedPayment.findOne({ provider: 'razorpay', externalId: paymentId }).select('merchantId').lean();
        if (prior && prior.merchantId.toString() === merchantId) return this.status(merchantId);
        throw new Error('This payment has already been used');
      }
      throw err;
    }

    const now = new Date();
    const renewalMonths = MONTHS[cycle] || 3;
    const renewal = new Date(now.getTime() + renewalMonths * 30 * 24 * 3600 * 1000);
    const prev = await Merchant.findOneAndUpdate(
      { _id: merchantId, 'billing.introOrderId': orderId },
      { $set: {
        'billing.plan': tier,
        'billing.planOrderLimit': LIMIT[tier],
        'billing.billingCycle': cycle,
        'billing.cycleStartDate': now,
        'billing.nextInvoiceDate': renewal,
        'billing.renewMonthly': p.renewMonthly,
        'billing.activatedAt': now,
        'billing.status': 'active',
        'billing.currentMonthOrders': 0,
        'onboarding.completedAt': now,
      }, $unset: { 'billing.pendingTier': 1, 'billing.pendingCycle': 1, 'billing.introOrderId': 1 } }
    );
    logger.info('Plan provisioned via self-serve checkout', { merchantId, tier, cycle, paymentId });
    // Notify only on the FIRST activation — renewals/re-verifications stay silent.
    if (!(prev as any)?.billing?.activatedAt) {
      void this.notifyFirstActivation(merchantId, tier);
    }
    return this.status(merchantId);
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
   * Called from the subscription.charged webhook — roll the cycle forward.
   * Amount must match the stored renewal charge for the merchant's active cycle.
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
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'billing.cycleStartDate': new Date(), 'billing.status': 'active', 'billing.lastPaymentError': null } });
    logger.info('Subscription renewal charged', { merchantId: merchant._id, subscriptionId });
  }

  /** Called from subscription.paused webhook */
  async onSubscriptionPaused(subscriptionId: string) {
    const merchant = await this.merchantForSubscription(subscriptionId);
    if (!merchant) return;
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'billing.status': 'paused' } });
    logger.warn('Subscription paused', { merchantId: merchant._id });
  }

  /** Called from subscription.cancelled or subscription.expired webhook */
  async onSubscriptionCancelledOrExpired(subscriptionId: string, status: 'cancelled' | 'expired') {
    const merchant = await this.merchantForSubscription(subscriptionId);
    if (!merchant) return;
    await Merchant.updateOne({ _id: merchant._id }, { $set: {
      'billing.plan': 'free_trial',
      'billing.planOrderLimit': 500,
      'billing.status': status,
    }});
    logger.warn(`Subscription ${status}`, { merchantId: merchant._id });
  }

  /** Called from payment.failed webhook (subscription payments carry the subscription id). */
  async onPaymentFailed(subscriptionId: string | undefined, orderId: string | undefined, errorReason?: string) {
    let merchant = subscriptionId ? await this.merchantForSubscription(subscriptionId) : null;
    if (!merchant && orderId && /^order_[A-Za-z0-9]+$/.test(orderId)) {
      merchant = await Merchant.findOne({ 'billing.introOrderId': orderId }).select('_id');
    }
    if (!merchant) return;
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'billing.status': 'past_due', 'billing.lastPaymentError': (errorReason || 'Payment failed').slice(0, 256) } });
    logger.error('Subscription payment failed', { merchantId: merchant._id, errorReason });
  }

  async status(merchantId: string) {
    const m = await Merchant.findById(merchantId).lean();
    const b = (m as any)?.billing || {};
    const active = !!b.activatedAt && b.plan && b.plan !== 'free_trial';
    return {
      active, plan: b.plan, cycle: normalizeCycle(b.billingCycle) || b.billingCycle, limit: b.planOrderLimit,
      renewMonthly: b.renewMonthly, activatedAt: b.activatedAt, nextInvoice: b.nextInvoiceDate,
    };
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
