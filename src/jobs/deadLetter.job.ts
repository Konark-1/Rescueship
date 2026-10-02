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
    
    try {
      const { emailService } = await import('../services/email.service');
      await emailService.sendEmail({
        to: 'konarkofficial@gmail.com',
        subject: `🚨 [RescueShip DLQ Alert] Job ${jobId} in queue "${originalQueue}" failed`,
        text: `Dead-letter queue alert:\nJob: ${jobId}\nQueue: ${originalQueue}\nError: ${errorMessage}\nTimestamp: ${new Date().toISOString()}`,
      });
    } catch (mailErr: any) {
      logger.warn('Failed to send DLQ email alert', { error: mailErr?.message });
    }
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

deadLetterWorker.on('completed', (job: Job) => {
  logger.info(`Job ${job.id} completed in dead-letter queue`);
});

deadLetterWorker.on('error', (err: Error) => {
  logger.warn('dead-letter worker Redis error', { error: err.message });
});

deadLetterWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} failed inside dead-letter queue itself!`, { error: err.message });
});
