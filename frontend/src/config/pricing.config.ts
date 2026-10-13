/**
 * 🚢 RescueShip — Authoritative Unified Pricing Configuration
 * Single source of truth for both Landing Page presentation and in-app Billing Checkout.
 * Backend-enforced (src/services/subscription.service.ts, src/config/plans.ts), monthly before GST:
 * Starter ₹1,999 (500 orders) · Growth ₹4,999 (2,000) · Scale ₹11,999 (6,000) · Fleet ₹24,999 (15,000).
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
  flagship?: string;
  features?: string[];
}

export interface TierConfig {
  key: Tier;
  name: string;
  orders: number;
  base: number;
  blurb: string;
  flagship?: string;
  features?: string[];
}

export const TIERS: TierConfig[] = [
  {
    key: 'starter',
    name: 'Starter',
    orders: 500,
    base: 1999,
    blurb: 'For new D2C brands feeling the first RTO sting.',
    features: [
      'Up to 500 orders/mo',
      'WhatsApp NDR rescue: reschedule, address fix, location pin',
      'Shiprocket & Delhivery',
      'Rescue dashboard',
      'Email support',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    orders: 2000,
    base: 4999,
    blurb: 'Turn failed COD deliveries into prepaid orders.',
    features: [
      'Up to 2,000 orders/mo',
      'Everything in Starter',
      'COD → prepaid links & partial COD deposit (your Razorpay/Cashfree)',
      'AI address & landmark correction',
      'All carriers incl. ClickPost & custom',
      'Advanced analytics, live feed & weekly ROI report',
    ],
  },
  {
    key: 'scale',
    name: 'Scale',
    orders: 6000,
    base: 11999,
    blurb: 'Stop RTO before the parcel even ships.',
    flagship: 'Pre-delivery confirmation & pincode guard',
    features: [
      'Up to 6,000 orders/mo',
      'Everything in Growth',
      'Pre-delivery confirmation & COD reminders',
      'Pincode risk rules + storefront sync',
      'Courier fraud watchtower',
      'CSV exports',
    ],
  },
  {
    key: 'fleet',
    name: 'Fleet',
    orders: 15000,
    base: 24999,
    blurb: 'For high-volume brands that want hands-on help.',
    flagship: 'Priority support & guided onboarding',
    features: [
      'Up to 15,000 orders/mo',
      'Everything in Scale',
      'Priority WhatsApp & phone support',
      'Guided onboarding call',
    ],
  },
];

/** Aliased for components expecting `PLANS` (e.g. PlanPicker, PricingSection) */
export const PLANS: Plan[] = TIERS.map((t) => ({
  id: t.key,
  name: t.name,
  maxOrders: t.orders,
  priceMonthly: t.base,
  blurb: t.blurb,
  flagship: t.flagship,
  features: t.features,
}));

export const CYCLES: { key: Cycle; label: string; months: number; discount: number; tag: string }[] = [
  { key: 'quarterly', label: 'Quarterly',   months: 3,  discount: 0,    tag: '90-Day Guarantee' },
  { key: 'semi',      label: 'Semi-Annual', months: 6,  discount: 0.10, tag: '−10%' },
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
  { key: 'pack_500',  credits: 500,  priceInr: 499,  label: '500 messages' },
  { key: 'pack_2000', credits: 2000, priceInr: 1499, label: '2,000 messages' },
  { key: 'pack_5000', credits: 5000, priceInr: 2999, label: '5,000 messages' },
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
  if (volume <= 500) return 'starter';
  if (volume <= 2000) return 'growth';
  if (volume <= 6000) return 'scale';
  return 'fleet';
}

export function tierForOrders(n: number): Plan {
  return PLANS.find((p) => n <= p.maxOrders) ?? PLANS[PLANS.length - 1];
}
