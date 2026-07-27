import { codConversionWorker } from './codConversion.job';
import { ndrRescueWorker } from './ndrRescue.job';
import { whatsappSendWorker } from './whatsappSend.job';
import { escalationWorker } from './escalation.job';
import { deadLetterWorker } from './deadLetter.job';
import { setupMonthlyResetWorker, scheduleMonthlyReset } from './monthlyReset.job';
import { setupReconciliationWorker, scheduleReconciliation } from './reconciliation.job';
import { logger } from '../utils/logger';

export * from './codConversion.job';
export * from './ndrRescue.job';
export * from './whatsappSend.job';
export * from './escalation.job';
export * from './deadLetter.job';
export * from './monthlyReset.job';
export * from './reconciliation.job';

const monthlyResetWorker = setupMonthlyResetWorker();
const reconciliationWorker = setupReconciliationWorker();

/**
 * Start all BullMQ workers.
 * Called during Express app bootstrap.
 */
export function startAllWorkers(): void {
  logger.info('🚀  Starting all BullMQ workers…');
  
  codConversionWorker.run();
  ndrRescueWorker.run();
  whatsappSendWorker.run();
  escalationWorker.run();
  deadLetterWorker.run();
  monthlyResetWorker.run();
  reconciliationWorker.run();

  scheduleMonthlyReset().catch((err) => {
    logger.error('Failed to schedule monthly reset cron job', { error: err.message });
  });

  scheduleReconciliation().catch((err) => {
    logger.error('Failed to schedule daily outcome reconciliation cron job', { error: err.message });
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
    codConversionWorker.close(),
    ndrRescueWorker.close(),
    whatsappSendWorker.close(),
    escalationWorker.close(),
    deadLetterWorker.close(),
    monthlyResetWorker.close(),
    reconciliationWorker.close(),
  ]);

  logger.info('✅  All BullMQ workers stopped');
}
