import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { orderService } from '../services/order.service';
import { logger } from '../utils/logger';

export const codConversionWorker = new Worker(
  'cod-conversion',
  async (job: Job) => {
    const { action, merchantId, orderData, paymentLinkId, provider } = job.data;
    logger.info(`Processing cod-conversion job: ${job.id}`, { action, merchantId });

    try {
      if (action === 'process_new_cod') {
        await orderService.processCODOrder(merchantId, orderData);
      } else if (action === 'payment_confirmed') {
        await orderService.handlePaymentConfirmation(paymentLinkId, provider);
      } else if (action === 'send_reminder') {
        await orderService.sendCODReminder(job.data.orderId);
      } else {
        throw new Error(`Unknown action in cod-conversion queue: ${action}`);
      }
    } catch (err: any) {
      logger.error(`Error in cod-conversion worker for job ${job.id}`, { error: err.message });
      const isAuthError = err.response?.status === 401 || err.message?.includes('401') || err.message?.includes('Authentication failed');
      if (isAuthError) {
        logger.warn(`Job ${job.id} stopped due to unrecoverable invalid API credentials for merchant: ${merchantId}. Please update Payment Gateway keys in Settings.`);
        return;
      }
      throw err; // Fail the job for transient errors to allow BullMQ retries
    }
  },
  {
    connection: redisConnection as any,
    autorun: false, // Let index.ts start the workers explicitly
  }
);

codConversionWorker.on('completed', (job: Job) => {
  logger.info(`Job ${job.id} completed successfully in cod-conversion queue`);
});

codConversionWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} failed in cod-conversion queue`, { error: err.message });
});
