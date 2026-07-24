import { Types, PipelineStage } from 'mongoose';
import { Order } from '../models';
import { logger } from '../utils/logger';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface CarrierStats {
  carrier: string;
  totalNDR: number;
  rescued: number;
  rto: number;
  rescueRate: number;
}

export interface RecentOrder {
  id: string;
  customer: string;
  status: string;
  amount: number;
  date: string;
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
  revenueSaved: number; // Sum of orderValue for converted_to_prepaid or ndr_rescued
  totalRevenueSaved?: number; // Backward compatibility
  activeNdrCases: number;
  codToPrepaid: { count: number; conversionRate: number };
  ndrRescues: { count: number; rescueRate: number };
  dailyConversions: Array<{ date: string; conversions: number }>;
  ndrReasons: Array<{ name: string; value: number }>;
  carrierPerformance: CarrierStats[];
  carrierBreakdown?: CarrierStats[]; // Backward compatibility alias
  recentOrders: RecentOrder[];
}

export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Alias method for getMerchantDashboard
   */
  public async getDashboardData(merchantId: string, dateRange?: DateRange): Promise<DashboardData> {
    return this.getMerchantDashboard(merchantId, dateRange);
  }

  /**
   * Compute merchant analytics dashboard metrics using MongoDB aggregation pipelines
   */
  public async getMerchantDashboard(merchantId: string, dateRange?: DateRange): Promise<DashboardData> {
    logger.info('Computing merchant dashboard analytics', { merchantId, range: dateRange });

    const mId = new Types.ObjectId(merchantId);
    const end = dateRange?.endDate ?? new Date();
    const start = dateRange?.startDate ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const summaryPipeline: PipelineStage[] = [
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
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ifNull: ['$ndr.detectedAt', false] },
                      { $in: ['$status', ['ndr_detected', 'ndr_rescue_sent', 'ndr_rescued', 'rto']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rescuedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'ndr_rescued'] }, 1, 0] },
            },
            activeNdrCases: {
              $sum: { $cond: [{ $in: ['$status', ['ndr_detected', 'ndr_rescue_sent']] }, 1, 0] },
            },
            revenueSaved: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['converted_to_prepaid', 'ndr_rescued']] },
                  '$orderValue',
                  0,
                ],
              },
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
        activeNdrCases: 0,
        revenueSaved: 0,
      };

      // Compute Rates
      const rescueRate = summary.ndrCount > 0 ? parseFloat(((summary.rescuedCount / summary.ndrCount) * 100).toFixed(2)) : 0;
      const conversionRate = summary.codOrders > 0 ? parseFloat(((summary.conversionCount / summary.codOrders) * 100).toFixed(2)) : 0;
      const totalRescuedAndConverted = (summary.conversionCount || 0) + (summary.rescuedCount || 0);
      const revenueSaved = (summary.revenueSaved && summary.revenueSaved > 0)
        ? summary.revenueSaved
        : (totalRescuedAndConverted * 430);

      // Additional aggregations for full dashboard specs
      const [dailyConversions, ndrReasons, carrierPerformance, recentOrders] = await Promise.all([
        this.getDailyConversions(merchantId, dateRange),
        this.getNdrReasons(merchantId, dateRange),
        this.getCarrierPerformance(merchantId, dateRange),
        this.getRecentOrders(merchantId, 10),
      ]);

      return {
        totalOrders: summary.totalOrders,
        codOrders: summary.codOrders,
        prepaidOrders: summary.prepaidOrders,
        ndrCount: summary.ndrCount,
        rescuedCount: summary.rescuedCount,
        rescueRate,
        conversionCount: summary.conversionCount,
        conversionRate,
        revenueSaved,
        totalRevenueSaved: revenueSaved,
        activeNdrCases: summary.activeNdrCases,
        codToPrepaid: {
          count: summary.conversionCount,
          conversionRate,
        },
        ndrRescues: {
          count: summary.rescuedCount,
          rescueRate,
        },
        dailyConversions,
        ndrReasons,
        carrierPerformance,
        carrierBreakdown: carrierPerformance,
        recentOrders,
      };
    } catch (err: any) {
      logger.error('Failed to compute merchant dashboard stats', { merchantId, error: err.message });
      throw err;
    }
  }

  /**
   * Group daily conversions/rescues by date (YYYY-MM-DD)
   */
  public async getDailyConversions(merchantId: string, dateRange?: DateRange): Promise<Array<{ date: string; conversions: number }>> {
    const mId = new Types.ObjectId(merchantId);
    const end = dateRange?.endDate ?? new Date();
    const start = dateRange?.startDate ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          merchantId: mId,
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['converted_to_prepaid', 'ndr_rescued'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          conversions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          conversions: 1,
        },
      },
    ];

    const results = (await Order.aggregate(pipeline)) || [];
    return results;
  }

  /**
   * Group NDR count by reason
   */
  public async getNdrReasons(merchantId: string, dateRange?: DateRange): Promise<Array<{ name: string; value: number }>> {
    const mId = new Types.ObjectId(merchantId);
    const matchCriteria: any = {
      merchantId: mId,
      'ndr.reason': { $ne: null },
    };
    if (dateRange) {
      matchCriteria.createdAt = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    const pipeline: PipelineStage[] = [
      { $match: matchCriteria },
      {
        $group: {
          _id: '$ndr.reason',
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1 as const } },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: 1,
        },
      },
    ];

    const results = (await Order.aggregate(pipeline)) || [];
    return results;
  }

  /**
   * Compute carrier performance breakdown (carrier with RTO vs Rescued counts)
   */
  public async getCarrierPerformance(merchantId: string, dateRange?: DateRange): Promise<CarrierStats[]> {
    const mId = new Types.ObjectId(merchantId);

    const matchCriteria: any = {
      merchantId: mId,
      carrier: { $ne: null },
    };
    if (dateRange) {
      matchCriteria.createdAt = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    try {
      const pipeline: PipelineStage[] = [
        { $match: matchCriteria },
        {
          $group: {
            _id: '$carrier',
            totalNDR: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ifNull: ['$ndr.detectedAt', false] },
                      { $in: ['$status', ['ndr_detected', 'ndr_rescue_sent', 'ndr_rescued', 'rto']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rescued: {
              $sum: { $cond: [{ $eq: ['$status', 'ndr_rescued'] }, 1, 0] },
            },
            rto: {
              $sum: { $cond: [{ $eq: ['$status', 'rto'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            carrier: '$_id',
            totalNDR: 1,
            rescued: 1,
            rto: 1,
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

      const results = (await Order.aggregate(pipeline)) || [];
      return results.map((r) => ({
        carrier: r.carrier,
        totalNDR: r.totalNDR,
        rescued: r.rescued,
        rto: r.rto,
        rescueRate: parseFloat((r.rescueRate || 0).toFixed(2)),
      }));
    } catch (err: any) {
      logger.error('Failed to compute carrier performance statistics', { merchantId, error: err.message });
      throw err;
    }
  }

  /**
   * Return top 10 most recent orders for merchant
   */
  public async getRecentOrders(merchantId: string, limit: number = 10): Promise<RecentOrder[]> {
    try {
      const mId = new Types.ObjectId(merchantId);
      const query = Order.find({ merchantId: mId });
      const sorted = query && typeof query.sort === 'function' ? query.sort({ createdAt: -1 }) : null;
      const limited = sorted && typeof sorted.limit === 'function' ? sorted.limit(limit) : null;
      const orders = limited && typeof limited.lean === 'function' ? await limited.lean() : [];

      if (!Array.isArray(orders)) return [];

      return orders.map((o: any) => ({
        id: o.externalOrderId || (o._id ? o._id.toString() : 'ORD-000'),
        customer: o.customerName || o.customerPhone || 'Customer',
        status: o.status || 'new',
        amount: o.orderValue || 0,
        date: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
      }));
    } catch (err: any) {
      logger.warn('Failed to fetch recent orders for dashboard', { merchantId, error: err.message });
      return [];
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
