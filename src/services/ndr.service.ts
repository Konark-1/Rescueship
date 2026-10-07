import { Types } from 'mongoose';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { config } from '../config/env';
import { Merchant, Order, AuditLog, NdrCase, RescueLedger } from '../models';
import { whatsAppService } from './whatsapp.service';
import { logisticsService } from './logistics.service';
import { encryptionService } from './encryption.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { realtimeService } from './realtime.service';
import { logger } from '../utils/logger';
import { getPolicy } from '../config/rescue-policy';
import { COPY } from '../i18n/customer-copy';
import { addressCorrectionService } from './address-correction.service';
import { SecurityAlertService } from './security-alert.service';
import { makeJobId } from '../utils/job-id';
import { checkSubscriptionAccess } from '../utils/subscription-guard';

export type NDRCategory =
  | 'CUSTOMER_NOT_AVAILABLE'
  | 'CUSTOMER_REFUSED'
  | 'ADDRESS_ISSUE'
  | 'PREMISES_LOCKED'
  | 'RESCHEDULE_REQUEST'
  | 'COD_COLLECTION_ISSUE'
  | 'CANCELLATION_RISK'
  | 'UNKNOWN_FAILURE';

export interface NDREventData {
  awb: string;
  externalOrderId: string;
  reason: string;
  phone: string;
  carrier: 'shiprocket' | 'clickpost' | 'delhivery';
  attemptTime?: Date;
}

export function getISTDate(date: Date = new Date()): { istHour: number; istDayOfWeek: number; istDate: Date } {
  const utcTime = date.getTime();
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(utcTime + istOffsetMs);
  const istHour = istDate.getUTCHours();
  const istDayOfWeek = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
  return { istHour, istDayOfWeek, istDate };
}

export function isBeforeSameDayCutoff(attemptTime?: Date): boolean {
  const time = attemptTime ? new Date(attemptTime) : new Date();
  const { istHour } = getISTDate(time);
  return istHour < 15; // Cutoff at 3:00 PM IST
}

export function getDeliveryTimingButtons(orderId: string, attemptTime?: Date): { bodyText: string; buttons: Array<{ id: string; title: string }> } {
  const time = attemptTime ? new Date(attemptTime) : new Date();
  const before3PM = isBeforeSameDayCutoff(time);
  const { istDayOfWeek } = getISTDate(time);
  const isThuFri = istDayOfWeek === 4 || istDayOfWeek === 5;

  let bodyText: string;
  const buttons: Array<{ id: string; title: string }> = [];

  if (before3PM) {
    bodyText = 'We could not confirm a delivery attempt at your doorstep. We have flagged this with delivery management. Delivery vans are still active in your area today.\n\nWhen should we deliver your order?';
    buttons.push({ id: `resched:today:${orderId}`, title: '⚡ Deliver Today' });
    buttons.push({ id: `resched:tomorrow:${orderId}`, title: '📅 Deliver Tomorrow' });
    if (isThuFri) {
      buttons.push({ id: `resched:weekend:${orderId}`, title: '🏖️ On Weekend' });
    } else {
      buttons.push({ id: `resched:day_after:${orderId}`, title: '📦 Day After' });
    }
  } else {
    bodyText = 'We could not confirm a delivery attempt at your doorstep. We have flagged this with delivery management. Daytime delivery rounds in your area are completed for today.\n\nWhen should we deliver your order?';
    buttons.push({ id: `resched:tomorrow:${orderId}`, title: '📅 Deliver Tomorrow' });
    buttons.push({ id: `resched:day_after:${orderId}`, title: '📦 Day After' });
    if (isThuFri) {
      buttons.push({ id: `resched:weekend:${orderId}`, title: '🏖️ On Weekend' });
    } else {
      buttons.push({ id: `resched:weekend:${orderId}`, title: '🏖️ Next Slot' });
    }
  }

  return { bodyText, buttons };
}

export class NDRService {
  private static instance: NDRService;
  private escalationQueue: Queue | null = null;

  private constructor() {}

  public static getInstance(): NDRService {
    if (!NDRService.instance) {
      NDRService.instance = new NDRService();
    }
    return NDRService.instance;
  }

  private getEscalationQueue(): Queue {
    if (!this.escalationQueue) {
      this.escalationQueue = new Queue('escalation', { connection: redisConnection as any });
    }
    return this.escalationQueue;
  }

  /**
   * Process incoming NDR webhook event with policy decision layer
   */
  public async processNDREvent(merchantId: string, ndrData: NDREventData): Promise<void> {
    logger.info('Processing NDR Event', { merchantId, awb: ndrData.awb, reason: ndrData.reason });

    try {
      const query = Merchant.findById(merchantId);
      const merchant = query && typeof (query as any).select === 'function'
        ? await (query as any).select('settings billing whatsappConfig carrierConfig rescuePolicy contactPhone ownerPhone storeName accessExpiresAt licenseStatus')
        : await query;
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }

      // 🛡️ ZERO-LOOPHOLE SUBSCRIPTION & QUOTA CHECK
      const subCheck = checkSubscriptionAccess(merchant);
      if (!subCheck.allowed) {
        logger.warn('NDR rescue blocked: Subscription inactive or quota exceeded', {
          merchantId,
          reason: subCheck.reason,
          awb: ndrData.awb,
        });
        await AuditLog.create({
          merchantId: merchant._id,
          action: 'ndr_blocked_subscription_inactive',
          source: 'ndr_service',
          payload: { reason: subCheck.reason, awb: ndrData.awb },
          status: 'failed',
        });
        return;
      }

      if (!merchant.settings?.ndrRescue?.enabled) {
        logger.info('NDR rescue is disabled for merchant, skipping', { merchantId });
        return;
      }

      if (merchant.billing.rescueCredits <= 0) {
        logger.info('Insufficient rescue credits for NDR rescue', { merchantId });
        return;
      }

      if (merchant.billing.rescueCredits < 20) {
        logger.warn('Low rescue credits warning for merchant', { merchantId, credits: merchant.billing.rescueCredits });
        await AuditLog.create({
          merchantId: merchant._id,
          action: 'low_credits_warning',
          source: 'ndr_service',
          payload: { credits: merchant.billing.rescueCredits },
          status: 'success',
        });
      }

      let order = await Order.findOne({ merchantId: merchant._id, awb: ndrData.awb });
      if (!order && ndrData.externalOrderId) {
        order = await Order.findOne({ merchantId: merchant._id, externalOrderId: ndrData.externalOrderId });
      }

      if (!order) {
        // Carriers (Delhivery/ClickPost especially) often omit the consignee phone. Without
        // an existing order we have nobody to message — skip cleanly instead of failing
        // Order.create validation and burning three retries.
        if (!ndrData.phone) {
          logger.warn('NDR has no customer phone and no matching order; cannot rescue', { merchantId, awb: ndrData.awb });
          await AuditLog.create({
            merchantId: merchant._id,
            action: 'ndr_skipped_no_phone',
            source: 'ndr_service',
            payload: { awb: ndrData.awb, externalOrderId: ndrData.externalOrderId, carrier: ndrData.carrier },
            status: 'failed',
            error: 'No customer phone in carrier payload and no matching order',
          });
          return;
        }
        const normalizedPhone = normalizeIndianPhone(ndrData.phone);
        try {
          order = await Order.create({
            merchantId: merchant._id,
            // {merchantId, externalOrderId} is unique — never store '' for carrier-originated orders.
            externalOrderId: ndrData.externalOrderId || `AWB-${ndrData.awb}`,
            platform: merchant.platform,
            customerPhone: normalizedPhone,
            orderValue: 0,
            paymentMethod: 'cod',
            status: 'shipped',
            awb: ndrData.awb,
            carrier: ndrData.carrier,
            shippingPincode: (ndrData as any).pincode || (ndrData as any).shippingPincode || null,
            shippingCity: (ndrData as any).city || null,
            shippingState: (ndrData as any).state || null,
            failureSource: 'COURIER_REPORTED',
            attemptCount: 0,
          });

          // Increment monthly orders count for plan quota enforcement
          await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.currentMonthOrders': 1 } });
        } catch (err: any) {
          if (err.code === 11000 || err.name === 'MongoServerError' || err.message?.includes('E11000')) {
            order = await Order.findOne({
              merchantId: merchant._id,
              $or: [{ awb: ndrData.awb }, { externalOrderId: ndrData.externalOrderId }],
            });
            if (order) {
              order.awb = ndrData.awb;
              order.carrier = ndrData.carrier;
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }

      if (order && ['delivered', 'returned', 'cancelled', 'lost', 'rto'].includes(order.status as any)) {
        logger.info('Order is already in terminal state, skipping NDR event', { orderId: order._id, status: order.status, awb: ndrData.awb });
        return;
      }

      const isFake = this.detectFakeAttempt(order, ndrData);

      // HIGH-4 fix: Atomic status transition — prevents duplicate rescue messages
      const ndrPayload = {
        reason: ndrData.reason,
        detectedAt: new Date(),
        rescueMessagesSent: 1,
        lastMessageSentAt: new Date(),
        customerResponse: null,
        resolvedAt: null,
        resolution: null,
        isFakeAttempt: isFake,
      };

      const updated: any = await (Order as any).findOneAndUpdate(
        { _id: order._id, status: { $nin: ['ndr_detected', 'ndr_rescue_sent', 'ndr_rescued', 'delivered', 'returned', 'cancelled', 'rto', 'lost'] } },
        {
          $set: {
            status: 'ndr_detected',
            awb: ndrData.awb,
            carrier: ndrData.carrier,
            ndr: ndrPayload,
            failureSource: 'COURIER_REPORTED',
            lastAttemptAt: ndrData.attemptTime || new Date(),
          },
          $inc: { attemptCount: 1 },
        },
        { new: true }
      );

      if (!updated) {
        logger.info('Order already in NDR flow, skipping duplicate webhook', { orderId: order._id, awb: ndrData.awb });
        return;
      }

      // Refresh order reference for downstream use
      order = updated;
      if (!order) return;
      if (!order.customerPhone && ndrData.phone) {
        order.customerPhone = ndrData.phone;
      }

      // 🛡️ VECTOR 4 FIX: Atomic Creation with Idempotent Deduplication for NdrCase
      try {
        await NdrCase.create({
          orderId: order._id,
          merchantId: merchant._id,
          awb: ndrData.awb,
          externalOrderId: order.externalOrderId,
          customerPhone: order.customerPhone,
          failureReason: ndrData.reason,
          failureCategory: (order.paymentMethod === 'prepaid' && this.classifyRemark(ndrData.reason) === 'COD_COLLECTION_ISSUE')
            ? 'CUSTOMER_NOT_AVAILABLE'
            : this.classifyRemark(ndrData.reason),
          whatsappMessageSentAt: new Date(),
          status: 'OPEN',
          isFakeRemarkSuspicious: isFake,
          failureSource: 'COURIER_REPORTED',
          attemptCount: order.attemptCount || 1,
          lastWebhookAt: new Date(),
        });
      } catch (caseErr: any) {
        if (caseErr?.code === 11000 || caseErr?.name === 'MongoServerError' || caseErr?.message?.includes('E11000')) {
          try {
            await NdrCase.updateOne(
              { orderId: order._id, merchantId: merchant._id },
              { $set: { lastWebhookAt: new Date() } }
            );
          } catch { /* proceed */ }
        } else {
          logger.warn('Failed to record NdrCase model', { error: caseErr?.message });
        }
      }

      realtimeService.emitNdrDetected(
        order.merchantId.toString(),
        order.externalOrderId,
        ndrData.reason,
        isFake
      );

      await this.decideAndAct(order, merchant);

    } catch (err: any) {
      logger.error('Failed to process NDR event rescue', { awb: ndrData.awb, error: err.message });
      await AuditLog.create({
        merchantId: new Types.ObjectId(merchantId),
        action: 'ndr_rescue_sent',
        source: 'ndr_service',
        payload: ndrData,
        status: 'failed',
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Policy Decision Layer (P4, R3 & R6 Fix)
   */
  public async decideAndAct(order: any, merchant: any): Promise<void> {
    if (Order && typeof Order.findOneAndUpdate === 'function') {
      const claimed = await Order.findOneAndUpdate(
        { _id: order._id, 'ndr.decisionMode': { $exists: false } },
        { $set: { 'ndr.decisionMode': 'deciding', 'ndr.decisionClaimedAt': new Date() } },
        { new: true }
      );
      if (!claimed && order.ndr?.decisionMode && order.ndr.decisionMode !== 'deciding') {
        logger.info('decideAndAct already ran for this order — skip (idempotent)', { id: order._id });
        return;
      }
    }

    order.ndr = order.ndr || {};
    const saveOrder = async () => {
      if (typeof order.save === 'function') {
        await order.save();
      } else if (order._id) {
        await Order.findByIdAndUpdate(order._id, { $set: { status: order.status, ndr: order.ndr } });
      }
    };

    const policy = getPolicy(merchant.rescuePolicy);
    const score = this.fakeRemarkScore(order);
    order.ndr.fakeRemarkScore = score;

    if (policy.engage.respectMerchantManualResolve && this.merchantAlreadyResolved(order)) {
      order.ndr.decisionMode = 'manual_skip';
      await saveOrder();
      await RescueLedger.recordDecision({
        merchantId: order.merchantId,
        orderId: order._id,
        externalOrderId: order.externalOrderId,
        flaggedAt: new Date(),
        decisionMode: 'manual_skip',
        fakeRemarkScore: score,
      });
      return;
    }

    if ((policy.pilot?.holdoutRate ?? 0) > 0 && Math.random() < policy.pilot!.holdoutRate) {
      order.ndr.holdout = true;
      order.ndr.holdoutReason = 'pilot_control_group';
      order.ndr.decisionMode = 'holdout';
      await saveOrder();
      await RescueLedger.recordDecision({
        merchantId: order.merchantId,
        orderId: order._id,
        externalOrderId: order.externalOrderId,
        pilotId: policy.pilot?.pilotId,
        flaggedAt: new Date(),
        decisionMode: 'holdout',
        fakeRemarkScore: score,
      });
      return;
    }

    if (policy.reviewMode.enabled && this.shouldHoldForReview(order, policy)) {
      order.ndr.decisionMode = 'review';
      order.status = 'ndr_pending_review';
      await saveOrder();
      await RescueLedger.recordDecision({
        merchantId: order.merchantId,
        orderId: order._id,
        externalOrderId: order.externalOrderId,
        flaggedAt: new Date(),
        decisionMode: 'review',
        fakeRemarkScore: score,
      });
      realtimeService.broadcast({
        type: 'ndr_needs_review',
        merchantId: order.merchantId.toString(),
        payload: { orderId: order.externalOrderId, score },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Terminal State Race Condition Prevention:
    // Atomic status transition using findOneAndUpdate to prevent race condition if a delivery or RTO
    // confirmation webhook arrived concurrently.
    const terminalStates = ['delivered', 'rto', 'returned', 'cancelled', 'lost'];
    if (Order && typeof Order.findOneAndUpdate === 'function') {
      const claimedOrder = await (Order as any).findOneAndUpdate(
        {
          _id: order._id,
          status: { $nin: terminalStates },
        },
        {
          $set: {
            status: 'ndr_rescue_sent',
            'ndr.decisionMode': 'engaged',
            'ndr.status': 'IN_PROGRESS',
            'ndr.lastAttemptAt': new Date(),
          },
        },
        { new: true }
      );

      if (!claimedOrder) {
        logger.info('NDR rescue aborted: Order already in terminal or rescued state', { orderId: order._id });
        return;
      }
      order = claimedOrder;
    } else {
      if (terminalStates.includes(order.status)) {
        logger.info('NDR rescue aborted: Order already in terminal state', { orderId: order._id });
        return;
      }
      order.ndr.decisionMode = 'engaged';
      order.status = 'ndr_rescue_sent';
      await saveOrder();
    }

    try {
      // Business-initiated message MUST be a Meta-approved template (error 131047 otherwise).
      await this.sendVerifyRescue(order, merchant);

      // The NDR entered the rescue workflow — meter it against the monthly plan
      // quota (billing.currentMonthOrders). Non-fatal on failure.
      try {
        await Merchant.updateOne({ _id: order.merchantId }, { $inc: { 'billing.currentMonthOrders': 1 } });
      } catch (incErr: any) {
        logger.warn('Failed to increment monthly order usage (non-fatal)', { merchantId: String(order.merchantId), error: incErr.message });
      }

      await RescueLedger.recordDecision({
        merchantId: order.merchantId,
        orderId: order._id,
        externalOrderId: order.externalOrderId,
        flaggedAt: new Date(),
        decisionMode: 'engaged',
        fakeRemarkScore: score,
      });

      await this.scheduleEscalations(order, merchant);
    } catch (err) {
      // Roll back the provisional NDR state so a BullMQ retry can re-attempt the
      // whole send (credit is refunded inside sendVerifyRescue). Otherwise the order
      // would be stuck in `ndr_rescue_sent` with no escalation and no message sent.
      await Order.updateOne(
        { _id: order._id },
        { $set: { status: 'ndr_detected' }, $unset: { 'ndr.decisionMode': 1 } }
      );
      throw err;
    }
  }

  private async scheduleEscalations(order: any, merchant: any): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    const chain = merchant.settings?.ndrRescue?.escalationChain || [4, 12, 24];
    const eq = this.getEscalationQueue();
    for (let i = 0; i < chain.length; i++) {
      const hours = chain[i];
      await eq.add(
        'escalate-ndr',
        { orderId: order._id.toString(), level: i + 1, merchantId: merchant._id.toString() },
        { delay: hours * 3600 * 1000, jobId: makeJobId('escalation', order._id.toString(), i + 1), removeOnComplete: true, removeOnFail: true }
      );
    }
  }

  public fakeRemarkScore(order: any, attemptTime?: Date): number {
    const time = attemptTime ? new Date(attemptTime) : new Date();
    // Deliveries happen in India; evaluate the 'odd hour' heuristic in IST regardless of server TZ.
    const hour = (time.getUTCHours() + 5 + (time.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;
    let score = 0;
    if (hour < 8 || hour >= 22) score += 0.5;
    if (order.outForDeliveryAt) {
      const diffMin = (time.getTime() - new Date(order.outForDeliveryAt).getTime()) / (1000 * 60);
      if (diffMin >= 0 && diffMin < 15) score += 0.5;
    }
    return Math.min(1.0, score);
  }

  public parseButtonPayload(payload: string): {
    action:
      | 'reschedule'
      | 'address'
      | 'address_skip'
      | 'cancel'
      | 'pay_retention'
      | 'confirm_cancel'
      | 'predelivery_confirm'
      | 'verify_fake'
      | 'verify_redeliver';
    subAction?: string;
    orderId?: string;
  } | null {
    const raw = String(payload || '').trim();
    const parts = raw.split(':');
    if (parts.length >= 2) {
      const act = parts[0].toLowerCase();
      if (act === 'verify') {
        const sub = parts[1].toLowerCase();
        const oId = parts[2]?.trim() || undefined;
        if (sub === 'fake' || sub === 'did_not_visit' || sub === 'never_visited') {
          return { action: 'verify_fake', subAction: 'fake', orderId: oId };
        }
        if (sub === 'redeliver' || sub === 'reattempt') {
          return { action: 'verify_redeliver', subAction: 'redeliver', orderId: oId };
        }
        if (sub === 'cancel') {
          return { action: 'cancel', orderId: oId };
        }
      }
      if (act === 'resched' || act === 'reschedule') {
        if (parts.length === 2) {
          return { action: 'reschedule', subAction: 'tomorrow', orderId: parts[1].trim() || undefined };
        }
        return { action: 'reschedule', subAction: parts[1].toLowerCase(), orderId: parts[2]?.trim() || undefined };
      }
      if (act === 'address') {
        const sub = parts[1].toLowerCase();
        const oId = parts[2]?.trim() || undefined;
        if (sub === 'skip' || sub === 'keep') {
          return { action: 'address_skip', orderId: oId };
        }
        return { action: 'address', subAction: sub, orderId: oId };
      }
      if (act === 'retention' || act === 'pay_retention') {
        return { action: 'pay_retention', orderId: parts[parts.length - 1]?.trim() || undefined };
      }
      if (act === 'confirm_cancel') {
        return { action: 'confirm_cancel', orderId: parts[parts.length - 1]?.trim() || undefined };
      }
      if (['reschedule', 'address', 'cancel', 'pay_retention', 'confirm_cancel', 'predelivery_confirm'].includes(act)) {
        if (parts.length === 2) {
          return { action: act as any, orderId: parts[1].trim() || undefined };
        } else if (parts.length >= 3) {
          return { action: act as any, subAction: parts[1].toLowerCase(), orderId: parts[2].trim() || undefined };
        }
      }
    }
    const t = raw.toLowerCase();
    if (/predelivery_confirm|yes_home|im_home|i'm home|available|yes,? i'm home/.test(t) && !/cancel|resched/.test(t)) {
      return { action: 'predelivery_confirm' };
    }
    if (/did\s*not\s*visit|never\s*visited|no\s*attempt|not\s*attempted|fake|rider\s*never|nobody\s*came|did\s*not\s*come/.test(t)) {
      return { action: 'verify_fake' };
    }
    if (/attempt\s*redeliver|redeliver|try\s*again/.test(t) && !/cancel/.test(t)) {
      return { action: 'verify_redeliver' };
    }
    if (/keep\s*address|skip|same\s*address|keep\s*current/.test(t)) {
      return { action: 'address_skip' };
    }
    if (/resched|reattempt|tomorrow|deliver|today/.test(t) && !/cancel/.test(t)) {
      let subAction = 'tomorrow';
      if (/today/i.test(t)) subAction = 'today';
      else if (/day\s*after/i.test(t)) subAction = 'day_after';
      else if (/weekend/i.test(t)) subAction = 'weekend';
      return { action: 'reschedule', subAction };
    }
    if (/address|location|pin|change\s*address|update\s*address/.test(t)) {
      let subAction = 'both';
      if (/gps|pin/i.test(t) && !/text|landmark/i.test(t)) subAction = 'gps';
      else if (/landmark|text/i.test(t) && !/gps|pin/i.test(t)) subAction = 'text';
      return { action: 'address', subAction };
    }
    if (/pay_retention|convert|prepaid|pay.*online|pay.*upi/i.test(t)) return { action: 'pay_retention' };
    if (/confirm_cancel|cancel anyway|confirm.*cancel/i.test(t)) return { action: 'confirm_cancel' };
    if (/cancel|return|don'?t want|refuse/.test(t)) return { action: 'cancel' };
    return null;
  }

  private merchantAlreadyResolved(order: any): boolean {
    return order.status === 'ndr_rescued' || order.status === 'delivered' || order.status === 'rto';
  }

  private shouldHoldForReview(order: any, policy: any): boolean {
    if (policy.reviewMode.when === 'all') return true;
    if (policy.reviewMode.when === 'high_value_only') return (order.orderValue || 0) >= (policy.reviewMode.highValueInr || Infinity);
    return false;
  }

  private async sendVerifyRescue(order: any, merchant: any): Promise<void> {
    const { whatsAppDispatcherService } = require('./whatsapp/whatsapp-dispatcher.service');
    let category = this.classifyRemark(order.ndr?.reason || '');
    if (order.paymentMethod === 'prepaid' && category === 'COD_COLLECTION_ISSUE') {
      category = 'CUSTOMER_NOT_AVAILABLE';
    }

    // ─── 🛡️ ANTI-FARMING SERIAL CANCELLATION COOLDOWN GUARD (P0) ───
    if (category === 'COD_COLLECTION_ISSUE') {
      const { cooldownService } = require('./cooldown.service');
      const isCooldown = await cooldownService.checkAntiFarmingCooldown(
        order.customerPhone,
        merchant._id.toString()
      );
      if (isCooldown) {
        logger.warn(`[ANTI-FARMING] Cooldown triggered for phone ${order.customerPhone}`);
        // Bypass the discount logic entirely and dispatch the standard ndr_reschedule_en
        category = 'CUSTOMER_NOT_AVAILABLE';
      }
    }
    const name = order.customerName || 'Customer';
    const orderId = String(order.externalOrderId || '');

    const terminalStates = ['delivered', 'rto', 'returned', 'cancelled', 'lost'];
    if (terminalStates.includes(order.status)) {
      logger.info('NDR rescue aborted: Order already in terminal state', { orderId: order._id, status: order.status });
      return;
    }

    const dispatchResult = await whatsAppDispatcherService.dispatchNdrRescue({
      merchantId: merchant._id.toString(),
      orderId: order._id.toString(),
      phone: order.customerPhone,
      category,
      variables: {
        customerName: name,
        externalOrderId: orderId,
        codAmount: String(order.orderValue || 0),
      },
      order,
    });

    if (!dispatchResult.success && !dispatchResult.suppressed) {
      throw new Error(dispatchResult.error || 'WhatsApp dispatch failed');
    }
  }

  public async handleCustomerResponse(phone: string, buttonPayload: string, resolvedOrder?: any): Promise<void> {
    logger.info('Handling customer response', { phone, buttonPayload });

    // Accept both our structured ction:orderId payload and the plain quick-reply
    // titles Meta returns for template buttons (e.g. 'Reschedule Tomorrow', 'Cancel Order').
    const parsed = this.parseButtonPayload(buttonPayload);
    if (!parsed) {
      logger.warn('Unrecognised button payload', { buttonPayload });
      return;
    }
    if (!parsed.orderId && !resolvedOrder) {
      logger.warn('Button payload has no order reference and no resolved order', { buttonPayload });
      return;
    }
    const action = parsed.action;
    const orderId = parsed.orderId || resolvedOrder?._id?.toString();
    const normalizedPhone = normalizeIndianPhone(phone);

    try {
      let order = resolvedOrder;
      if (order) {
        if (normalizeIndianPhone(order.customerPhone) !== normalizedPhone) {
          logger.warn('Security alert: Phone number mismatch on resolved order button action', { phone, orderPhone: order.customerPhone });
          return;
        }
      } else {
        order = await Order.findOne({ _id: orderId, customerPhone: normalizedPhone });
        if (!order) {
          order = await Order.findOne({ externalOrderId: orderId, customerPhone: normalizedPhone });
        }
      }

      if (!order) {
        logger.warn('Order not found or phone mismatch for customer response', { orderId, phone });
        return;
      }

      if (order.status === 'delivered' || order.status === 'returned') {
        logger.info('Order already delivered or returned', { orderId });
        return;
      }
      if (order.status === 'ndr_rescued' && (action === 'verify_fake' || action === 'verify_redeliver')) {
        logger.info('Order already rescheduled / rescued', { orderId });
        return;
      }

      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${order.merchantId}`);
      }

      if (order.merchantId.toString() !== merchant._id.toString()) {
        logger.warn('Security alert: Cross-tenant button action attempt rejected', { orderId: order._id, merchantId: merchant._id });
        await SecurityAlertService.sendCriticalAlert('CROSS_TENANT_IDOR_BLOCKED', {
          orderId: order._id.toString(),
          ownerMerchantId: order.merchantId.toString(),
          attackerMerchantId: merchant._id.toString(),
          customerPhone: phone,
          buttonPayload,
        }).catch(() => {});
        return;
      }

      // Use the MERCHANT's carrier account; support multi-carrier map and single carrier fallback
      const cc: any = merchant.carrierConfig || {};
      const targetCarrier = order.carrier || cc.provider || 'shiprocket';
      const specificCarrierConfig = cc.carriers?.[targetCarrier] || (cc.provider === targetCarrier ? cc : {});

      let apiToken: string | undefined;
      let apiKey: string | undefined;
      let carrierEmail: string | undefined;
      let carrierUsername: string | undefined;
      let carrierPassword: string | undefined;
      let customerCode: string | undefined;
      let licenseKey: string | undefined;
      let loginId: string | undefined;

      try {
        if (specificCarrierConfig.apiToken) apiToken = encryptionService.decrypt(specificCarrierConfig.apiToken);
        if (specificCarrierConfig.apiKey) apiKey = encryptionService.decrypt(specificCarrierConfig.apiKey);
        if (specificCarrierConfig.email) carrierEmail = encryptionService.decrypt(specificCarrierConfig.email);
        if (specificCarrierConfig.username) carrierUsername = encryptionService.decrypt(specificCarrierConfig.username);
        if (specificCarrierConfig.password) carrierPassword = encryptionService.decrypt(specificCarrierConfig.password);
        if (specificCarrierConfig.customerCode) customerCode = encryptionService.decrypt(specificCarrierConfig.customerCode);
        if (specificCarrierConfig.licenseKey) licenseKey = encryptionService.decrypt(specificCarrierConfig.licenseKey);
        if (specificCarrierConfig.loginId) loginId = encryptionService.decrypt(specificCarrierConfig.loginId);
      } catch (err) {
        logger.error('Stored carrier credentials cannot be decrypted; merchant must reconnect carrier', { merchantId: merchant._id, targetCarrier });
        throw new Error('Carrier credentials require reconnection');
      }

      const carrierConfig: any = {
        provider: targetCarrier,
        mode: specificCarrierConfig.mode,
        apiToken: apiToken || apiKey,
        apiKey: apiKey || apiToken,
        email: carrierEmail || (targetCarrier === 'shiprocket' ? config.shiprocket.email : undefined),
        username: carrierUsername,
        password: carrierPassword || (targetCarrier === 'shiprocket' ? config.shiprocket.password : undefined),
        customerCode,
        licenseKey,
        loginId,
      };

      if (action === 'predelivery_confirm') {
        const { preDeliveryService } = require('./pre-delivery.service');
        await preDeliveryService.handleCustomerConfirmation(order, merchant);
        return;
      }

      if (action === 'verify_fake') {
        if (!order.ndr) order.ndr = {} as any;
        order.ndr.isFakeAttempt = true;
        order.ndr.fakeRemarkScore = 1.0;
        order.ndr.customerResponse = 'fake_remark_reported';
        order.ndr.scheduledSlot = 'tomorrow';
        if (typeof (order as any).save === 'function') await order.save();
        else await Order.findByIdAndUpdate(order._id, { $set: { ndr: order.ndr } });

        await NdrCase.findOneAndUpdate(
          { orderId: order._id },
          {
            $set: {
              customerResponseType: 'DENIAL_FAKE',
              customerResponseAt: new Date(),
              isFakeRemarkSuspicious: true,
              resolutionType: 'fake_remark_escalated',
            },
          }
        ).catch(() => {});

        realtimeService.broadcast({
          type: 'fake_remark_escalated',
          merchantId: order.merchantId.toString(),
          payload: {
            orderId: order.externalOrderId,
            awb: order.awb,
            carrier: order.carrier,
            reason: 'Customer reported delivery agent did not visit',
          },
          timestamp: new Date().toISOString(),
        });

        // 🛡️ Fail-Safe Autopilot: Pre-schedule next-day redelivery immediately with carrier.
        // If customer drops off without replying further, order is safely rescued for tomorrow!
        await this.rescheduleDelivery(order, merchant, 'tomorrow', { suppressMessage: true });

        // Send Step 2A-1 Timing options (Deliver Today < 3PM vs Tomorrow vs Weekend/Day After)
        const { bodyText, buttons } = getDeliveryTimingButtons(order._id.toString());
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          bodyText,
          buttons,
          this.getWaConfig(merchant)
        );
        return;
      } else if (action === 'verify_redeliver') {
        if (!order.ndr) order.ndr = {} as any;
        order.ndr.customerResponse = 'reschedule_requested';
        order.ndr.scheduledSlot = 'tomorrow';
        if (typeof (order as any).save === 'function') await order.save();
        else await Order.findByIdAndUpdate(order._id, { $set: { ndr: order.ndr } });

        await NdrCase.findOneAndUpdate(
          { orderId: order._id },
          {
            $set: {
              customerResponseType: 'RESCHEDULE',
              customerResponseAt: new Date(),
              resolutionType: 'rescheduled',
            },
          }
        ).catch(() => {});

        // 🛡️ Fail-Safe Autopilot: Pre-schedule next-day redelivery immediately with carrier.
        await this.rescheduleDelivery(order, merchant, 'tomorrow', { suppressMessage: true });

        // Send Step 2B-1 Timing options
        const { bodyText, buttons } = getDeliveryTimingButtons(order._id.toString());
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          bodyText,
          buttons,
          this.getWaConfig(merchant)
        );
        return;
      } else if (action === 'reschedule') {
        const subChoice = parsed.subAction || 'tomorrow';
        if (!order.ndr) order.ndr = {} as any;
        order.ndr.scheduledSlot = subChoice;
        if (typeof (order as any).save === 'function') await order.save();
        else await Order.findByIdAndUpdate(order._id, { $set: { 'ndr.scheduledSlot': subChoice } });

        // Reschedule on carrier and advance customer to Step 2 (Address Confirmation with Skip)
        await this.rescheduleDelivery(order, merchant, subChoice, { sendAddressStep: true });
        return;
      } else if (action === 'address_skip') {
        const slot = order.ndr?.scheduledSlot;
        const slotLabel = slot === 'today'
          ? 'Today'
          : slot === 'day_after'
            ? 'Day After Tomorrow'
            : slot === 'weekend'
              ? 'the Weekend'
              : 'Tomorrow';
        const confirmMsg = `✅ Delivery confirmed for ${slotLabel} with your current address. We have notified the delivery hub for priority handling.`;
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          confirmMsg,
          [],
          this.getWaConfig(merchant)
        );

        await AuditLog.create({
          merchantId: order.merchantId,
          orderId: order._id,
          action: 'customer_response_address_skip',
          source: 'whatsapp_webhook',
          payload: { buttonPayload, phone, slot: slotLabel },
          status: 'success',
        });
        return;
      } else if (action === 'address') {
        const mode = parsed.subAction === 'gps'
          ? 'location_pin'
          : parsed.subAction === 'text'
            ? 'text_address'
            : 'both';

        logger.info('Initiating multi-step address correction from customer response', {
          orderId: order._id,
          mode,
        });

        await addressCorrectionService.initiateAddressCorrection(
          order._id.toString(),
          mode as any
        );
        return;
      } else if (action === 'cancel') {
        // ─── 🛡️ ANTI-EXPLOIT GUARD 1: Serial Abuser Cooldown (Anti-Farming) ───
        const { cooldownService } = require('./cooldown.service');
        const isSerialAbuser = await cooldownService.checkAntiFarmingCooldown(
          normalizedPhone,
          merchant._id.toString()
        );

        if (isSerialAbuser) {
          logger.warn(`[ANTI-FARMING] Cooldown triggered for phone ${order.customerPhone || normalizedPhone}`);
        }

        // ─── ANTI-EXPLOIT RETENTION: Offer dynamic self-funding COD→Prepaid conversion ───
        if (!isSerialAbuser && order.paymentMethod === 'cod' && !order.ndr?.retentionOffered) {
          const codSettings = merchant.settings?.codConversion || {};
          const incentiveType = codSettings.incentiveType || 'flat';
          const incentiveAmount = codSettings.incentiveAmount !== undefined ? codSettings.incentiveAmount : 100;
          const discountCap = codSettings.discountCap;

          let discount = 0;
          if (incentiveType === 'percentage') {
            discount = Math.round(((order.orderValue || 0) * incentiveAmount) / 100);
            if (discountCap && discountCap > 0) {
              discount = Math.min(discount, discountCap);
            }
          } else {
            discount = incentiveAmount;
          }

          if (discount > 0 && (order.orderValue || 0) > discount) {
            const finalAmount = (order.orderValue || 0) - discount;

            if (!order.ndr) order.ndr = {} as any;
            order.ndr.retentionOffered = true;
            order.ndr.retentionDiscount = discount;
            order.ndr.retentionFinalAmount = finalAmount;
            order.ndr.customerResponse = 'cancel_retention_pending';
            await order.save();

            await this.cancelEscalationJobs(order, merchant);

            const { orderService } = require('./order.service');
            const paymentLink = await orderService.generateRetentionPaymentLink(order, merchant, finalAmount, discount);

            const retentionMsg = paymentLink?.shortUrl
              ? `Before we cancel — convert to online payment now and save ₹${discount}! Your new total is ₹${finalAmount}. Prepaid orders skip cash-collection queues and get priority dispatch.\n\nPay securely: ${paymentLink.shortUrl}`
              : `Before we cancel — convert to online payment now and save ₹${discount}! Your new total is ₹${finalAmount} via instant UPI.`;

            await whatsAppService.sendInteractiveButtons(
              order.customerPhone,
              retentionMsg,
              [
                { id: `retention:pay:${order._id}`, title: `💳 Pay ₹${finalAmount} Online` },
                { id: `confirm_cancel:${order._id}`, title: '⚠️ Cancel Anyway' },
              ],
              this.getWaConfig(merchant)
            );
            return;
          }
        }

        // ─── CONFIRMED CANCEL: Clean exit without free coupon handouts ───
        order.status = 'rto';
        if (order.ndr) {
          order.ndr.customerResponse = 'cancel';
          order.ndr.resolvedAt = new Date();
          order.ndr.resolution = 'cancelled';
        }
        if (!order.failureSource || order.failureSource === 'NONE') {
          order.failureSource = 'CUSTOMER_PRE_ATTEMPT';
        }
        await order.save();

        await this.cancelEscalationJobs(order, merchant);

        if (order.carrier && order.awb) {
          try {
            await logisticsService.cancelDelivery(
              order.carrier,
              {
                awb: order.awb,
                reason: 'Customer cancelled order via WhatsApp NDR',
              },
              carrierConfig
            );
            await AuditLog.create({
              merchantId: order.merchantId,
              orderId: order._id,
              action: 'carrier_cancellation_dispatched',
              source: 'ndr_service',
              payload: { carrier: order.carrier, awb: order.awb },
              status: 'success',
            });
          } catch (carrierErr: any) {
            logger.warn('Carrier cancellation notification warning', { awb: order.awb, error: carrierErr?.message });
          }
        }

        realtimeService.emitOrderCancelled(
          order.merchantId.toString(),
          order.externalOrderId,
          160,
          'Customer opted out via WhatsApp'
        );

        const customCoupon = (merchant as any).settings?.ndrRescue?.returnCoupon;
        const cancelMsg = customCoupon
          ? COPY.cancelled({ orderId: order.externalOrderId, coupon: customCoupon })
          : COPY.cancelledClean({ orderId: order.externalOrderId });

        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          cancelMsg,
          [],
          this.getWaConfig(merchant)
        );
        return;
      } else if (action === 'pay_retention') {
        const codSettings = merchant.settings?.codConversion || {};
        const incentiveType = codSettings.incentiveType || 'flat';
        const incentiveAmount = codSettings.incentiveAmount !== undefined ? codSettings.incentiveAmount : 100;
        const discountCap = codSettings.discountCap;

        let discount = order.ndr?.retentionDiscount;
        if (discount === undefined) {
          if (incentiveType === 'percentage') {
            discount = Math.round(((order.orderValue || 0) * incentiveAmount) / 100);
            if (discountCap && discountCap > 0) {
              discount = Math.min(discount, discountCap);
            }
          } else {
            discount = incentiveAmount;
          }
        }
        const finalAmount = order.ndr?.retentionFinalAmount || Math.max(1, (order.orderValue || 0) - (discount || 0));

        const { orderService } = require('./order.service');
        const paymentLink = await orderService.generateRetentionPaymentLink(order, merchant, finalAmount, discount);

        const payMsg = paymentLink?.shortUrl
          ? `Here is your priority fast-track payment link: ${paymentLink.shortUrl}\n\nPay ₹${finalAmount} to confirm and priority-dispatch your order.`
          : `Click below to complete your prepaid conversion for ₹${finalAmount}.`;

        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          payMsg,
          [],
          this.getWaConfig(merchant)
        );
        return;
      } else if (action === 'confirm_cancel') {
        order.status = 'rto';
        if (order.ndr) {
          order.ndr.customerResponse = 'cancel';
          order.ndr.resolvedAt = new Date();
          order.ndr.resolution = 'cancelled';
        }
        if (!order.failureSource || order.failureSource === 'NONE') {
          order.failureSource = 'CUSTOMER_PRE_ATTEMPT';
        }
        await order.save();

        await this.cancelEscalationJobs(order, merchant);

        if (order.carrier && order.awb) {
          try {
            await logisticsService.cancelDelivery(
              order.carrier,
              { awb: order.awb, reason: 'Customer confirmed cancellation via WhatsApp' },
              carrierConfig
            );
          } catch (carrierErr: any) {
            logger.warn('Carrier cancellation notification warning', { awb: order.awb, error: carrierErr?.message });
          }
        }

        realtimeService.emitOrderCancelled(
          order.merchantId.toString(),
          order.externalOrderId,
          160,
          'Customer opted out via WhatsApp'
        );

        const customCoupon = (merchant as any).settings?.ndrRescue?.returnCoupon;
        const cancelMsg = customCoupon
          ? COPY.cancelled({ orderId: order.externalOrderId, coupon: customCoupon })
          : COPY.cancelledClean({ orderId: order.externalOrderId });

        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          cancelMsg,
          [],
          this.getWaConfig(merchant)
        );
        return;
      }

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: `customer_response_${action}`,
        source: 'whatsapp_webhook',
        payload: { buttonPayload, phone },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to handle customer response button click', { phone, error: err.message });
      throw err;
    }
  }

  public async handleCustomerLocationResponse(phone: string, location: any, resolvedOrder?: any): Promise<void> {
    const { addressCorrectionService } = require('./address-correction.service');
    await addressCorrectionService.handleLocationResponse(phone, location, resolvedOrder);
  }

  public async handleCustomerTextResponse(phone: string, text: string, resolvedOrder?: any): Promise<void> {
    const { addressCorrectionService } = require('./address-correction.service');
    const handled = await addressCorrectionService.handleTextAddressResponse(phone, text, resolvedOrder);
    if (!handled) {
      const normalizedPhone = normalizeIndianPhone(phone);
      const order = resolvedOrder || await Order.findOne({
        customerPhone: normalizedPhone,
        status: 'ndr_rescue_sent',
      }).sort({ updatedAt: -1 });

      if (!order) return;

      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) return;

      // Check for pre-delivery confirmation intent
      if (order.status === 'out_for_delivery' && /yes|home|available|deliver|waiting|bhejo/i.test(text) && !/not|cancel|don'?t/i.test(text)) {
        const { preDeliveryService } = require('./pre-delivery.service');
        await preDeliveryService.handleCustomerConfirmation(order, merchant);
        return;
      }

      // Check for fake remark / delivery denial signals (Rule 4 in Fake Remark Detection)
      const fakeDenialRegex = /(?:nobody|no\s*one|not\s*a\s*single\s*call|did\s*not\s*call|didn't\s*call|never\s*called|fake|did\s*not\s*come|didn't\s*come|no\s*attempt|koi\s*nahi\s*aaya|call\s*nahi\s*kiya)/i;
      if (fakeDenialRegex.test(text)) {
        logger.warn('Customer reported fake delivery attempt', { phone, orderId: order._id, text });
        if (!order.ndr) order.ndr = {} as any;
        order.ndr.isFakeAttempt = true;
        order.ndr.fakeRemarkScore = 1.0;
        order.ndr.customerResponse = 'fake_remark_reported';
        order.ndr.resolution = 'fake_remark_escalated';
        await order.save();

        await AuditLog.create({
          merchantId: order.merchantId,
          orderId: order._id,
          action: 'fake_remark_reported_by_customer',
          source: 'whatsapp_webhook',
          payload: { text, phone },
          status: 'success',
        });

        realtimeService.broadcast({
          type: 'fake_remark_escalated',
          merchantId: order.merchantId.toString(),
          payload: {
            orderId: order.externalOrderId,
            awb: order.awb,
            customerFeedback: text,
            carrier: order.carrier,
          },
          timestamp: new Date().toISOString(),
        });

        await NdrCase.findOneAndUpdate(
          { orderId: order._id },
          {
            $set: {
              customerResponseType: 'DENIAL_FAKE',
              customerResponseAt: new Date(),
              customerResponseText: text,
              isFakeRemarkSuspicious: true,
              resolutionType: 'fake_remark_escalated',
            },
          }
        ).catch(() => {});

        // 🛡️ Fail-Safe Autopilot: Immediately pre-schedule next-day redelivery with carrier.
        await this.rescheduleDelivery(order, merchant, 'tomorrow', { suppressMessage: true });

        // Send Step 2A-1 Timing options (Deliver Today < 3PM vs Tomorrow vs Weekend/Day After)
        const { bodyText, buttons } = getDeliveryTimingButtons(order._id.toString());
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          bodyText,
          buttons,
          this.getWaConfig(merchant)
        );
        return;
      }

      // MED-7 fix: Only confirm address if in active address collection state.
      const isInAddressFlow = order.ndr?.customerResponse === 'address_update_started';
      if (isInAddressFlow) {
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          COPY.addressConfirmed(),
          [],
          this.getWaConfig(merchant)
        );
      } else {
        logger.info('Received text outside address update flow, skipping false confirmation', { phone, text });
      }
    }
  }

  public async escalate(orderId: string, level: number): Promise<void> {
    logger.info('Checking NDR escalation status', { orderId, level });

    const order = await Order.findOne({ _id: orderId, status: 'ndr_rescue_sent' });
    if (!order) {
      logger.info('Order no longer in ndr_rescue_sent status — escalation aborted', { orderId });
      return;
    }

    try {
      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) return;

      // Escalation reminders are also business-initiated (often with no open customer
      // window) → re-send the approved template rather than a free-form message.
      const language = merchant.settings?.ndrRescue?.messageLanguage || 'en';
      await whatsAppService.sendTemplate(
        order.customerPhone,
        'ndr_rescue_en',
        language,
        [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: order.customerName || 'Customer' },
              { type: 'text', text: String(order.externalOrderId || '') },
            ],
          },
        ],
        this.getWaConfig(merchant)
      );

      if (order.ndr) {
        order.ndr.rescueMessagesSent += 1;
        order.ndr.lastMessageSentAt = new Date();
      }
      await order.save();

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: `ndr_escalation_level_${level}`,
        source: 'ndr_service',
        payload: { level },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to process escalation', { orderId, level, error: err.message });
      throw err;
    }
  }

  public detectFakeAttempt(order: any, ndrData?: NDREventData): boolean {
    return this.fakeRemarkScore(order, ndrData?.attemptTime) >= 0.5;
  }

  public classifyRemark(remark: string): NDRCategory {
    const text = (remark || '').toLowerCase();
    if (text.includes('refused') || text.includes('rejected') || text.includes('refuse')) {
      return 'CUSTOMER_REFUSED';
    }
    if (text.includes('cancelled') || text.includes('canceled') || text.includes('dont want') || text.includes("don't want")) {
      return 'CANCELLATION_RISK';
    }
    if (text.includes('cod') || text.includes('cash') || text.includes('payment') || text.includes('money')) {
      return 'COD_COLLECTION_ISSUE';
    }
    if (text.includes('address') || text.includes('location') || text.includes('pincode') || text.includes('incomplete') || text.includes('incorrect') || text.includes('wrong address')) {
      return 'ADDRESS_ISSUE';
    }
    if (text.includes('not available') || text.includes('unavailable') || text.includes('out of station') || text.includes('not at home') || text.includes('unreachable') || text.includes('no answer') || text.includes('not reachable') || text.includes('switched off')) {
      return 'CUSTOMER_NOT_AVAILABLE';
    }
    if (text.includes('premises locked') || text.includes('door locked') || text.includes('premises closed') || (text.includes('locked') && !text.includes('unlocked'))) {
      return 'PREMISES_LOCKED';
    }
    if (text.includes('later') || text.includes('reschedule') || text.includes('tomorrow') || text.includes('next day') || text.includes('re-attempt')) {
      return 'RESCHEDULE_REQUEST';
    }
    return 'UNKNOWN_FAILURE';
  }

  public classifyNDRReason(reason: string): 'customer_unavailable' | 'wrong_address' | 'refused' | 'phone_unreachable' | 'other' {
    const r = reason.toLowerCase();
    if (r.includes('unavailable') || r.includes('not available') || r.includes('locked')) return 'customer_unavailable';
    if (r.includes('address') || r.includes('location') || r.includes('pincode')) return 'wrong_address';
    if (r.includes('refused') || r.includes('reject') || r.includes('cancel')) return 'refused';
    if (r.includes('unreachable') || r.includes('busy') || r.includes('network')) return 'phone_unreachable';
    return 'other';
  }

  /**
   * Reschedules delivery with the carrier and updates the order status.
   * Dynamically calculates target date based on subChoice ('tomorrow', 'day_after', 'weekend').
   */
  public async rescheduleDelivery(
    order: any,
    merchant: any,
    subChoice: string = 'tomorrow',
    options?: { suppressMessage?: boolean; sendAddressStep?: boolean }
  ): Promise<{ success: boolean; dateStr: string; label: string; result?: any }> {
    let targetDate: Date;
    let label: string;

    if (subChoice === 'today') {
      targetDate = new Date();
      label = 'Today (Same-Day Priority)';
    } else if (subChoice === 'day_after') {
      targetDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      label = 'Day After Tomorrow';
    } else if (subChoice === 'weekend') {
      const now = new Date(Date.now());
      const dayOfWeek = now.getDay();
      const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
      targetDate = new Date(Date.now() + daysUntilSat * 24 * 60 * 60 * 1000);
      label = `This Weekend (${targetDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })})`;
    } else {
      targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      label = 'Tomorrow';
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    const carrierReason = subChoice === 'today'
      ? 'URGENT_SAME_DAY_REQUEST: Customer confirmed available at doorstep before 3 PM'
      : `Customer requested reattempt for ${label} via WhatsApp`;

    logger.info('Rescheduling delivery with carrier', { awb: order.awb, dateStr, label });

    const cc: any = merchant?.carrierConfig || {};
    const targetCarrier = order.carrier || cc.provider || 'shiprocket';
    const specificCarrierConfig = cc.carriers?.[targetCarrier] || (cc.provider === targetCarrier ? cc : {});

    let apiToken: string | undefined;
    let apiKey: string | undefined;
    let carrierEmail: string | undefined;
    let carrierUsername: string | undefined;
    let carrierPassword: string | undefined;
    let customerCode: string | undefined;
    let licenseKey: string | undefined;
    let loginId: string | undefined;

    try {
      if (specificCarrierConfig.apiToken) apiToken = encryptionService.decrypt(specificCarrierConfig.apiToken);
      if (specificCarrierConfig.apiKey) apiKey = encryptionService.decrypt(specificCarrierConfig.apiKey);
      if (specificCarrierConfig.email) carrierEmail = encryptionService.decrypt(specificCarrierConfig.email);
      if (specificCarrierConfig.username) carrierUsername = encryptionService.decrypt(specificCarrierConfig.username);
      if (specificCarrierConfig.password) carrierPassword = encryptionService.decrypt(specificCarrierConfig.password);
      if (specificCarrierConfig.customerCode) customerCode = encryptionService.decrypt(specificCarrierConfig.customerCode);
      if (specificCarrierConfig.licenseKey) licenseKey = encryptionService.decrypt(specificCarrierConfig.licenseKey);
      if (specificCarrierConfig.loginId) loginId = encryptionService.decrypt(specificCarrierConfig.loginId);
    } catch (err: any) {
      logger.warn('Failed to decrypt carrier credentials for reschedule', { error: err?.message, targetCarrier });
    }

    const carrierConfig: any = {
      provider: targetCarrier,
      mode: specificCarrierConfig.mode,
      apiToken: apiToken || apiKey,
      apiKey: apiKey || apiToken,
      email: carrierEmail || (targetCarrier === 'shiprocket' ? config.shiprocket.email : undefined),
      username: carrierUsername,
      password: carrierPassword || (targetCarrier === 'shiprocket' ? config.shiprocket.password : undefined),
      customerCode,
      licenseKey,
      loginId,
    };

    if (order.carrier && order.awb) {
      const result = await logisticsService.rescheduleDelivery(
        order.carrier,
        {
          awb: order.awb,
          newDate: dateStr,
          reason: carrierReason,
        },
        carrierConfig
      );

      if (result.success) {
        order.status = 'ndr_rescued';
        const rtoFee = merchant?.settings?.estimatedRtoLossPerOrder || 140;
        order.rtoFeeSaved = rtoFee;
        const finalResolution = order.ndr?.resolution === 'fake_remark_escalated' ? 'fake_remark_escalated' : 'rescheduled';
        const ndrUpdate: Record<string, any> = {
          status: 'ndr_rescued',
          rtoFeeSaved: rtoFee,
        };
        if (order.ndr) {
          order.ndr.customerResponse = order.ndr.customerResponse || 'reschedule';
          order.ndr.resolvedAt = new Date();
          order.ndr.resolution = finalResolution;
          order.ndr.scheduledSlot = subChoice;
          ndrUpdate['ndr.customerResponse'] = order.ndr.customerResponse;
          ndrUpdate['ndr.resolvedAt'] = new Date();
          ndrUpdate['ndr.resolution'] = finalResolution;
          ndrUpdate['ndr.scheduledSlot'] = subChoice;
        }
        if (typeof (order as any).save === 'function') {
          await (order as any).save();
        } else {
          await Order.findByIdAndUpdate(order._id, { $set: ndrUpdate });
        }

        try {
          await NdrCase.findOneAndUpdate(
            { orderId: order._id, merchantId: order.merchantId },
            {
              $set: {
                status: 'REATTEMPT_REQUESTED',
                customerResponseType: 'RESCHEDULE',
                customerResponseAt: new Date(),
                resolutionType: 'rescheduled',
                reattemptRequestedAt: new Date(),
                carrierReattemptStatus: 'SUCCESS',
                rtoFeeSaved: rtoFee,
                estimatedLossPrevented: rtoFee,
              },
            }
          );
        } catch (caseErr: any) {
          logger.warn('Failed to update NdrCase on reschedule', { error: caseErr?.message });
        }

        await this.cancelEscalationJobs(order, merchant);

        await Merchant.findByIdAndUpdate(order.merchantId, {
          $inc: { 'billing.totalRescues': 1 },
        });

        if (!options?.suppressMessage) {
          if (options?.sendAddressStep) {
            const addressPrompt = `Delivery scheduled for ${label}! 📦\n\nTo ensure the delivery executive reaches you smoothly, would you like to update your delivery address or share a GPS location pin?`;
            await whatsAppService.sendInteractiveButtons(
              order.customerPhone,
              addressPrompt,
              [
                { id: `address:update:${order._id}`, title: '📍 Update Address' },
                { id: `address:skip:${order._id}`, title: '⏭️ Keep Address' },
              ],
              this.getWaConfig(merchant)
            );
          } else {
            const rescheduleMsg = COPY.escalated({ window: label });
            await whatsAppService.sendInteractiveButtons(
              order.customerPhone,
              rescheduleMsg,
              [],
              this.getWaConfig(merchant)
            );
          }
        }

        return { success: true, dateStr, label, result };
      } else {
        throw new Error(`Carrier reschedule failed: ${result.message}`);
      }
    }

    return { success: false, dateStr, label };
  }

  private async cancelEscalationJobs(order: any, merchant: any): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const eq = this.getEscalationQueue();
      const chain = merchant.settings?.ndrRescue?.escalationChain || [4, 12, 24];
      for (let i = 0; i < chain.length; i++) {
        const jobId = makeJobId('escalation', order._id.toString(), i + 1);
        const job = await eq.getJob(jobId);
        if (job) await job.remove();
      }
    } catch (err: any) {
      logger.warn('Failed to cancel escalation jobs from Redis queue', { orderId: order._id, error: err?.message });
    }
  }

  private getWaConfig(merchant: any) {
    let token: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        token = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch (err: any) {
        // Fail closed: never send the stored ciphertext to Meta as if it were a token.
        logger.error('Stored WhatsApp token cannot be decrypted; merchant must reconnect WhatsApp', { merchantId: merchant._id });
        throw new Error('WhatsApp credentials require reconnection');
      }
    }
    return {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: token,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };
  }
}

export const ndrService = NDRService.getInstance();
