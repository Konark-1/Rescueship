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
    // JWTs carry no role claim. Admin access is an explicit allowlist of merchant IDs
    // (ADMIN_MERCHANT_IDS=comma,separated). Everyone else gets 403 — cross-tenant
    // aggregates must not leak to ordinary merchants even in pseudonymised form.
    const admins = (process.env.ADMIN_MERCHANT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const isAdmin = admins.includes(req.merchant!.merchantId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    const cohort = await metricsService.getCohortMetrics(false);
    const phase4 = await metricsService.isPhase4Ready();
    res.json({ success: true, cohort, phase4Gate: phase4 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
