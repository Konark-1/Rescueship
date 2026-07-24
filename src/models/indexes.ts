/**
 * indexes.ts
 * All MongoDB compound indexes for production performance.
 * Call ensureIndexes() during server startup AFTER mongoose connects.
 */

import { Order, Merchant, AuditLog, BillingEvent } from './index';
import { logger } from '../utils/logger';

export async function ensureIndexes(): Promise<void> {
  try {
    logger.info('Ensuring MongoDB indexes...');

    // ─── Order Indexes ───
    await Order.collection.createIndex(
      { merchantId: 1, status: 1, createdAt: -1 },
      { name: 'idx_merchant_status_created', background: true }
    );
    await Order.collection.createIndex(
      { merchantId: 1, awb: 1 },
      { name: 'idx_merchant_awb', background: true }
    );
    await Order.collection.createIndex(
      { customerPhone: 1, status: 1 },
      { name: 'idx_phone_status', background: true }
    );
    await Order.collection.createIndex(
      { externalOrderId: 1 },
      { name: 'idx_external_order_unique', unique: true, background: true }
    );
    await Order.collection.createIndex(
      { paymentLinkId: 1 },
      { name: 'idx_payment_link', sparse: true, background: true }
    );
    await Order.collection.createIndex(
      { 'ndr.addressCorrectionStep': 1, status: 1 },
      { name: 'idx_address_correction_step', sparse: true, background: true }
    );

    // ─── Merchant Indexes ───
    await Merchant.collection.createIndex(
      { email: 1 },
      { name: 'idx_merchant_email_unique', unique: true, background: true }
    );
    await Merchant.collection.createIndex(
      { 'billing.plan': 1, 'billing.currentMonthOrders': 1 },
      { name: 'idx_plan_usage', background: true }
    );

    // ─── AuditLog Indexes ───
    await AuditLog.collection.createIndex(
      { merchantId: 1, createdAt: -1 },
      { name: 'idx_audit_merchant_created', background: true }
    );
    await AuditLog.collection.createIndex(
      { merchantId: 1, action: 1, createdAt: -1 },
      { name: 'idx_audit_action', background: true }
    );
    // TTL: Auto-delete audit logs older than 90 days
    await AuditLog.collection.createIndex(
      { createdAt: 1 },
      { name: 'idx_audit_ttl', expireAfterSeconds: 90 * 24 * 60 * 60, background: true }
    );

    // ─── BillingEvent Indexes ───
    await BillingEvent.collection.createIndex(
      { merchantId: 1, eventType: 1, createdAt: -1 },
      { name: 'idx_billing_event_type', background: true }
    );
    await BillingEvent.collection.createIndex(
      { merchantId: 1, createdAt: -1 },
      { name: 'idx_billing_merchant_created', background: true }
    );

    logger.info('✅ All MongoDB indexes ensured successfully');
  } catch (err: any) {
    logger.error('Failed to create indexes', { error: err.message });
    // Don't crash — indexes are performance optimization
  }
}
