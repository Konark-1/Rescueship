#!/usr/bin/env ts-node
/**
 * liveops-watchtower.ts
 *
 * LiveOps operational telemetry and watchtower health checks:
 * 1. checkDeadLetterQueue(): Redis / BullMQ dead-letter and failure counts across queues
 * 2. checkWabaQuality(wabaId): Meta WhatsApp Business Account quality rating & health
 * 3. checkWebhookFailureRate(): Recent webhook error frequency and failure rate
 *
 * Can be imported as utility functions or run directly as a CLI script:
 *   npx ts-node src/scripts/liveops-watchtower.ts [dlq|waba <id>|webhooks|all]
 */

import { Queue } from 'bullmq';
import mongoose from 'mongoose';
import axios from 'axios';
import { redisConnection } from '../config/redis';
import { WebhookEvent, Merchant } from '../models';
import { config } from '../config/env';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

export interface DeadLetterCheckResult {
  deadLetterQueue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
  };
  failedByQueue: Record<string, number>;
  totalFailedAcrossQueues: number;
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
}

export interface WabaQualityResult {
  wabaId: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  messagingLimitTier?: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  error?: string;
  timestamp: string;
}

export interface WebhookFailureRateResult {
  windowMinutes: number;
  totalEvents: number;
  failedEvents: number;
  successfulEvents: number;
  failureRatePercentage: number;
  recentErrors: Array<{ source: string; eventId?: string; error: string; createdAt: Date }>;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
}

/**
 * 1. Check Redis / BullMQ dead letter queue and failed counts across core worker queues
 */
export async function checkDeadLetterQueue(): Promise<DeadLetterCheckResult> {
  const queueNames = [
    'dead-letter',
    'ndr-lifecycle',
    'ndr-rescue',
    'escalation',
    'cod-conversion',
    'quality-monitor',
    'template-poller',
    'subscription-lifecycle',
    'reconciliation',
    'digest',
  ];

  const queues = queueNames.map((name) => new Queue(name, { connection: redisConnection as any }));

  try {
    const dlq = queues[0];
    const dlqCounts = await dlq.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    const dlqTotal = (dlqCounts.waiting || 0) + (dlqCounts.active || 0) + (dlqCounts.failed || 0) + (dlqCounts.delayed || 0);

    const failedByQueue: Record<string, number> = {};
    let totalFailedAcrossQueues = 0;

    await Promise.all(
      queues.slice(1).map(async (q) => {
        try {
          const failed = await q.getFailedCount();
          failedByQueue[q.name] = failed;
          totalFailedAcrossQueues += failed;
        } catch (err: any) {
          failedByQueue[q.name] = -1;
          logger.warn(`Watchtower failed inspecting queue ${q.name}`, { error: err?.message });
        }
      })
    );

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if ((dlqCounts.failed || 0) > 0 || (dlqCounts.waiting || 0) > 5 || totalFailedAcrossQueues > 25) {
      status = 'critical';
    } else if ((dlqCounts.waiting || 0) > 0 || totalFailedAcrossQueues > 0) {
      status = 'degraded';
    }

    return {
      deadLetterQueue: {
        waiting: dlqCounts.waiting || 0,
        active: dlqCounts.active || 0,
        completed: dlqCounts.completed || 0,
        failed: dlqCounts.failed || 0,
        delayed: dlqCounts.delayed || 0,
        total: dlqTotal,
      },
      failedByQueue,
      totalFailedAcrossQueues,
      status,
      timestamp: new Date().toISOString(),
    };
  } finally {
    await Promise.all(queues.map((q) => q.close().catch(() => {})));
  }
}

/**
 * 2. Check Meta WABA quality rating via Meta Graph API
 */
export async function checkWabaQuality(wabaId: string, accessTokenOverride?: string): Promise<WabaQualityResult> {
  const version = config.whatsapp.apiVersion || 'v22.0';
  let token = accessTokenOverride;

  if (!token) {
    try {
      // Look up merchant with matching WABA credentials if DB is connected
      if (mongoose.connection.readyState === 1) {
        const merchant = await Merchant.findOne({
          $or: [
            { 'whatsappConfig.wabaId': wabaId },
            { 'whatsappConfig.businessAccountId': wabaId },
          ],
        }).lean();

        const wc = (merchant as any)?.whatsappConfig;
        const encToken = wc?.systemUserToken || wc?.accessToken;
        if (encToken) {
          try {
            token = encryptionService.decrypt(encToken);
          } catch {
            token = undefined;
          }
        }
      }
    } catch (dbErr: any) {
      logger.warn('Watchtower could not query merchant for WABA token', { error: dbErr?.message });
    }
  }

  if (!token) {
    token = config.whatsapp.accessToken;
  }

  if (!token || token.startsWith('your-') || token === 'dummy_sim') {
    return {
      wabaId,
      qualityRating: 'UNKNOWN',
      messagingLimitTier: 'UNKNOWN',
      status: 'unknown',
      error: 'No valid Meta WhatsApp access token configured or simulated environment active',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const url = `https://graph.facebook.com/${version}/${wabaId}`;
    const response = await axios.get(url, {
      params: { fields: 'quality_rating,messaging_limit_tier' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    const data = response.data || {};
    const qualityRating = (data.quality_rating || 'UNKNOWN').toUpperCase() as 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
    const messagingLimitTier = data.messaging_limit_tier;

    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'unknown';
    if (qualityRating === 'GREEN') status = 'healthy';
    else if (qualityRating === 'YELLOW') status = 'warning';
    else if (qualityRating === 'RED') status = 'critical';

    return {
      wabaId,
      qualityRating,
      messagingLimitTier,
      status,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.warn('Watchtower WABA quality probe failed', { wabaId, error: msg });
    return {
      wabaId,
      qualityRating: 'UNKNOWN',
      status: 'unknown',
      error: msg,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 3. Check recent webhook failure rate from WebhookEvent logs
 */
export async function checkWebhookFailureRate(windowMinutes: number = 60): Promise<WebhookFailureRateResult> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const [totalEvents, failedEvents, recentErrorDocs] = await Promise.all([
    WebhookEvent.countDocuments({ createdAt: { $gte: since } }),
    WebhookEvent.countDocuments({ createdAt: { $gte: since }, error: { $ne: null } }),
    WebhookEvent.find({ createdAt: { $gte: since }, error: { $ne: null } })
      .select('source eventId error createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const successfulEvents = Math.max(0, totalEvents - failedEvents);
  const failureRatePercentage = totalEvents > 0
    ? Number(((failedEvents / totalEvents) * 100).toFixed(2))
    : 0;

  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (failureRatePercentage > 15 || (failedEvents > 50 && totalEvents > 0)) {
    status = 'critical';
  } else if (failureRatePercentage > 5 || failedEvents > 5) {
    status = 'warning';
  }

  const recentErrors = recentErrorDocs.map((doc: any) => ({
    source: doc.source,
    eventId: doc.eventId,
    error: doc.error || 'Unknown error',
    createdAt: doc.createdAt,
  }));

  return {
    windowMinutes,
    totalEvents,
    failedEvents,
    successfulEvents,
    failureRatePercentage,
    recentErrors,
    status,
    timestamp: new Date().toISOString(),
  };
}

// ─── CLI Entrypoint ───
async function runCli() {
  const mode = process.argv[2] || 'all';
  const param = process.argv[3];

  console.log(`\n🔭 RescueShip LiveOps Watchtower — Starting check [mode: ${mode}]...`);

  if (mongoose.connection.readyState !== 1 && (mode === 'all' || mode === 'webhooks' || mode === 'waba')) {
    const mongoUri = config.mongodb?.uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/rescueship';
    try {
      await mongoose.connect(mongoUri);
    } catch (e: any) {
      console.warn(`⚠️ MongoDB connection skipped: ${e.message}`);
    }
  }

  try {
    if (mode === 'dlq' || mode === 'all') {
      console.log('\n--- Dead-Letter Queue & Worker Queue Diagnostics ---');
      const dlqResult = await checkDeadLetterQueue();
      console.log(JSON.stringify(dlqResult, null, 2));
    }

    if (mode === 'waba' || mode === 'all') {
      const wabaId = param || (config.whatsapp as any)?.businessAccountId || 'test-waba-id';
      console.log(`\n--- Meta WABA Quality Health [WABA: ${wabaId}] ---`);
      const wabaResult = await checkWabaQuality(wabaId);
      console.log(JSON.stringify(wabaResult, null, 2));
    }

    if (mode === 'webhooks' || mode === 'all') {
      const mins = param ? parseInt(param, 10) : 60;
      console.log(`\n--- Webhook Failure Rate Diagnostics [Window: ${mins}m] ---`);
      const webhookResult = await checkWebhookFailureRate(mins);
      console.log(JSON.stringify(webhookResult, null, 2));
    }
  } catch (err: any) {
    console.error(`\n❌ Watchtower inspection encountered an error: ${err.message}`);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

if (require.main === module) {
  runCli();
}
