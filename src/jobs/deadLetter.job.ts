import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

export const deadLetterWorker = new Worker(
  'dead-letter',
  async (job: Job) => {
    const { originalQueue, jobId, jobData, errorMessage } = job.data;
    logger.error(`🚨  Dead-Letter Queue alert: Job ${jobId} in queue "${originalQueue}" failed permanently.`, {
      jobData,
      error: errorMessage,
    });
    
    // In production, we would hook up SendGrid/SES, Slack hooks, or PagerDuty here.
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

deadLetterWorker.on('completed', (job: Job) => {
  logger.info(`Job ${job.id} completed in dead-letter queue`);
});

deadLetterWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} failed inside dead-letter queue itself!`, { error: err.message });
});
