/**
 * billing.ts — client + the ONE price model the UI renders.
 * The backend recomputes this identically before charging; the UI
 * never decides what to charge, only what to show. Keep both in sync.
 */
const API = import.meta.env.VITE_API_URL || '';

export type Tier = 'starter' | 'growth' | 'scale' | 'fleet';
export type Cycle = 'quarterly' | 'annual';

export interface StoreMetrics {
  aov: number;          // Average Order Value (e.g. 1200)
  codPct: number;       // COD percentage 0..1 (e.g. 0.70)
  courierRto: number;   // 2-way courier RTO cost (e.g. 140)
  wastedCac: number;    // Wasted CAC + packaging (e.g. 250)
}

export const DEFAULT_METRICS: StoreMetrics = {
  aov: 1200,
  codPct: 0.70,
  courierRto: 140,
  wastedCac: 250,
};

export const TIERS: { key: Tier; name: string; orders: number; base: number; blurb: string }[] = [
  { key: 'starter', name: 'Starter', orders: 1000,  base: 1199, blurb: 'For early D2C brands feeling the first RTO sting.' },
  { key: 'growth',  name: 'Growth',  orders: 5000,  base: 2899, blurb: 'Where recovery becomes a line item you watch grow.' },
  { key: 'scale',   name: 'Scale',   orders: 12000, base: 5499, blurb: 'For scaling brands that refuse to lose orders.' },
  { key: 'fleet',   name: 'Fleet',   orders: 25000, base: 9499, blurb: 'For high-volume ops with multi-carrier delivery.' },
];

export const CYCLES: { key: Cycle; label: string; months: number; discount: number; tag: string }[] = [
  { key: 'quarterly', label: 'Quarterly', months: 3,  discount: 0,    tag: '90-Day Guarantee' },
  { key: 'annual',    label: 'Annual',    months: 12, discount: 0.20, tag: '−20%' },
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
  // Blended RTO rate: COD orders face ~25% RTO; Prepaid face ~3%
  const blendedRtoRate = (m.codPct * 0.25) + ((1 - m.codPct) * 0.03);
  const failedDeliveries = Math.round(volume * blendedRtoRate);
  const loss = Math.round(failedDeliveries * costPerFailed);
  const rescueRate = 0.60; // projected 60% rescue rate
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

const call = async (token: string, path: string, body?: any) => {
  const r = await fetch(`${API}/api/billing${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
};

export const billingApi = {
  /** Returns { orderId, subscriptionId, amountInr, currency, keyId } to open Razorpay. */
  checkout: (token: string, tier: Tier, cycle: Cycle) => call(token, '/checkout', { tier, cycle }),
  /** After Razorpay success — server verifies signature + provisions plan. */
  verify: (token: string, payload: any) => call(token, '/checkout/verify', payload),
  status: (token: string) => call(token, '/status'),
};

export const loadRazorpay = () => new Promise<boolean>((res) => {
  if ((window as any).Razorpay) return res(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => res(true); s.onerror = () => res(false);
  document.body.appendChild(s);
});
