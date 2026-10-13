/**
 * Plan → feature ladder. Single source of truth for what each paid plan unlocks
 * (enforced by requireFeature() on routes and planAllows() inside services).
 * Each plan includes everything in the plan below it. Keep in sync with
 * frontend/src/config/pricing.config.ts (tests/pricing-consistency.test.ts checks it).
 */
const STARTER = [
  'basic_kpi',
  'ndr_rescue',          // WhatsApp NDR follow-up: reschedule, address fix, location pin
  'address_text', 'address_location', 'address_both',
  'shiprocket', 'delhivery',
];
const GROWTH = [
  ...STARTER,
  'cod_conversion',      // COD → prepaid payment links (merchant's own Razorpay/Cashfree)
  'partial_deposit',     // partial COD deposit requests
  'ai_address',          // Gemini address/landmark parsing
  'clickpost', 'custom_carrier', 'all_carriers',
  'advanced_charts', 'realtime_feed', 'weekly_report', 'upi_qr', 'seller_notifications',
];
const SCALE = [
  ...GROWTH,
  'predelivery',         // pre-delivery confirmation + COD reminders
  'pincode_guard', 'storefront_sync', // pincode risk rules + storefront sync
  'fraud_watchtower', 'csv_export',
];
const FLEET = [...SCALE, 'priority_support', 'onboarding_call'];

export const planLimits: Record<string, { orderLimit: number; features: string[] }> = {
  // No free tier: an account without a paid plan gets no automation (see subscription-guard).
  free_trial: { orderLimit: 0, features: [] },
  starter: { orderLimit: 500, features: STARTER },
  growth: { orderLimit: 2000, features: GROWTH },
  scale: { orderLimit: 6000, features: SCALE },
  fleet: { orderLimit: 15000, features: FLEET },
  enterprise: { orderLimit: 99999999, features: FLEET },
};

/** True when the merchant's current plan includes `feature`. */
export function planAllows(merchant: any, feature: string): boolean {
  const plan = merchant?.billing?.plan || 'free_trial';
  return (planLimits[plan]?.features || []).includes(feature);
}
