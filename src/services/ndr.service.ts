import { Types } from 'mongoose';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { config } from '../config/env';
import { Merchant, Order, AuditLog, BillingEvent, NdrCase, DeliveryAttempt, RescueLedger } from '../models';
import { whatsAppService } from './whatsapp.service';
import { logisticsService } from './logistics.service';
import { encryptionService } from './encryption.service';
import { geocodingService } from './geocoding.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { getMessages, translateReason } from '../i18n/messages';
import { realtimeService } from './realtime.service';
import { logger } from '../utils/logger';
import { getPolicy, RescuePolicy } from '../config/rescue-policy';
import { recordOutbound } from './whatsapp-cost.service';
import { COPY } from '../i18n/customer-copy';
import { addressCorrectionService, LocationData } from './address-correction.service';
import { SecurityAlertService } from './security-alert.service';
import { makeJobId } from '../utils/job-id';

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
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
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
          });
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
        { $set: { status: 'ndr_detected', awb: ndrData.awb, carrier: ndrData.carrier, ndr: ndrPayload } },
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

      // Persist first-class NdrCase record
      try {
        await NdrCase.create({
          orderId: order._id,
          merchantId: merchant._id,
          awb: ndrData.awb,
          externalOrderId: order.externalOrderId,
          customerPhone: order.customerPhone,
          failureReason: ndrData.reason,
          failureCategory: this.classifyRemark(ndrData.reason),
          whatsappMessageSentAt: new Date(),
          status: 'OPEN',
          isFakeRemarkSuspicious: isFake,
        });
      } catch (caseErr: any) {
        logger.warn('Failed to record NdrCase model', { error: caseErr?.message });
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

  private parseButtonPayload(payload: string): { action: 'reschedule' | 'address' | 'cancel'; orderId?: string } | null {
    const raw = String(payload || '').trim();
    const idx = raw.indexOf(':');
    if (idx > 0) {
      const action = raw.slice(0, idx).toLowerCase();
      const orderId = raw.slice(idx + 1).trim();
      if (action === 'reschedule' || action === 'address' || action === 'cancel') return { action, orderId: orderId || undefined };
    }
    const t = raw.toLowerCase();
    if (/resched|reattempt|tomorrow|home|deliver/.test(t)) return { action: 'reschedule' };
    if (/address|location|pin/.test(t)) return { action: 'address' };
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
    const category = this.classifyRemark(order.ndr?.reason || '');
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

      if (order.status === 'ndr_rescued' || order.status === 'delivered') {
        logger.info('Order already resolved', { orderId });
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

      // Use the MERCHANT's carrier account; fall back to the platform Shiprocket account
      // only when the merchant has not connected their own. Fail closed on bad ciphertext.
      const cc: any = merchant.carrierConfig || {};
      let apiToken: string | undefined;
      let carrierEmail: string | undefined;
      let carrierPassword: string | undefined;
      try {
        if (cc.apiToken) apiToken = encryptionService.decrypt(cc.apiToken);
        else if (cc.apiKey) apiToken = encryptionService.decrypt(cc.apiKey);
        if (cc.email) carrierEmail = encryptionService.decrypt(cc.email);
        if (cc.password) carrierPassword = encryptionService.decrypt(cc.password);
      } catch (err) {
        logger.error('Stored carrier credentials cannot be decrypted; merchant must reconnect carrier', { merchantId: merchant._id });
        throw new Error('Carrier credentials require reconnection');
      }

      const carrierConfig = {
        provider: order.carrier || cc.provider,
        apiToken,
        email: carrierEmail || config.shiprocket.email,
        password: carrierPassword || config.shiprocket.password,
      };

      if (action === 'reschedule') {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        logger.info('Rescheduling delivery with carrier', { awb: order.awb, tomorrow });
        
        if (order.carrier && order.awb) {
          const result = await logisticsService.rescheduleDelivery(
            order.carrier,
            {
              awb: order.awb,
              newDate: tomorrow,
              reason: 'Customer requested reattempt tomorrow via WhatsApp',
            },
            carrierConfig
          );

          if (result.success) {
            order.status = 'ndr_rescued';
            const ndrUpdate: Record<string, any> = { status: 'ndr_rescued' };
            if (order.ndr) {
              order.ndr.customerResponse = 'reschedule';
              order.ndr.resolvedAt = new Date();
              order.ndr.resolution = 'rescheduled';
              ndrUpdate['ndr.customerResponse'] = 'reschedule';
              ndrUpdate['ndr.resolvedAt'] = new Date();
              ndrUpdate['ndr.resolution'] = 'rescheduled';
            }
            if (typeof (order as any).save === 'function') {
              await (order as any).save();
            } else {
              await Order.findByIdAndUpdate(order._id, { $set: ndrUpdate });
            }

            await this.cancelEscalationJobs(order, merchant);

            await Merchant.findByIdAndUpdate(order.merchantId, {
              $inc: { 'billing.totalRescues': 1 },
            });

            const rescheduleMsg = COPY.escalated({ window: 'Tomorrow 9 AM – 12 PM' });
            await whatsAppService.sendInteractiveButtons(
              order.customerPhone,
              rescheduleMsg,
              [],
              this.getWaConfig(merchant)
            );
          } else {
            throw new Error(`Carrier reschedule failed: ${result.message}`);
          }
        }
      } else if (action === 'address') {
        if (order.ndr) {
          order.ndr.customerResponse = 'address_update_started';
        }
        await order.save();

        const instructions = COPY.askBuildingDetails();
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          instructions,
          [],
          this.getWaConfig(merchant)
        );
      } else if (action === 'cancel') {
        order.status = 'rto';
        if (order.ndr) {
          order.ndr.customerResponse = 'cancel';
          order.ndr.resolvedAt = new Date();
          order.ndr.resolution = 'cancelled';
        }
        await order.save();

        await this.cancelEscalationJobs(order, merchant);

        // Notify carrier immediately to abort re-attempts and initiate RTO early to save freight
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

        // Realtime feed notification: emit order cancelled with ₹160 freight saved
        realtimeService.emitOrderCancelled(
          order.merchantId.toString(),
          order.externalOrderId,
          160,
          'Customer opted out via WhatsApp'
        );

        const coupon = (merchant as any).settings?.ndrRescue?.returnCoupon || 'COMEBACK150';
        const cancelMsg = COPY.cancelled({ orderId: order.externalOrderId, coupon });
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          cancelMsg,
          [],
          this.getWaConfig(merchant)
        );
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

        const fakeApology = 'We apologize for this experience. We have flagged this delivery attempt as suspicious with courier management and raised an immediate supervisor escalation to reschedule your delivery.';
        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          fakeApology,
          [],
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
