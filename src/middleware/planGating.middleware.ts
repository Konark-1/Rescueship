import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { Merchant } from '../models';
import { checkSubscriptionAccess } from '../utils/subscription-guard';
import { logger } from '../utils/logger';

export const planLimits: Record<string, { orderLimit: number; features: string[] }> = {
  free_trial: { orderLimit: 100, features: ['basic_kpi', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery'] },
  starter: { orderLimit: 1000, features: ['basic_kpi', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery'] },
  growth: { orderLimit: 5000, features: ['basic_kpi', 'advanced_charts', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery', 'clickpost', 'upi_qr', 'seller_notifications', 'api_docs', 'priority_queue'] },
  scale: { orderLimit: 12000, features: ['basic_kpi', 'advanced_charts', 'csv_export', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery', 'clickpost', 'custom_carrier', 'upi_qr', 'seller_notifications', 'api_docs', 'priority_queue', 'sla'] },
  fleet: { orderLimit: 25000, features: ['basic_kpi', 'advanced_charts', 'csv_export', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery', 'clickpost', 'custom_carrier', 'upi_qr', 'seller_notifications', 'api_docs', 'priority_queue', 'sla', 'dedicated_manager'] },
  enterprise: { orderLimit: 99999999, features: ['basic_kpi', 'advanced_charts', 'csv_export', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery', 'clickpost', 'custom_carrier', 'upi_qr', 'seller_notifications', 'api_docs', 'priority_queue', 'sla', 'dedicated_manager'] },
};

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
          error: `The feature '${featureName}' requires a Growth or Scale subscription plan.`,
          currentPlan: planKey,
          requiredFeature: featureName,
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
