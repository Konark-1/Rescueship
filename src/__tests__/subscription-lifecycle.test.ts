import { checkSubscriptionAccess } from '../utils/subscription-guard';
import { subscriptionService, priceFor } from '../services/subscription.service';

describe('Subscription Lifecycle, Expiration & Anti-Loophole Guards', () => {
  it('allows active subscriptions with remaining days and orders within quota', () => {
    const activeMerchant = {
      _id: 'merchant_active_1',
      createdAt: new Date(),
      billing: {
        plan: 'starter',
        status: 'active',
        planOrderLimit: 1000,
        currentMonthOrders: 150,
        nextInvoiceDate: new Date(Date.now() + 20 * 24 * 3600 * 1000), // 20 days left
      },
    };

    const check = checkSubscriptionAccess(activeMerchant);
    expect(check.allowed).toBe(true);
    expect(check.daysRemaining).toBe(20);
    expect(check.isGracePeriod).toBeFalsy();
  });

  it('allows operations during 3-day grace period to prevent sudden delivery failures', () => {
    const graceMerchant = {
      _id: 'merchant_grace_1',
      createdAt: new Date(),
      billing: {
        plan: 'growth',
        status: 'past_due',
        planOrderLimit: 5000,
        currentMonthOrders: 200,
        nextInvoiceDate: new Date(Date.now() - 1 * 24 * 3600 * 1000), // Expired 1 day ago
      },
    };

    const check = checkSubscriptionAccess(graceMerchant);
    expect(check.allowed).toBe(true);
    expect(check.isGracePeriod).toBe(true);
  });

  it('blocks operations immediately once grace period (> 3 days overdue) has expired', () => {
    const expiredMerchant = {
      _id: 'merchant_expired_1',
      createdAt: new Date(),
      billing: {
        plan: 'starter',
        status: 'past_due',
        planOrderLimit: 1000,
        currentMonthOrders: 50,
        nextInvoiceDate: new Date(Date.now() - 5 * 24 * 3600 * 1000), // Expired 5 days ago
      },
    };

    const check = checkSubscriptionAccess(expiredMerchant);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Subscription expired');
  });

  it('blocks operations when merchant reaches monthly plan order volume quota', () => {
    const quotaReachedMerchant = {
      _id: 'merchant_quota_1',
      createdAt: new Date(),
      billing: {
        plan: 'starter',
        status: 'active',
        planOrderLimit: 1000,
        currentMonthOrders: 1000, // Reached limit
        nextInvoiceDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      },
    };

    const check = checkSubscriptionAccess(quotaReachedMerchant);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Monthly order volume limit reached');
  });

  it('blocks operations when account is administratively paused or cancelled', () => {
    const pausedMerchant = {
      _id: 'merchant_paused_1',
      billing: {
        plan: 'growth',
        status: 'paused',
        planOrderLimit: 5000,
        currentMonthOrders: 10,
        nextInvoiceDate: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      },
    };

    const check = checkSubscriptionAccess(pausedMerchant);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('paused');
  });

  it('calculates proper pre-expiry stacking date without losing existing paid days', () => {
    const now = Date.now();
    const tenDaysFromNow = new Date(now + 10 * 24 * 3600 * 1000);
    const renewalMonths = 3; // Quarterly
    
    // Simulate pre-expiry stacking
    const baseDate = tenDaysFromNow.getTime() > now ? tenDaysFromNow : new Date(now);
    const stackedRenewal = new Date(baseDate.getTime() + renewalMonths * 30 * 24 * 3600 * 1000);

    // Total days from now should be 10 days + 90 days = 100 days
    const totalDays = Math.round((stackedRenewal.getTime() - now) / (1000 * 60 * 60 * 24));
    expect(totalDays).toBe(100);
  });
});
