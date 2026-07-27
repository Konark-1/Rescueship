import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { RescueLedger } from '../models/RescueLedger';
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
