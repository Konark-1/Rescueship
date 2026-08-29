import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { orderService } from '../services/order.service';
import { Merchant, Order } from '../models';
import { logger } from '../utils/logger';
import { TenantCircuitBreaker } from '../utils/circuit-breaker';

export const codConversionWorker = new Worker(
  'cod-conversion',
  async (job: Job) => {
    const { action, merchantId, orderData, paymentLinkId, provider } = job.data;
    logger.info(`Processing cod-conversion job: ${job.id}`, { action, merchantId });

    let targetMerchantId = merchantId;
    if (!targetMerchantId && job.data.orderId) {
      const order = await Order.findById(job.data.orderId);
      if (order) {
        targetMerchantId = order.merchantId.toString();
      }
    } else if (!targetMerchantId && paymentLinkId) {
      const order = await Order.findOne({ paymentLinkId });
      if (order) {
        targetMerchantId = order.merchantId.toString();
      }
    }

    // 🔒 Tenant Circuit Breaker Guard
    if (targetMerchantId) {
      const isBlocked = await TenantCircuitBreaker.isCircuitOpen(targetMerchantId);
      if (isBlocked) {
        logger.warn(`Skipping job ${job.id} for merchant ${targetMerchantId}: Circuit breaker tripped due to repeated failures.`);
        return;
      }
    }

    try {
      if (targetMerchantId) {
        const merchant = await Merchant.findById(targetMerchantId);
        if (merchant?.settings?.globalPause) {
          logger.info(`Global pause active for merchant ${targetMerchantId}. Skipping job ${job.id}`, {
            jobId: job.id,
            action,
            merchantId: targetMerchantId,
          });
          return;
        }
      }

      if (action === 'process_new_cod') {
        await orderService.processCODOrder(merchantId, orderData);
      } else if (action === 'payment_confirmed') {
        await orderService.handlePaymentConfirmation(paymentLinkId, job.data.amountPaidPaise);
      } else if (action === 'send_reminder') {
        await orderService.sendCODReminder(job.data.orderId);
      } else {
        throw new Error(`Unknown action in cod-conversion queue: ${action}`);
      }

      // Success: reset circuit breaker failure count
      if (targetMerchantId) {
        await TenantCircuitBreaker.recordSuccess(targetMerchantId);
      }
    } catch (err: any) {
      logger.error(`Error in cod-conversion worker for job ${job.id}`, { error: err.message });
      if (targetMerchantId) {
        await TenantCircuitBreaker.recordFailure(targetMerchantId, { jobId: job.id, action });
      }
      const isAuthError = err.response?.status === 401 || err.message?.includes('401') || err.message?.includes('Authentication failed');
      if (isAuthError) {
        logger.warn(`Job ${job.id} stopped due to unrecoverable invalid API credentials for merchant: ${targetMerchantId}. Please update Payment Gateway keys in Settings.`);
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
