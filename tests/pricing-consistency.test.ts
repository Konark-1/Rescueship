/** Checkout (backend) and the pricing shown to merchants (frontend) must never drift. */
jest.mock('../src/services/email.service', () => ({ emailService: {} }));
jest.mock('../src/services/alert.service', () => ({ alertService: {} }));
jest.mock('../src/services/merchant-digest.service', () => ({ merchantDigestService: {} }));
import { priceFor as backendPrice, PRICE as BACKEND_PRICE, BANDS as BACKEND_BANDS, CREDIT_PACKS as BACKEND_PACKS, creditAllowanceFor } from '../src/services/subscription.service';
import { priceFor as frontendPrice, PRICE as FRONTEND_PRICE, BANDS, CYCLES, PLANS, CREDIT_PACKS as FRONTEND_PACKS, estimate, bandFor } from '../frontend/src/config/pricing.config';
import { planAllows } from '../src/config/plans';

const plans = ['rescue', 'convert', 'prevent'] as const;
const cycles = ['quarterly', 'semi', 'annual'] as const;

describe('pricing consistency', () => {
  it('same price table and bands on both sides', () => {
    expect(FRONTEND_PRICE).toEqual(BACKEND_PRICE);
    expect([...BANDS]).toEqual([...BACKEND_BANDS]);
  });

  it.each(plans.flatMap((p) => BANDS.flatMap((b) => cycles.map((c) => [p, b, c] as const))))('%s / %d / %s: same upfront and renewal charge', (p, b, c) => {
    const be = backendPrice(p, b, c);
    const fe = frontendPrice(p, b, c);
    expect(be.introUpfront).toBe(fe.upfront);
    expect(be.renewalCharge).toBe(fe.upfront);
    expect(be.months).toBe(fe.months);
  });

  it('higher plans cost more at every band; bigger bands cost more per plan', () => {
    for (const b of BANDS) {
      expect(BACKEND_PRICE.rescue[b]).toBeLessThan(BACKEND_PRICE.convert[b]);
      expect(BACKEND_PRICE.convert[b]).toBeLessThan(BACKEND_PRICE.prevent[b]);
    }
    for (const p of plans) for (let i = 1; i < BANDS.length; i++) expect(BACKEND_PRICE[p][BANDS[i]]).toBeGreaterThan(BACKEND_PRICE[p][BANDS[i - 1]]);
  });

  it('every price leaves the merchant ≥2.5× expected saving at full band (default metrics)', () => {
    for (const p of PLANS) for (const b of BANDS) {
      expect(estimate(b, {}, p.key).saved / BACKEND_PRICE[p.key][b]).toBeGreaterThanOrEqual(2.5);
    }
  });

  it('feature ladder: each plan includes the one below', () => {
    const m = (plan: string) => ({ billing: { plan } });
    expect(planAllows(m('rescue'), 'ndr_rescue')).toBe(true);
    expect(planAllows(m('rescue'), 'cod_conversion')).toBe(false);
    expect(planAllows(m('convert'), 'cod_conversion')).toBe(true);
    expect(planAllows(m('convert'), 'predelivery')).toBe(false);
    expect(planAllows(m('prevent'), 'predelivery')).toBe(true);
    expect(planAllows(m('prevent'), 'ndr_rescue')).toBe(true);
  });

  it('bands and allowances', () => {
    expect(bandFor(1)).toBe(500);
    expect(bandFor(501)).toBe(1000);
    expect(bandFor(10000)).toBe(10000);
    expect(bandFor(10001)).toBeNull();
    expect(creditAllowanceFor(2500)).toBe(5000);
    expect(creditAllowanceFor(0)).toBe(0);
  });

  it('credit packs match; shortest cycle is 3 months', () => {
    for (const p of FRONTEND_PACKS) expect(BACKEND_PACKS[p.key]).toMatchObject({ credits: p.credits, priceInr: p.priceInr });
    expect(Math.min(...CYCLES.map((c) => c.months))).toBe(3);
  });
});
