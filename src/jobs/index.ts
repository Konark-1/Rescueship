import { codConversionWorker } from './codConversion.job';
import { ndrRescueWorker } from './ndrRescue.job';
import { whatsappSendWorker } from './whatsappSend.job';
import { escalationWorker } from './escalation.job';
import { deadLetterWorker } from './deadLetter.job';
import { logger } from '../utils/logger';

export * from './codConversion.job';
export * from './ndrRescue.job';
export * from './whatsappSend.job';
export * from './escalation.job';
export * from './deadLetter.job';

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
  ]);

  logger.info('✅  All BullMQ workers stopped');
}
