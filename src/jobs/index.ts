import { codConversionWorker } from './codConversion.job';
import { ndrRescueWorker } from './ndrRescue.job';
import { whatsappSendWorker } from './whatsappSend.job';
import { escalationWorker } from './escalation.job';
import { deadLetterWorker } from './deadLetter.job';
import { ndrLifecycleWorker, scheduleNdrLifecycle } from './ndr-lifecycle.job';
import { setupMonthlyResetWorker, scheduleMonthlyReset } from './monthlyReset.job';
import { setupReconciliationWorker, scheduleReconciliation } from './reconciliation.job';
import { setupWeeklyRoiReportWorker, scheduleWeeklyRoiReport } from './weeklyRoiReport.job';
import { setupSubscriptionLifecycleWorker, scheduleSubscriptionLifecycle } from './subscription-lifecycle.job';
import { setupDigestWorker, scheduleDigestJob } from './digest.job';
import { piiAnonymizationWorker, schedulePiiAnonymization } from './pii-anonymization.job';
import { staleDepositsWorker, scheduleCancelStaleDeposits } from './cancel-stale-deposits.job';
import { setupConnectionHealthWorker, scheduleConnectionHealth } from './connection-health.job';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

/** Jobs that exhausted their retries are copied here so the dead-letter worker can alert ops. */
let deadLetterQueue: Queue | null = null;
function forwardToDeadLetter(worker: any): void {
  if (worker.name === 'dead-letter') return;
  worker.on('failed', (job: any, err: Error) => {
    if (!job) return;
    const maxAttempts = job.opts?.attempts || 1;
    if (job.attemptsMade < maxAttempts) return;
    if (!deadLetterQueue) deadLetterQueue = new Queue('dead-letter', { connection: redisConnection as any });
    // No job payload (it can hold phone numbers / addresses): ids and the error are enough to act on.
    deadLetterQueue
      .add('failed-job', { originalQueue: worker.name, jobId: job.id, jobData: { name: job.name }, errorMessage: String(err?.message || '').slice(0, 500) }, { removeOnComplete: 1000, removeOnFail: 1000 })
      .catch((e) => logger.warn('Could not forward failed job to dead-letter queue', { queue: worker.name, error: e.message }));
  });
}

export * from './codConversion.job';
export * from './ndrRescue.job';
export * from './whatsappSend.job';
export * from './escalation.job';
export * from './deadLetter.job';
export * from './monthlyReset.job';
export * from './reconciliation.job';
export * from './ndr-lifecycle.job';
export * from './weeklyRoiReport.job';
export * from './subscription-lifecycle.job';
export * from './digest.job';
export * from './pii-anonymization.job';
export * from './cancel-stale-deposits.job';
export * from './connection-health.job';

let monthlyResetWorker: any = null;
let reconciliationWorker: any = null;
let weeklyRoiReportWorker: any = null;
let subscriptionLifecycleWorker: any = null;
let digestWorker: any = null;
let connectionHealthWorker: any = null;

/**
 * Start all BullMQ workers safely without re-running active workers.
 * Called during Express app bootstrap.
 */
export function startAllWorkers(): void {
  logger.info('🚀  Starting all BullMQ workers…');
  
  if (!monthlyResetWorker) monthlyResetWorker = setupMonthlyResetWorker();
  if (!reconciliationWorker) reconciliationWorker = setupReconciliationWorker();
  if (!weeklyRoiReportWorker) weeklyRoiReportWorker = setupWeeklyRoiReportWorker();
  if (!subscriptionLifecycleWorker) subscriptionLifecycleWorker = setupSubscriptionLifecycleWorker();
  if (!digestWorker) digestWorker = setupDigestWorker();
  if (!connectionHealthWorker) connectionHealthWorker = setupConnectionHealthWorker();

  const workers = [
    codConversionWorker,
    ndrRescueWorker,
    whatsappSendWorker,
    escalationWorker,
    deadLetterWorker,
    ndrLifecycleWorker,
    monthlyResetWorker,
    reconciliationWorker,
    weeklyRoiReportWorker,
    subscriptionLifecycleWorker,
    digestWorker,
    piiAnonymizationWorker,
    staleDepositsWorker,
    connectionHealthWorker,
  ].filter(Boolean);

  for (const worker of workers) {
    worker.on('error', (err: Error) => {
      logger.warn(`BullMQ worker ${worker.name || 'unknown'} Redis warning`, { error: err.message });
    });
    forwardToDeadLetter(worker);
    if (!worker.isRunning()) {
      worker.run();
    }
  }

  scheduleMonthlyReset().catch((err) => {
    logger.error('Failed to schedule monthly reset cron job', { error: err.message });
  });

  scheduleReconciliation().catch((err) => {
    logger.error('Failed to schedule daily outcome reconciliation cron job', { error: err.message });
  });

  scheduleNdrLifecycle().catch((err) => {
    logger.error('Failed to schedule repeatable NDR lifecycle reconciliation job', { error: err.message });
  });

  scheduleWeeklyRoiReport().catch((err) => {
    logger.error('Failed to schedule weekly Sunday ROI report cron job', { error: err.message });
  });

  scheduleSubscriptionLifecycle().catch((err) => {
    logger.error('Failed to schedule daily subscription lifecycle cron job', { error: err.message });
  });

  scheduleDigestJob().catch((err) => {
    logger.error('Failed to schedule hourly merchant digest cron job', { error: err.message });
  });

  schedulePiiAnonymization().catch((err) => {
    logger.error('Failed to schedule daily DPDP PII anonymization cron job', { error: err.message });
  });

  scheduleConnectionHealth().catch((err) => {
    logger.error('Failed to schedule daily connection health sweep', { error: err.message });
  });

  scheduleCancelStaleDeposits().catch((err) => {
    logger.error('Failed to schedule repeatable stale deposits cleanup job', { error: err.message });
  });

  logger.info('✅  All BullMQ workers running');
}

/**
 * Gracefully stop all workers to allow in-flight jobs to complete.
 * Called during application shutdown.
 */
export async function stopAllWorkers(): Promise<void> {
  logger.info('🛑  Stopping all BullMQ workers gracefully…');
  
  await Promise.all([
    codConversionWorker?.close(),
    ndrRescueWorker?.close(),
    whatsappSendWorker?.close(),
    escalationWorker?.close(),
    deadLetterWorker?.close(),
    ndrLifecycleWorker?.close(),
    monthlyResetWorker?.close(),
    reconciliationWorker?.close(),
    weeklyRoiReportWorker?.close(),
    subscriptionLifecycleWorker?.close(),
    digestWorker?.close(),
    piiAnonymizationWorker?.close(),
    staleDepositsWorker?.close(),
    connectionHealthWorker?.close(),
  ]);

  logger.info('✅  All BullMQ workers stopped');
}
