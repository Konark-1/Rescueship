/**
 * rto-arrest.service.ts
 * Enterprise RTO Arrest Engine.
 *
 * Intercepts shipments transitioning to 'rto_initiated' at local delivery hubs
 * before line-haul movement back to the origin begins. Dispatches high-urgency
 * customer WhatsApp intercept with isRtoArrest: true, and coordinates automated
 * carrier reattempt override when customer confirms delivery or completes payment.
 */

import { Types } from 'mongoose';
import { Order, Merchant, NdrCase, AuditLog, Shipment } from '../models';
import { whatsAppDispatcherService } from './whatsapp/whatsapp-dispatcher.service';
import { logisticsService, CarrierConfig } from './logistics.service';
import { orderStateMachineService } from './state-machine/order-state-machine.service';
import { encryptionService } from './encryption.service';
import { realtimeService } from './realtime.service';
import { logger, maskPhone } from '../utils/logger';

export interface RtoArrestParams {
  merchantId: string;
  orderId: string;
  awb?: string;
  reason?: string;
  carrier?: string;
}

export interface RtoArrestResult {
  success: boolean;
  arrestTriggered: boolean;
  message: string;
  reason?: string;
}

export interface RtoAbortOverrideParams {
  orderId: string;
  newDate?: string;
  reason?: string;
}

export class RtoArrestService {
  private static instance: RtoArrestService;

  private constructor() {}

  public static getInstance(): RtoArrestService {
    if (!RtoArrestService.instance) {
      RtoArrestService.instance = new RtoArrestService();
    }
    return RtoArrestService.instance;
  }

  /**
   * Main entrypoint to intercept an order entering rto_initiated state.
   */
  public async executeRtoArrest(params: RtoArrestParams): Promise<RtoArrestResult> {
    const { merchantId, orderId, awb, reason, carrier } = params;

    logger.info('Evaluating RTO Arrest for order', { merchantId, orderId, awb });

    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn('RTO Arrest skipped: Order not found', { orderId });
      return { success: false, arrestTriggered: false, message: `Order not found: ${orderId}` };
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      logger.warn('RTO Arrest skipped: Merchant not found', { merchantId: order.merchantId });
      return { success: false, arrestTriggered: false, message: 'Merchant not found' };
    }

    // ─── 1. Merchant Settings Gate ───
    if (merchant.settings?.ndrRescue?.rtoArrestEnabled === false) {
      logger.info('RTO Arrest disabled by merchant settings', { merchantId });
      return { success: false, arrestTriggered: false, message: 'RTO Arrest disabled by merchant' };
    }

    // ─── 2. Terminal State Guard ───
    if (orderStateMachineService.isTerminal(order.status)) {
      logger.info('RTO Arrest skipped: Order is already terminal', { orderId, status: order.status });
      return { success: false, arrestTriggered: false, message: `Order is already terminal: ${order.status}` };
    }

    // ─── 3. Deduplication / Idempotency Guard ───
    if (order.rtoArrestAttemptedAt) {
      logger.info('RTO Arrest already attempted for this order, skipping duplicate', { orderId });
      return { success: true, arrestTriggered: false, message: 'RTO Arrest already attempted' };
    }

    const existingArrestLog = await AuditLog.findOne({
      orderId: order._id,
      action: 'rto_arrest_triggered',
    });
    if (existingArrestLog) {
      logger.info('RTO Arrest log already exists for this order, skipping duplicate', { orderId });
      return { success: true, arrestTriggered: false, message: 'RTO Arrest already logged' };
    }

    // ─── 4. Mark RTO Arrest State on Order ───
    order.rtoArrestAttemptedAt = new Date();
    order.rtoArrestStatus = 'TRIGGERED';
    await order.save();

    // ─── 5. Update or Create NdrCase for Tracking ───
    try {
      let ndrCase = await NdrCase.findOne({ orderId: order._id });
      if (ndrCase) {
        ndrCase.status = 'OPEN';
        ndrCase.failureCategory = 'RTO_ARREST';
        ndrCase.failureReason = reason || 'Return to origin initiated by carrier';
        ndrCase.whatsappMessageSentAt = new Date();
        await ndrCase.save();
      } else {
        await NdrCase.create({
          orderId: order._id,
          merchantId: merchant._id,
          awb: awb || order.awb || 'UNKNOWN_AWB',
          externalOrderId: order.externalOrderId,
          customerPhone: order.customerPhone,
          failureReason: reason || 'Return to origin initiated by carrier',
          failureCategory: 'RTO_ARREST',
          whatsappMessageSentAt: new Date(),
          status: 'OPEN',
        });
      }
    } catch (caseErr: any) {
      logger.warn('Failed to update NdrCase for RTO Arrest', { error: caseErr?.message });
    }

    // ─── 6. Dispatch Urgent WhatsApp RTO Arrest Message ───
    let dispatchResult: any = { success: false };
    if (order.customerPhone) {
      try {
        dispatchResult = await whatsAppDispatcherService.dispatchNdrRescue({
          merchantId: merchant._id.toString(),
          orderId: order._id.toString(),
          phone: order.customerPhone,
          category: 'RTO_ARREST',
          isRtoArrest: true,
          variables: {
            customerName: order.customerName || 'Customer',
            externalOrderId: String(order.externalOrderId || ''),
            codAmount: String(order.orderValue || 0),
          },
        });
      } catch (waErr: any) {
        logger.error('Exception dispatching RTO Arrest WhatsApp message', {
          orderId: order._id,
          error: waErr.message,
        });
      }
    }

    // ─── 7. Record Audit Trail & Broadcast ───
    await AuditLog.create({
      merchantId: merchant._id,
      orderId: order._id,
      action: dispatchResult.success ? 'rto_arrest_triggered' : 'rto_arrest_failed',
      source: 'rto_arrest_service',
      payload: {
        awb: awb || order.awb,
        phone: maskPhone(order.customerPhone),
        carrier: carrier || order.carrier,
        reason,
        dispatchResult,
      },
      status: dispatchResult.success ? 'success' : 'failed',
    });

    realtimeService.broadcast({
      type: 'rto_arrest_triggered',
      merchantId: merchant._id.toString(),
      payload: {
        orderId: order.externalOrderId,
        awb: awb || order.awb,
        carrier: carrier || order.carrier,
        status: 'rto_initiated',
      },
      timestamp: new Date().toISOString(),
    });

    return {
      success: dispatchResult.success,
      arrestTriggered: true,
      message: dispatchResult.success
        ? 'RTO Arrest intercept successfully dispatched to customer'
        : `RTO Arrest recorded but WhatsApp dispatch failed or was suppressed: ${dispatchResult.suppressReason || dispatchResult.error || 'unknown'}`,
    };
  }

  /**
   * Abort carrier RTO and schedule delivery reattempt when customer confirms.
   */
  public async abortRtoAndReattempt(params: RtoAbortOverrideParams): Promise<{ success: boolean; message: string }> {
    const { orderId, newDate, reason } = params;

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${order.merchantId}`);
    }

    if (!order.awb || !order.carrier) {
      throw new Error('Order missing AWB or carrier information for RTO abort');
    }

    // 1. Resolve carrier credentials
    const cc: any = merchant.carrierConfig || {};
    let apiToken: string | undefined;
    let carrierEmail: string | undefined;
    let carrierPassword: string | undefined;

    try {
      if (cc.apiToken) apiToken = encryptionService.decrypt(cc.apiToken);
      else if (cc.apiKey) apiToken = encryptionService.decrypt(cc.apiKey);
      if (cc.email) carrierEmail = encryptionService.decrypt(cc.email);
      if (cc.password) carrierPassword = encryptionService.decrypt(cc.password);
    } catch (err: any) {
      logger.warn('Failed to decrypt carrier credentials for RTO abort override', { error: err?.message });
    }

    const carrierConfig: CarrierConfig = {
      provider: (order.carrier as any) || cc.provider,
      apiToken,
      email: carrierEmail,
      password: carrierPassword,
    };

    // 2. Call courier to reschedule / abort RTO
    const tomorrow = newDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const carrierRes = await logisticsService.rescheduleDelivery(
      order.carrier,
      {
        awb: order.awb,
        newDate: tomorrow,
        reason: reason || 'RTO Arrest: Customer confirmed delivery reattempt',
      },
      carrierConfig
    );

    // 3. Transition order status to ndr_rescued via state machine
    await orderStateMachineService.transitionOrder(order, 'ndr_rescued');

    order.rtoArrestStatus = 'RESCUED';
    await order.save();

    // 4. Update NdrCase
    await NdrCase.updateMany(
      { orderId: order._id, status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'CUSTOMER_RESPONDED'] } },
      {
        $set: {
          status: 'REATTEMPT_REQUESTED',
          resolutionType: 'rescheduled',
          reattemptRequestedAt: new Date(),
          carrierReattemptStatus: carrierRes.success ? 'SUCCESS' : 'MANUAL_REQUIRED',
        },
      }
    );

    // 5. Audit Log
    await AuditLog.create({
      merchantId: merchant._id,
      orderId: order._id,
      action: 'rto_arrest_courier_override',
      source: 'rto_arrest_service',
      payload: { awb: order.awb, carrier: order.carrier, carrierResponse: carrierRes },
      status: carrierRes.success ? 'success' : 'failed',
    });

    return {
      success: carrierRes.success,
      message: carrierRes.success
        ? 'RTO successfully aborted with carrier; delivery reattempt scheduled'
        : `Carrier returned non-success response on RTO abort: ${carrierRes.message}`,
    };
  }
}

export const rtoArrestService = RtoArrestService.getInstance();
