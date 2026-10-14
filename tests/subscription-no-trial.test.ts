/** RescueShip is pay-first (90-day money-back guarantee, no free trial). */
jest.mock('../src/services/realtime.service', () => ({ realtimeService: { emitCapacityWarning: jest.fn() } }));
import { checkSubscriptionAccess } from '../src/utils/subscription-guard';

describe('subscription guard: no free trial', () => {
  it('blocks a brand-new merchant who never paid', () => {
    const r = checkSubscriptionAccess({ _id: 'm1', createdAt: new Date(), billing: { plan: 'free_trial' } });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/No active plan/);
  });

  it('blocks a merchant with no billing object at all', () => {
    expect(checkSubscriptionAccess({ _id: 'm2', createdAt: new Date() }).allowed).toBe(false);
  });

  it('allows an activated paid plan within its cycle', () => {
    const r = checkSubscriptionAccess({
      _id: 'm3',
      billing: { plan: 'growth', status: 'active', activatedAt: new Date(), nextInvoiceDate: new Date(Date.now() + 10 * 86400000), planOrderLimit: 5000, currentMonthOrders: 10 },
    });
    expect(r.allowed).toBe(true);
  });

  it('keeps license-granted access (accessExpiresAt) working', () => {
    const r = checkSubscriptionAccess({ _id: 'm4', accessExpiresAt: new Date(Date.now() + 5 * 86400000), billing: { plan: 'scale' } });
    expect(r.allowed).toBe(true);
  });
});
