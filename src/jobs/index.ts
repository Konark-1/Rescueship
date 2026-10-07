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
import { logger } from '../utils/logger';

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

let monthlyResetWorker: any = null;
let reconciliationWorker: any = null;
let weeklyRoiReportWorker: any = null;
let subscriptionLifecycleWorker: any = null;
let digestWorker: any = null;

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
  ].filter(Boolean);

  for (const worker of workers) {
    worker.on('error', (err: Error) => {
      logger.warn(`BullMQ worker ${worker.name || 'unknown'} Redis warning`, { error: err.message });
    });
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
  ]);

  logger.info('✅  All BullMQ workers stopped');
}
