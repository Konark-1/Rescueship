/**
 * whatsapp-cost.service.ts
 * ─────────────────────────────────────────────────────────────
 * Meta conversation-category classifier + per-merchant spend
 * estimator. Catches the marketing-rate trap (L-3): a message that
 * leads with a discount is MARKETING in Meta's eyes regardless of
 * intent, ~6x the utility rate in India.
 */
import { Merchant, Order } from '../models';

export type MetaCategory = 'utility' | 'marketing' | 'service' | 'auth';
const RATE_INR: Record<MetaCategory, number> = { utility: 0.14, marketing: 0.88, service: 0, auth: 0.20 };

export interface TemplateMeta { name: string; category: MetaCategory; hasIncentive: boolean; }

export function classifyTemplate(t: { name: string; body: string; hasDiscount: boolean }): TemplateMeta {
  const promo = t.hasDiscount || /off|discount|save ₹|coupon|cashback/i.test(t.body);
  const category: MetaCategory = promo ? 'marketing' : /otp|verify|code/i.test(t.body) ? 'auth' : 'utility';
  return { name: t.name, hasIncentive: promo, category };
}
export const costInr = (m: TemplateMeta, conversations = 1) => +(RATE_INR[m.category] * conversations).toFixed(2);

/** Meta can reclassify — reconcile intended vs actual, never trust intended alone. */
export function reconcileCategory(intended: MetaCategory, metaReturned: MetaCategory): { effective: MetaCategory; mismatch: boolean } {
  return { effective: metaReturned || intended, mismatch: !!metaReturned && metaReturned !== intended };
}

/** Stamp an outbound send + accumulate the merchant's projected monthly Meta spend. */
export async function recordOutbound(args: {
  orderId: string; merchantId: string; templateName: string; body: string; hasDiscount: boolean; metaReturnedCategory?: MetaCategory;
}): Promise<TemplateMeta> {
  const meta = classifyTemplate({ name: args.templateName, body: args.body, hasDiscount: args.hasDiscount });
  const { effective } = reconcileCategory(meta.category, args.metaReturnedCategory as MetaCategory);
  const add = RATE_INR[effective];

  if (Order && typeof Order.findByIdAndUpdate === 'function') {
    await Order.findByIdAndUpdate(args.orderId, {
      $set: { 'ndr.lastOutboundAt': new Date(), 'ndr.lastOutboundMerchantId': args.merchantId },
    });
  }

  if (Merchant && typeof Merchant.findByIdAndUpdate === 'function') {
    await Merchant.findByIdAndUpdate(args.merchantId, { $inc: { 'billing.estimatedMetaSpendMonth': add } });
  }

  return { ...meta, category: effective };
}
