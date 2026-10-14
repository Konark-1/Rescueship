/**
 * 🚢 RescueShip — pricing & value model (single source for landing + billing).
 *
 * Price = feature PLAN (what is included) × monthly ORDER BAND (how much).
 * Backend mirror: src/services/subscription.service.ts (PRICE) and src/config/plans.ts
 * (features). tests/pricing-consistency.test.ts fails if the two drift.
 *
 * How prices were set (Oct 2026):
 *   burn  = orders × COD share × COD RTO rate × cost per RTO
 *   save  = burn × expected RTO reduction for the plan
 *   price ≈ 20% of save (merchant keeps ~4–7×), volume discount, ₹999 floor.
 *
 * Evidence behind the defaults (vendor/industry blogs, used at or below their low end):
 *   - COD RTO 30–40% (Base, India benchmarks 2026) → we use 30%.
 *   - Cost of one RTO ₹205–315 direct (CampaignHQ) → we use ₹250 incl. packaging/wasted CAC.
 *   - Failure reasons: customer unavailable 28–45%, address 14–25%, refused/COD 10–37%,
 *     premises closed 10–15%, rescheduled ~9% (GoSwift, Shipsy, Pragma).
 *   - Automated NDR follow-up: 8–14% RTO reduction (Base) → Rescue 12%.
 *   - Prepaid nudge converts 8–12% of COD orders (CampaignHQ); prepaid RTO ≈ half of COD (Base)
 *     → Convert ≈ 19%.
 *   - Pre-dispatch COD confirmation: 30–40% COD RTO cut (CampaignHQ, vendor) → we credit
 *     only 15% on top → Prevent ≈ 1 − (1−0.19)(1−0.15) ≈ 31%.
 */

export type PlanKey = 'rescue' | 'convert' | 'prevent';
/** @deprecated alias kept for older imports */
export type Tier = PlanKey;
export type Band = 500 | 1000 | 2500 | 5000 | 10000;
export type Cycle = 'quarterly' | 'semi' | 'annual';

export const BANDS: Band[] = [500, 1000, 2500, 5000, 10000];
/** Above the top band → custom (enterprise) pricing. */
export const CUSTOM_ABOVE = 10000;

/** Monthly price (₹, before GST) per plan × band. Mirror of the backend PRICE table. */
export const PRICE: Record<PlanKey, Record<Band, number>> = {
  rescue:  { 500: 999,  1000: 1499, 2500: 2499, 5000: 4499,  10000: 7999 },
  convert: { 500: 1499, 1000: 1999, 2500: 3999, 5000: 6999,  10000: 12499 },
  prevent: { 500: 1999, 1000: 2999, 2500: 6499, 5000: 11499, 10000: 19999 },
};

export interface PlanConfig {
  key: PlanKey;
  name: string;
  tagline: string;
  /** When the plan acts in the order's life. */
  actsWhen: string;
  /** Share of failed-delivery reasons the plan can act on (range, for display). */
  coverage: string;
  /** Expected reduction in RTOs (fraction) used for the savings estimate. */
  reduction: number;
  bestFor: string;
  features: string[];
}

export const PLANS: PlanConfig[] = [
  {
    key: 'rescue',
    name: 'Rescue',
    tagline: 'Save the parcel after a failed delivery.',
    actsWhen: 'After the courier marks a delivery failed',
    coverage: '≈50–70% of failure reasons',
    reduction: 0.12,
    bestFor: 'New brands losing parcels to “customer not available”',
    features: [
      'WhatsApp rescue within minutes of a failed attempt',
      'Reschedule, fix address or share location pin',
      'Shiprocket & Delhivery',
      'Rescue dashboard',
    ],
  },
  {
    key: 'convert',
    name: 'Convert',
    tagline: 'Also turn COD refusals into paid orders.',
    actsWhen: '+ when the customer can’t or won’t pay cash',
    coverage: '≈60–85% of failure reasons',
    reduction: 0.19,
    bestFor: 'COD-heavy brands where customers say “cash nahi hai”',
    features: [
      'Everything in Rescue',
      'Pay-online & part-payment links (your Razorpay/Cashfree)',
      'Prepaid offer right after a COD order',
      'AI address & landmark correction',
      'All couriers, live analytics, weekly ROI report',
    ],
  },
  {
    key: 'prevent',
    name: 'Prevent',
    tagline: 'Also stop risky orders before they ship.',
    actsWhen: '+ before the parcel leaves your warehouse',
    coverage: 'All of the above + pre-shipment check',
    reduction: 0.31,
    bestFor: 'High-value or high-risk products, Tier-2/3 COD',
    features: [
      'Everything in Convert',
      'Confirm COD orders on WhatsApp before dispatch',
      'Delivery-day COD reminder',
      'Pincode risk rules + storefront sync',
      'Courier fake-attempt watch, CSV exports',
    ],
  },
];

export const CYCLES: { key: Cycle; label: string; months: number; discount: number; tag: string }[] = [
  { key: 'quarterly', label: 'Quarterly',   months: 3,  discount: 0,    tag: '90-Day Guarantee' },
  { key: 'semi',      label: 'Semi-Annual', months: 6,  discount: 0.10, tag: '−10%' },
  { key: 'annual',    label: 'Annual',      months: 12, discount: 0.20, tag: '−20%' },
];

export interface StoreMetrics {
  aov: number;          // Average order value (₹)
  codPct: number;       // COD share 0..1
  codRtoRate: number;   // Share of COD orders that come back (0..1)
  courierRto: number;   // Forward + return freight lost per RTO (₹)
  wastedCac: number;    // Packaging + wasted ad spend per RTO (₹)
}

export const DEFAULT_METRICS: StoreMetrics = {
  aov: 1200,
  codPct: 0.65,
  codRtoRate: 0.30,
  courierRto: 130,
  wastedCac: 120,
};

/** Kept for older imports: cost of one RTO with default metrics. */
export const AVG_RESCUE_VALUE = DEFAULT_METRICS.courierRto + DEFAULT_METRICS.wastedCac;

/** Message top-up packs — mirror of backend CREDIT_PACKS (display only). */
export const CREDIT_PACKS: { key: string; credits: number; priceInr: number; label: string }[] = [
  { key: 'pack_500',  credits: 500,  priceInr: 499,  label: '500 messages' },
  { key: 'pack_2000', credits: 2000, priceInr: 1499, label: '2,000 messages' },
  { key: 'pack_5000', credits: 5000, priceInr: 2999, label: '5,000 messages' },
];

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

/** Smallest band that covers the volume; null above the top band (custom pricing). */
export function bandFor(volume: number): Band | null {
  return BANDS.find((b) => volume <= b) ?? null;
}

export function planByKey(key: PlanKey): PlanConfig {
  return PLANS.find((p) => p.key === key) || PLANS[0];
}

export function priceFor(plan: PlanKey, band: Band, cycle: Cycle) {
  const c = CYCLES.find((item) => item.key === cycle) || CYCLES[0];
  const base = PRICE[plan][band];
  const monthly = Math.round(base * (1 - c.discount));
  const upfront = monthly * c.months;
  return { monthly, upfront, months: c.months, base };
}

/**
 * Burn and save for a store. "Burn" = what RTOs cost per month today; "save" = the
 * expected reduction for the plan. Estimates — the dashboard shows real recovered ₹
 * after the first 30 days.
 */
export function estimate(volume: number, metrics: Partial<StoreMetrics> = {}, plan: PlanKey = 'rescue') {
  const m = { ...DEFAULT_METRICS, ...metrics };
  const costPerRto = m.courierRto + m.wastedCac;
  const codOrders = Math.round(volume * m.codPct);
  const rtos = Math.round(codOrders * m.codRtoRate);
  const burn = Math.round(rtos * costPerRto);
  const reduction = planByKey(plan).reduction;
  const rtosAvoided = Math.round(rtos * reduction);
  const saved = Math.round(burn * reduction);
  return { codOrders, rtos, burn, costPerRto, reduction, rtosAvoided, saved };
}

/** Recommend the cheapest plan whose saving still beats ~3× its price; prefer more features. */
export function recommendedPlan(volume: number, metrics: Partial<StoreMetrics> = {}): PlanKey {
  const band = bandFor(volume) ?? 10000;
  const ranked: PlanKey[] = ['prevent', 'convert', 'rescue'];
  return ranked.find((k) => estimate(volume, metrics, k).saved >= 3 * PRICE[k][band]) ?? 'rescue';
}
