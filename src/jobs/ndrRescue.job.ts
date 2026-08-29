import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { ndrService } from '../services/ndr.service';
import { logger } from '../utils/logger';
import { TenantCircuitBreaker } from '../utils/circuit-breaker';

export const ndrRescueWorker = new Worker(
  'ndr-rescue',
  async (job: Job) => {
    const { merchantId, ndrData } = job.data;
    logger.info(`Processing ndr-rescue job: ${job.id}`, { merchantId, awb: ndrData?.awb });

    if (merchantId) {
      const isBlocked = await TenantCircuitBreaker.isCircuitOpen(merchantId);
      if (isBlocked) {
        logger.warn(`Skipping ndr-rescue job ${job.id} for merchant ${merchantId}: Circuit breaker open.`);
        return;
      }
    }

    try {
      await ndrService.processNDREvent(merchantId, ndrData);
      if (merchantId) {
        await TenantCircuitBreaker.recordSuccess(merchantId);
      }
    } catch (err: any) {
      logger.error(`Error in ndr-rescue worker for job ${job.id}`, { error: err.message });
      if (merchantId) {
        await TenantCircuitBreaker.recordFailure(merchantId, { jobId: job.id, awb: ndrData?.awb });
      }
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
