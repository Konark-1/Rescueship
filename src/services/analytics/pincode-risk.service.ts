/**
 * pincode-risk.service.ts
 * Enterprise Pincode Risk & RTO Analytics Engine.
 *
 * Aggregates 30-day historical order and NDR delivery telemetry by Indian postal code.
 * Identifies high-risk failure clusters, flags suspicious fake delivery attempts,
 * resolves city/zone, and computes actionable operational recommendations.
 */

import { Types } from 'mongoose';
import { Order } from '../../models';
import { redisConnection } from '../../config/redis';
import { logger } from '../../utils/logger';

export interface PincodeRiskSummary {
  pincode: string;
  city: string;
  state?: string;
  totalOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  courierReported: number;
  customerCancelled: number;
  fakeAttempts: number;
  avgAttempts: number;
  rtoRate: number; // percentage (0 - 100)
  riskScore: number; // 0.00 - 1.00
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  primaryCarrier?: string;
  failureReasons: string[];
  recommendedAction: string;
}

// Comprehensive Indian Pincode Prefix to City/Region Directory
const PINCODE_PREFIX_MAP: Array<{ prefix: string; city: string; state: string }> = [
  { prefix: '2013', city: 'Noida', state: 'Uttar Pradesh' },
  { prefix: '2010', city: 'Ghaziabad', state: 'Uttar Pradesh' },
  { prefix: '110', city: 'New Delhi', state: 'Delhi' },
  { prefix: '121', city: 'Faridabad', state: 'Haryana' },
  { prefix: '122', city: 'Gurugram', state: 'Haryana' },
  { prefix: '124', city: 'Rohtak', state: 'Haryana' },
  { prefix: '131', city: 'Sonipat', state: 'Haryana' },
  { prefix: '132', city: 'Panipat', state: 'Haryana' },
  { prefix: '141', city: 'Ludhiana', state: 'Punjab' },
  { prefix: '143', city: 'Amritsar', state: 'Punjab' },
  { prefix: '144', city: 'Jalandhar', state: 'Punjab' },
  { prefix: '160', city: 'Chandigarh', state: 'Punjab/Haryana' },
  { prefix: '180', city: 'Jammu', state: 'Jammu & Kashmir' },
  { prefix: '190', city: 'Srinagar', state: 'Jammu & Kashmir' },
  { prefix: '208', city: 'Kanpur', state: 'Uttar Pradesh' },
  { prefix: '226', city: 'Lucknow', state: 'Uttar Pradesh' },
  { prefix: '221', city: 'Varanasi', state: 'Uttar Pradesh' },
  { prefix: '248', city: 'Dehradun', state: 'Uttarakhand' },
  { prefix: '282', city: 'Agra', state: 'Uttar Pradesh' },
  { prefix: '302', city: 'Jaipur', state: 'Rajasthan' },
  { prefix: '342', city: 'Jodhpur', state: 'Rajasthan' },
  { prefix: '313', city: 'Udaipur', state: 'Rajasthan' },
  { prefix: '380', city: 'Ahmedabad', state: 'Gujarat' },
  { prefix: '390', city: 'Vadodara', state: 'Gujarat' },
  { prefix: '395', city: 'Surat', state: 'Gujarat' },
  { prefix: '360', city: 'Rajkot', state: 'Gujarat' },
  { prefix: '400', city: 'Mumbai', state: 'Maharashtra' },
  { prefix: '401', city: 'Thane', state: 'Maharashtra' },
  { prefix: '411', city: 'Pune', state: 'Maharashtra' },
  { prefix: '422', city: 'Nashik', state: 'Maharashtra' },
  { prefix: '431', city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' },
  { prefix: '440', city: 'Nagpur', state: 'Maharashtra' },
  { prefix: '452', city: 'Indore', state: 'Madhya Pradesh' },
  { prefix: '462', city: 'Bhopal', state: 'Madhya Pradesh' },
  { prefix: '492', city: 'Raipur', state: 'Chhattisgarh' },
  { prefix: '500', city: 'Hyderabad', state: 'Telangana' },
  { prefix: '520', city: 'Vijayawada', state: 'Andhra Pradesh' },
  { prefix: '530', city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { prefix: '560', city: 'Bengaluru', state: 'Karnataka' },
  { prefix: '570', city: 'Mysuru', state: 'Karnataka' },
  { prefix: '575', city: 'Mangaluru', state: 'Karnataka' },
  { prefix: '580', city: 'Hubli-Dharwad', state: 'Karnataka' },
  { prefix: '600', city: 'Chennai', state: 'Tamil Nadu' },
  { prefix: '641', city: 'Coimbatore', state: 'Tamil Nadu' },
  { prefix: '625', city: 'Madurai', state: 'Tamil Nadu' },
  { prefix: '620', city: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { prefix: '682', city: 'Kochi', state: 'Kerala' },
  { prefix: '695', city: 'Thiruvananthapuram', state: 'Kerala' },
  { prefix: '673', city: 'Kozhikode', state: 'Kerala' },
  { prefix: '700', city: 'Kolkata', state: 'West Bengal' },
  { prefix: '711', city: 'Howrah', state: 'West Bengal' },
  { prefix: '734', city: 'Siliguri', state: 'West Bengal' },
  { prefix: '751', city: 'Bhubaneswar', state: 'Odisha' },
  { prefix: '769', city: 'Rourkela', state: 'Odisha' },
  { prefix: '781', city: 'Guwahati', state: 'Assam' },
  { prefix: '799', city: 'Agartala', state: 'Tripura' },
  { prefix: '800', city: 'Patna', state: 'Bihar' },
  { prefix: '834', city: 'Ranchi', state: 'Jharkhand' },
  { prefix: '831', city: 'Jamshedpur', state: 'Jharkhand' },
  { prefix: '826', city: 'Dhanbad', state: 'Jharkhand' },
];

const ZONE_FALLBACKS: Record<string, { city: string; state: string }> = {
  '1': { city: 'Northern Region', state: 'Delhi/Punjab/Haryana' },
  '2': { city: 'Upper North Region', state: 'Uttar Pradesh/Uttarakhand' },
  '3': { city: 'Western Region', state: 'Rajasthan/Gujarat' },
  '4': { city: 'Central West Region', state: 'Maharashtra/Madhya Pradesh' },
  '5': { city: 'South Central Region', state: 'Karnataka/AP/Telangana' },
  '6': { city: 'Southern Region', state: 'Tamil Nadu/Kerala' },
  '7': { city: 'Eastern Region', state: 'West Bengal/Odisha/Northeast' },
  '8': { city: 'East Central Region', state: 'Bihar/Jharkhand' },
};

export class PincodeRiskService {
  private static instance: PincodeRiskService;

  private constructor() {}

  public static getInstance(): PincodeRiskService {
    if (!PincodeRiskService.instance) {
      PincodeRiskService.instance = new PincodeRiskService();
    }
    return PincodeRiskService.instance;
  }

  /**
   * Resolves the city and state for a given Indian 6-digit postal code.
   */
  public resolveLocation(pincode: string): { city: string; state: string } {
    if (!pincode) {
      return { city: 'Unknown', state: 'India' };
    }

    const cleanPin = String(pincode).trim().replace(/\D/g, '');
    if (cleanPin.length < 3) {
      return { city: 'India', state: 'India' };
    }

    for (const entry of PINCODE_PREFIX_MAP) {
      if (cleanPin.startsWith(entry.prefix)) {
        return { city: entry.city, state: entry.state };
      }
    }

    const firstChar = cleanPin.charAt(0);
    if (ZONE_FALLBACKS[firstChar]) {
      return ZONE_FALLBACKS[firstChar];
    }

    return { city: `Pincode ${cleanPin}`, state: 'India' };
  }

  /**
   * Calculates a normalized risk score (0.0 to 1.0) for a given postal code.
   * Leverages 90-day order telemetry across the merchant, with fallback to regional heuristics.
   */
  public async getPincodeRiskScore(pincode?: string | null, merchantId?: string): Promise<number> {
    if (!pincode) return 0.20; // Baseline eCommerce risk
    const cleanPin = String(pincode).trim().replace(/\D/g, '');
    if (cleanPin.length !== 6) return 0.25;

    try {
      const matchCriteria: any = {
        shippingPincode: cleanPin,
        createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      };
      if (merchantId) {
        matchCriteria.merchantId = new Types.ObjectId(merchantId);
      }

      const stats = await Order.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            failedOrders: {
              $sum: {
                $cond: [{ $in: ['$status', ['rto', 'returned', 'cancelled']] }, 1, 0],
              },
            },
          },
        },
      ]);

      if (stats.length > 0 && stats[0].totalOrders >= 3) {
        const rate = stats[0].failedOrders / stats[0].totalOrders;
        return Number(Math.min(1.0, Math.max(0.0, rate)).toFixed(2));
      }
    } catch (err: any) {
      logger.warn('Failed to query pincode risk from order history, using heuristic', {
        pincode: cleanPin,
        error: err?.message,
      });
    }

    // Heuristic fallbacks for well-known regional profiles
    if (cleanPin.startsWith('78') || cleanPin.startsWith('79')) {
      return 0.32; // Remote Northeast
    }
    if (cleanPin.startsWith('80') || cleanPin.startsWith('82') || cleanPin.startsWith('84')) {
      return 0.28; // Rural Eastern belt
    }
    if (
      cleanPin.startsWith('110') ||
      cleanPin.startsWith('400') ||
      cleanPin.startsWith('560') ||
      cleanPin.startsWith('600')
    ) {
      return 0.12; // Tier-1 high density metros
    }

    return 0.20; // Default baseline risk
  }

  /**
   * Retrieves the Top N Highest-Risk Pincodes for a merchant over the last 30 days.
   * Cached in Redis with a 5-minute (300s) TTL.
   */
  public async getTopRiskPincodes(merchantId: string, limit: number = 5): Promise<PincodeRiskSummary[]> {
    const cacheKey = `pincode_risk:${merchantId}:${limit}`;

    // 1. Try Redis Cache
    try {
      if (redisConnection && typeof (redisConnection as any).get === 'function') {
        const cached = await redisConnection.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (cacheErr: any) {
      logger.debug('Redis cache miss or read error in getTopRiskPincodes', { error: cacheErr?.message });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 2. Aggregate MongoDB Orders
    const rows = await Order.aggregate([
      {
        $match: {
          merchantId: new Types.ObjectId(merchantId),
          shippingPincode: { $exists: true, $ne: null, $nin: ['', null] },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$shippingPincode',
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          failedOrders: {
            $sum: {
              $cond: [{ $in: ['$status', ['rto', 'returned', 'cancelled']] }, 1, 0],
            },
          },
          courierReported: {
            $sum: {
              $cond: [{ $eq: ['$failureSource', 'COURIER_REPORTED'] }, 1, 0],
            },
          },
          customerCancelled: {
            $sum: {
              $cond: [{ $eq: ['$failureSource', 'CUSTOMER_PRE_ATTEMPT'] }, 1, 0],
            },
          },
          fakeAttempts: {
            $sum: {
              $cond: [{ $gte: [{ $ifNull: ['$ndr.fakeRemarkScore', 0] }, 0.5] }, 1, 0],
            },
          },
          totalAttempts: {
            $sum: { $ifNull: ['$attemptCount', 0] },
          },
          cities: { $addToSet: '$shippingCity' },
          states: { $addToSet: '$shippingState' },
          failureReasons: { $push: '$ndr.reason' },
          carriers: { $addToSet: '$carrier' },
        },
      },
    ]);

    if (!rows || rows.length === 0) {
      return [];
    }

    // Adaptive noise filter: If catalog has > 10 distinct pincodes, filter for totalOrders >= 2
    const minOrders = rows.length > 10 ? 2 : 1;
    const filteredRows = rows.filter((r) => r.totalOrders >= minOrders);

    const summaries: PincodeRiskSummary[] = filteredRows.map((doc) => {
      const pin = String(doc._id).trim();
      const loc = this.resolveLocation(pin);
      const dbCity = (doc.cities || []).find((c: any) => typeof c === 'string' && c.trim().length > 0);
      const dbState = (doc.states || []).find((s: any) => typeof s === 'string' && s.trim().length > 0);
      const city = dbCity || loc.city;
      const state = dbState || loc.state;

      const total = doc.totalOrders || 1;
      const failed = doc.failedOrders || 0;
      const courierReported = doc.courierReported || 0;
      const customerCancelled = doc.customerCancelled || 0;
      const totalAttempts = doc.totalAttempts || 0;
      const avgAttempts = total > 0 ? Number((totalAttempts / total).toFixed(1)) : 0;

      const rtoFraction = failed / total;
      const rtoRate = Number((rtoFraction * 100).toFixed(1));

      // Weighted score blending actual RTO rate and fake delivery remark penalties
      const fakePenalty = doc.fakeAttempts > 0 ? Math.min(0.25, doc.fakeAttempts * 0.08) : 0;
      const riskScore = Number(Math.min(1.0, Math.max(0.0, rtoFraction + fakePenalty)).toFixed(2));

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (rtoRate >= 50 || riskScore >= 0.65) {
        riskLevel = 'CRITICAL';
      } else if (rtoRate >= 30 || riskScore >= 0.40) {
        riskLevel = 'HIGH';
      } else if (rtoRate >= 18 || riskScore >= 0.22) {
        riskLevel = 'MEDIUM';
      }

      let recommendedAction: string;
      if (rtoFraction >= 0.5) {
        recommendedAction = 'Require UPI deposit or mandatory phone verification';
      } else if (doc.fakeAttempts >= 2) {
        recommendedAction = 'Audit carrier for fake attempts / reassign courier';
      } else if (rtoFraction >= 0.25) {
        recommendedAction = 'Enable pre-delivery confirmation & COD verification';
      } else {
        recommendedAction = 'Monitor delivery SLA';
      }

      // Collect unique non-null failure reasons (up to 3)
      const cleanReasons = Array.from(
        new Set(
          (doc.failureReasons || [])
            .filter((reason: any) => typeof reason === 'string' && reason.trim().length > 0)
        )
      ).slice(0, 3) as string[];

      const carriers = (doc.carriers || []).filter((c: any) => typeof c === 'string');

      return {
        pincode: pin,
        city,
        state,
        totalOrders: doc.totalOrders,
        deliveredOrders: doc.deliveredOrders || 0,
        failedOrders: doc.failedOrders || 0,
        courierReported,
        customerCancelled,
        fakeAttempts: doc.fakeAttempts || 0,
        avgAttempts,
        rtoRate,
        riskScore,
        riskLevel,
        primaryCarrier: carriers[0] || undefined,
        failureReasons: cleanReasons,
        recommendedAction,
      };
    });

    // Sort by risk priority: highest rtoRate first, then highest fakeAttempts, then total volume
    summaries.sort((a, b) => {
      if (b.rtoRate !== a.rtoRate) return b.rtoRate - a.rtoRate;
      if (b.fakeAttempts !== a.fakeAttempts) return b.fakeAttempts - a.fakeAttempts;
      return b.totalOrders - a.totalOrders;
    });

    const topList = summaries.slice(0, Math.max(1, limit));

    // 3. Cache in Redis (300s TTL)
    try {
      if (redisConnection && typeof (redisConnection as any).set === 'function') {
        await redisConnection.set(cacheKey, JSON.stringify(topList), 'EX', 300);
      }
    } catch (writeErr: any) {
      logger.warn('Failed to cache pincode risk in Redis', { error: writeErr?.message });
    }

    return topList;
  }
}

export const pincodeRiskService = PincodeRiskService.getInstance();
