import { Types } from 'mongoose';
import { Order } from '../models';
import { logger } from '../utils/logger';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DashboardData {
  totalOrders: number;
  codOrders: number;
  prepaidOrders: number;
  ndrCount: number;
  rescuedCount: number;
  rescueRate: number; // percentage
  conversionCount: number;
  conversionRate: number; // percentage
  totalRevenueSaved: number; // rescued * average RTO cost (assume flat 400 INR as default)
  carrierBreakdown: Array<{
    carrier: string;
    totalNDR: number;
    rescued: number;
    rescueRate: number;
  }>;
}

export interface CarrierStats {
  carrier: string;
  totalNDR: number;
  rescued: number;
  rescueRate: number;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private static readonly DEFAULT_RTO_COST = 400; // Average RTO cost in INR

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Compute merchant analytics dashboard metrics
   */
  public async getMerchantDashboard(merchantId: string, dateRange: DateRange): Promise<DashboardData> {
    logger.info('Computing merchant dashboard analytics', { merchantId, range: dateRange });

    const mId = new Types.ObjectId(merchantId);
    const start = dateRange.startDate;
    const end = dateRange.endDate;

    try {
      const summaryPipeline = [
        {
          $match: {
            merchantId: mId,
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            codOrders: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'cod'] }, 1, 0] },
            },
            prepaidOrders: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'prepaid'] }, 1, 0] },
            },
            conversionCount: {
              $sum: { $cond: [{ $eq: ['$status', 'converted_to_prepaid'] }, 1, 0] },
            },
            ndrCount: {
              $sum: { $cond: [{ $ifNull: ['$ndr.detectedAt', false] }, 1, 0] },
            },
            rescuedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'ndr_rescued'] }, 1, 0] },
            },
          },
        },
      ];

      const summaryResult = await Order.aggregate(summaryPipeline);
      const summary = summaryResult[0] || {
        totalOrders: 0,
        codOrders: 0,
        prepaidOrders: 0,
        conversionCount: 0,
        ndrCount: 0,
        rescuedCount: 0,
      };

      // Compute Rates
      const rescueRate = summary.ndrCount > 0 ? parseFloat(((summary.rescuedCount / summary.ndrCount) * 100).toFixed(2)) : 0;
      const conversionRate = summary.codOrders > 0 ? parseFloat(((summary.conversionCount / summary.codOrders) * 100).toFixed(2)) : 0;
      const totalRevenueSaved = summary.rescuedCount * AnalyticsService.DEFAULT_RTO_COST;

      // Compute Carrier Breakdown
      const carrierBreakdown = await this.getCarrierPerformance(merchantId, dateRange);

      return {
        totalOrders: summary.totalOrders,
        codOrders: summary.codOrders,
        prepaidOrders: summary.prepaidOrders,
        ndrCount: summary.ndrCount,
        rescuedCount: summary.rescuedCount,
        rescueRate,
        conversionCount: summary.conversionCount,
        conversionRate,
        totalRevenueSaved,
        carrierBreakdown,
      };
    } catch (err: any) {
      logger.error('Failed to compute merchant dashboard stats', { merchantId, error: err.message });
      throw err;
    }
  }

  /**
   * Compute carrier performance breakdown
   */
  public async getCarrierPerformance(merchantId: string, dateRange?: DateRange): Promise<CarrierStats[]> {
    const mId = new Types.ObjectId(merchantId);
    
    // Default date range: last 30 days if not provided
    const start = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = dateRange?.endDate || new Date();

    try {
      const pipeline = [
        {
          $match: {
            merchantId: mId,
            carrier: { $ne: null },
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: '$carrier',
            totalNDR: {
              $sum: { $cond: [{ $ifNull: ['$ndr.detectedAt', false] }, 1, 0] },
            },
            rescued: {
              $sum: { $cond: [{ $eq: ['$status', 'ndr_rescued'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            carrier: '$_id',
            totalNDR: 1,
            rescued: 1,
            rescueRate: {
              $cond: [
                { $gt: ['$totalNDR', 0] },
                { $multiply: [{ $divide: ['$rescued', '$totalNDR'] }, 100] },
                0,
              ],
            },
          },
        },
      ];

      const results = await Order.aggregate(pipeline);
      return results.map((r) => ({
        carrier: r.carrier,
        totalNDR: r.totalNDR,
        rescued: r.rescued,
        rescueRate: parseFloat(r.rescueRate.toFixed(2)),
      }));
    } catch (err: any) {
      logger.error('Failed to compute carrier performance statistics', { merchantId, error: err.message });
      throw err;
    }
  }

  /**
   * Helper: Get simple rescue rate percentage
   */
  public async getRescueRate(merchantId: string): Promise<number> {
    const mId = new Types.ObjectId(merchantId);
    try {
      const ndrCount = await Order.countDocuments({ merchantId: mId, 'ndr.detectedAt': { $ne: null } });
      if (ndrCount === 0) return 0;
      const rescuedCount = await Order.countDocuments({ merchantId: mId, status: 'ndr_rescued' });
      return parseFloat(((rescuedCount / ndrCount) * 100).toFixed(2));
    } catch (err: any) {
      logger.error('Failed to get rescue rate', { merchantId, error: err.message });
      return 0;
    }
  }

  /**
   * Helper: Get simple conversion rate percentage
   */
  public async getConversionRate(merchantId: string): Promise<number> {
    const mId = new Types.ObjectId(merchantId);
    try {
      const codCount = await Order.countDocuments({ merchantId: mId, paymentMethod: 'cod' });
      if (codCount === 0) return 0;
      const convertedCount = await Order.countDocuments({ merchantId: mId, status: 'converted_to_prepaid' });
      return parseFloat(((convertedCount / codCount) * 100).toFixed(2));
    } catch (err: any) {
      logger.error('Failed to get conversion rate', { merchantId, error: err.message });
      return 0;
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();
