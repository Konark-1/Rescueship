/**
 * refund.service.ts
 * ─────────────────────────────────────────────────────────────
 * Money a customer paid online must be returned when the order is not delivered
 * (cancelled / RTO / returned) or when they paid twice. Refunds are never automatic:
 * the order is flagged `pending_approval`, the merchant is alerted, and the merchant
 * approves the refund from the dashboard (executeRefund), which calls their gateway.
 */
import axios from 'axios';
import { Order, AuditLog, Merchant } from '../models';
import { encryptionService } from './encryption.service';
import { logger } from '../utils/logger';

// rto_initiated is not final (RTO arrest can still deliver), so it never triggers a refund.
const NOT_DELIVERED = ['cancelled', 'rto', 'returned'];

export class RefundService {
  /**
   * Flag a refund when the order has money collected online and will not be delivered.
   * Idempotent: only flags orders whose refundStatus is 'none'/unset.
   */
  async flagIfPaid(orderId: any, reason: string): Promise<boolean> {
    const order: any = await Order.findById(orderId);
    if (!order) return false;
    const paid = Number(order.codConversion?.amountPaid || 0);
    const current = order.codConversion?.refundStatus || 'none';
    if (paid <= 0 || current !== 'none') return false;
    if (!NOT_DELIVERED.includes(order.status) && reason !== 'duplicate_payment' && !reason.startsWith('paid_after_')) return false;
    return this.flag(order, paid, reason);
  }

  /** Flag a specific amount (e.g. a second payment, or a payment that arrived after cancellation). */
  async flag(order: any, amountInr: number, reason: string, paymentRef?: { paymentLinkId?: string; paymentId?: string }): Promise<boolean> {
    const res = await Order.updateOne(
      { _id: order._id, $or: [{ 'codConversion.refundStatus': { $in: ['none', null] } }, { 'codConversion.refundStatus': { $exists: false } }] },
      {
        $set: {
          'codConversion.refundStatus': 'pending_approval',
          'codConversion.refundAmount': amountInr,
          'codConversion.refundRequestedAt': new Date(),
          'codConversion.refundReason': reason,
          ...(paymentRef?.paymentId ? { 'codConversion.refundPaymentId': paymentRef.paymentId } : {}),
        },
      }
    );
    if (!res.modifiedCount) return false;
    await AuditLog.create({
      merchantId: order.merchantId,
      orderId: order._id,
      action: 'refund_pending_approval',
      source: 'refund_service',
      payload: { amountInr, reason, ...paymentRef },
      status: 'success',
    }).catch(() => {});
    try {
      const { realtimeService } = require('./realtime.service');
      realtimeService.broadcast({
        type: 'merchant_action_required',
        merchantId: order.merchantId.toString(),
        payload: { kind: 'refund_due', orderId: order.externalOrderId, amount: amountInr, reason },
        timestamp: new Date().toISOString(),
      });
    } catch { /* realtime is best-effort */ }
    logger.warn('Refund flagged for merchant approval', { orderId: order._id, amountInr, reason });
    return true;
  }

  /** Merchant-approved refund through the merchant's own gateway (tenant-scoped). */
  async executeRefund(merchantId: string, orderId: string): Promise<{ status: string; refundId?: string; message?: string }> {
    const order: any = await Order.findOne({ _id: orderId, merchantId });
    if (!order) throw new Error('Order not found');
    const cc = order.codConversion || {};
    if (cc.refundStatus !== 'pending_approval' && cc.refundStatus !== 'failed') {
      throw new Error(`No refund awaiting approval (status: ${cc.refundStatus || 'none'})`);
    }
    const amountInr = Number(cc.refundAmount || 0);
    if (amountInr <= 0) throw new Error('Nothing to refund');

    const merchant: any = await Merchant.findById(merchantId).select('paymentConfig');
    const pc = merchant?.paymentConfig || {};
    const provider = pc.provider || pc.gateway;
    const paymentId = cc.refundPaymentId || cc.paymentId;

    // Claim the refund so a double click cannot refund twice.
    const claimed = await Order.updateOne(
      { _id: order._id, merchantId, 'codConversion.refundStatus': cc.refundStatus },
      { $set: { 'codConversion.refundStatus': 'processing' } }
    );
    if (!claimed.modifiedCount) throw new Error('Refund is already being processed');

    if (provider !== 'razorpay' || !paymentId || !pc.keyId || !pc.keySecret) {
      // Cashfree links / missing payment id: the merchant refunds in their gateway dashboard.
      await Order.updateOne({ _id: order._id }, { $set: { 'codConversion.refundStatus': 'approved' } });
      return { status: 'approved', message: 'Refund approved. Issue it from your payment gateway dashboard, then mark it refunded.' };
    }

    try {
      const keyId = encryptionService.decrypt(pc.keyId);
      const keySecret = encryptionService.decrypt(pc.keySecret);
      const { data } = await axios.post(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
        { amount: Math.round(amountInr * 100), speed: 'normal', notes: { orderId: String(order.externalOrderId), reason: String(cc.refundReason || '') } },
        { auth: { username: keyId, password: keySecret }, timeout: 15000 }
      );
      await Order.updateOne({ _id: order._id }, { $set: { 'codConversion.refundStatus': 'refunded', 'codConversion.refundId': data?.id || null } });
      await AuditLog.create({ merchantId, orderId: order._id, action: 'refund_issued', source: 'refund_service', payload: { amountInr, refundId: data?.id }, status: 'success' }).catch(() => {});
      return { status: 'refunded', refundId: data?.id };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.description || err.message;
      await Order.updateOne({ _id: order._id }, { $set: { 'codConversion.refundStatus': 'failed' } });
      await AuditLog.create({ merchantId, orderId: order._id, action: 'refund_failed', source: 'refund_service', payload: { amountInr }, status: 'failed', error: msg }).catch(() => {});
      throw new Error(`Refund failed: ${msg}`);
    }
  }

  /** Merchant confirms a refund they issued manually in the gateway dashboard. */
  async markRefunded(merchantId: string, orderId: string, refundId?: string): Promise<void> {
    const res = await Order.updateOne(
      { _id: orderId, merchantId, 'codConversion.refundStatus': { $in: ['approved', 'pending_approval', 'failed'] } },
      { $set: { 'codConversion.refundStatus': 'refunded', ...(refundId ? { 'codConversion.refundId': String(refundId).slice(0, 64) } : {}) } }
    );
    if (!res.modifiedCount) throw new Error('No refund to mark as done');
  }

  /** Merchant decides no refund is owed (e.g. paid amount used as a cancellation fee per policy). */
  async reject(merchantId: string, orderId: string): Promise<void> {
    const res = await Order.updateOne(
      { _id: orderId, merchantId, 'codConversion.refundStatus': { $in: ['pending_approval', 'failed'] } },
      { $set: { 'codConversion.refundStatus': 'rejected' } }
    );
    if (!res.modifiedCount) throw new Error('No refund awaiting approval');
  }
}

export const refundService = new RefundService();
