import { Queue } from 'bullmq';
import mongoose from 'mongoose';
import axios from 'axios';
import { redisConnection } from '../config/redis';
import { WebhookEvent, Merchant } from '../models';
import { config } from '../config/env';
import { encryptionService } from './encryption.service';
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
  const CORE_QUEUES = [
    'carrier-dispatch',
    'cod-conversion',
    'ndr-rescue',
    'notification-dispatch',
    'order-ingestion',
  ];

  const failedByQueue: Record<string, number> = {};
  let totalFailedAcrossQueues = 0;

  for (const qName of CORE_QUEUES) {
    try {
      const q = new Queue(qName, { connection: redisConnection as any });
      const counts = await q.getJobCounts('failed');
      const count = counts.failed || 0;
      failedByQueue[qName] = count;
      totalFailedAcrossQueues += count;
      await q.close();
    } catch (err: any) {
      failedByQueue[qName] = -1;
      logger.warn(`[Watchtower DLQ] Unable to inspect queue ${qName}`, { error: err.message });
    }
  }

  // Also inspect dedicated dlq queue
  const dlqQueue = new Queue('dlq', { connection: redisConnection as any });
  let dlqCounts = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };

  try {
    const rawCounts = await dlqQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    dlqCounts = {
      waiting: rawCounts.waiting || 0,
      active: rawCounts.active || 0,
      completed: rawCounts.completed || 0,
      failed: rawCounts.failed || 0,
      delayed: rawCounts.delayed || 0,
    };
  } catch (err: any) {
    logger.warn('[Watchtower DLQ] Failed to fetch DLQ metrics', { error: err.message });
  } finally {
    await dlqQueue.close();
  }

  const totalDlq =
    dlqCounts.waiting +
    dlqCounts.active +
    dlqCounts.completed +
    dlqCounts.failed +
    dlqCounts.delayed;

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (dlqCounts.failed > 5 || totalFailedAcrossQueues > 20) {
    status = 'critical';
  } else if (dlqCounts.failed > 0 || totalFailedAcrossQueues > 0) {
    status = 'degraded';
  }

  return {
    deadLetterQueue: {
      ...dlqCounts,
      total: totalDlq,
    },
    failedByQueue,
    totalFailedAcrossQueues,
    status,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 2. Check Meta WhatsApp Business Account (WABA) Quality Health
 */
export async function checkWabaQuality(wabaId: string): Promise<WabaQualityResult> {
  const token = (config.whatsapp as any)?.systemUserToken || config.whatsapp?.accessToken;

  if (!token) {
    return {
      wabaId,
      qualityRating: 'UNKNOWN',
      status: 'warning',
      error: 'WhatsApp systemUserToken not configured in environment',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const metaApiVersion = 'v19.0';
    const url = `https://graph.facebook.com/${metaApiVersion}/${wabaId}?fields=id,name,message_template_namespace,phone_numbers{id,display_phone_number,quality_rating,messaging_limit_tier}`;

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    const phoneNumbers = res.data?.phone_numbers?.data || [];
    if (phoneNumbers.length === 0) {
      return {
        wabaId,
        qualityRating: 'UNKNOWN',
        status: 'warning',
        error: 'No phone numbers registered under this WABA',
        timestamp: new Date().toISOString(),
      };
    }

    const primary = phoneNumbers[0];
    const qualityRating = (primary.quality_rating || 'UNKNOWN').toUpperCase();
    const messagingLimitTier = primary.messaging_limit_tier;

    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
    if (qualityRating === 'RED') {
      status = 'critical';
    } else if (qualityRating === 'YELLOW') {
      status = 'warning';
    } else if (qualityRating === 'GREEN') {
      status = 'healthy';
    } else {
      status = 'unknown';
    }

    return {
      wabaId,
      qualityRating,
      messagingLimitTier,
      status,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    logger.error(`[Watchtower WABA] Health query failed for ${wabaId}`, { error: errorMsg });

    return {
      wabaId,
      qualityRating: 'UNKNOWN',
      status: 'critical',
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 3. Inspect Webhook Error Frequency and compute recent failure rate
 */
export async function checkWebhookFailureRate(windowMinutes = 60): Promise<WebhookFailureRateResult> {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

  const totalEvents = await WebhookEvent.countDocuments({
    createdAt: { $gte: cutoff },
  });

  const failedEvents = await WebhookEvent.countDocuments({
    createdAt: { $gte: cutoff },
    status: { $in: ['failed', 'error'] },
  });

  const successfulEvents = totalEvents - failedEvents;
  const failureRatePercentage =
    totalEvents > 0 ? (failedEvents / totalEvents) * 100 : 0;

  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (totalEvents > 10 && failureRatePercentage > 15) {
    status = 'critical';
  } else if (totalEvents > 5 && failureRatePercentage > 5) {
    status = 'warning';
  }

  const recentFailureDocs = await WebhookEvent.find({
    createdAt: { $gte: cutoff },
    status: { $in: ['failed', 'error'] },
  })
    .select('source eventId error createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const recentErrors = recentFailureDocs.map((doc: any) => ({
    source: doc.source || 'unknown',
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
