import { Worker, Job, Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { carrierDlq } from '../queues/dlq.queue';
import { CarrierRateLimitError } from '../utils/errors.util';
import { logisticsService } from '../services/logistics.service';
import { logger } from '../utils/logger';

export const carrierDispatchQueue = new Queue('carrier-dispatch', {
  connection: redisConnection as any,
});

/**
 * Core handler for processing carrier jobs with intelligent HTTP 429 DLQ routing.
 */
export async function processCarrierJob(job: Job): Promise<any> {
  const { action, carrier, payload, carrierConfig } = job.data;
  logger.info(`Processing carrier dispatch job: ${job.id}`, { action, carrier, awb: payload?.awb });

  try {
    let result: any;
    if (action === 'reschedule') {
      result = await logisticsService.rescheduleDelivery(carrier, payload, carrierConfig);
    } else if (action === 'update_address') {
      result = await logisticsService.updateDeliveryAddress(carrier, payload, carrierConfig);
    } else if (action === 'cancel') {
      result = await logisticsService.cancelDelivery(carrier, payload, carrierConfig);
    } else if (action === 'adjust_cod') {
      result = await logisticsService.adjustCodAmount(carrier, payload, carrierConfig);
    } else {
      // Generic dispatch or test action
      result = { success: true, action };
    }
    return result;
  } catch (error: any) {
    if (error instanceof CarrierRateLimitError || error?.name === 'CarrierRateLimitError' || error?.statusCode === 429) {
      // Exponential backoff: 2^(attemptsMade) * 60,000ms, capped at 3,600,000ms (1 hour)
      const attemptsMade = typeof job.attemptsMade === 'number' ? job.attemptsMade : 0;
      const delay = Math.min(Math.pow(2, attemptsMade) * 60000, 3600000);

      await carrierDlq.add(
        'retry-carrier-action',
        {
          ...job.data,
          originalJobId: job.id,
          attemptsMade: attemptsMade + 1,
          rateLimitedAt: new Date().toISOString(),
        },
        {
          delay,
          attempts: 5,
        }
      );

      // Crucial: Mark the original job as completed so it does not pollute the standard BullMQ failed queue
      logger.warn(`[DLQ ROUTING] Job ${job.id} moved to DLQ due to 429. Delay: ${delay}ms`);
      return { dlqRouted: true, delay, reason: 'CarrierRateLimitError (429)' };
    }

    logger.error(`Carrier dispatch job ${job.id} failed with unrecoverable error`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Primary BullMQ Worker for outbound carrier API dispatching.
 */
export const carrierDispatchWorker = new Worker(
  'carrier-dispatch',
  async (job: Job) => {
    return processCarrierJob(job);
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

carrierDispatchWorker.on('completed', (job: Job) => {
  logger.info(`Job ${job.id} completed successfully in carrier-dispatch queue`);
});

carrierDispatchWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} failed in carrier-dispatch queue`, { error: err.message });
});

/**
 * Worker for processing retried jobs from carrier-dlq.
 */
export const carrierDlqWorker = new Worker(
  'carrier-dlq',
  async (job: Job) => {
    logger.info(`[DLQ RETRY] Processing retried carrier action from DLQ: ${job.id}`);
    return processCarrierJob(job);
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

carrierDlqWorker.on('completed', (job: Job) => {
  logger.info(`[DLQ RETRY] Job ${job.id} successfully recovered from DLQ`);
});

carrierDlqWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`[DLQ RETRY] Job ${job?.id} permanently failed in carrier-dlq`, { error: err.message });
});
