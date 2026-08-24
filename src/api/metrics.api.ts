import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { metricsService } from '../services/metrics.service';

const router = Router();

/**
 * GET /api/metrics/my
 * Merchant's own rescue metrics (shown on dashboard).
 */
router.get('/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const metrics = await metricsService.getMerchantMetrics(req.merchant!.merchantId);
    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/metrics/cohort
 * Admin-only: aggregate pilot metrics.
 */
router.get('/cohort', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = (req.merchant as any)?.role === 'admin' || (req.merchant as any)?.isAdmin === true;
    const cohort = await metricsService.getCohortMetrics(!isAdmin);
    const phase4 = await metricsService.isPhase4Ready();
    res.json({ success: true, cohort, phase4Gate: phase4 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
