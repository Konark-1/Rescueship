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

export const COD_AMENDABLE_CARRIERS: readonly string[] = (process.env.COD_AMENDABLE_CARRIERS || 'shiprocket,clickpost,delhivery')
  .split(',')
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

export interface ConversionCheck {
  ok: boolean;
  reason?: 'unknown_order_value' | 'not_cod' | 'post_dispatch_disabled' | 'carrier_cannot_amend_cod';
}

export function canOfferOnlinePayment(order: any, merchant: any): ConversionCheck {
  const value = Number(order?.orderValue || 0);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'unknown_order_value' };
  if (order?.paymentMethod !== 'cod') return { ok: false, reason: 'not_cod' };

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
