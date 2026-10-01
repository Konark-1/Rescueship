import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { Order } from '../models';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/dashboard/summary
 * Returns operational summary for the authenticated merchant:
 * - totalSaved: sum of rtoFeeSaved on rescued orders or formula based
 * - rescuedCount: count of orders with status 'ndr_rescued' this month
 * - conversionCount: count of orders with status 'converted_to_prepaid' this month
 * - rtoArrestCount: count of orders with rtoArrestStatus: 'RESCUED' (or status === 'ndr_rescued' and rtoArrestAttemptedAt != null)
 * - ordersNeedingAttention: urgent/actionable orders requiring merchant attention
 */
router.get('/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;

  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const mId = Types.ObjectId.isValid(merchantId) ? new Types.ObjectId(merchantId) : merchantId;

    logger.info('Fetching dashboard summary', { merchantId });

    const [rescuedCount, conversionCount, rtoArrestCount, sumRtoResult, ordersNeedingAttention] = await Promise.all([
      // Count of orders with status 'ndr_rescued' this month
      Order.countDocuments({
        merchantId,
        status: 'ndr_rescued',
        createdAt: { $gte: startOfMonth },
      }),

      // Count of orders with status 'converted_to_prepaid' this month
      Order.countDocuments({
        merchantId,
        status: 'converted_to_prepaid',
        createdAt: { $gte: startOfMonth },
      }),

      // Count of orders with rtoArrestStatus: 'RESCUED' (or status === 'ndr_rescued' and rtoArrestAttemptedAt != null)
      Order.countDocuments({
        merchantId,
        $or: [
          { rtoArrestStatus: 'RESCUED' },
          { status: 'ndr_rescued', rtoArrestAttemptedAt: { $ne: null } },
        ],
      }),

      // Sum of rtoFeeSaved on rescued orders this month
      Order.aggregate([
        {
          $match: {
            merchantId: mId,
            status: 'ndr_rescued',
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$rtoFeeSaved' },
          },
        },
      ]),

      // Orders needing attention: status in ['ndr_detected', 'ndr_pending_review', 'ndr_rescue_sent']
      // or failureSource: 'COURIER_REPORTED' and status not in ['delivered', 'cancelled', 'rto']
      Order.find({
        merchantId,
        $or: [
          { status: { $in: ['ndr_detected', 'ndr_pending_review', 'ndr_rescue_sent'] } },
          {
            failureSource: 'COURIER_REPORTED',
            status: { $nin: ['delivered', 'cancelled', 'rto'] },
          },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    let sumRtoFeeSaved = sumRtoResult[0]?.total || 0;
    if (!sumRtoFeeSaved) {
      // If no month-specific sum found, check all-time rescued orders sum as fallback
      const allTimeResult = await Order.aggregate([
        {
          $match: {
            merchantId: mId,
            status: 'ndr_rescued',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$rtoFeeSaved' },
          },
        },
      ]);
      sumRtoFeeSaved = allTimeResult[0]?.total || 0;
    }

    const totalSaved = sumRtoFeeSaved > 0
      ? sumRtoFeeSaved
      : rescuedCount * 250 + rtoArrestCount * 250 + conversionCount * 50;

    res.status(200).json({
      totalSaved,
      rescuedCount,
      conversionCount,
      rtoArrestCount,
      ordersNeedingAttention,
    });
  } catch (err: any) {
    logger.error('Failed to get dashboard summary', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve dashboard summary' });
  }
});

export default router;
