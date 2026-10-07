/**
 * 🚢 RescueShip — Authoritative Unified Pricing Configuration
 * Single source of truth for both Landing Page presentation and in-app Billing Checkout.
 * Hardcoded backend-enforced truth (The ₹4,999 Mandate):
 * Starter (₹4,999), Growth (₹11,999), Scale (₹24,999), Fleet (₹44,999).
 */

export type Tier = 'starter' | 'growth' | 'scale' | 'fleet';
export type Cycle = 'quarterly' | 'semi' | 'annual';

export const AVG_RESCUE_VALUE = 250; // ₹ saved per rescue (midpoint of ₹200–400 RTO courier cost + repackaging)

export interface Plan {
  id: Tier;
  name: string;
  maxOrders: number;
  priceMonthly: number;
  blurb: string;
}

export interface TierConfig {
  key: Tier;
  name: string;
  orders: number;
  base: number;
  blurb: string;
}

export const TIERS: TierConfig[] = [
  { key: 'starter', name: 'Starter', orders: 1000,  base: 4999,  blurb: 'For early D2C brands feeling the first RTO sting.' },
  { key: 'growth',  name: 'Growth',  orders: 5000,  base: 11999, blurb: 'Where recovery becomes a line item you watch grow.' },
  { key: 'scale',   name: 'Scale',   orders: 12000, base: 24999, blurb: 'For scaling brands that refuse to lose orders.' },
  { key: 'fleet',   name: 'Fleet',   orders: 25000, base: 44999, blurb: 'For high-volume ops with multi-carrier delivery.' },
];

/** Aliased for components expecting `PLANS` (e.g. PlanPicker, PricingSection) */
export const PLANS: Plan[] = TIERS.map((t) => ({
  id: t.key,
  name: t.name,
  maxOrders: t.orders,
  priceMonthly: t.base,
  blurb: t.blurb,
}));

export const CYCLES: { key: Cycle; label: string; months: number; discount: number; tag: string }[] = [
  { key: 'quarterly', label: 'Quarterly',   months: 3,  discount: 0,    tag: '90-Day Guarantee' },
  { key: 'semi',      label: 'Semi-Annual', months: 6,  discount: 0.15, tag: '−15%' },
  { key: 'annual',    label: 'Annual',      months: 12, discount: 0.20, tag: '−20%' },
];

export interface StoreMetrics {
  aov: number;          // Average Order Value (e.g. 1200)
  codPct: number;       // COD percentage 0..1 (e.g. 0.70)
  courierRto: number;   // 2-way courier RTO cost (e.g. 140)
  wastedCac: number;    // Wasted CAC + packaging (e.g. 250)
}

export const DEFAULT_METRICS: StoreMetrics = {
  aov: 1200,
  codPct: 0.65,
  courierRto: 130,
  wastedCac: 120,
};

/** Self-serve rescue-credit top-up packs — mirror of backend CREDIT_PACKS (display only). */
export const CREDIT_PACKS: { key: string; credits: number; priceInr: number; label: string }[] = [
  { key: 'pack_100',  credits: 100,  priceInr: 499,  label: '100 Rescues' },
  { key: 'pack_500',  credits: 500,  priceInr: 1999, label: '500 Rescues' },
  { key: 'pack_2000', credits: 2000, priceInr: 6999, label: '2,000 Rescues' },
];

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function priceFor(tier: Tier, cycle: Cycle) {
  const t = TIERS.find((item) => item.key === tier) || TIERS[0];
  const c = CYCLES.find((item) => item.key === cycle) || CYCLES[0];
  const monthly = Math.round(t.base * (1 - c.discount));
  const upfront = monthly * c.months;

  return {
    monthly,
    upfront,
    introMonthly: monthly,     // Kept for backward compatibility
    renewMonthly: monthly,     // Kept for backward compatibility
    introUpfront: upfront,     // Kept for backward compatibility
    renewalCharge: upfront,    // Kept for backward compatibility
    months: c.months,
  };
}

export function lossFor(volume: number, metrics: Partial<StoreMetrics> = {}) {
  const m = { ...DEFAULT_METRICS, ...metrics };
  const costPerFailed = m.courierRto + m.wastedCac;
  // Realistic blended RTO rate: COD orders face ~18% RTO; Prepaid face ~2.5%
  const blendedRtoRate = (m.codPct * 0.18) + ((1 - m.codPct) * 0.025);
  const failedDeliveries = Math.round(volume * blendedRtoRate);
  const loss = Math.round(failedDeliveries * costPerFailed);
  // Realistic, conservative rescue rate: 32% (not every customer responds or accepts re-attempt)
  const rescueRate = 0.32;
  const saved = Math.round(loss * rescueRate);
  const rescuesPerMonth = Math.round(failedDeliveries * rescueRate);
  const rescuesPerWeek = +(rescuesPerMonth / 4.33).toFixed(1);

  return {
    loss,
    saved,
    rescuesPerMonth,
    rescuesPerWeek,
    failedDeliveries,
    costPerFailed,
    blendedRtoRate,
    codOrders: Math.round(volume * m.codPct),
  };
}

export function recommendedTier(volume: number): Tier {
  if (volume <= 1000) return 'starter';
  if (volume <= 5000) return 'growth';
  if (volume <= 12000) return 'scale';
  return 'fleet';
}

export function tierForOrders(n: number): Plan {
  return PLANS.find((p) => n <= p.maxOrders) ?? PLANS[PLANS.length - 1];
}
