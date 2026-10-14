import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { Merchant } from '../models';
import { checkSubscriptionAccess } from '../utils/subscription-guard';
import { logger } from '../utils/logger';

import { planLimits } from '../config/plans';
export { planLimits };

/**
 * Gate route access to merchants with an ACTIVE, non-expired subscription.
 */
export const requireActiveSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const merchantId = req.merchant?.merchantId;
    if (!merchantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const subCheck = checkSubscriptionAccess(merchant);
    // An expired plan or used-up quota stops automation and new actions, not the merchant's
    // access to their own data: reads stay open, and refunds owed to customers can still be
    // processed.
    const method = req.method.toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    const isRefund = /\/refund$/.test(req.path);
    if (!subCheck.allowed && (isRead || isRefund)) {
      res.setHeader('X-Subscription-Status', 'inactive');
      next();
      return;
    }
    if (!subCheck.allowed) {
      logger.warn('Access denied: Subscription inactive or quota exceeded', {
        merchantId,
        reason: subCheck.reason,
      });
      res.status(403).json({
        error: subCheck.reason || 'Subscription expired or inactive. Please renew your plan to continue.',
        code: 'SUBSCRIPTION_INACTIVE',
        requiresRenewal: true,
      });
      return;
    }

    next();
  } catch (err: any) {
    logger.error('Error in requireActiveSubscription middleware', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Gate route access to specific tiered features with active subscription enforcement.
 */
export const requireFeature = (featureName: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const merchantId = req.merchant?.merchantId;
      if (!merchantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        res.status(404).json({ error: 'Merchant not found' });
        return;
      }

      // 🛡️ Zero-loophole check: must be active first
      const subCheck = checkSubscriptionAccess(merchant);
      if (!subCheck.allowed) {
        logger.warn('Feature access denied: subscription expired/inactive', {
          merchantId,
          reason: subCheck.reason,
          feature: featureName,
        });
        res.status(403).json({
          error: subCheck.reason || 'Subscription inactive. Please renew your plan to access this feature.',
          code: 'SUBSCRIPTION_INACTIVE',
          requiresRenewal: true,
        });
        return;
      }

      const planKey = merchant.billing.plan || 'free_trial';
      const allowedFeatures = planLimits[planKey]?.features || planLimits.free_trial.features;

      if (!allowedFeatures.includes(featureName)) {
        logger.warn('Feature access denied by plan gating', { merchantId, plan: planKey, feature: featureName });
        res.status(403).json({
          error: `The feature '${featureName}' is not included in your ${planKey} plan.`,
          currentPlan: planKey,
          requiredFeature: featureName,
          upgradeRequired: true,
        });
        return;
      }

      next();
    } catch (err: any) {
      logger.error('Error in planGating middleware', { error: err.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
