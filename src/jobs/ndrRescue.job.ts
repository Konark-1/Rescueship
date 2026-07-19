import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { ndrService } from '../services/ndr.service';
import { logger } from '../utils/logger';

export const ndrRescueWorker = new Worker(
  'ndr-rescue',
  async (job: Job) => {
    const { merchantId, ndrData } = job.data;
    logger.info(`Processing ndr-rescue job: ${job.id}`, { merchantId, awb: ndrData?.awb });

    try {
      await ndrService.processNDREvent(merchantId, ndrData);
    } catch (err: any) {
      logger.error(`Error in ndr-rescue worker for job ${job.id}`, { error: err.message });
      throw err;
    }
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

ndrRescueWorker.on('completed', (job: Job) => {
  logger.info(`Job ${job.id} completed successfully in ndr-rescue queue`);
});

ndrRescueWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} failed in ndr-rescue queue`, { error: err.message });
});
