/**
 * pre-delivery.service.ts
 * Enterprise Conditional Pre-Delivery Confirmation Engine.
 *
 * Dispatches a proactive Out-For-Delivery (OFD) WhatsApp filter to intercept
 * 20-30% of delivery failures before the courier reaches the doorstep.
 *
 * Gated strictly by 4 risk heuristics:
 *  1. Pincode Risk > 0.25 (historical high-RTO cluster)
 *  2. High-Value COD (COD order > ₹2,000)
 *  3. Merchant explicitly enabled in settings
 *  4. Customer RTO Risk score > 0.6
 */

import { Order, Merchant, AuditLog, BillingEvent } from '../models';
import { whatsAppService } from './whatsapp.service';
import { encryptionService } from './encryption.service';
import { recordOutbound } from './whatsapp-cost.service';
import { checkSubscriptionAccess } from '../utils/subscription-guard';
import { pincodeRiskService } from './analytics/pincode-risk.service';
import { realtimeService } from './realtime.service';
import { redisConnection } from '../config/redis';
import { COPY } from '../i18n/customer-copy';
import { logger, maskPhone } from '../utils/logger';

export interface PreDeliveryEvaluation {
  shouldSend: boolean;
  reason?: string;
  pincodeRisk?: number;
  customerRtoScore?: number;
}

export class PreDeliveryService {
  private static instance: PreDeliveryService;

  private constructor() {}

  public static getInstance(): PreDeliveryService {
    if (!PreDeliveryService.instance) {
      PreDeliveryService.instance = new PreDeliveryService();
    }
    return PreDeliveryService.instance;
  }

  /**
   * Evaluates whether an order qualifies for a pre-delivery confirmation message.
   * Gated strictly by the 4 operational risk heuristics.
   */
  public async shouldSendPreDelivery(order: any, merchant: any): Promise<PreDeliveryEvaluation> {
    if (!order || !merchant) {
      return { shouldSend: false, reason: 'missing_order_or_merchant' };
    }

    // 1. Merchant global pause guard
    if (merchant.settings?.globalPause) {
      return { shouldSend: false, reason: 'global_pause_active' };
    }

    // 2. Terminal state guard
    const terminalStates = ['delivered', 'rto', 'returned', 'cancelled', 'lost'];
    if (terminalStates.includes(order.status)) {
      return { shouldSend: false, reason: `order_already_terminal:${order.status}` };
    }

    // 3. Deduplication: Never send pre-delivery message more than once per order
    if (order.preDeliveryConfirmation?.sentAt) {
      return { shouldSend: false, reason: 'already_sent' };
    }

    // 4. Zero-loophole subscription & quota check
    const subCheck = checkSubscriptionAccess(merchant);
    if (!subCheck.allowed) {
      return { shouldSend: false, reason: `subscription_inactive:${subCheck.reason}` };
    }

    // 5. Sufficient rescue credits check
    if ((merchant.billing?.rescueCredits ?? 0) <= 0) {
      return { shouldSend: false, reason: 'insufficient_rescue_credits' };
    }

    // ─── Core Heuristic Evaluation (Any of the 4 gates triggers confirmation) ───

    // Heuristic 1: Pincode Risk > 0.25 (or custom threshold)
    const pincode = order.shippingPincode || order.shippingAddress?.zip || order.shippingAddress?.pincode;
    const pincodeRisk = await pincodeRiskService.getPincodeRiskScore(pincode, merchant._id.toString());
    const pincodeThreshold = merchant.settings?.preDeliveryConfirmation?.pincodeRiskThreshold ?? 0.25;

    if (pincodeRisk > pincodeThreshold) {
      return {
        shouldSend: true,
        reason: `pincode_risk_exceeded:${pincodeRisk}>${pincodeThreshold}`,
        pincodeRisk,
      };
    }

    // Heuristic 2: High-Value COD (COD order > ₹2,000 or custom threshold)
    const minCodValue = merchant.settings?.preDeliveryConfirmation?.minOrderValue ?? 2000;
    if (order.paymentMethod === 'cod' && (order.orderValue || 0) > minCodValue) {
      return {
        shouldSend: true,
        reason: `high_value_cod:₹${order.orderValue}>₹${minCodValue}`,
        pincodeRisk,
      };
    }

    // Heuristic 3: Merchant setting explicitly enabled for all out-for-delivery orders
    if (merchant.settings?.preDeliveryConfirmation?.enabled === true) {
      return {
        shouldSend: true,
        reason: 'merchant_explicitly_enabled',
        pincodeRisk,
      };
    }

    // Heuristic 4: Customer RTO risk score > 0.6 (or custom threshold)
    const rawRtoScore = order.rtoRisk?.score ?? 0;
    const normalizedRtoScore = rawRtoScore > 1 ? rawRtoScore / 100 : rawRtoScore;
    const customerThreshold = merchant.settings?.preDeliveryConfirmation?.customerRtoScoreThreshold ?? 0.6;

    if (normalizedRtoScore > customerThreshold) {
      return {
        shouldSend: true,
        reason: `customer_rto_risk_exceeded:${normalizedRtoScore}>${customerThreshold}`,
        pincodeRisk,
        customerRtoScore: normalizedRtoScore,
      };
    }

    return {
      shouldSend: false,
      reason: 'risk_thresholds_not_met',
      pincodeRisk,
      customerRtoScore: normalizedRtoScore,
    };
  }

  /**
   * Dispatches the WhatsApp interactive pre-delivery confirmation message.
   */
  public async evaluateAndSendPreDelivery(
    order: any,
    merchant: any,
    carrierPayload?: any
  ): Promise<boolean> {
    const evalResult = await this.shouldSendPreDelivery(order, merchant);

    if (!evalResult.shouldSend) {
      logger.info('Pre-delivery confirmation skipped', {
        orderId: order._id,
        externalOrderId: order.externalOrderId,
        reason: evalResult.reason,
      });
      return false;
    }

    logger.info('Order qualified for pre-delivery confirmation', {
      orderId: order._id,
      externalOrderId: order.externalOrderId,
      reason: evalResult.reason,
    });

    // Redis distributed lock to prevent concurrent webhook duplicate dispatches (6h TTL)
    const lockKey = `predeliv_lock:${order._id}`;
    try {
      if (redisConnection && typeof (redisConnection as any).set === 'function') {
        const acquired = await redisConnection.set(lockKey, '1', 'EX', 21600, 'NX');
        if (!acquired) {
          logger.info('Pre-delivery confirmation already in progress or dispatched', { orderId: order._id });
          return false;
        }
      }
    } catch (lockErr: any) {
      logger.warn('Redis lock error during pre-delivery confirmation check', { error: lockErr?.message });
    }

    // ─── Atomic Credit Reservation ───
    let creditReserved = false;
    try {
      const updatedMerchant = await Merchant.findOneAndUpdate(
        { _id: merchant._id, 'billing.rescueCredits': { $gt: 0 } },
        { $inc: { 'billing.rescueCredits': -1 } },
        { new: true }
      );

      if (!updatedMerchant) {
        logger.warn('Insufficient credits for pre-delivery confirmation dispatch', { merchantId: merchant._id });
        return false;
      }
      creditReserved = true;

      // Prepare customer copy
      const customerName = order.customerName || 'Customer';
      const storeName = merchant.storeName || merchant.name || 'our store';
      const carrierName = (order.carrier || carrierPayload?.carrier || 'our courier partner').toUpperCase();
      const codNote =
        order.paymentMethod === 'cod'
          ? `(Amount to collect: ₹${order.orderValue || 0} via Cash or UPI). `
          : '';

      const bodyText = COPY.preDeliveryNotice({
        name: customerName,
        orderId: order.externalOrderId,
        store: storeName,
        carrier: carrierName,
        codNote,
      });

      // Interactive Action Buttons
      const buttons = [
        { id: `predelivery_confirm:${order._id}`, title: "✅ Yes, I'm home" },
        { id: `reschedule:${order._id}`, title: '📅 Reschedule' },
        { id: `address:${order._id}`, title: '📍 Update Address' },
        { id: `cancel:${order._id}`, title: "❌ I don't want it" },
      ];

      // Decrypt merchant WhatsApp access token
      let waToken: string | undefined;
      if (merchant.whatsappConfig?.accessToken) {
        try {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        } catch {
          logger.error('Merchant WhatsApp token decryption failed in pre-delivery service', { merchantId: merchant._id });
        }
      }

      const waConfig = {
        phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
        accessToken: waToken,
        businessAccountId: merchant.whatsappConfig?.businessAccountId,
      };

      // Dispatch WhatsApp interactive message
      await whatsAppService.sendInteractiveButtons(
        order.customerPhone,
        bodyText,
        buttons,
        waConfig
      );

      // Update Order model
      order.preDeliveryConfirmation = {
        sentAt: new Date(),
        response: null,
        respondedAt: null,
      };
      if (!order.ndr) order.ndr = {} as any;
      order.ndr.lastOutboundAt = new Date();
      order.ndr.lastOutboundMerchantId = merchant._id;
      await order.save();

      // Record outbound message metrics & cost
      await recordOutbound({
        orderId: order._id.toString(),
        merchantId: merchant._id.toString(),
        templateName: 'predelivery_confirmation',
        body: bodyText,
        hasDiscount: false,
      });

      // Increment monthly order metrics
      try {
        await Merchant.updateOne(
          { _id: merchant._id },
          { $inc: { 'billing.currentMonthOrders': 1 } }
        );
      } catch {}

      // Record BillingEvent
      await BillingEvent.create({
        merchantId: merchant._id,
        eventType: 'whatsapp_predelivery_sent',
        orderId: order._id,
        creditsCost: 1,
      });

      // Record Immutable Audit Log
      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'predelivery_confirmation_sent',
        source: 'pre_delivery_service',
        payload: {
          externalOrderId: order.externalOrderId,
          reason: evalResult.reason,
          pincode: order.shippingPincode,
          orderValue: order.orderValue,
          carrier: carrierName,
        },
        status: 'success',
      });

      // Realtime Telemetry Broadcast
      realtimeService.emitOrderUpdate(
        merchant._id.toString(),
        order.externalOrderId,
        'out_for_delivery',
        { preDeliverySent: true, triggerReason: evalResult.reason }
      );

      logger.info('Pre-delivery confirmation successfully dispatched', {
        orderId: order._id,
        externalOrderId: order.externalOrderId,
        phone: maskPhone(order.customerPhone),
      });

      return true;
    } catch (err: any) {
      logger.error('Failed to dispatch pre-delivery confirmation message', {
        orderId: order._id,
        externalOrderId: order.externalOrderId,
        error: err.message,
      });

      // Refund reserved credit on dispatch failure
      if (creditReserved) {
        try {
          await Merchant.updateOne(
            { _id: merchant._id },
            { $inc: { 'billing.rescueCredits': 1 } }
          );
        } catch {}
      }

      try {
        await AuditLog.create({
          merchantId: merchant._id,
          orderId: order._id,
          action: 'predelivery_confirmation_failed',
          source: 'pre_delivery_service',
          payload: { externalOrderId: order.externalOrderId, error: err.message },
          status: 'failed',
          error: err.message,
        });
      } catch {}

      return false;
    }
  }

  /**
   * Handles customer acknowledgment when they tap [✅ Yes, I'm home].
   */
  public async handleCustomerConfirmation(order: any, merchant: any): Promise<void> {
    if (!order) return;

    logger.info('Customer confirmed pre-delivery presence', {
      orderId: order._id,
      externalOrderId: order.externalOrderId,
    });

    if (!order.preDeliveryConfirmation) {
      order.preDeliveryConfirmation = {};
    }
    order.preDeliveryConfirmation.response = 'confirmed';
    order.preDeliveryConfirmation.respondedAt = new Date();
    await order.save();

    const merchantId = (order.merchantId || merchant?._id)?.toString();

    await AuditLog.create({
      merchantId: order.merchantId || merchant?._id,
      orderId: order._id,
      action: 'predelivery_confirmed_by_customer',
      source: 'whatsapp_webhook',
      payload: { externalOrderId: order.externalOrderId, response: 'confirmed' },
      status: 'success',
    });

    // Realtime update
    if (merchantId) {
      realtimeService.emitOrderUpdate(
        merchantId,
        order.externalOrderId,
        order.status,
        { preDeliveryResponse: 'confirmed' }
      );
    }

    // Send polite acknowledgment
    let waToken: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch {
        // use unencrypted fallback
      }
    }

    const waConfig = {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: waToken,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };

    const replyMsg = COPY.preDeliveryConfirmed();
    await whatsAppService.sendInteractiveButtons(
      order.customerPhone,
      replyMsg,
      [],
      waConfig
    );
  }
}

export const preDeliveryService = PreDeliveryService.getInstance();
