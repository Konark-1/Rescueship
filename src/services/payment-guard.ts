/**
 * payment-guard.ts
 * ─────────────────────────────────────────────────────────────
 * Single place that decides whether an order may be offered an online
 * (COD → prepaid) payment link. Guardrails:
 *   - never when the order value is unknown/zero (carrier-created orders),
 *   - never on a non-COD order,
 *   - after dispatch, only when the merchant explicitly opted in AND the
 *     carrier has an implemented COD amendment; otherwise the rider would
 *     still collect cash from a customer who already paid.
 */

// Carriers whose COD amount we can change AFTER dispatch through a verified API. Empty by
// default: Shiprocket only allows COD→prepaid before pickup (no API) and ClickPost's NDR API
// has no COD amendment. Enable a carrier here only after testing it on a live account.
import { planAllows } from '../config/plans';

export const COD_AMENDABLE_CARRIERS: readonly string[] = (process.env.COD_AMENDABLE_CARRIERS || '')
  .split(',')
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

export interface ConversionCheck {
  ok: boolean;
  reason?: 'unknown_order_value' | 'not_cod' | 'post_dispatch_disabled' | 'carrier_cannot_amend_cod' | 'payment_webhook_unverified' | 'plan_excludes_conversion';
}

/**
 * A payment link is only useful if the gateway's signed webhook reaches us; otherwise the
 * customer pays and the order stays COD (the rider collects again). The first correctly
 * signed webhook (or the ₹1 self-test from onboarding) sets paymentConfig.webhookVerifiedAt.
 * PAYMENT_REQUIRE_VERIFIED_WEBHOOK=false disables the check (tests / migration only).
 */
export function paymentWebhookReady(merchant: any): boolean {
  if (process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK === 'false') return true;
  return Boolean(merchant?.paymentConfig?.webhookVerifiedAt);
}

export function canOfferOnlinePayment(order: any, merchant: any): ConversionCheck {
  // COD → prepaid links are a Growth+ feature; Starter keeps the reschedule/address path.
  if (!planAllows(merchant, 'cod_conversion')) return { ok: false, reason: 'plan_excludes_conversion' };
  const value = Number(order?.orderValue || 0);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'unknown_order_value' };
  if (order?.paymentMethod !== 'cod') return { ok: false, reason: 'not_cod' };
  if (!paymentWebhookReady(merchant)) return { ok: false, reason: 'payment_webhook_unverified' };

  const dispatched = Boolean(order?.awb);
  if (dispatched) {
    if (merchant?.settings?.codConversion?.allowPostDispatch !== true) {
      return { ok: false, reason: 'post_dispatch_disabled' };
    }
    const carrier = String(order?.carrier || '').toLowerCase();
    if (!COD_AMENDABLE_CARRIERS.includes(carrier)) {
      return { ok: false, reason: 'carrier_cannot_amend_cod' };
    }
  }
  return { ok: true };
}
