/**
 * export.api.ts
 * ─────────────────────────────────────────────────────────────
 * REST endpoints for CSV/JSON data exports.
 * Gated to Scale & Enterprise plans only.
 */

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { exportService, ExportType, ExportFormat } from '../services/export.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

const router = Router();

const EXPORT_ALLOWED_PLANS = ['scale', 'enterprise'];

/**
 * GET /api/export/:type
 * Query params: format (csv|json), startDate, endDate, status (comma-separated)
 */
router.get(
  '/:type',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const merchantId = req.merchant?.merchantId;
    if (!merchantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { type } = req.params;
    const validTypes: ExportType[] = ['orders', 'ndr_report', 'revenue_summary', 'carrier_performance'];

    if (!validTypes.includes(type as ExportType)) {
      res.status(400).json({ error: `Invalid export type. Valid: ${validTypes.join(', ')}` });
      return;
    }

    try {
      // Plan gating: Only Scale & Enterprise
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        res.status(404).json({ error: 'Merchant not found' });
        return;
      }

      const plan = merchant.billing?.plan || 'starter';
      if (!EXPORT_ALLOWED_PLANS.includes(plan)) {
        res.status(403).json({
          error: 'Data export is available on Scale and Enterprise plans only.',
          currentPlan: plan,
          upgradeTo: 'scale',
        });
        return;
      }

      const format = (req.query.format as ExportFormat) || 'csv';
      if (!['csv', 'json'].includes(format)) {
        res.status(400).json({ error: 'Format must be csv or json' });
        return;
      }

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const statusFilter = req.query.status
        ? (req.query.status as string).split(',').map((s) => s.trim())
        : undefined;

      const result = await exportService.generateExport({
        merchantId,
        type: type as ExportType,
        format,
        startDate,
        endDate,
        statusFilter,
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('X-Export-Rows', result.rowCount.toString());
      res.send(result.data);
    } catch (err: any) {
      logger.error('Export generation failed', { merchantId, type, error: err.message });
      res.status(500).json({ error: 'Failed to generate export' });
    }
  }
);

/**
 * GET /api/export
 * List available export types for the merchant's plan.
 */
router.get(
  '/',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const merchantId = req.merchant?.merchantId;
    if (!merchantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const merchant = await Merchant.findById(merchantId);
    const plan = merchant?.billing?.plan || 'starter';
    const allowed = EXPORT_ALLOWED_PLANS.includes(plan);

    res.json({
      plan,
      exportEnabled: allowed,
      availableTypes: allowed
        ? ['orders', 'ndr_report', 'revenue_summary', 'carrier_performance']
        : [],
      formats: ['csv', 'json'],
      message: allowed
        ? 'Data export is enabled for your plan.'
        : 'Upgrade to Scale or Enterprise plan to enable data exports.',
    });
  }
);

export default router;
