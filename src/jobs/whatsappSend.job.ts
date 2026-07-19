import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { whatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';

export const whatsappSendWorker = new Worker(
  'whatsapp-send',
  async (job: Job) => {
    const { to, templateName, language, components, merchantConfig } = job.data;
    logger.info(`Processing whatsapp-send job: ${job.id}`, { to, templateName });

    try {
      await whatsAppService.sendTemplate(to, templateName, language, components, merchantConfig);
    } catch (err: any) {
      logger.error(`Error in whatsapp-send worker for job ${job.id}`, { error: err.message });
      throw err;
    }
  },
  {
    connection: redisConnection as any,
    limiter: {
      max: 70,
      duration: 1000, // Process max 70 messages per 1 second (1000 ms)
    },
    autorun: false,
  }
);

whatsappSendWorker.on('completed', (job: Job) => {
  logger.info(`Job ${job.id} completed successfully in whatsapp-send queue`);
});

whatsappSendWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} failed in whatsapp-send queue`, { error: err.message });
});
