/**
 * digest.job.ts
 * ─────────────────────────────────────────────────────────────
 * BullMQ repeatable cron job & worker for the hourly merchant digest.
 * Runs at the top of every hour ('0 * * * *') to batch all pending
 * operational events (NDR alerts, recoveries, payments) into a
 * single notification email per active merchant.
 */

import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { merchantDigestService } from '../services/merchant-digest.service';
import { logger } from '../utils/logger';

export const DIGEST_QUEUE_NAME = 'digest-notifications';

export const digestQueue = new Queue(DIGEST_QUEUE_NAME, {
  connection: redisConnection as any,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export function setupDigestWorker(): Worker {
  const worker = new Worker(
    DIGEST_QUEUE_NAME,
    async (job: Job) => {
      logger.info('Processing hourly merchant digest cron job...', { jobId: job.id });
      try {
        const result = await merchantDigestService.flushAllDigests();
        logger.info('Hourly merchant digest cron job finished', {
          jobId: job.id,
          totalMerchants: result.totalMerchants,
          emailsSent: result.emailsSent,
        });
        return result;
      } catch (err: any) {
        logger.error('Failed to execute hourly merchant digest job', { error: err.message });
        throw err;
      }
    },
    {
      connection: redisConnection as any,
      autorun: false,
    }
  );

  worker.on('error', (err: Error) => {
    logger.warn('Digest worker Redis warning', { error: err.message });
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error('Digest job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

/**
 * Schedule repeatable job for the top of every hour (0 * * * *)
 */
export const scheduleDigestJob = async (): Promise<void> => {
  await digestQueue.add(
    'send-hourly-merchant-digests',
    {},
    {
      repeat: {
        pattern: '0 * * * *',
      },
    }
  );
  logger.info('Scheduled hourly merchant digest cron job (0 * * * *)');
};
