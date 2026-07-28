import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant, IMerchant } from '../models/Merchant';
import { alertService } from '../services/alert.service';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'quality-monitor';

export const qualityMonitorQueue = new Queue(QUEUE_NAME, { connection: redisConnection as any });

export interface QualityCheckResult {
  merchantId: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  messagingLimitTier: string;
  templatesRejected: string[];
  action: 'none' | 'warn' | 'pause';
}

async function graphGet(path: string, params: Record<string, any>, token: string): Promise<any> {
  const url = new URL(`https://graph.facebook.com/v22.0${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set('access_token', token);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Graph API ${res.status}`);
  }
  return res.json();
}

async function checkMerchantQuality(merchant: IMerchant): Promise<QualityCheckResult> {
  const wabaConfig = (merchant as any).whatsappConfig;
  const token = wabaConfig?.systemUserToken || wabaConfig?.accessToken;
  const wabaId = wabaConfig?.wabaId;

  const result: QualityCheckResult = {
    merchantId: (merchant as any)._id?.toString() || (merchant as any).id || '',
    qualityRating: 'UNKNOWN',
    messagingLimitTier: 'UNKNOWN',
    templatesRejected: [],
    action: 'none',
  };

  if (!wabaId || !token) return result;

  // 1. Check WABA quality rating
  try {
    const wabaData = await graphGet(`/${wabaId}`, {
      fields: 'quality_rating,messaging_limit_tier',
    }, token);

    result.qualityRating = wabaData.quality_rating || 'UNKNOWN';
    result.messagingLimitTier = wabaData.messaging_limit_tier || 'UNKNOWN';
  } catch (err: any) {
    logger.warn(`[QualityMonitor] WABA fetch failed for ${result.merchantId}`, {
      error: err.message,
    });
  }

  // 2. Check template statuses
  try {
    const templatesData = await graphGet(`/${wabaId}/message_templates`, {
      fields: 'name,status,rejection_reason',
      limit: 50,
    }, token);

    for (const tpl of templatesData?.data || []) {
      if (tpl.status === 'REJECTED') {
        result.templatesRejected.push(`${tpl.name}: ${tpl.rejection_reason || 'no reason given'}`);
      }
    }
  } catch (err: any) {
    logger.warn(`[QualityMonitor] Template fetch failed for ${result.merchantId}`, {
      error: err.message,
    });
  }

  // 3. Determine action
  if (result.qualityRating === 'RED') {
    result.action = 'pause';
  } else if (result.qualityRating === 'YELLOW' || result.templatesRejected.length > 0) {
    result.action = 'warn';
  }

  // Persist the check result
  await Merchant.findByIdAndUpdate(
    result.merchantId,
    {
      $set: {
        'quality.lastCheckedAt': new Date(),
        'quality.rating': result.qualityRating,
        'quality.messagingTier': result.messagingLimitTier,
        'quality.rejectedTemplates': result.templatesRejected,
      },
    }
  );

  return result;
}

async function pauseMerchant(merchant: IMerchant, result: QualityCheckResult): Promise<void> {
  const mId = (merchant as any)._id?.toString() || (merchant as any).id || '';
  await Merchant.findByIdAndUpdate(
    mId,
    {
      $set: {
        'billing.status': 'paused_quality',
        'quality.pausedAt': new Date(),
        'quality.pauseReason': `WABA quality rating: ${result.qualityRating}`,
      },
    }
  );

  await alertService.sendQualityPause(merchant, result);
  logger.warn(`[QualityMonitor] PAUSED merchant ${mId} — quality RED`);
}

/**
 * Runs every 6 hours. Checks WABA quality rating + template statuses
 * for all active (live + paid) merchants.
 */
export function startQualityMonitorWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      logger.info('[QualityMonitor] Starting cycle', { jobId: job.id });

      const activeMerchants = await Merchant.find({
        'billing.status': 'active',
        'onboarding.completedAt': { $exists: true },
        'whatsappConfig.wabaId': { $exists: true },
      }).lean();

      const results: QualityCheckResult[] = [];

      for (const merchant of activeMerchants) {
        try {
          const result = await checkMerchantQuality(merchant as IMerchant);
          results.push(result);

          if (result.action === 'pause') {
            await pauseMerchant(merchant as IMerchant, result);
          } else if (result.action === 'warn') {
            await alertService.sendQualityWarning(merchant as IMerchant, result);
          }
        } catch (err: any) {
          logger.error(`[QualityMonitor] Failed for ${(merchant as any)._id || (merchant as any).id}`, {
            error: err.message,
          });
        }
      }

      logger.info('[QualityMonitor] Cycle complete', {
        checked: results.length,
        warnings: results.filter(r => r.action === 'warn').length,
        paused: results.filter(r => r.action === 'pause').length,
      });

      return results;
    },
    { connection: redisConnection as any, concurrency: 3 }
  );

  // Schedule: every 6 hours
  qualityMonitorQueue.add(
    'check-all',
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 }, removeOnComplete: 10 }
  );

  logger.info('[QualityMonitor] Worker started, scheduled every 6h');
  return worker;
}
