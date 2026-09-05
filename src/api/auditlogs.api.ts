import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { AuditLog } from '../models';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/audit-logs
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const logs = await AuditLog.find({ merchantId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AuditLog.countDocuments({ merchantId });

    res.status(200).json({
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    logger.error('Failed to fetch audit logs', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
