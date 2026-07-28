import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { RescueLedger } from '../models/RescueLedger';
import { Order, Merchant } from '../models';
import { ndrService } from '../services/ndr.service';
import { logger } from '../utils/logger';

export const reconciliationQueue = new Queue('reconciliation', {
  connection: redisConnection as any,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export function setupReconciliationWorker(): Worker {
  const worker = new Worker(
    'reconciliation',
    async () => {
      logger.info('Running daily outcome reconciliation job...');
      const count = await RescueLedger.reconcileOutcomes();
      logger.info('Daily outcome reconciliation completed', { reconciledCount: count });

      // R3 Fix: Sweep stuck claims older than 5 minutes and re-decide them
      try {
        const stuck = await Order.find({
          'ndr.decisionMode': 'deciding' as any,
          'ndr.decisionClaimedAt': { $lt: new Date(Date.now() - 5 * 60 * 1000) } as any,
        }).limit(500);

        for (const o of stuck) {
          logger.warn('Recovering stuck decision claim', { orderId: o._id });
          await Order.updateOne({ _id: o._id }, { $unset: { 'ndr.decisionMode': 1, 'ndr.decisionClaimedAt': 1 } });
          const merchant = await Merchant.findById(o.merchantId);
          if (merchant) {
            await ndrService.decideAndAct(o, merchant);
          }
        }
      } catch (err: any) {
        logger.error('Error sweeping stuck decision claims', { error: err.message });
      }
    },
    { connection: redisConnection as any, autorun: false }
  );

  worker.on('failed', (job, err) => {
    logger.error('Reconciliation job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

export async function scheduleReconciliation(): Promise<void> {
  await reconciliationQueue.add(
    'reconcile-outcomes',
    {},
    { repeat: { pattern: '0 3 * * *' }, jobId: 'cron-reconciliation-daily' }
  );
  logger.info('Scheduled daily outcome reconciliation cron (03:00 AM)');
}
