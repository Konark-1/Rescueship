/**
 * Plan → feature ladder. Single source of truth for what each paid plan unlocks
 * (enforced by requireFeature() on routes and planAllows() inside services).
 * Plans set WHAT is included; the order band (billing.planOrderLimit) sets HOW MUCH.
 * Each plan includes everything in the plan below it. Keep in sync with
 * frontend/src/config/pricing.config.ts (tests/pricing-consistency.test.ts checks it).
 */
/** Rescue: act after a failed delivery attempt. */
const RESCUE = [
  'basic_kpi',
  'ndr_rescue',          // WhatsApp NDR follow-up: reschedule, address fix, location pin
  'address_text', 'address_location', 'address_both',
  'shiprocket', 'delhivery',
];
/** Convert: + handle customers who won't/can't pay cash. */
const CONVERT = [
  ...RESCUE,
  'cod_conversion',      // COD → prepaid payment links (merchant's own Razorpay/Cashfree)
  'partial_deposit',     // partial COD deposit requests
  'ai_address',          // Gemini address/landmark parsing
  'clickpost', 'custom_carrier', 'all_carriers',
  'advanced_charts', 'realtime_feed', 'weekly_report', 'upi_qr', 'seller_notifications',
];
/** Prevent: + stop risky orders before they ship. */
const PREVENT = [
  ...CONVERT,
  'predelivery',         // pre-dispatch COD confirmation + delivery-day reminders
  'pincode_guard', 'storefront_sync', // pincode risk rules + storefront sync
  'fraud_watchtower', 'csv_export',
];

export const planLimits: Record<string, { orderLimit: number; features: string[] }> = {
  // No free tier: an account without a paid plan gets no automation (see subscription-guard).
  free_trial: { orderLimit: 0, features: [] },
  // The order limit comes from the purchased band (billing.planOrderLimit); these are fallbacks.
  rescue: { orderLimit: 500, features: RESCUE },
  convert: { orderLimit: 500, features: CONVERT },
  prevent: { orderLimit: 500, features: PREVENT },
  enterprise: { orderLimit: 99999999, features: [...PREVENT, 'priority_support'] },
  // Legacy plan keys (accounts provisioned before Oct 2026) map onto the new ladder.
  starter: { orderLimit: 500, features: RESCUE },
  growth: { orderLimit: 2000, features: CONVERT },
  scale: { orderLimit: 6000, features: PREVENT },
  fleet: { orderLimit: 15000, features: [...PREVENT, 'priority_support'] },
};

/** True when the merchant's current plan includes `feature`. */
export function planAllows(merchant: any, feature: string): boolean {
  const plan = merchant?.billing?.plan || 'free_trial';
  return (planLimits[plan]?.features || []).includes(feature);
}
