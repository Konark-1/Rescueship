import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { BillingEvent, Merchant } from '../models';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/billing/usage
router.get('/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const events = await BillingEvent.find({ merchantId }).sort({ timestamp: -1 });
    res.status(200).json(events);
  } catch (err: any) {
    logger.error('Failed to fetch billing usage', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch billing usage' });
  }
});

// GET /api/billing/plan
router.get('/plan', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    res.status(200).json(merchant.billing);
  } catch (err: any) {
    logger.error('Failed to fetch billing plan', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch billing plan' });
  }
});

export default router;
