import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { MerchantTransaction } from '../models/MerchantTransaction';
import { standardMerchantLimiter } from '../middleware/merchant-rate-limiter';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/transactions
 * Retrieve paginated payment transactions for the authenticated merchant
 */
router.get('/', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchant!.merchantId;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const query: any = { merchantId };

    if (req.query.status && typeof req.query.status === 'string' && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const term = req.query.search.trim();
      query.$or = [
        { customerName: { $regex: term, $options: 'i' } },
        { customerPhone: { $regex: term, $options: 'i' } },
        { orderNumber: { $regex: term, $options: 'i' } },
        { razorpayPaymentId: { $regex: term, $options: 'i' } },
      ];
    }

    if (req.query.from || req.query.to) {
      query.collectedAt = {};
      if (req.query.from) query.collectedAt.$gte = new Date(req.query.from as string);
      if (req.query.to) query.collectedAt.$lte = new Date(req.query.to as string);
    }

    const [transactions, total] = await Promise.all([
      MerchantTransaction.find(query).sort({ collectedAt: -1 }).skip(skip).limit(limit).lean(),
      MerchantTransaction.countDocuments(query),
    ]);

    // Format response
    const formatted = transactions.map((t: any) => ({
      id: t._id,
      orderNumber: t.orderNumber || 'N/A',
      customerName: t.customerName || 'Customer',
      customerPhone: t.customerPhone || 'N/A',
      amountCollected: t.amountCollectedPaise / 100,
      platformFee: t.platformFeePaise / 100,
      amountSettled: t.amountSettledPaise / 100,
      currency: t.currency || 'INR',
      status: t.status,
      settlementMode: t.settlementMode,
      payoutDestination: t.payoutDestination,
      collectedAt: t.collectedAt,
      settledAt: t.settledAt,
      paymentId: t.razorpayPaymentId,
    }));

    res.json({
      transactions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    logger.error('Failed to fetch merchant transactions', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * GET /api/transactions/summary
 * Aggregate metrics for collected payments, fees, and settlements
 */
router.get('/summary', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchant!.merchantId;
    const mongoose = (await import('mongoose')).default;

    const stats = await MerchantTransaction.aggregate([
      { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
      {
        $group: {
          _id: null,
          totalCollectedPaise: { $sum: '$amountCollectedPaise' },
          totalFeePaise: { $sum: '$platformFeePaise' },
          totalSettledPaise: { $sum: '$amountSettledPaise' },
          count: { $sum: 1 },
          pendingCount: {
            $sum: { $cond: [{ $in: ['$status', ['collected', 'transfer_pending']] }, 1, 0] },
          },
          settledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'settled'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalCollectedPaise: 0,
      totalFeePaise: 0,
      totalSettledPaise: 0,
      count: 0,
      pendingCount: 0,
      settledCount: 0,
    };

    res.json({
      totalCollected: result.totalCollectedPaise / 100,
      totalFees: result.totalFeePaise / 100,
      totalSettled: result.totalSettledPaise / 100,
      transactionCount: result.count,
      pendingCount: result.pendingCount,
      settledCount: result.settledCount,
    });
  } catch (err: any) {
    logger.error('Failed to fetch merchant transaction summary', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch transaction summary' });
  }
});

export default router;
