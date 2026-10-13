import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { Order, Merchant, NdrCase } from '../models';
import { whatsAppDispatcherService } from '../services/whatsapp/whatsapp-dispatcher.service';
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
    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;
    const now = new Date();
    const startDate = startDateStr && !isNaN(Date.parse(startDateStr))
      ? new Date(startDateStr)
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endDate = endDateStr && !isNaN(Date.parse(endDateStr))
      ? new Date(endDateStr)
      : now;
    const mId = Types.ObjectId.isValid(merchantId) ? new Types.ObjectId(merchantId) : merchantId;

    logger.info('Fetching dashboard summary', { merchantId, startDate, endDate });

    const dateFilter = { $gte: startDate, $lte: endDate };

    const [rescuedCount, conversionCount, rtoArrestCount, sumRtoResult, ordersNeedingAttention] = await Promise.all([
      // Count of orders with status 'ndr_rescued' in date range
      Order.countDocuments({
        merchantId: mId,
        status: 'ndr_rescued',
        createdAt: dateFilter,
      }),

      // Count of orders with status 'converted_to_prepaid' in date range
      Order.countDocuments({
        merchantId: mId,
        status: 'converted_to_prepaid',
        createdAt: dateFilter,
      }),

      // Count of orders with rtoArrestStatus: 'RESCUED' (or status === 'ndr_rescued' and rtoArrestAttemptedAt != null)
      Order.countDocuments({
        merchantId: mId,
        createdAt: dateFilter,
        $or: [
          { rtoArrestStatus: 'RESCUED' },
          { status: 'ndr_rescued', rtoArrestAttemptedAt: { $ne: null } },
        ],
      }),

      // Sum of rtoFeeSaved on rescued orders in date range
      Order.aggregate([
        {
          $match: {
            merchantId: mId,
            status: 'ndr_rescued',
            createdAt: dateFilter,
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
        merchantId: mId,
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

    // Evaluate rolling 24-hour Meta Tier Limit
    const merchantDoc = await Merchant.findById(mId).select('metaTierLimit');
    const metaTierLimit = merchantDoc?.metaTierLimit ?? 1000;
    const tierCheck = await whatsAppDispatcherService.checkMetaTierLimit(merchantId, metaTierLimit);
    const metaTier = {
      metaTierLimit: tierCheck.limit,
      current24hCount: tierCheck.current,
      isLimitReached: !tierCheck.allowed,
    };

    res.status(200).json({
      totalSaved,
      rescuedCount,
      conversionCount,
      rtoArrestCount,
      ordersNeedingAttention,
      metaTier,
    });
  } catch (err: any) {
    logger.error('Failed to get dashboard summary', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve dashboard summary' });
  }
});

/**
 * GET /api/dashboard/attention
 * Everything that needs the merchant to act, in one list: broken connections, unconfirmed
 * email, refunds awaiting approval and courier actions that failed (rescue promised to the
 * customer but the courier API refused it).
 */
router.get('/attention', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const merchant: any = await Merchant.findById(merchantId).select('email emailVerified connections');
    const items: any[] = [];

    const connections = merchant?.connections || {};
    for (const kind of ['shopify', 'whatsapp', 'payment', 'carrier']) {
      const c = connections[kind] || {};
      const broken = c.status === 'error' || c.status === 'token_expired' || c.status === 'templates_rejected';
      const unhealthy = c.health && c.health.ok === false;
      if (broken || unhealthy) {
        items.push({
          type: 'connection',
          kind,
          severity: broken ? 'high' : 'medium',
          title: `${kind === 'payment' ? 'Payment gateway' : kind === 'carrier' ? 'Courier' : kind[0].toUpperCase() + kind.slice(1)} needs attention`,
          detail: c.health?.detail || c.lastError || c.status,
          checkedAt: c.health?.checkedAt || null,
        });
      }
    }

    if (merchant && merchant.emailVerified !== true) {
      items.push({ type: 'email_unverified', severity: 'low', title: 'Confirm your email', detail: `We sent a link to ${merchant.email}.` });
    }

    const refunds = await Order.find({ merchantId, 'codConversion.refundStatus': { $in: ['pending_approval', 'approved', 'failed'] } })
      .select('externalOrderId externalOrderName customerName status codConversion.refundStatus codConversion.refundAmount codConversion.refundReason codConversion.refundRequestedAt')
      .sort({ 'codConversion.refundRequestedAt': -1 })
      .limit(50)
      .lean();
    for (const o of refunds as any[]) {
      items.push({
        type: 'refund',
        severity: o.codConversion?.refundStatus === 'failed' ? 'high' : 'medium',
        orderId: String(o._id),
        orderRef: o.externalOrderName || o.externalOrderId,
        title: `Refund ₹${o.codConversion?.refundAmount || 0} to ${o.customerName || 'customer'}`,
        detail: o.codConversion?.refundReason || '',
        refundStatus: o.codConversion?.refundStatus,
        at: o.codConversion?.refundRequestedAt || null,
      });
    }

    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const failedActions = await NdrCase.find({
      merchantId,
      carrierReattemptStatus: { $in: ['FAILED', 'MANUAL_REQUIRED'] },
      updatedAt: { $gte: since },
      status: { $nin: ['CLOSED', 'DELIVERED'] },
    } as any)
      .select('orderId awb externalOrderId customerResponseType carrierReattemptStatus updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    for (const c of failedActions as any[]) {
      items.push({
        type: 'courier_action',
        severity: 'high',
        orderId: c.orderId ? String(c.orderId) : null,
        orderRef: c.externalOrderId || c.awb,
        title: `Courier action needed for ${c.externalOrderId || c.awb}`,
        detail: `Customer asked for ${String(c.customerResponseType || 'a change').toLowerCase().replace(/_/g, ' ')}; the courier API did not accept it. Do it in your courier panel.`,
        at: c.updatedAt,
      });
    }

    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => rank[a.severity] - rank[b.severity]);
    res.json({ items });
  } catch (err: any) {
    logger.error('Failed to build attention list', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to load action items' });
  }
});

export default router;
