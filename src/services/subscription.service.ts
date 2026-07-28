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
import { Merchant } from '../models';
import { logger } from '../utils/logger';

export type Tier = 'starter' | 'growth' | 'scale';
export type Cycle = 'quarterly' | 'semi' | 'annual';

const BASE: Record<Tier, number> = { starter: 2999, growth: 8999, scale: 19999 };
const LIMIT: Record<Tier, number> = { starter: 2000, growth: 10000, scale: 50000 };
const MONTHS: Record<Cycle, number> = { quarterly: 3, semi: 6, annual: 12 };
const DISC: Record<Cycle, number> = { quarterly: 0, semi: 0.15, annual: 0.30 };
const INTRO_OFF = 0.4;
const PERIOD: Record<Cycle, 'monthly' | 'quarterly' | 'yearly'> = { quarterly: 'monthly', semi: 'monthly', annual: 'monthly' };

export function priceFor(tier: Tier, cycle: Cycle) {
  const base = BASE[tier];
  const introMonthly = Math.round(base * (1 - INTRO_OFF));
  const renewMonthly = Math.round(base * (1 - DISC[cycle]));
  return { introMonthly, renewMonthly, introUpfront: introMonthly * 3, renewalCharge: renewMonthly * MONTHS[cycle], months: MONTHS[cycle] };
}

const rz = axios.create({ baseURL: 'https://api.razorpay.com/v1', auth: { username: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy', password: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret' } });

export class SubscriptionService {
  /** Build the upfront intro order + the deferred renewal subscription. */
  async createCheckout(merchantId: string, tier: Tier, cycle: Cycle) {
    if (!BASE[tier]) throw new Error('Invalid tier');
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
      const startAt = Math.floor(Date.now() / 1000) + 90 * 24 * 3600; // ~1 quarter from now
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

    return { orderId, subscriptionId, amountInr: p.introUpfront * 100, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy' };
  }

  /** Verify Razorpay signature, then PROVISION the plan (this is the activation). */
  async verifyAndProvision(merchantId: string, body: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string; tier: Tier; cycle: Cycle }) {
    if (process.env.RAZORPAY_KEY_SECRET) {
      const sig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest('hex');
      const a = Buffer.from(sig, 'hex'), b = Buffer.from(body.razorpay_signature || '', 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid payment signature');
    }

    const p = priceFor(body.tier, body.cycle);
    const now = new Date();
    const renewal = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    await Merchant.findByIdAndUpdate(merchantId, { $set: {
      'billing.plan': body.tier,
      'billing.planOrderLimit': LIMIT[body.tier],
      'billing.billingCycle': body.cycle,
      'billing.cycleStartDate': now,
      'billing.nextInvoiceDate': renewal,
      'billing.renewMonthly': p.renewMonthly,
      'billing.activatedAt': now,
      'billing.status': 'active',
      'billing.currentMonthOrders': 0,
      'onboarding.completedAt': now,
    }});
    logger.info('Plan provisioned via self-serve checkout', { merchantId, tier: body.tier, cycle: body.cycle });
    return this.status(merchantId);
  }

  /** Called from the subscription.charged webhook — roll the cycle forward. */
  async onRenewalCharged(merchantId: string) {
    await Merchant.findByIdAndUpdate(merchantId, { $set: { 'billing.cycleStartDate': new Date(), 'billing.status': 'active' } });
    logger.info('Subscription renewal charged', { merchantId });
  }

  /** Called from subscription.paused webhook */
  async onSubscriptionPaused(merchantId: string) {
    await Merchant.findByIdAndUpdate(merchantId, { $set: { 'billing.status': 'paused' } });
    logger.warn('Subscription paused', { merchantId });
  }

  /** Called from subscription.cancelled or subscription.expired webhook */
  async onSubscriptionCancelledOrExpired(merchantId: string, status: 'cancelled' | 'expired') {
    await Merchant.findByIdAndUpdate(merchantId, { $set: {
      'billing.plan': 'free_trial',
      'billing.planOrderLimit': 500,
      'billing.status': status,
    }});
    logger.warn(`Subscription ${status}`, { merchantId });
  }

  /** Called from payment.failed webhook */
  async onPaymentFailed(merchantId: string, errorReason?: string) {
    await Merchant.findByIdAndUpdate(merchantId, { $set: { 'billing.status': 'past_due', 'billing.lastPaymentError': errorReason || 'Payment failed' } });
    logger.error('Subscription payment failed', { merchantId, errorReason });
  }

  async status(merchantId: string) {
    const m = await Merchant.findById(merchantId).lean();
    const b = (m as any)?.billing || {};
    const active = !!b.activatedAt && b.plan && b.plan !== 'free_trial';
    return {
      active, plan: b.plan, cycle: b.billingCycle, limit: b.planOrderLimit,
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
