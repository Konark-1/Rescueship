#!/usr/bin/env ts-node
/**
 * liveops-watchtower.ts
 *
 * CLI script for LiveOps operational telemetry and watchtower health checks:
 *   npx ts-node scripts/liveops-watchtower.ts [dlq|waba <id>|webhooks|all]
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env';
import {
  checkDeadLetterQueue,
  checkWabaQuality,
  checkWebhookFailureRate,
  DeadLetterCheckResult,
  WabaQualityResult,
  WebhookFailureRateResult,
} from '../src/services/liveops-watchtower.service';

export {
  checkDeadLetterQueue,
  checkWabaQuality,
  checkWebhookFailureRate,
  DeadLetterCheckResult,
  WabaQualityResult,
  WebhookFailureRateResult,
};

// ─── CLI Entrypoint ───
async function runCli() {
  const mode = process.argv[2] || 'all';
  const param = process.argv[3];

  console.log(`\n🔭 RescueShip LiveOps Watchtower — Starting check [mode: ${mode}]...`);

  if (mongoose.connection.readyState !== 1 && (mode === 'all' || mode === 'webhooks' || mode === 'waba')) {
    const mongoUri = config.mongodb?.uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/rescueship';
    try {
      await mongoose.connect(mongoUri);
    } catch (e: any) {
      console.warn(`⚠️ MongoDB connection skipped: ${e.message}`);
    }
  }

  try {
    if (mode === 'dlq' || mode === 'all') {
      console.log('\n--- Dead-Letter Queue & Worker Queue Diagnostics ---');
      const dlqResult = await checkDeadLetterQueue();
      console.log(JSON.stringify(dlqResult, null, 2));
    }

    if (mode === 'waba' || mode === 'all') {
      const wabaId = param || (config.whatsapp as any)?.businessAccountId || 'test-waba-id';
      console.log(`\n--- Meta WABA Quality Health [WABA: ${wabaId}] ---`);
      const wabaResult = await checkWabaQuality(wabaId);
      console.log(JSON.stringify(wabaResult, null, 2));
    }

    if (mode === 'webhooks' || mode === 'all') {
      const mins = param ? parseInt(param, 10) : 60;
      console.log(`\n--- Webhook Failure Rate Diagnostics [Window: ${mins}m] ---`);
      const webhookResult = await checkWebhookFailureRate(mins);
      console.log(JSON.stringify(webhookResult, null, 2));
    }
  } catch (err: any) {
    console.error(`\n❌ Watchtower inspection encountered an error: ${err.message}`);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

if (require.main === module) {
  runCli();
}
