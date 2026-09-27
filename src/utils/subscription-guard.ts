import { logger } from './logger';
import { realtimeService } from '../services/realtime.service';

export interface SubscriptionAccessCheck {
  allowed: boolean;
  reason?: string;
  isGracePeriod?: boolean;
  daysRemaining?: number;
}

const GRACE_PERIOD_DAYS = 3;

/**
 * Universal subscription & quota guard for RescueShip.
 * Evaluates whether a merchant is legally authorized to execute automated
 * COD conversions, NDR recoveries, or access gated features.
 */
export function checkSubscriptionAccess(merchant: any): SubscriptionAccessCheck {
  if (!merchant) {
    return { allowed: false, reason: 'Merchant record not found' };
  }

  const billing = merchant.billing || {};
  const plan = billing.plan || 'free_trial';
  const status = billing.status || 'active';
  const now = Date.now();

  // 1. Explicit Administrative / Quality Pauses or Cancellations
  if (status === 'paused' || status === 'paused_quality') {
    return { allowed: false, reason: 'Account is temporarily paused. Contact support or check dashboard.' };
  }
  if (status === 'cancelled') {
    return { allowed: false, reason: 'Subscription has been cancelled. Please reactivate your plan to continue rescues.' };
  }

  // 2. Resolve Expiration Timestamp
  // Prefer billing.nextInvoiceDate (from active cycle), fallback to accessExpiresAt
  const expiryDate = billing.nextInvoiceDate
    ? new Date(billing.nextInvoiceDate).getTime()
    : merchant.accessExpiresAt
    ? new Date(merchant.accessExpiresAt).getTime()
    : null;

  if (expiryDate) {
    const diffMs = expiryDate - now;
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const gracePeriodMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

    // A. Active (Not expired yet)
    if (diffMs > 0) {
      // Check order volume limit
      return checkQuotaLimit(billing, plan, daysRemaining);
    }

    // B. In Grace Period (Expired within last 3 days)
    if (diffMs <= 0 && Math.abs(diffMs) <= gracePeriodMs) {
      logger.warn('Merchant operating in subscription grace period', {
        merchantId: merchant._id?.toString(),
        daysOverdue: Math.abs(daysRemaining),
      });
      // Allow operation during grace period, but flag it
      return {
        ...checkQuotaLimit(billing, plan, 0),
        isGracePeriod: true,
        daysRemaining: 0,
      };
    }

    // C. Hard Expired (Past Grace Period)
    return {
      allowed: false,
      reason: `Subscription expired on ${new Date(expiryDate).toLocaleDateString('en-IN')}. Please renew to resume automated rescues.`,
      daysRemaining: 0,
    };
  }

  // 3. Free Trial Fallback (when no explicit expiry date is configured)
  if (plan === 'free_trial') {
    // If merchant created > 14 days ago and still on free_trial with no expiry date
    const createdAt = merchant.createdAt ? new Date(merchant.createdAt).getTime() : now;
    const trialDurationMs = 14 * 24 * 60 * 60 * 1000;
    if (now - createdAt > trialDurationMs) {
      return {
        allowed: false,
        reason: 'Free trial has ended. Please upgrade to a paid plan to continue automated rescues.',
        daysRemaining: 0,
      };
    }
  }

  return checkQuotaLimit(billing, plan, undefined, merchant._id || merchant.id);
}

function checkQuotaLimit(billing: any, plan: string, daysRemaining?: number, merchantId?: any): SubscriptionAccessCheck {
  const currentOrders = Number(billing.currentMonthOrders || 0);
  const planLimit = Number(billing.planOrderLimit || (plan === 'free_trial' ? 100 : 1000));

  if (merchantId && plan !== 'enterprise' && planLimit > 0) {
    const pct = Math.round((currentOrders / planLimit) * 100);
    if (pct >= 80) {
      try {
        realtimeService.emitCapacityWarning(merchantId.toString(), currentOrders, planLimit);
      } catch {
        // non-blocking
      }
    }
  }

  if (plan !== 'enterprise' && planLimit > 0 && currentOrders >= planLimit) {
    return {
      allowed: false,
      reason: `Monthly order volume limit reached (${currentOrders}/${planLimit} orders). Upgrade plan to continue rescues.`,
      daysRemaining,
    };
  }

  return {
    allowed: true,
    daysRemaining,
  };
}
