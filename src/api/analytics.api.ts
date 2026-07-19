import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { analyticsService } from '../services/analytics.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/analytics/dashboard
 * Retrieve rescue rate, conversion rate, revenue saved, order counts
 */
router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  // Defaults: last 30 days
  const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = endDateStr ? new Date(endDateStr) : new Date();

  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    logger.info('Fetching dashboard analytics', { merchantId, startDate, endDate });
    const stats = await analyticsService.getMerchantDashboard(merchantId, { startDate, endDate });
    res.status(200).json(stats);
  } catch (err: any) {
    logger.error('Failed to get dashboard analytics', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve dashboard analytics' });
  }
});

/**
 * GET /api/analytics/carriers
 * Retrieve carrier performance breakdown
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
    logger.info('Fetching carrier performance stats', { merchantId });
    const carrierStats = await analyticsService.getCarrierPerformance(merchantId, { startDate, endDate });
    res.status(200).json({ carriers: carrierStats });
  } catch (err: any) {
    logger.error('Failed to get carrier analytics', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve carrier statistics' });
  }
});

/**
 * GET /api/analytics/daily-trend
 * Retrieve daily order trend
 */
router.get('/daily-trend', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const { Order } = await import('../models');
    const { Types } = await import('mongoose');
    const pipeline: any[] = [
      { $match: { merchantId: new Types.ObjectId(merchantId) } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];
    const trend = await Order.aggregate(pipeline);
    res.status(200).json(trend);
  } catch (err: any) {
    logger.error('Failed to get daily trend', { error: err.message });
    res.status(500).json({ error: 'Failed to get daily trend' });
  }
});

/**
 * GET /api/analytics/carrier-breakdown
 * Retrieve NDR rate and rescue rate per carrier
 */
router.get('/carrier-breakdown', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const carrierStats = await analyticsService.getCarrierPerformance(merchantId);
    res.status(200).json({ carriers: carrierStats });
  } catch (err: any) {
    logger.error('Failed to get carrier breakdown', { error: err.message });
    res.status(500).json({ error: 'Failed to get carrier breakdown' });
  }
});

/**
 * GET /api/analytics/ndr-reasons
 * Retrieve breakdown of NDR reasons
 */
router.get('/ndr-reasons', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const { Order } = await import('../models');
    const { Types } = await import('mongoose');
    const pipeline: any[] = [
      { $match: { merchantId: new Types.ObjectId(merchantId), "ndr.reason": { $ne: null } } },
      {
        $group: {
          _id: "$ndr.reason",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];
    const reasons = await Order.aggregate(pipeline);
    res.status(200).json(reasons);
  } catch (err: any) {
    logger.error('Failed to get ndr reasons', { error: err.message });
    res.status(500).json({ error: 'Failed to get ndr reasons' });
  }
});

export default router;
