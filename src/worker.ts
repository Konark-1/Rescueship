/**
 * src/worker.ts
 * ─────────────────────────────────────────────────────────────
 * Dedicated background worker process for RescueShip.
 * Designed for execution in production environments (Render background worker,
 * Docker containers, or Kubernetes pods) separate from the Express HTTP API.
 *
 * Runs all BullMQ queue consumers and scheduled crons:
 *   - cod-conversion worker
 *   - ndr-rescue worker
 *   - whatsapp-send rate-limited worker
 *   - escalation worker
 *   - dead-letter worker
 *   - ndr-lifecycle sweep worker
 *   - monthly-orders-reset cron worker
 *   - outcome reconciliation cron worker
 *   - weekly Sunday ROI report worker
 *   - quality monitor worker
 *   - template poller worker
 *   - hourly merchant digest cron worker
 *
 * Usage:
 *   npm run worker        # Production (transpiled dist/worker.js)
 *   npm run worker:dev    # Development (ts-node src/worker.ts)
 */

import { validateEnvironment } from './config/startup-validator';
import { connectDatabase, disconnectDatabase } from './config/database';
import { ensureIndexes } from './models/indexes';
import { connectRedis, disconnectRedis } from './config/redis';
import { startAllWorkers, stopAllWorkers } from './jobs';
import { startQualityMonitorWorker } from './jobs/quality-monitor.job';
import { startTemplatePollerWorker } from './jobs/template-poller.job';
import { logger } from './utils/logger';

async function bootstrapWorker(): Promise<void> {
  logger.info('🚀 [Dedicated Worker] Initializing RescueShip Background Worker Process…');

  try {
    // 1. Validate Environment
    validateEnvironment();

    // 2. Connect Database & ensure compound/TTL indexes
    await connectDatabase();
    await ensureIndexes();
    logger.info('✅ [Dedicated Worker] Database connected & indexes verified');

    // 3. Connect Redis
    const redisHealthy = await connectRedis();
    if (!redisHealthy) {
      logger.error('❌ [Dedicated Worker] Cannot start background workers: Redis is unreachable or has exceeded quota.');
      process.exit(1);
    }

    // 4. Start all BullMQ Workers & Cron Schedulers
    startAllWorkers();
    startQualityMonitorWorker();
    startTemplatePollerWorker();

    logger.info('🎯 [Dedicated Worker] All BullMQ workers and schedulers are actively consuming jobs.');

    // 5. Periodic Heartbeat log every 10 minutes
    const heartbeat = setInterval(() => {
      logger.info('💓 [Dedicated Worker] Worker process heartbeat — all queues active');
    }, 10 * 60 * 1000);

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`🛑 [Dedicated Worker] Received ${signal}. Commencing graceful worker shutdown…`);
      clearInterval(heartbeat);

      try {
        await stopAllWorkers();
        await disconnectRedis();
        await disconnectDatabase();
        logger.info('✅ [Dedicated Worker] Graceful worker shutdown completed successfully.');
        process.exit(0);
      } catch (err: any) {
        logger.error('⚠️ [Dedicated Worker] Error during worker shutdown', { error: err.message });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err: any) {
    logger.error('❌ [Dedicated Worker] Fatal error starting background worker process', { error: err.message });
    process.exit(1);
  }
}

// Auto-run when executed directly
if (require.main === module) {
  bootstrapWorker();
}

export { bootstrapWorker };
