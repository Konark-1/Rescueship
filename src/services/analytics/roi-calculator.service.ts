/**
 * roi-calculator.service.ts
 * Enterprise Anti-Refund ROI Calculator & Weekly Reporting Engine.
 *
 * Golden Metric:
 * Reverse-logistics cost per failed shipment = ₹70 forward shipping + ₹70 reverse RTO shipping = ₹140.
 * Every rescued delivery prevents this direct out-of-pocket loss for the merchant.
 */

import { Types } from 'mongoose';
import { Order, NdrCase, Merchant } from '../../models';
import { logger } from '../../utils/logger';

export interface MerchantRoiSummary {
  merchantId: string;
  currency: string;
  estimatedRtoLossPerOrder: number;
  monthRescuedCount: number;
  monthRtoFeesSaved: number;
  monthRevenueProtected: number;
  totalRescuedCount: number;
  totalRtoFeesSaved: number;
  totalRevenueProtected: number;
  estimatedSoftwareCostMonth: number;
  roiMultiple: number;
  dashboardHeaderMessage: string;
  license: {
    status: 'TRIAL' | 'ACTIVE' | 'APPROACHING_EXPIRY' | 'EXPIRED';
    accessGrantedAt: Date | null;
    accessExpiresAt: Date | null;
    daysRemaining: number;
  };
}

export interface WeeklyReportMetrics {
  merchantId: string;
  merchantName: string;
  phone: string;
  startDate: Date;
  endDate: Date;
  interceptedCount: number;
  locationPinsSecured: number;
  addressesUpdated: number;
  reattemptsScheduled: number;
  convertedPrepaidCount: number;
  rescuedCount: number;
  rtoFeesSaved: number;
  summaryMessage: string;
}

export class RoiCalculatorService {
  private static instance: RoiCalculatorService;

  public static readonly DEFAULT_RTO_LOSS_PER_ORDER = 140; // ₹70 forward + ₹70 reverse

  private constructor() {}

  public static getInstance(): RoiCalculatorService {
    if (!RoiCalculatorService.instance) {
      RoiCalculatorService.instance = new RoiCalculatorService();
    }
    return RoiCalculatorService.instance;
  }

  /**
   * Return the configured or default RTO loss per shipment for a merchant
   */
  public getRtoLossPerOrder(merchant: any): number {
    return merchant?.settings?.estimatedRtoLossPerOrder || RoiCalculatorService.DEFAULT_RTO_LOSS_PER_ORDER;
  }

  /**
   * Compute complete Anti-Refund ROI metrics for merchant dashboard
   */
  public async getMerchantRoiSummary(merchantId: string): Promise<MerchantRoiSummary> {
    const mId = new Types.ObjectId(merchantId);
    const merchant = await Merchant.findById(mId).lean();
    const rtoLossPerOrder = this.getRtoLossPerOrder(merchant);

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Month-to-date rescued orders
    const monthOrders = await Order.find({
      merchantId: mId,
      $or: [
        { status: { $in: ['ndr_rescued', 'converted_to_prepaid'] } },
        { rtoFeeSaved: { $gt: 0 } },
      ],
      updatedAt: { $gte: monthStart, $lte: monthEnd },
    }).select('orderValue rtoFeeSaved status').lean();

    const monthRescuedCount = monthOrders.length;
    const monthRtoFeesSaved = monthOrders.reduce((sum, o) => sum + (o.rtoFeeSaved || rtoLossPerOrder), 0);
    const monthRevenueProtected = monthOrders.reduce((sum, o) => sum + (o.orderValue || 0), 0);

    // All-time rescued orders
    const allTimeOrders = await Order.find({
      merchantId: mId,
      $or: [
        { status: { $in: ['ndr_rescued', 'converted_to_prepaid'] } },
        { rtoFeeSaved: { $gt: 0 } },
      ],
    }).select('orderValue rtoFeeSaved status').lean();

    const totalRescuedCount = allTimeOrders.length;
    const totalRtoFeesSaved = allTimeOrders.reduce((sum, o) => sum + (o.rtoFeeSaved || rtoLossPerOrder), 0);
    const totalRevenueProtected = allTimeOrders.reduce((sum, o) => sum + (o.orderValue || 0), 0);

    // Software investment (90-day license baseline ₹15,000 ~ ₹5,000/month)
    const estimatedSoftwareCostMonth = 5000;
    const roiMultiple = estimatedSoftwareCostMonth > 0
      ? Number((monthRtoFeesSaved / estimatedSoftwareCostMonth).toFixed(1))
      : 1;

    // License expiry days calculation
    const expiresAt = (merchant as any)?.accessExpiresAt ? new Date((merchant as any).accessExpiresAt) : null;
    let daysRemaining = 0;
    let status: 'TRIAL' | 'ACTIVE' | 'APPROACHING_EXPIRY' | 'EXPIRED' = (merchant as any)?.licenseStatus || 'TRIAL';

    if (expiresAt) {
      const diffMs = expiresAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      if (daysRemaining <= 0) {
        status = 'EXPIRED';
      } else if (daysRemaining <= 15) {
        status = 'APPROACHING_EXPIRY';
      } else {
        status = 'ACTIVE';
      }
    }

    const dashboardHeaderMessage = `RescueShip has saved you ₹${monthRtoFeesSaved.toLocaleString('en-IN')} in RTO fees this month.`;

    return {
      merchantId,
      currency: 'INR',
      estimatedRtoLossPerOrder: rtoLossPerOrder,
      monthRescuedCount,
      monthRtoFeesSaved,
      monthRevenueProtected,
      totalRescuedCount,
      totalRtoFeesSaved,
      totalRevenueProtected,
      estimatedSoftwareCostMonth,
      roiMultiple,
      dashboardHeaderMessage,
      license: {
        status,
        accessGrantedAt: (merchant as any)?.accessGrantedAt ? new Date((merchant as any).accessGrantedAt) : null,
        accessExpiresAt: expiresAt,
        daysRemaining,
      },
    };
  }

  /**
   * Aggregate metrics for weekly Sunday automated report
   */
  public async getWeeklyReportMetrics(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeeklyReportMetrics | null> {
    const mId = new Types.ObjectId(merchantId);
    const merchant = await Merchant.findById(mId).lean();
    if (!merchant) return null;

    const phone = merchant.ownerPhone || (merchant as any).phone || '';
    const rtoLossPerOrder = this.getRtoLossPerOrder(merchant);

    // NDR Cases created in this week
    const cases = await NdrCase.find({
      merchantId: mId,
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    const interceptedCount = cases.length;
    const locationPinsSecured = cases.filter((c) => c.customerResponseType === 'LOCATION_PIN').length;
    const addressesUpdated = cases.filter((c) => c.customerResponseType === 'TEXT_ADDRESS').length;
    const reattemptsScheduled = cases.filter((c) => c.status === 'REATTEMPT_REQUESTED' || c.resolutionType === 'rescheduled').length;
    const convertedPrepaidCount = cases.filter((c) => c.customerResponseType === 'PAYMENT').length;

    // Rescued orders in this week
    const rescuedOrders = await Order.find({
      merchantId: mId,
      $or: [
        { status: { $in: ['ndr_rescued', 'converted_to_prepaid'] } },
        { rtoFeeSaved: { $gt: 0 } },
      ],
      updatedAt: { $gte: startDate, $lte: endDate },
    }).select('rtoFeeSaved').lean();

    const rescuedCount = rescuedOrders.length;
    const rtoFeesSaved = rescuedOrders.reduce((sum, o) => sum + (o.rtoFeeSaved || rtoLossPerOrder), 0);

    const summaryMessage =
      `📊 Weekly Rescue Report: We intercepted ${interceptedCount} failed deliveries this week. ` +
      `By securing location pins and reattempts, we saved you ₹${rtoFeesSaved.toLocaleString('en-IN')} in return shipping costs.`;

    return {
      merchantId,
      merchantName: merchant.storeName || merchant.name || 'Merchant',
      phone,
      startDate,
      endDate,
      interceptedCount,
      locationPinsSecured,
      addressesUpdated,
      reattemptsScheduled,
      convertedPrepaidCount,
      rescuedCount,
      rtoFeesSaved,
      summaryMessage,
    };
  }
}

export const roiCalculatorService = RoiCalculatorService.getInstance();
