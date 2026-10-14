import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

export const CONNECTION_HEALTH_QUEUE = 'connection-health';
export const connectionHealthQueue = new Queue(CONNECTION_HEALTH_QUEUE, { connection: redisConnection as any });

export const setupConnectionHealthWorker = () => {
  const worker = new Worker(
    CONNECTION_HEALTH_QUEUE,
    async (job: Job) => {
      const { checkAllMerchants } = require('../services/connection-health.service');
      const res = await checkAllMerchants();
      logger.info('Connection health sweep done', { jobId: job.id, ...res });
      return res;
    },
    { connection: redisConnection as any, autorun: false, concurrency: 1 }
  );
  worker.on('failed', (job, err) => logger.error('Connection health sweep failed', { jobId: job?.id, error: err.message }));
  return worker;
};

/** Daily at 03:30 IST (22:00 UTC). */
export const scheduleConnectionHealth = async () => {
  await connectionHealthQueue.add('sweep', {}, { repeat: { pattern: '0 22 * * *' }, removeOnComplete: true, removeOnFail: 50 });
  logger.info('Scheduled daily connection health sweep');
};
