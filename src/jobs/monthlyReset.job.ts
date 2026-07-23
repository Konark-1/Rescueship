import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

export const MONTHLY_RESET_QUEUE_NAME = 'monthly-orders-reset';
export const monthlyResetQueue = new Queue(MONTHLY_RESET_QUEUE_NAME, { connection: redisConnection as any });

export const setupMonthlyResetWorker = () => {
  const worker = new Worker(
    MONTHLY_RESET_QUEUE_NAME,
    async (job: Job) => {
      logger.info('Running monthly order limit reset worker', { jobId: job.id });
      const result = await Merchant.updateMany({}, { $set: { 'billing.currentMonthOrders': 0 } });
      logger.info('Monthly order limit reset completed', { modifiedCount: result.modifiedCount });
      return { resetCount: result.modifiedCount };
    },
    { connection: redisConnection as any }
  );

  worker.on('failed', (job, err) => {
    logger.error('Monthly reset worker failed', { jobId: job?.id, error: err.message });
  });

  return worker;
};

export const scheduleMonthlyReset = async () => {
  // Add repeatable cron job on 1st of every month at midnight (0 0 1 * *)
  await monthlyResetQueue.add(
    'reset-monthly-counts',
    {},
    {
      repeat: {
        pattern: '0 0 1 * *',
      },
    }
  );
  logger.info('Scheduled monthly order reset cron job');
};
