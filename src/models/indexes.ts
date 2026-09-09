/**
 * indexes.ts
 * All MongoDB compound indexes for production performance & safety.
 * Call ensureIndexes() during server startup AFTER mongoose connects.
 *
 * Design rules:
 *  - Every index is created independently; one failure never skips the rest.
 *  - Key patterns that also appear in a schema `.index()` call use the SAME
 *    name here so Mongo never sees "same keys, different name" (code 85/86).
 *  - Known legacy indexes (old names / wrong options) are dropped before the
 *    canonical one is created, so upgrades self-heal.
 *  - Only the WABA phone-number uniqueness index is fatal; it is the cross-tenant
 *    routing key for inbound WhatsApp.
 */

import { Collection } from 'mongodb';
import { Order, Merchant, AuditLog, BillingEvent, ProcessedPayment } from './index';
import { logger } from '../utils/logger';

type IndexSpec = {
  keys: Record<string, 1 | -1>;
  options: Record<string, any> & { name: string };
  /** Legacy index names that conflict with this one and must be removed first. */
  replaces?: string[];
  fatal?: boolean;
};

const IDX_CONFLICT_CODES = new Set([85, 86]); // IndexOptionsConflict, IndexKeySpecsConflict

async function dropIfExists(col: Collection, name: string): Promise<void> {
  try {
    await col.dropIndex(name);
    logger.warn('Dropped legacy index', { collection: col.collectionName, index: name });
  } catch (err: any) {
    if (err?.code !== 26 && err?.code !== 27 && err?.codeName !== 'IndexNotFound' && err?.codeName !== 'NamespaceNotFound') throw err;
  }
}

/** Find an existing index with identical key pattern but a different name. */
async function conflictingIndexName(col: Collection, keys: Record<string, 1 | -1>, name: string): Promise<string | null> {
  let existing: any[] = [];
  try { existing = await col.indexes(); } catch { return null; }
  const want = JSON.stringify(keys);
  const hit = existing.find((i) => i.name !== name && i.name !== '_id_' && JSON.stringify(i.key) === want);
  return hit?.name || null;
}

async function ensureOne(col: Collection, spec: IndexSpec): Promise<boolean> {
  for (const legacy of spec.replaces || []) await dropIfExists(col, legacy);

  const attempt = async () => col.createIndex(spec.keys, { background: true, ...spec.options });
  try {
    await attempt();
    return true;
  } catch (err: any) {
    if (IDX_CONFLICT_CODES.has(err?.code)) {
      // Same keys under another name, or same name with different options: replace it.
      const other = await conflictingIndexName(col, spec.keys, spec.options.name);
      if (other) await dropIfExists(col, other);
      await dropIfExists(col, spec.options.name);
      try {
        await attempt();
        logger.warn('Rebuilt conflicting index', { collection: col.collectionName, index: spec.options.name, replaced: other });
        return true;
      } catch (err2: any) {
        logger.error('Index rebuild failed', { collection: col.collectionName, index: spec.options.name, error: err2.message });
        if (spec.fatal) throw err2;
        return false;
      }
    }
    logger.error('Index build failed', { collection: col.collectionName, index: spec.options.name, error: err.message, code: err?.code });
    if (spec.fatal) throw err;
    return false;
  }
}

export async function ensureIndexes(): Promise<void> {
  logger.info('Ensuring MongoDB indexes...');
  let failures = 0;
  const run = async (col: Collection, specs: IndexSpec[]) => {
    for (const s of specs) if (!(await ensureOne(col, s))) failures++;
  };

  try {
    // ─── Orders ───
    // Legacy global-unique externalOrderId wrongly rejected two merchants sharing an order id.
    await dropIfExists(Order.collection as any, 'idx_external_order_unique');
    await run(Order.collection as any, [
      { keys: { merchantId: 1, status: 1, createdAt: -1 }, options: { name: 'idx_merchant_status_created' }, replaces: ['merchantId_1_status_1_createdAt_-1'] },
      {
        keys: { merchantId: 1, awb: 1 },
        options: { name: 'idx_merchant_awb_unique', unique: true, partialFilterExpression: { awb: { $type: 'string' } } },
        replaces: ['idx_merchant_awb', 'merchantId_1_awb_1'],
      },
      { keys: { merchantId: 1, customerPhone: 1 }, options: { name: 'idx_merchant_phone' }, replaces: ['merchantId_1_customerPhone_1'] },
      { keys: { customerPhone: 1, status: 1 }, options: { name: 'idx_phone_status' }, replaces: ['customerPhone_1_status_1'] },
      { keys: { merchantId: 1, createdAt: -1 }, options: { name: 'idx_merchant_created' }, replaces: ['merchantId_1_createdAt_-1'] },
      { keys: { merchantId: 1, externalOrderId: 1 }, options: { name: 'idx_merchant_external_order_unique', unique: true }, replaces: ['merchantId_1_externalOrderId_1'] },
      { keys: { paymentLinkId: 1 }, options: { name: 'idx_payment_link', sparse: true } },
      { keys: { 'ndr.addressCorrectionStep': 1, status: 1 }, options: { name: 'idx_address_correction_step', sparse: true } },
    ]);
    // Redundant prefix index (covered by idx_merchant_status_created).
    await dropIfExists(Order.collection as any, 'merchantId_1_status_1');

    // ─── Merchants ───
    await run(Merchant.collection as any, [
      { keys: { email: 1 }, options: { name: 'idx_merchant_email_unique', unique: true }, replaces: ['email_1'] },
      { keys: { 'billing.plan': 1, 'billing.currentMonthOrders': 1 }, options: { name: 'idx_plan_usage' } },
      {
        keys: { 'whatsappConfig.phoneNumberId': 1 },
        options: {
          name: 'idx_waba_phonenumber_unique',
          unique: true,
          partialFilterExpression: { 'whatsappConfig.phoneNumberId': { $gt: '' } },
        },
        fatal: true,
      },
      ...['shopify.shopDomain', 'platformConfig.shopifyDomain'].map((field): IndexSpec => ({
        keys: { [field]: 1 } as Record<string, 1>,
        options: {
          name: `idx_${field.replace(/\./g, '_')}_unique`,
          unique: true,
          partialFilterExpression: { [field]: { $gt: '' } },
        },
      })),
      { keys: { 'billing.razorpaySubscriptionId': 1 }, options: { name: 'idx_billing_subscription', sparse: true } },
      { keys: { 'billing.introOrderId': 1 }, options: { name: 'idx_billing_intro_order', sparse: true } },
      { keys: { 'passwordReset.tokenHash': 1 }, options: { name: 'idx_password_reset_token', sparse: true } },
    ]);

    // ─── ProcessedPayment (replay protection) ───
    await run(ProcessedPayment.collection as any, [
      { keys: { provider: 1, externalId: 1 }, options: { name: 'idx_processed_payment_unique', unique: true } },
    ]);

    // ─── AuditLog (uses `timestamp`, schema has timestamps:false) ───
    await run(AuditLog.collection as any, [
      { keys: { merchantId: 1, timestamp: -1 }, options: { name: 'idx_audit_merchant_ts' }, replaces: ['merchantId_1_timestamp_-1', 'idx_audit_merchant_created'] },
      { keys: { merchantId: 1, action: 1, timestamp: -1 }, options: { name: 'idx_audit_action_ts' }, replaces: ['idx_audit_action'] },
      { keys: { timestamp: 1 }, options: { name: 'idx_audit_ttl', expireAfterSeconds: 90 * 24 * 60 * 60 }, replaces: ['timestamp_1'] },
    ]);
    // Indexes on a field this collection never writes.
    await dropIfExists(AuditLog.collection as any, 'createdAt_1');

    // ─── BillingEvent (uses `timestamp`) ───
    await run(BillingEvent.collection as any, [
      { keys: { merchantId: 1, eventType: 1, timestamp: -1 }, options: { name: 'idx_billing_event_type_ts' }, replaces: ['merchantId_1_eventType_1_timestamp_-1', 'idx_billing_event_type'] },
      { keys: { merchantId: 1, timestamp: -1 }, options: { name: 'idx_billing_merchant_ts' }, replaces: ['idx_billing_merchant_created'] },
    ]);
    await dropIfExists(BillingEvent.collection as any, 'merchantId_1_eventType_1'); // prefix of the above

    if (failures === 0) logger.info('✅ All MongoDB indexes ensured successfully');
    else logger.warn(`MongoDB indexes ensured with ${failures} non-fatal failure(s) — see errors above`);
  } catch (err: any) {
    logger.error('FATAL index build failure', { error: err.message });
    console.error('🚨 FATAL: WABA unique index failed — cross-tenant safety is OFF. Fix duplicate/empty phoneNumberId docs, then restart.');
    process.exit(1);
  }
}
