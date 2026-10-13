/** Checkout (backend) and the pricing shown to merchants (frontend) must never drift. */
jest.mock('../src/services/email.service', () => ({ emailService: {} }));
jest.mock('../src/services/alert.service', () => ({ alertService: {} }));
jest.mock('../src/services/merchant-digest.service', () => ({ merchantDigestService: {} }));
import { priceFor as backendPrice, LIMIT, CREDIT_PACKS as BACKEND_PACKS } from '../src/services/subscription.service';
import { priceFor as frontendPrice, TIERS, CYCLES, CREDIT_PACKS as FRONTEND_PACKS } from '../frontend/src/config/pricing.config';

const tiers = ['starter', 'growth', 'scale', 'fleet'] as const;
const cycles = ['quarterly', 'semi', 'annual'] as const;

describe('pricing consistency', () => {
  it.each(tiers.flatMap((t) => cycles.map((c) => [t, c] as const)))('%s / %s: same upfront and renewal charge', (t, c) => {
    const b = backendPrice(t, c);
    const f = frontendPrice(t, c);
    expect(b.introUpfront).toBe(f.upfront);
    expect(b.renewalCharge).toBe(f.upfront); // renewals repeat the chosen cycle upfront
    expect(b.months).toBe(f.months);
  });

  it('order limits match', () => {
    for (const t of TIERS) expect(LIMIT[t.key]).toBe(t.orders);
  });

  it('credit packs match', () => {
    for (const p of FRONTEND_PACKS) expect(BACKEND_PACKS[p.key]).toMatchObject({ credits: p.credits, priceInr: p.priceInr });
  });

  it('no monthly plan: shortest cycle is 3 months', () => {
    expect(Math.min(...CYCLES.map((c) => c.months))).toBe(3);
  });
});
