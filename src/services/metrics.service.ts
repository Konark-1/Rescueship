import { Merchant, IMerchant } from '../models/Merchant';
import { logger } from '../utils/logger';

export interface RescueMetrics {
  merchantId: string;
  window: '24h' | '7d' | '30d' | 'lifetime';
  ndrReceived: number;
  rescuesAttempted: number;
  rescuesSucceeded: number;
  rescuesFailed: number;
  rescueRate: number;          // succeeded / attempted
  conversionRate: number;      // succeeded / ndrReceived
  avgRescueTimeMin: number;    // NDR event → successful rescue
  revenue: number;             // estimated ₹ saved (rescues × avg order value)
  templatesSent: number;
  templatesFailed: number;
}

export interface CohortMetrics {
  totalMerchants: number;
  activeMerchants: number;
  aggregateRescueRate: number;
  aggregateNDRProcessed: number;
  topPerformers: Array<{ merchantId: string; storeName: string; rescueRate: number }>;
  needsAttention: Array<{ merchantId: string; storeName: string; rescueRate: number; issue: string }>;
}

class MetricsService {
  /**
   * Record an NDR event received (from carrier webhook).
   */
  async recordNDRReceived(merchantId: string, orderId: string): Promise<void> {
    await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $inc: {
          'metrics.ndrReceived': 1,
          'metrics.ndrReceived7d': 1,
        },
        $push: {
          'metrics.recentEvents': {
            $each: [{ type: 'ndr_received', orderId, at: new Date() }],
            $slice: -200,
          },
        },
      }
    );
  }

  /**
   * Record a rescue attempt (WhatsApp template sent for an NDR).
   */
  async recordRescueAttempt(
    merchantId: string,
    orderId: string,
    templateName: string,
    success: boolean
  ): Promise<void> {
    const inc: Record<string, number> = {
      'metrics.rescuesAttempted': 1,
      'metrics.templatesSent': 1,
    };

    if (!success) {
      inc['metrics.rescuesFailed'] = 1;
      inc['metrics.templatesFailed'] = 1;
    }

    await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $inc: inc,
        $push: {
          'metrics.recentEvents': {
            $each: [{
              type: success ? 'rescue_attempt_ok' : 'rescue_attempt_fail',
              orderId,
              template: templateName,
              at: new Date(),
            }],
            $slice: -200,
          },
        },
      }
    );
  }

  /**
   * Record a successful rescue (customer confirmed re-delivery / converted).
   */
  async recordRescueSuccess(
    merchantId: string,
    orderId: string,
    ndrReceivedAt: Date,
    orderValue: number = 0
  ): Promise<void> {
    const rescueTimeMin = (Date.now() - ndrReceivedAt.getTime()) / 60_000;

    await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $inc: {
          'metrics.rescuesSucceeded': 1,
          'metrics.revenueSaved': orderValue,
        },
        $push: {
          'metrics.rescueTimes': {
            $each: [rescueTimeMin],
            $slice: -100,
          },
          'metrics.recentEvents': {
            $each: [{ type: 'rescue_success', orderId, rescueTimeMin, orderValue, at: new Date() }],
            $slice: -200,
          },
        },
      }
    );

    logger.info(`[Metrics] Rescue success: ${merchantId} / ${orderId} in ${rescueTimeMin.toFixed(1)}min`);
  }

  /**
   * Compute metrics for a single merchant.
   */
  async getMerchantMetrics(merchantId: string, window: RescueMetrics['window'] = 'lifetime'): Promise<RescueMetrics> {
    const merchant = await Merchant.findById(merchantId).lean();
    const m = (merchant as any)?.metrics || {};

    const rescueTimes: number[] = m.rescueTimes || [];
    const avgTime = rescueTimes.length > 0
      ? rescueTimes.reduce((a: number, b: number) => a + b, 0) / rescueTimes.length
      : 0;

    const attempted = m.rescuesAttempted || 0;
    const succeeded = m.rescuesSucceeded || 0;
    const ndr = m.ndrReceived || 0;

    return {
      merchantId,
      window,
      ndrReceived: ndr,
      rescuesAttempted: attempted,
      rescuesSucceeded: succeeded,
      rescuesFailed: m.rescuesFailed || 0,
      rescueRate: attempted > 0 ? succeeded / attempted : 0,
      conversionRate: ndr > 0 ? succeeded / ndr : 0,
      avgRescueTimeMin: avgTime,
      revenue: m.revenueSaved || 0,
      templatesSent: m.templatesSent || 0,
      templatesFailed: m.templatesFailed || 0,
    };
  }

  /**
   * Aggregate metrics across all pilot merchants.
   */
  async getCohortMetrics(anonymize: boolean = false): Promise<CohortMetrics> {
    const merchants = await Merchant.find({
      'onboarding.completedAt': { $exists: true },
    }).lean();

    let totalAttempted = 0;
    let totalSucceeded = 0;
    let totalNDR = 0;

    const performers: Array<{ merchantId: string; storeName: string; rescueRate: number }> = [];
    const attention: Array<{ merchantId: string; storeName: string; rescueRate: number; issue: string }> = [];

    for (let i = 0; i < merchants.length; i++) {
      const merchant = merchants[i];
      const m = (merchant as any).metrics || {};
      const attempted = m.rescuesAttempted || 0;
      const succeeded = m.rescuesSucceeded || 0;
      const rate = attempted > 0 ? succeeded / attempted : 0;
      const rawMId = (merchant as any)._id?.toString() || '';
      const rawStoreName = (merchant as any).storeName || (merchant as any).shopify?.shopDomain || rawMId;

      const mId = anonymize ? `anon_merchant_${i + 1}` : rawMId;
      const storeName = anonymize ? `Store ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}` : rawStoreName;

      totalAttempted += attempted;
      totalSucceeded += succeeded;
      totalNDR += m.ndrReceived || 0;

      if (attempted >= 5) {
        performers.push({ merchantId: mId, storeName, rescueRate: rate });

        if (rate < 0.15) {
          attention.push({
            merchantId: mId,
            storeName,
            rescueRate: rate,
            issue: rate === 0 ? 'Zero rescues succeeded — check template approval + phone numbers'
              : 'Low rescue rate — review message copy / timing',
          });
        }
      }
    }

    performers.sort((a, b) => b.rescueRate - a.rescueRate);

    return {
      totalMerchants: merchants.length,
      activeMerchants: merchants.filter(m => (m as any).billing?.status === 'active').length,
      aggregateRescueRate: totalAttempted > 0 ? totalSucceeded / totalAttempted : 0,
      aggregateNDRProcessed: totalNDR,
      topPerformers: performers.slice(0, 5),
      needsAttention: attention,
    };
  }

  /**
   * THE Phase 4 gate: is the aggregate rescue rate ≥ 30%?
   */
  async isPhase4Ready(): Promise<{ ready: boolean; rate: number; threshold: number; sampleSize: number }> {
    const cohort = await this.getCohortMetrics();
    const threshold = 0.30;

    return {
      ready: cohort.aggregateRescueRate >= threshold,
      rate: cohort.aggregateRescueRate,
      threshold,
      sampleSize: cohort.aggregateNDRProcessed,
    };
  }
}

export const metricsService = new MetricsService();
