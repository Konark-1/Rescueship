import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { ndrService } from '../services/ndr.service';
import { logger } from '../utils/logger';

export const escalationWorker = new Worker(
  'escalation',
  async (job: Job) => {
    const { orderId, level } = job.data;
    logger.info(`Processing escalation job: ${job.id}`, { orderId, level });

    try {
      await ndrService.escalate(orderId, level);
    } catch (err: any) {
      logger.error(`Error in escalation worker for job ${job.id}`, { error: err.message });
      throw err;
    }
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

escalationWorker.on('completed', (job: Job) => {
  logger.info(`Job ${job.id} completed successfully in escalation queue`);
});

escalationWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} failed in escalation queue`, { error: err.message });
});
