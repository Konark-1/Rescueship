import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

export const planLimits: Record<string, { orderLimit: number; features: string[] }> = {
  free_trial: { orderLimit: 100, features: ['basic_kpi', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery'] },
  starter: { orderLimit: 2000, features: ['basic_kpi', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery'] },
  growth: { orderLimit: 10000, features: ['basic_kpi', 'advanced_charts', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery', 'clickpost', 'upi_qr', 'seller_notifications', 'api_docs', 'priority_queue'] },
  scale: { orderLimit: 50000, features: ['basic_kpi', 'advanced_charts', 'csv_export', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery', 'clickpost', 'custom_carrier', 'upi_qr', 'seller_notifications', 'api_docs', 'priority_queue', 'sla'] },
  enterprise: { orderLimit: 99999999, features: ['basic_kpi', 'advanced_charts', 'csv_export', 'address_text', 'address_location', 'address_both', 'shiprocket', 'delhivery', 'clickpost', 'custom_carrier', 'upi_qr', 'seller_notifications', 'api_docs', 'priority_queue', 'sla', 'dedicated_manager'] },
};

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
