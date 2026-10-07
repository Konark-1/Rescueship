import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { analyticsService } from '../services/analytics.service';
import { pincodeRiskService } from '../services/analytics/pincode-risk.service';
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

/**
 * GET /api/analytics/high-risk-pincodes
 * Retrieves the Top N high-risk delivery pincodes with RTO rates, fake attempt detection,
 * and operational recommendations over the last 30 days.
 */
router.get('/high-risk-pincodes', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string, 10) || 5));

  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const data = await pincodeRiskService.getTopRiskPincodes(merchantId, limit);
    res.status(200).json({
      success: true,
      data,
      meta: {
        count: data.length,
        limit,
        periodDays: 30,
        generatedAt: new Date(),
      },
    });
  } catch (err: any) {
    logger.error('Failed to get high-risk pincodes', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve high-risk pincodes' });
  }
});

/**
 * GET /api/analytics/roi
 * Expose Financial ROI calculation:
 * (Rescued Orders * ₹140 avg freight) + (Retained GMV * Margin) - WhatsApp HSM Costs
 */
router.get('/roi', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const roi = await analyticsService.getFinancialROI(merchantId, startDate, endDate);
    res.status(200).json({
      success: true,
      data: roi,
      ...roi,
    });
  } catch (err: any) {
    logger.error('Failed to get financial ROI', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve financial ROI' });
  }
});

/**
 * GET /api/analytics/fraud-index
 * Expose Courier Fraud Index:
 * Aggregate fake delivery attempts grouped by Carrier Name with disputed freight calculations.
 */
router.get('/fraud-index', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const fraudIndex = await analyticsService.getFraudIndex(merchantId, startDate, endDate);
    res.status(200).json({
      success: true,
      data: fraudIndex,
      ...fraudIndex,
    });
  } catch (err: any) {
    logger.error('Failed to get fraud index', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve fraud index' });
  }
});

/**
 * GET /api/analytics/funnel
 * Expose AI Rescue Funnel stats:
 * NDR Triggered → WhatsApp Sent → Customer Replied → Rescued with AI Parser telemetry.
 */
router.get('/funnel', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const funnel = await analyticsService.getRescueFunnelStats(merchantId, startDate, endDate);
    res.status(200).json({
      success: true,
      data: funnel,
      ...funnel,
    });
  } catch (err: any) {
    logger.error('Failed to get rescue funnel', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve rescue funnel' });
  }
});

/**
 * GET /api/analytics/fraud-disputes/export
 * Export CSV containing disputed fake delivery attempts:
 * AWB, Courier Remark, WhatsApp Customer Reply Timestamp, Proof of Fake Attempt
 */
router.get('/fraud-disputes/export', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const carrier = req.query.carrier as string;
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = endDateStr ? new Date(endDateStr) : new Date();

  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const rows = await analyticsService.getDisputeExportRows(merchantId, carrier, startDate, endDate);
    const headers = ['AWB', 'Carrier', 'Courier Remark', 'WhatsApp Customer Reply Timestamp', 'Proof of Fake Attempt'];
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
      csvLines.push([
        escape(r.awb),
        escape(r.carrier),
        escape(r.courierRemark),
        escape(r.customerReplyTimestamp),
        escape(r.proofOfFakeAttempt),
      ].join(','));
    }

    const csvContent = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=fraud-disputes-${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    logger.error('Failed to export fraud dispute CSV', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to export fraud dispute CSV' });
  }
});

export default router;
