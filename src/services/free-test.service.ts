import crypto from 'crypto';
import { TrialUsage } from '../models/TrialUsage';
import { checkSubscriptionAccess } from '../utils/subscription-guard';
import { logger } from '../utils/logger';

/**
 * Test rescues: a merchant sends a rescue message to their OWN phone from their OWN
 * WhatsApp Business number. Meta bills the merchant's WABA, never the platform, but an
 * unlimited, unverified test button is still a spam vector against strangers and puts
 * the platform's Meta app standing at risk. Every test send goes through `reserve()`.
 *
 * Not-yet-paying merchants:
 *   - the recipient must be an owner phone verified by an inbound WhatsApp message,
 *   - FREE_TEST_LIFETIME_LIMIT (3) sends per identity, where identity = merchant, WhatsApp
 *     phone number id, WABA, owner phone and store domain (a new sign-up cannot reset it),
 *   - FREE_TEST_DAILY_PER_MERCHANT (5) per day and FREE_TEST_GLOBAL_DAILY_CAP (300) per day
 *     across the platform,
 *   - FREE_TEST_ENABLED=false switches free tests off entirely.
 * Paying merchants: TEST_SEND_DAILY_PER_PAID_MERCHANT (20) per day.
 *
 * Counters live in MongoDB with conditional upserts, so they fail CLOSED: if the write
 * cannot be made, the send is refused.
 */

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export const freeTestLimits = () => ({
  enabled: process.env.FREE_TEST_ENABLED !== 'false',
  lifetime: num(process.env.FREE_TEST_LIFETIME_LIMIT, 3),
  perDay: num(process.env.FREE_TEST_DAILY_PER_MERCHANT, 5),
  globalPerDay: num(process.env.FREE_TEST_GLOBAL_DAILY_CAP, 300),
  paidPerDay: num(process.env.TEST_SEND_DAILY_PER_PAID_MERCHANT, 20),
});

const digits = (p?: string | null) => String(p || '').replace(/\D/g, '');
/** Compare phones on their last 10 digits (Indian numbers arrive with and without 91). */
export const samePhone = (a?: string | null, b?: string | null) => {
  const x = digits(a);
  const y = digits(b);
  return x.length >= 10 && y.length >= 10 && x.slice(-10) === y.slice(-10);
};

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const endOfIstDay = () => {
  const day = istDay();
  return new Date(Date.parse(`${day}T00:00:00+05:30`) + 2 * 24 * 3600 * 1000);
};

export function isPayingMerchant(merchant: any): boolean {
  const plan = merchant?.billing?.plan;
  if (!plan || plan === 'free_trial') return false;
  try {
    return checkSubscriptionAccess(merchant).allowed;
  } catch {
    return false;
  }
}

export function ownerPhoneVerified(merchant: any): boolean {
  return Boolean(merchant?.ownerPhone && merchant?.ownerPhoneVerifiedAt);
}

/** Identities a free test allowance is tied to. */
export function trialKeys(merchant: any): string[] {
  const keys = new Set<string>([`merchant:${merchant._id}`]);
  const wa = merchant.whatsappConfig || {};
  if (wa.phoneNumberId) keys.add(`pnid:${wa.phoneNumberId}`);
  const waba = wa.wabaId || wa.businessAccountId;
  if (waba) keys.add(`waba:${waba}`);
  const owner = digits(merchant.ownerPhone).slice(-10);
  if (owner.length === 10) keys.add(`owner:${owner}`);
  const shop = merchant.shopify?.shopDomain;
  if (shop) keys.add(`shop:${String(shop).toLowerCase()}`);
  const woo = merchant.connections?.woocommerce?.url;
  if (woo) {
    try {
      keys.add(`woo:${new URL(woo).host.toLowerCase()}`);
    } catch {
      /* not a URL */
    }
  }
  return [...keys];
}

/** Atomically add one to `key` unless it already reached `limit`. */
async function bump(key: string, limit: number, expiresAt?: Date): Promise<boolean> {
  if (limit <= 0) return false;
  try {
    await TrialUsage.findOneAndUpdate(
      { key, count: { $lt: limit } },
      { $inc: { count: 1 }, ...(expiresAt ? { $setOnInsert: { expiresAt } } : {}) },
      { upsert: true, new: true }
    );
    return true;
  } catch (err: any) {
    // Duplicate key = the doc exists and is at the limit (the filter did not match).
    if (err?.code === 11000) return false;
    throw err;
  }
}

async function unbump(keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    await TrialUsage.updateMany({ key: { $in: keys }, count: { $gt: 0 } }, { $inc: { count: -1 } });
  } catch (err: any) {
    logger.warn('free-test: could not release reservation', { error: err?.message });
  }
}

export interface TestStatus {
  paying: boolean;
  enabled: boolean;
  ownerPhoneVerified: boolean;
  limit: number;
  used: number;
  remaining: number;
}

export async function getTestStatus(merchant: any): Promise<TestStatus> {
  const limits = freeTestLimits();
  const paying = isPayingMerchant(merchant);
  if (paying) {
    return { paying, enabled: true, ownerPhoneVerified: ownerPhoneVerified(merchant), limit: limits.paidPerDay, used: 0, remaining: limits.paidPerDay };
  }
  const docs = await TrialUsage.find({ key: { $in: trialKeys(merchant) } }).select('count').lean();
  const used = docs.reduce((max, d: any) => Math.max(max, d.count || 0), 0);
  return {
    paying,
    enabled: limits.enabled,
    ownerPhoneVerified: ownerPhoneVerified(merchant),
    limit: limits.lifetime,
    used,
    remaining: limits.enabled ? Math.max(0, limits.lifetime - used) : 0,
  };
}

export interface Reservation {
  allowed: boolean;
  reason?: string;
  code?: 'disabled' | 'phone_unverified' | 'lifetime_limit' | 'daily_limit' | 'platform_limit';
  remaining?: number;
  /** Give the allowance back when the send itself failed (nothing reached the phone). */
  release: () => Promise<void>;
}

const noop = async () => {};

export async function reserveTestSend(merchant: any): Promise<Reservation> {
  const limits = freeTestLimits();
  const day = istDay();
  const dailyExpiry = endOfIstDay();

  if (isPayingMerchant(merchant)) {
    const key = `paid-day:${merchant._id}:${day}`;
    const ok = await bump(key, limits.paidPerDay, dailyExpiry);
    if (!ok) return { allowed: false, code: 'daily_limit', reason: `You can send ${limits.paidPerDay} test messages a day. Try again tomorrow.`, release: noop };
    return { allowed: true, release: () => unbump([key]) };
  }

  if (!limits.enabled) {
    return { allowed: false, code: 'disabled', reason: 'Free test rescues are paused right now. Choose a plan to send tests.', release: noop };
  }
  if (!ownerPhoneVerified(merchant)) {
    return { allowed: false, code: 'phone_unverified', reason: 'Verify your own mobile number first, so test messages only go to you.', release: noop };
  }

  const keys = trialKeys(merchant);
  const existing = await TrialUsage.find({ key: { $in: keys } }).select('count').lean();
  const used = existing.reduce((max, d: any) => Math.max(max, d.count || 0), 0);
  if (used >= limits.lifetime) {
    return { allowed: false, code: 'lifetime_limit', reason: `You've used your ${limits.lifetime} free test rescues. Choose a plan to keep testing.`, remaining: 0, release: noop };
  }

  const taken: string[] = [];
  const rollback = async () => unbump(taken);

  const globalKey = `global-day:${day}`;
  if (!(await bump(globalKey, limits.globalPerDay, dailyExpiry))) {
    logger.warn('free-test: platform daily cap reached', { day, cap: limits.globalPerDay });
    return { allowed: false, code: 'platform_limit', reason: 'Free test rescues are busy today. Try again tomorrow, or choose a plan.', release: noop };
  }
  taken.push(globalKey);

  const dayKey = `merchant-day:${merchant._id}:${day}`;
  if (!(await bump(dayKey, limits.perDay, dailyExpiry))) {
    await rollback();
    return { allowed: false, code: 'daily_limit', reason: `You can send ${limits.perDay} test rescues a day. Try again tomorrow.`, release: noop };
  }
  taken.push(dayKey);

  for (const key of keys) {
    if (!(await bump(key, limits.lifetime))) {
      await rollback();
      return { allowed: false, code: 'lifetime_limit', reason: `You've used your ${limits.lifetime} free test rescues. Choose a plan to keep testing.`, remaining: 0, release: noop };
    }
    taken.push(key);
  }

  return { allowed: true, remaining: Math.max(0, limits.lifetime - used - 1), release: rollback };
}

// ── Owner phone verification ────────────────────────────────────────────────
// The owner proves a phone is theirs by sending a code FROM it TO their business
// number. That inbound message also opens the 24h window for the test that follows.

const CODE_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const MAX_UNPAID_PHONE_CHANGES = 3;

export const hashCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

export function newVerificationCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function buildVerification(phone: string) {
  const code = newVerificationCode();
  return {
    code,
    record: { phone, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS), attempts: 0 },
  };
}

/**
 * Called for every inbound message to a merchant's number. Returns true when the message
 * was a verification attempt from the pending phone (so it must not be treated as a
 * customer reply).
 */
export async function tryVerifyOwnerPhone(merchant: any, from: string, text: string): Promise<boolean> {
  const pending = merchant?.ownerPhoneVerification;
  if (!pending?.phone || !samePhone(pending.phone, from)) return false;
  const match = String(text || '').match(/\b(\d{6})\b/);
  if (!match) return false;

  const { Merchant } = await import('../models/Merchant');
  const expired = !pending.expiresAt || new Date(pending.expiresAt).getTime() < Date.now();
  if (expired || (pending.attempts || 0) >= MAX_ATTEMPTS) {
    await Merchant.updateOne({ _id: merchant._id }, { $unset: { ownerPhoneVerification: 1 } });
    logger.info('Owner phone verification expired or locked', { merchantId: merchant._id });
    return true;
  }
  if (hashCode(match[1]) !== pending.codeHash) {
    await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'ownerPhoneVerification.attempts': 1 } });
    return true;
  }
  await Merchant.updateOne(
    { _id: merchant._id },
    { $set: { ownerPhone: pending.phone, ownerPhoneVerifiedAt: new Date() }, $unset: { ownerPhoneVerification: 1 } }
  );
  logger.info('Owner phone verified via inbound WhatsApp', { merchantId: merchant._id });
  return true;
}
