import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

/**
 * BullMQ Dead Letter Queue for rate-limited (HTTP 429) carrier operations.
 * Allows intelligent exponential backoff and controlled retry pacing without
 * blocking main ingestion or rescue queues.
 */
export const carrierDlq = new Queue('carrier-dlq', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 60000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
