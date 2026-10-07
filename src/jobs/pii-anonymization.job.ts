import { Worker, Queue, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Order, DeliveryAttempt, NdrCase, AuditLog } from '../models';
import { logger } from '../utils/logger';

export interface PiiAnonymizationStats {
  ordersAnonymized: number;
  attemptsAnonymized: number;
  ndrCasesAnonymized: number;
  auditLogsScrubbed: number;
}

export const piiAnonymizationQueue = new Queue('pii-anonymization', {
  connection: redisConnection as any,
});

/**
 * Recursively sanitize objects/strings by masking Indian phone numbers and PII keys.
 */
function sanitizePiiMetadata(val: any): any {
  if (!val) return val;
  if (typeof val === 'string') {
    return val.replace(/(?:\+?91)?[6-9]\d{9}/g, 'REDACTED');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizePiiMetadata);
  }
  if (typeof val === 'object') {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('phone') ||
        lower.includes('mobile') ||
        lower.includes('wa_id') ||
        lower === 'from' ||
        lower === 'to' ||
        lower === 'recipient'
      ) {
        copy[k] = 'REDACTED';
      } else {
        copy[k] = sanitizePiiMetadata(v);
      }
    }
    return copy;
  }
  return val;
}

/**
 * Anonymize PII for Order, DeliveryAttempt, NdrCase, and AuditLog records older than 180 days.
 * Complies with India Digital Personal Data Protection (DPDP) Act 2023.
 */
export async function anonymizePiiRecords(cutoffDays: number = 180): Promise<PiiAnonymizationStats> {
  const cutoffDate = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
  logger.info('[DPDP PII Anonymization] Starting anonymization run', {
    cutoffDays,
    cutoffDate: cutoffDate.toISOString(),
  });

  const stats: PiiAnonymizationStats = {
    ordersAnonymized: 0,
    attemptsAnonymized: 0,
    ndrCasesAnonymized: 0,
    auditLogsScrubbed: 0,
  };

  // ─── 1. ANONYMIZE ORDERS (>180 days since resolution or update) ───
  try {
    const expiredOrders = await Order.find({
      piiAnonymized: { $ne: true },
      $or: [
        { 'ndr.resolvedAt': { $lt: cutoffDate } },
        { 'codConversion.convertedAt': { $lt: cutoffDate } },
        { updatedAt: { $lt: cutoffDate } },
      ],
    })
      .select('_id')
      .limit(1000)
      .lean();

    if (expiredOrders.length > 0) {
      const orderOps = expiredOrders.map((o) => ({
        updateOne: {
          filter: { _id: o._id },
          update: {
            $set: {
              'customer.phone': 'REDACTED',
              'customer.name': 'REDACTED',
              'customer.address': 'REDACTED',
              customerPhone: 'REDACTED',
              customerName: 'REDACTED',
              shippingAddress: 'REDACTED',
              piiAnonymized: true,
            },
          },
        },
      }));

      const res = await Order.bulkWrite(orderOps as any);
      stats.ordersAnonymized = res.modifiedCount || orderOps.length;
    }
  } catch (err: any) {
    logger.error('[DPDP] Error anonymizing Order documents', { error: err.message });
  }

  // ─── 2. ANONYMIZE DELIVERY ATTEMPTS (>180 days old) ───
  try {
    const expiredAttempts = await DeliveryAttempt.find({
      piiAnonymized: { $ne: true },
      $or: [
        { attemptTime: { $lt: cutoffDate } },
        { createdAt: { $lt: cutoffDate } },
      ],
    })
      .select('_id')
      .limit(1000)
      .lean();

    if (expiredAttempts.length > 0) {
      const attemptOps = expiredAttempts.map((a) => ({
        updateOne: {
          filter: { _id: a._id },
          update: {
            $set: {
              'customer.phone': 'REDACTED',
              'customer.name': 'REDACTED',
              'customer.address': 'REDACTED',
              rawWebhook: {},
              piiAnonymized: true,
            },
          },
        },
      }));

      const res = await DeliveryAttempt.bulkWrite(attemptOps as any);
      stats.attemptsAnonymized = res.modifiedCount || attemptOps.length;
    }
  } catch (err: any) {
    logger.error('[DPDP] Error anonymizing DeliveryAttempt documents', { error: err.message });
  }

  // ─── 3. ANONYMIZE NDR CASES (>180 days since close or update) ───
  try {
    const expiredCases = await NdrCase.find({
      piiAnonymized: { $ne: true },
      $or: [
        { closedAt: { $lt: cutoffDate } },
        { updatedAt: { $lt: cutoffDate } },
      ],
    })
      .select('_id')
      .limit(1000)
      .lean();

    if (expiredCases.length > 0) {
      const caseOps = expiredCases.map((c) => ({
        updateOne: {
          filter: { _id: c._id },
          update: {
            $set: {
              'customer.phone': 'REDACTED',
              'customer.name': 'REDACTED',
              'customer.address': 'REDACTED',
              customerPhone: 'REDACTED',
              customerResponseText: 'REDACTED',
              piiAnonymized: true,
            },
          },
        },
      }));

      const res = await NdrCase.bulkWrite(caseOps as any);
      stats.ndrCasesAnonymized = res.modifiedCount || caseOps.length;
    }
  } catch (err: any) {
    logger.error('[DPDP] Error anonymizing NdrCase documents', { error: err.message });
  }

  // ─── 4. SCRUB AUDIT LOG METADATA (>180 days old) ───
  try {
    // Operates via collection driver to bypass Mongoose immutable pre-hooks
    const expiredAuditLogs = await AuditLog.find({
      timestamp: { $lt: cutoffDate },
      piiAnonymized: { $ne: true },
    })
      .limit(1000)
      .lean();

    if (expiredAuditLogs.length > 0) {
      const auditOps = expiredAuditLogs.map((log: any) => {
        const sanitizedMeta = sanitizePiiMetadata(log.metadata || {});
        const sanitizedPayload = sanitizePiiMetadata(log.payload || {});
        return {
          updateOne: {
            filter: { _id: log._id },
            update: {
              $set: {
                metadata: sanitizedMeta,
                payload: sanitizedPayload,
                piiAnonymized: true,
              },
            },
          },
        };
      });

      if (AuditLog.collection && typeof AuditLog.collection.bulkWrite === 'function') {
        const res = await AuditLog.collection.bulkWrite(auditOps as any);
        stats.auditLogsScrubbed = res.modifiedCount || auditOps.length;
      }
    }
  } catch (err: any) {
    logger.error('[DPDP] Error scrubbing AuditLog collection metadata', { error: err.message });
  }

  logger.info('[DPDP PII Anonymization] Completed anonymization run', stats);
  return stats;
}

/**
 * BullMQ Worker for DPDP PII Anonymization
 */
export const piiAnonymizationWorker = new Worker(
  'pii-anonymization',
  async (job: Job) => {
    logger.info(`Processing DPDP PII Anonymization job: ${job.id}`);
    const cutoffDays = job.data?.cutoffDays || 180;
    const stats = await anonymizePiiRecords(cutoffDays);
    return stats;
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

piiAnonymizationWorker.on('completed', (job: Job) => {
  logger.info(`DPDP PII Anonymization job ${job.id} completed successfully`);
});

piiAnonymizationWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`DPDP PII Anonymization job ${job?.id} failed`, { error: err.message });
});

/**
 * Schedule repeatable daily job (e.g., cron: '0 2 * * *' at 2:00 AM)
 */
export async function schedulePiiAnonymization(): Promise<void> {
  try {
    await piiAnonymizationQueue.add(
      'daily-pii-anonymization',
      { cutoffDays: 180 },
      {
        repeat: {
          pattern: '0 2 * * *',
        },
        removeOnComplete: true,
        removeOnFail: 50,
      }
    );
    logger.info('Scheduled repeatable daily DPDP PII anonymization job (0 2 * * *)');
  } catch (err: any) {
    logger.warn('Failed to schedule repeatable DPDP PII anonymization job', { error: err.message });
  }
}
