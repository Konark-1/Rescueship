import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Order, AuditLog } from '../models';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'stale-deposits-cleanup';
export const staleDepositsQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection as any,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

/**
 * Sweeps for orders that have been held for deposit or prepaid conversion
 * for longer than 4 hours without payment. Automatically cancels them to
 * prevent aged unconfirmed orders from lingering or dispatching.
 */
export async function cancelStaleDeposits(): Promise<{ cancelledCount: number }> {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const staleOrders = await Order.find({
    status: { $in: ['awaiting_deposit', 'awaiting_prepaid_conversion'] },
    depositRequestedAt: { $lt: fourHoursAgo },
  }).limit(100);

  if (!staleOrders || staleOrders.length === 0) {
    return { cancelledCount: 0 };
  }

  logger.info(`🧹 Found ${staleOrders.length} stale deposit orders to auto-cancel`);

  let cancelledCount = 0;

  for (const order of staleOrders) {
    try {
      await Order.findByIdAndUpdate(order._id, {
        $set: {
          status: 'cancelled',
          failureSource: 'CUSTOMER_PRE_ATTEMPT',
          'ndr.reason': 'Deposit not paid within 4 hours; unconfirmed order auto-cancelled to prevent RTO',
          'ndr.resolvedAt': new Date(),
          'ndr.resolution': 'cancelled',
        },
      });

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'order_auto_cancelled_unpaid_deposit',
        source: 'cancel_stale_deposits_job',
        payload: {
          externalOrderId: order.externalOrderId,
          shippingPincode: order.shippingPincode,
          orderValue: order.orderValue,
          depositRequestedAt: order.depositRequestedAt,
        },
        status: 'success',
      });

      cancelledCount++;
    } catch (cancelErr: any) {
      logger.error('Failed to cancel stale deposit order', {
        orderId: order._id,
        error: cancelErr.message,
      });
    }
  }

  logger.info(`✅ Successfully auto-cancelled ${cancelledCount} stale deposit orders`);
  return { cancelledCount };
}

export const staleDepositsWorker = new Worker(
  QUEUE_NAME,
  async () => {
    return await cancelStaleDeposits();
  },
  {
    connection: redisConnection as any,
    autorun: false,
  }
);

/**
 * Schedule repeatable job every 30 minutes
 */
export async function scheduleCancelStaleDeposits(): Promise<void> {
  try {
    await staleDepositsQueue.upsertJobScheduler(
      'every-30-mins-stale-deposits',
      { every: 30 * 60 * 1000 },
      { name: 'cancel-stale-deposits' }
    );
    logger.info('Scheduled repeatable stale deposits cleanup job (every 30 mins)');
  } catch (err: any) {
    logger.warn('Failed to schedule repeatable stale deposits cleanup job', { error: err.message });
  }
}
