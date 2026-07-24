import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { analyticsService } from '../services/analytics.service';
import { logger } from '../utils/logger';
import { Merchant } from '../models/Merchant';

const router = Router();

/**
 * GET /api/analytics/dashboard
 * Retrieve rescue rate, conversion rate, revenue saved, order counts.
 * Full analytics gated to Growth+ plan.
 */
router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = endDateStr ? new Date(endDateStr) : new Date();

  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const merchant = await Merchant.findById(merchantId);
    const plan = merchant?.billing?.plan || 'starter';

    logger.info('Fetching dashboard analytics', { merchantId, startDate, endDate, plan });
    const stats = await analyticsService.getMerchantDashboard(merchantId, { startDate, endDate });

    if (plan === 'starter' || plan === 'free_trial') {
      res.status(200).json({
        totalOrders: stats.totalOrders,
        message: 'Upgrade to Growth plan for full revenue analytics and conversion tracking.',
        isBasic: true,
      });
      return;
    }

    res.status(200).json(stats);
  } catch (err: any) {
    logger.error('Failed to get dashboard analytics', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve dashboard analytics' });
  }
});

/**
 * GET /api/analytics/carriers
 * Retrieve carrier performance breakdown. Growth+ plan gated.
 */
router.get('/carriers', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = endDateStr ? new Date(endDateStr) : new Date();

  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const merchant = await Merchant.findById(merchantId);
    const plan = merchant?.billing?.plan || 'starter';

    if (plan === 'starter' || plan === 'free_trial') {
      res.status(403).json({ error: 'Carrier performance reports require Growth plan or above.' });
      return;
    }

    logger.info('Fetching carrier performance stats', { merchantId });
    const carrierStats = await analyticsService.getCarrierPerformance(merchantId, { startDate, endDate });
    res.status(200).json({ carriers: carrierStats });
  } catch (err: any) {
    logger.error('Failed to get carrier analytics', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve carrier statistics' });
  }
});

export default router;
