/**
 * billing.ts — client + the ONE price model the UI renders.
 * The backend recomputes this identically before charging; the UI
 * never decides what to charge, only what to show. Keep both in sync.
 */
const API = import.meta.env.VITE_API_URL || '';

export type Tier = 'starter' | 'growth' | 'scale';
export type Cycle = 'quarterly' | 'semi' | 'annual';

export const TIERS: { key: Tier; name: string; orders: number; base: number; blurb: string }[] = [
  { key: 'starter', name: 'Starter', orders: 2000,  base: 2999,  blurb: 'For brands feeling the first RTO sting.' },
  { key: 'growth',  name: 'Growth',  orders: 10000, base: 8999,  blurb: 'Where recovery becomes a line item you watch grow.' },
  { key: 'scale',   name: 'Scale',   orders: 50000, base: 19999, blurb: 'For ops teams that refuse to lose a single order.' },
];
export const CYCLES: { key: Cycle; label: string; months: number; discount: number; tag: string }[] = [
  { key: 'quarterly', label: 'Quarterly',   months: 3,  discount: 0,    tag: '' },
  { key: 'semi',      label: 'Semi-Annual', months: 6,  discount: 0.15, tag: '−15%' },
  { key: 'annual',    label: 'Annual',      months: 12, discount: 0.30, tag: '−30%' },
];
export const INTRO_OFF = 0.4;          // first quarter only
export const RTO_RATE = 0.15, RTO_COST = 430, RESCUE_RATE = 0.6;

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function priceFor(tier: Tier, cycle: Cycle) {
  const base = TIERS.find((t) => t.key === tier)!.base;
  const disc = CYCLES.find((c) => c.key === cycle)!.discount;
  const introMonthly = Math.round(base * (1 - INTRO_OFF));
  const renewMonthly = Math.round(base * (1 - disc));
  const months = CYCLES.find((c) => c.key === cycle)!.months;
  return {
    introMonthly,
    renewMonthly,
    introUpfront: introMonthly * 3,                 // first quarter, charged now
    renewalCharge: renewMonthly * months,           // recurring charge at renewal
    months,
  };
}

export function lossFor(volume: number) {
  const loss = Math.round(volume * RTO_RATE * RTO_COST);
  const saved = Math.round(loss * RESCUE_RATE);
  const rescuesPerMonth = Math.round(volume * RTO_RATE * RESCUE_RATE);
  return { loss, saved, rescuesPerMonth, rescuesPerWeek: +(rescuesPerMonth / 4.33).toFixed(1) };
}

export function recommendedTier(volume: number): Tier {
  return volume <= 2000 ? 'starter' : volume <= 10000 ? 'growth' : 'scale';
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
