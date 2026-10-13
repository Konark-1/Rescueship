import { Types } from 'mongoose';
import axios from 'axios';
import { Merchant, Order, AuditLog, BillingEvent, NdrCase } from '../models';
import { whatsAppService } from './whatsapp.service';
import { paymentService } from './payment.service';
import { encryptionService } from './encryption.service';
import { recordOutbound } from './whatsapp-cost.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { realtimeService } from './realtime.service';
import { orderStateMachineService } from './state-machine/order-state-machine.service';
import { logisticsService } from './logistics.service';
import { rtoRiskService } from './rto-risk.service';
import { checkSubscriptionAccess } from '../utils/subscription-guard';
import { planAllows } from '../config/plans';
import { COPY } from '../i18n/customer-copy';
import { logger } from '../utils/logger';

export interface IncomingOrderData {
  externalOrderId: string;
  platform: 'shopify' | 'woocommerce' | 'custom';
  customerPhone: string;
  customerName?: string;
  orderValue: number;
  paymentMethod: 'cod' | 'prepaid';
  pincode?: string;
  city?: string;
  state?: string;
  shippingAddress?: any;
  /** Shopify order name (#1001) / number — carriers often send these instead of the id. */
  externalOrderName?: string | null;
  externalOrderNumber?: string | null;
}

export class OrderService {
  private static instance: OrderService;

  private constructor() {}

  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  /**
   * Process a new COD order webhook
   */
  public async processCODOrder(merchantId: string, orderData: IncomingOrderData): Promise<void> {
    logger.info('Processing new order for COD conversion', { merchantId, externalOrderId: orderData.externalOrderId });

    let creditReserved = false;
    try {
      const query = Merchant.findById(merchantId);
      const merchant = query && typeof (query as any).select === 'function'
        ? await (query as any).select('settings.codConversion billing paymentConfig whatsappConfig storeName platform accessExpiresAt licenseStatus')
        : await query;
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }

      // 🛡️ ZERO-LOOPHOLE SUBSCRIPTION & QUOTA CHECK
      const subCheck = checkSubscriptionAccess(merchant);
      if (!subCheck.allowed) {
        logger.warn('Order conversion blocked: Subscription inactive or quota exceeded', {
          merchantId,
          reason: subCheck.reason,
          externalOrderId: orderData.externalOrderId,
        });
        await AuditLog.create({
          merchantId: merchant._id,
          action: 'order_blocked_subscription_inactive',
          source: 'order_service',
          payload: { reason: subCheck.reason, externalOrderId: orderData.externalOrderId },
          status: 'failed',
        });
        return;
      }

      if (!merchant.settings?.codConversion?.enabled) {
        logger.info('COD conversion is disabled for merchant', { merchantId });
        return;
      }
      if (!planAllows(merchant, 'cod_conversion')) {
        logger.info('COD conversion not included in merchant plan', { merchantId, plan: merchant.billing?.plan });
        return;
      }

      if (merchant.billing.rescueCredits <= 0) {
        logger.info('Insufficient rescue credits for COD conversion', { merchantId });
        return;
      }

      if (merchant.billing.rescueCredits < 20) {
        logger.warn('Low rescue credits warning for merchant', { merchantId, credits: merchant.billing.rescueCredits });
        await AuditLog.create({
          merchantId: merchant._id,
          action: 'low_credits_warning',
          source: 'order_service',
          payload: { credits: merchant.billing.rescueCredits },
          status: 'success',
        });
      }

      if (orderData.paymentMethod !== 'cod') {
        logger.info('Order is not COD, skipping conversion', { externalOrderId: orderData.externalOrderId });
        return;
      }

      const minVal = merchant.settings.codConversion.minOrderValue || 0;
      if (orderData.orderValue < minVal) {
        logger.info('Order value is less than min order value threshold', {
          orderValue: orderData.orderValue,
          minVal,
        });
        return;
      }

      // ─── Atomic Credit Reservation (Prevents TOCTOU & Orphaned Payment Links) ───
      if (Merchant && typeof Merchant.findOneAndUpdate === 'function') {
        const reservedMerchant = await Merchant.findOneAndUpdate(
          {
            _id: merchant._id,
            'billing.rescueCredits': { $gt: 0 },
          },
          {
            $inc: { 'billing.rescueCredits': -1 },
          },
          { new: true }
        );

        if (!reservedMerchant) {
          logger.info('Insufficient credits to initiate COD conversion workflow', { merchantId });
          return;
        }
        creditReserved = true;
      } else {
        const updateRes = await Merchant.updateOne(
          { _id: merchant._id, 'billing.rescueCredits': { $gt: 0 } },
          { $inc: { 'billing.rescueCredits': -1 } }
        );
        if (updateRes.modifiedCount === 0) {
          logger.info('Insufficient credits to initiate COD conversion workflow', { merchantId });
          return;
        }
        creditReserved = true;
      }

      const normalizedPhone = normalizeIndianPhone(orderData.customerPhone);
      
      let riskAssessment;
      try {
        riskAssessment = await rtoRiskService.assessOrder(merchantId, {
          customerPhone: normalizedPhone,
          orderValue: orderData.orderValue,
          pincode: orderData.pincode || (orderData as any).shippingAddress?.pincode,
          address: typeof orderData.shippingAddress === 'string'
            ? orderData.shippingAddress
            : (orderData as any).shippingAddress?.fullAddress,
        });
      } catch (riskErr: any) {
        logger.warn('Failed to assess RTO risk during order processing', { error: riskErr?.message });
      }

      const pincode = orderData.pincode || (orderData as any).shippingAddress?.pincode || (orderData as any).shippingAddress?.zip || null;
      const city = orderData.city || (orderData as any).shippingAddress?.city || null;
      const state = orderData.state || (orderData as any).shippingAddress?.province || (orderData as any).shippingAddress?.state || null;
      let order;
      try {
        order = await Order.create({
          merchantId: merchant._id,
          externalOrderId: orderData.externalOrderId,
          platform: orderData.platform,
          customerPhone: normalizedPhone,
          customerName: orderData.customerName,
          orderValue: orderData.orderValue,
          paymentMethod: 'cod',
          shippingPincode: pincode,
          shippingCity: city,
          shippingState: state,
          shippingAddress: orderData.shippingAddress || null,
          externalOrderName: orderData.externalOrderName || null,
          externalOrderNumber: orderData.externalOrderNumber || null,
          failureSource: 'NONE',
          attemptCount: 0,
          status: 'new',
          ...(riskAssessment ? { rtoRisk: riskAssessment } : {}),
        });

        // Increment monthly orders count for plan quota enforcement
        await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.currentMonthOrders': 1 } });
      } catch (err: any) {
        if (err.code === 11000) {
          // A prior attempt created the order but failed before the message went out
          // (e.g. WhatsApp send error already reset it to 'new'). Resume instead of
          // silently dropping the conversion.
          const existing = await Order.findOne({ merchantId: merchant._id, externalOrderId: orderData.externalOrderId });
          if (!existing) {
            if (creditReserved) {
              await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
              creditReserved = false;
            }
            throw err;
          }
          if (existing.status !== 'new') {
            logger.info('Order already processed (duplicate index)', { externalOrderId: orderData.externalOrderId });
            if (creditReserved) {
              await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
              creditReserved = false;
            }
            return;
          }
          order = existing;
          logger.info('Resuming COD conversion for existing order after retry', { externalOrderId: orderData.externalOrderId });
        } else {
          if (creditReserved) {
            await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
            creditReserved = false;
          }
          throw err;
        }
      }

      // 🛡️ Pincode Guard Check: Intercept and mandate advance deposit / prepaid conversion
      const { pincodeGuardService } = await import('./pincode-guard.service');
      const isGuardHeld = planAllows(merchant, 'pincode_guard')
        ? await pincodeGuardService.checkAndHoldIfRequired(merchant, order, normalizedPhone)
        : false;
      if (isGuardHeld) {
        logger.info('Order placed on hold by Pincode Guard; skipping generic COD conversion', {
          merchantId,
          orderId: order._id,
          pincode: order.shippingPincode,
        });
        return;
      }

      let discount = 0;
      const codConv = merchant.settings?.codConversion;
      const incentiveType = codConv?.incentiveType || 'none';
      const incentiveAmount = codConv?.incentiveAmount || 0;
      const discountCap = codConv?.discountCap;

      if (codConv?.enabled !== false && incentiveType !== 'none') {
        if (incentiveType === 'flat') {
          discount = incentiveAmount;
        } else if (incentiveType === 'percentage') {
          let pctDiscount = Math.round((orderData.orderValue * incentiveAmount) / 100);
          if (discountCap && discountCap > 0) {
            pctDiscount = Math.min(pctDiscount, discountCap);
          }
          discount = pctDiscount;
        }
      }

      const finalAmount = orderData.orderValue - discount;

      // 🛡️ VECTOR 2 FIX: Negative Paise Trap
      if (finalAmount <= 0) {
        logger.warn('COD conversion aborted: Discount equals or exceeds order value', {
          merchantId,
          externalOrderId: orderData.externalOrderId,
          orderValue: orderData.orderValue,
          discount,
          finalAmount,
        });

        if (creditReserved) {
          await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
          creditReserved = false;
        }
        await Order.deleteOne({ _id: order._id }).catch(() => {});
        return;
      }

      // The customer's money must land in the MERCHANT's gateway account. Never fall back
      // to platform keys, and never treat undecryptable ciphertext as a credential.
      const pc: any = merchant.paymentConfig || {};
      const paymentProvider: 'razorpay' | 'cashfree' = pc.provider || pc.gateway || 'razorpay';
      const { paymentWebhookReady } = require('./payment-guard');
      if (!pc.keyId || !pc.keySecret || !paymentWebhookReady(merchant)) {
        logger.warn('COD conversion skipped: payment gateway not connected or its webhook is not verified yet', { merchantId });
        if (creditReserved) {
          await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
          creditReserved = false;
        }
        await Order.deleteOne({ _id: order._id });
        return;
      }
      let keyId: string;
      let keySecret: string;
      try {
        keyId = encryptionService.decrypt(pc.keyId);
        keySecret = encryptionService.decrypt(pc.keySecret);
      } catch (decErr: any) {
        logger.error('Stored payment gateway credentials cannot be decrypted; merchant must reconnect payment gateway', { merchantId });
        if (creditReserved) {
          await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
          creditReserved = false;
        }
        await Order.deleteOne({ _id: order._id });
        throw new Error('Payment credentials require reconnection');
      }

      let paymentLink;
      try {
        paymentLink = await paymentService.createPaymentLink(
          paymentProvider,
          {
            amount: finalAmount,
            currency: 'INR',
            description: `Order #${orderData.externalOrderId} Prepaid Upgrade`,
            customerName: orderData.customerName || 'Customer',
            customerPhone: normalizedPhone.startsWith('91') ? `+${normalizedPhone}` : normalizedPhone,
            orderId: orderData.externalOrderId,
            expiresInMinutes: 1440,
          },
          paymentProvider === 'razorpay'
            ? { keyId, keySecret }
            : { clientId: keyId, clientSecret: keySecret }
        );
      } catch (err: any) {
        // Never send a fabricated payment link to a real customer. Simulation is only
        // for automated tests, where the gateway is mocked.
        if (process.env.NODE_ENV === 'test') {
          paymentLink = { linkId: `plink_sim_${Date.now()}`, shortUrl: `https://pay.rescueship.io/l/${orderData.externalOrderId}` };
        } else {
          if (creditReserved) {
            await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
            creditReserved = false;
          }
          await Order.deleteOne({ _id: order._id });
          throw err;
        }
      }

      try {
        await paymentService.generateQRCode(paymentLink.shortUrl);
        logger.info('Generated UPI QR Code for COD conversion link', { externalOrderId: orderData.externalOrderId });
      } catch (qrErr: any) {
        logger.warn('Failed to generate UPI QR code for payment link', { error: qrErr.message });
      }

      if (order.status !== 'cod_conversion_sent') {
        await orderStateMachineService.transitionOrder(order, 'cod_conversion_sent');
      }
      order.paymentLinkId = paymentLink.linkId;
      order.paymentLinkUrl = paymentLink.shortUrl;
      order.codConversion = {
        messageSentAt: new Date(),
        incentiveOffered: discount,
        convertedAt: null,
      };
      await order.save();

      let waToken: string | undefined;
      if (merchant.whatsappConfig?.accessToken) {
        try {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        } catch (decErr: any) {
          logger.error('Stored WhatsApp token cannot be decrypted; merchant must reconnect WhatsApp', { merchantId });
          throw new Error('WhatsApp credentials require reconnection');
        }
      }

      const lang = merchant.settings.codConversion.messageLanguage || 'en';
      const hasDiscount = discount > 0;
      // Registered names (meta-template.service): utility framing (no incentive) or
      // marketing framing (with incentive): cod_confirm_en {customer, order, url}
      // vs cod_convert_en {customer, order, discount, url}. Only 'en' templates exist today.
      const templateName = hasDiscount ? 'cod_convert_en' : 'cod_confirm_en';

      const components: any[] = [
        {
          type: 'body',
          parameters: hasDiscount
            ? [
                { type: 'text', text: order.customerName || 'Customer' },
                { type: 'text', text: String(order.externalOrderId) },
                { type: 'text', text: `₹${discount}` },
              ]
            : [
                { type: 'text', text: order.customerName || 'Customer' },
                { type: 'text', text: String(order.externalOrderId) },
              ],
        },
        {
          type: 'button',
          index: '0',
          sub_type: 'url',
          // The template's URL button is a fixed redirector + a single trailing variable;
          // the payment link id (not the full short_url) is the dynamic suffix.
          parameters: [
            { type: 'text', text: paymentLink.linkId },
          ],
        },
      ];

      try {
        await whatsAppService.sendTemplate(
          order.customerPhone,
          templateName,
          lang,
          components,
          {
            phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
            accessToken: waToken,
            businessAccountId: merchant.whatsappConfig?.businessAccountId,
          }
        );
        logger.info('Dispatched COD conversion template via WhatsApp API', {
          phone: order.customerPhone,
          orderId: order.externalOrderId,
        });
      } catch (waErr: any) {
        // Do not charge a credit or record a "sent" event for a message that never left.
        logger.error('WhatsApp COD conversion send failed', { merchantId, orderId: order.externalOrderId, error: waErr.message });
        if (creditReserved) {
          await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.rescueCredits': 1 } });
          creditReserved = false;
        }
        await Order.updateOne({ _id: order._id }, { $set: { status: 'new', 'codConversion.messageSentAt': null } });
        await AuditLog.create({
          merchantId: merchant._id,
          orderId: order._id,
          action: 'cod_conversion_send_failed',
          source: 'order_service',
          payload: { externalOrderId: orderData.externalOrderId },
          status: 'failed',
          error: waErr.message,
        });
        throw waErr;
      }

      realtimeService.emitOrderUpdate(
        merchant._id.toString(),
        order.externalOrderId,
        'cod_conversion_sent',
        { discount, paymentUrl: paymentLink.shortUrl }
      );

      await recordOutbound({
        orderId: order._id.toString(),
        merchantId: order.merchantId.toString(),
        templateName,
        body: `Convert COD order #${order.externalOrderId} with ₹${discount} discount: ${paymentLink.shortUrl}`,
        hasDiscount: discount > 0,
      });

      // Credit was already atomically reserved upfront before external API calls
      creditReserved = false;

      // The order entered the automation workflow — meter it against the
      // monthly plan quota (billing.currentMonthOrders). Non-fatal on failure.
      try {
        await Merchant.updateOne({ _id: merchant._id }, { $inc: { 'billing.currentMonthOrders': 1 } });
      } catch (incErr: any) {
        logger.warn('Failed to increment monthly order usage (non-fatal)', { merchantId, error: incErr.message });
      }

      await BillingEvent.create({
        merchantId: merchant._id,
        eventType: 'whatsapp_template_sent',
        orderId: order._id,
        creditsCost: 1,
      });

      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'cod_conversion_sent',
        source: 'order_service',
        payload: { externalOrderId: orderData.externalOrderId, paymentLinkId: paymentLink.linkId, discount },
        status: 'success',
      });
    } catch (err: any) {
      if (creditReserved) {
        let refundSuccess = false;

        // Exponential backoff retry loop for credit refund
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await Merchant.updateOne({ _id: merchantId }, { $inc: { 'billing.rescueCredits': 1 } });
            refundSuccess = true;
            break;
          } catch (compErr: any) {
            logger.error(`Credit refund attempt ${attempt}/3 failed`, { error: compErr.message });
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }

        // Fallback: Record orphaned credit for nightly reconciliation cron
        if (!refundSuccess) {
          try {
            await AuditLog.create({
              merchantId: new Types.ObjectId(merchantId),
              action: 'orphaned_credit_refund_required',
              source: 'order_service',
              payload: { externalOrderId: orderData.externalOrderId, creditsLost: 1, reason: err.message },
              status: 'failed',
              error: 'All inline refund attempts failed. Manual reconciliation required.',
            });
          } catch (logErr: any) {
            logger.error('Failed to create orphaned credit audit log', { error: logErr?.message });
          }
        }
        creditReserved = false;
      }
      logger.error('Failed to process COD order conversion', { externalOrderId: orderData.externalOrderId, error: err.message });
      throw err;
    }
  }

  /**
   * Handle successful payment webhook event
   */
  public async handlePaymentSuccess(paymentLinkId: string, amountPaidPaise: number, paymentId?: string): Promise<void> {
    logger.info('Handling payment success for COD conversion', { paymentLinkId, amountPaidPaise });

    const order = await Order.findOne({
      $or: [{ paymentLinkId }, { depositPaymentLinkId: paymentLinkId }],
    });
    if (!order) {
      logger.warn('No order found matching paymentLinkId', { paymentLinkId });
      return;
    }

    if (order.status === 'converted_to_prepaid' || order.status === 'ndr_rescued' || order.status === 'confirmed') {
      const priorLink = order.codConversion?.paymentLinkId || (order as any).depositTransactionId;
      if (priorLink && priorLink !== paymentLinkId) {
        // The customer paid a second link for the same order: that money must go back.
        const { refundService } = require('./refund.service');
        await refundService.flag(order, amountPaidPaise / 100, 'duplicate_payment', { paymentLinkId, paymentId });
        return;
      }
      logger.info('Order already converted to prepaid, confirmed, or rescued, duplicate webhook event', { paymentLinkId });
      return;
    }
    if (['cancelled', 'delivered', 'returned'].includes(order.status as string)) {
      // Paid after the order was closed: record the payment and queue a refund for approval.
      await Order.updateOne({ _id: order._id }, { $set: { 'codConversion.amountPaid': amountPaidPaise / 100, 'codConversion.paymentLinkId': paymentLinkId, ...(paymentId ? { 'codConversion.paymentId': paymentId } : {}) } });
      const { refundService } = require('./refund.service');
      await refundService.flag(order, amountPaidPaise / 100, `paid_after_${order.status}`, { paymentLinkId, paymentId });
      return;
    }

    const previousStatus = order.status;

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${order.merchantId}`);
    }

    const discount = order.codConversion?.incentiveOffered || 0;
    const expectedAmountInr = Math.max(1, order.orderValue - discount);
    const expectedPaise = Math.round(expectedAmountInr * 100);

    const isNdrOrder = (order.status || '').startsWith('ndr_') || order.status === 'rto_initiated' || order.status === 'rto';
    const isDepositOrder =
      order.status === 'awaiting_deposit' ||
      order.status === 'awaiting_prepaid_conversion' ||
      (order as any).pincodeHoldReason === 'require_deposit' ||
      (order as any).pincodeHoldReason === 'force_prepaid';

    const depositAmount = (order as any).depositAmount || (order.pincodeHoldReason === 'force_prepaid' ? order.orderValue : 50);
    const expectedDepositPaise = Math.round(depositAmount * 100);
    const partialAmount = (merchant as any).settings?.partialPay?.amount || 49;
    const expectedPartialPaise = Math.round(partialAmount * 100);

    const isUnderpaid = isDepositOrder
      ? !amountPaidPaise || amountPaidPaise < expectedDepositPaise
      : isNdrOrder
      ? !amountPaidPaise || (amountPaidPaise < expectedPartialPaise && amountPaidPaise < expectedPaise)
      : !amountPaidPaise || amountPaidPaise < expectedPaise;

    if (isUnderpaid) {
      logger.error('Payment amount mismatch: payment was missing or underpaid', {
        paymentLinkId,
        expectedPaise: isDepositOrder ? expectedDepositPaise : expectedPaise,
        amountPaidPaise,
      });
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'payment_amount_mismatch',
        source: 'payment_webhook',
        payload: { expectedPaise: isDepositOrder ? expectedDepositPaise : expectedPaise, amountPaidPaise },
        status: 'failed',
        error: 'Payment amount mismatch: underpaid or missing',
      });
      return;
    }

    // Full payment = the whole amount the customer owed after discount. Anything less
    // (deposit, partial pay) keeps the order COD with a reduced collectable balance.
    const isFullPayment = amountPaidPaise >= expectedPaise;
    const amountPaidInr = amountPaidPaise / 100;
    const nextStatus = isDepositOrder ? 'confirmed' : isNdrOrder ? 'ndr_rescued' : isFullPayment ? 'converted_to_prepaid' : 'cod_conversion_sent';
    const rtoFeeSaved = (merchant as any)?.settings?.estimatedRtoLossPerOrder || 140;

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: {
          $in: [
            'awaiting_deposit',
            'awaiting_prepaid_conversion',
            'cod_conversion_sent',
            'ndr_detected',
            'ndr_rescue_sent',
            'ndr_pending_review',
            'rto_initiated',
            'rto',
            'new',
            'shipped',
          ],
        },
      },
      {
        $set: {
          status: nextStatus,
          paid: isFullPayment,
          paymentMethod: isFullPayment ? 'prepaid' : order.paymentMethod,
          'codConversion.amountPaid': amountPaidInr,
          'codConversion.paymentLinkId': paymentLinkId,
          ...(paymentId ? { 'codConversion.paymentId': paymentId } : {}),
          ...(isFullPayment && { 'codConversion.convertedAt': new Date() }),
          ...(isDepositOrder && {
            depositPaidAt: new Date(),
            depositTransactionId: paymentLinkId,
          }),
          ...(isNdrOrder && {
            rtoFeeSaved,
            'ndr.resolvedAt': new Date(),
            'ndr.resolution': 'rescheduled',
            'ndr.customerResponse': 'paid_online',
          }),
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      logger.warn('Order status transition race condition or order already converted', { orderId: order._id });
      // The money is real even if the transition lost a race; make sure it is accounted for.
      const fresh: any = await Order.findById(order._id);
      if (fresh && ['cancelled', 'delivered', 'returned'].includes(fresh.status) && !(fresh.codConversion?.amountPaid > 0)) {
        await Order.updateOne({ _id: order._id }, { $set: { 'codConversion.amountPaid': amountPaidInr, 'codConversion.paymentLinkId': paymentLinkId, ...(paymentId ? { 'codConversion.paymentId': paymentId } : {}) } });
        const { refundService } = require('./refund.service');
        await refundService.flag(fresh, amountPaidInr, `paid_after_${fresh.status}`, { paymentLinkId, paymentId });
      }
      return;
    }

    if (isNdrOrder) {
      try {
        await NdrCase.findOneAndUpdate(
          { orderId: updatedOrder._id, status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'CUSTOMER_RESPONDED'] } },
          {
            $set: {
              status: 'CUSTOMER_RESPONDED',
              customerResponseType: 'PAYMENT',
              customerResponseAt: new Date(),
              resolutionType: 'PAID_PREPAID',
              rtoFeeSaved,
              estimatedLossPrevented: rtoFeeSaved,
            },
          }
        );
      } catch (caseErr: any) {
        logger.warn('Failed to update NdrCase rtoFeeSaved on payment', { error: caseErr?.message });
      }
    }

    await Merchant.findByIdAndUpdate(order.merchantId, {
      $inc: { 'billing.totalConversions': 1 },
    });

    realtimeService.emitCodConverted(
      order.merchantId.toString(),
      order.externalOrderId,
      order.orderValue - discount
    );

    await this.markOrderAsPaidOnPlatform(updatedOrder, merchant, amountPaidInr, isFullPayment);

    // Amend courier COD amount (doorstep balance update)
    try {
      const { codAdjustmentService } = require('./courier/cod-adjustment.service');
      const paidInr = amountPaidPaise / 100;
      await codAdjustmentService.adjustCodAmount({
        orderId: updatedOrder._id.toString(),
        paymentId: paymentLinkId,
        paidAmountInInr: paidInr,
      });
    } catch (codErr: any) {
      logger.warn('Failed to adjust COD amount with courier after payment', { error: codErr?.message });
    }

    // If order was in NDR, rto_initiated, or rto state, trigger courier reattempt / RTO abort automatically
    if (isNdrOrder && updatedOrder.carrier && updatedOrder.awb) {
      try {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const carrierConfig = this.getCarrierConfig(merchant, updatedOrder.carrier);

        const reason = (previousStatus === 'rto' || previousStatus === 'rto_initiated')
          ? 'Customer paid online. RTO aborted by RescueShip.'
          : 'Customer paid online via WhatsApp NDR link. Reattempt scheduled.';

        await logisticsService.rescheduleDelivery(
          updatedOrder.carrier,
          {
            awb: updatedOrder.awb,
            newDate: tomorrow,
            reason,
          },
          carrierConfig
        );

        if (previousStatus === 'rto' || previousStatus === 'rto_initiated' || updatedOrder.rtoArrestStatus === 'TRIGGERED') {
          const { rtoArrestService } = require('./rto-arrest.service');
          try {
            await rtoArrestService.abortRtoAndReattempt({
              orderId: updatedOrder._id.toString(),
              newDate: tomorrow,
              reason: 'Customer paid online via UPI. RTO arrested and aborted by RescueShip.',
            });
          } catch (rtoErr: any) {
            logger.warn('rtoArrestService abortRtoAndReattempt failed, falling back to direct courier reschedule', { error: rtoErr?.message });
          }

          await AuditLog.create({
            merchantId: merchant._id,
            orderId: updatedOrder._id,
            action: 'rto_aborted_via_payment',
            source: 'payment_webhook',
            payload: { previousStatus, awb: updatedOrder.awb },
            status: 'success',
          });
        }
      } catch (reattemptErr: any) {
        logger.warn('Failed to schedule courier reattempt or abort RTO after payment confirmation', { error: reattemptErr?.message });
      }
    }

    await AuditLog.create({
      merchantId: order.merchantId,
      orderId: order._id,
      action: isNdrOrder ? 'ndr_cod_converted_to_prepaid' : 'cod_converted_to_prepaid',
      source: 'payment_webhook',
      payload: { paymentLinkId, amountPaidPaise, isNdrOrder },
      status: 'success',
    });
  }

  public getCarrierConfig(merchant: any, carrier?: string): any {
    const cc: any = merchant?.carrierConfig || {};
    const targetCarrier = carrier || cc.provider;
    const specific: any = cc.carriers?.[targetCarrier] || (cc.provider === targetCarrier ? cc : {});

    let apiToken: string | undefined;
    let apiKey: string | undefined;
    let email: string | undefined;
    let password: string | undefined;
    let username: string | undefined;
    let customerCode: string | undefined;
    let licenseKey: string | undefined;
    let loginId: string | undefined;

    try {
      if (specific.apiToken) apiToken = encryptionService.decrypt(specific.apiToken);
      if (specific.apiKey) apiKey = encryptionService.decrypt(specific.apiKey);
      if (specific.email) email = encryptionService.decrypt(specific.email);
      if (specific.password) password = encryptionService.decrypt(specific.password);
      if (specific.username) username = encryptionService.decrypt(specific.username);
      if (specific.customerCode) customerCode = encryptionService.decrypt(specific.customerCode);
      if (specific.licenseKey) licenseKey = encryptionService.decrypt(specific.licenseKey);
      if (specific.loginId) loginId = encryptionService.decrypt(specific.loginId);
    } catch {
      // Proceed with defaults / fallback
    }

    return {
      provider: targetCarrier,
      mode: specific.mode,
      apiToken: apiToken || apiKey,
      apiKey: apiKey || apiToken,
      // Merchant's own credentials only — never the platform's courier account.
      email,
      password,
      username,
      customerCode,
      licenseKey,
      loginId,
    };
  }

  public async handlePaymentConfirmation(paymentLinkId: string, amountPaidPaise: any, paymentId?: string): Promise<void> {
    const amount = Number(amountPaidPaise);
    if (!Number.isFinite(amount) || amount <= 0) {
      // Fail the job loud so BullMQ retries / dead-letters it and operators can see it,
      // instead of silently succeeding and leaving the order stuck in cod_conversion_sent.
      throw new Error(`Missing or invalid payment amount for payment link ${paymentLinkId}`);
    }
    return this.handlePaymentSuccess(paymentLinkId, amount, typeof paymentId === 'string' ? paymentId.slice(0, 64) : undefined);
  }

  public async sendCODReminder(orderId: string): Promise<void> {
    logger.info('Evaluating COD reminder dispatch', { orderId });
    const order = await Order.findById(orderId);
    if (!order || order.paymentMethod !== 'cod') {
      logger.info('COD reminder skipped: order not found or not COD', { orderId });
      return;
    }

    // Do not remind terminal or already converted orders
    const nonEligibleStatuses = ['converted_to_prepaid', 'delivered', 'rto', 'returned', 'cancelled', 'lost'];
    if (nonEligibleStatuses.includes(order.status)) {
      logger.info('COD reminder skipped: order status not eligible', { orderId, status: order.status });
      return;
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      logger.warn('COD reminder aborted: merchant not found', { orderId, merchantId: order.merchantId });
      return;
    }

    // Global pause guard
    if (merchant.settings?.globalPause) {
      logger.info('COD reminder skipped: merchant global pause active', { orderId });
      return;
    }

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

    const message = COPY.codReminder({
      name: order.customerName || 'Customer',
      orderId: order.externalOrderId,
      amount: order.orderValue,
    });

    const buttons = [
      ...(order.paymentLinkId ? [{ id: `pay_now:${order._id}`, title: '💳 Pay via UPI' }] : []),
      { id: `keep_cod:${order._id}`, title: '💵 Keep COD' },
    ];

    try {
      await whatsAppService.sendInteractiveButtons(
        order.customerPhone,
        message,
        buttons,
        waConfig
      );

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'cod_reminder_sent',
        source: 'order_service',
        payload: { externalOrderId: order.externalOrderId, orderValue: order.orderValue },
        status: 'success',
      });

      logger.info('COD reminder successfully dispatched', {
        orderId: order._id,
        externalOrderId: order.externalOrderId,
      });
    } catch (err: any) {
      logger.error('Failed to dispatch COD reminder via WhatsApp', {
        orderId: order._id,
        error: err.message,
      });
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'cod_reminder_failed',
        source: 'order_service',
        payload: { externalOrderId: order.externalOrderId, error: err.message },
        status: 'failed',
      });
    }
  }

  public async markOrderAsPaidOnPlatform(order: any, merchant?: any, amountPaidInr?: number, isFullPayment = true): Promise<void> {
    if (!merchant && order?.merchantId) {
      merchant = await Merchant.findById(order.merchantId);
    }
    return this.syncOrderToPlatform(order, merchant, amountPaidInr, isFullPayment);
  }

  private async syncOrderToPlatform(order: any, merchant: any, amountPaidInr?: number, isFullPayment = true): Promise<void> {
    try {
      // Shopify credentials may live under `merchant.shopify` (OAuth / direct-token connect)
      // or the legacy `platformConfig` (manual settings). Prefer the connect flow's copy.
      const { getShopifyAccess } = require('./shopify-admin');
      const shopifyCreds = merchant && order?.platform === 'shopify' ? await getShopifyAccess(merchant) : null;
      const wcCreds = merchant ? this.resolveWooCommerceCredentials(merchant) : null;
      if (order && merchant && order.platform === 'woocommerce' && wcCreds) {
        await this.syncWooCommerceOrder(order, wcCreds, amountPaidInr, isFullPayment);
        return;
      }
      if (order && merchant && order.platform === 'shopify' && shopifyCreds) {
        const domain = shopifyCreds.domain;

        // 🔒 SEC-01 FIX: Defense-in-depth domain validation before outbound request
        const SHOPIFY_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
        if (!SHOPIFY_DOMAIN_REGEX.test(domain)) {
          logger.error('CRITICAL: Aborting Shopify sync due to invalid domain format (SSRF Protection)', { domain });
          return;
        }

        const externalOrderId = order.externalOrderId;

        // 🔒 SEC-04 FIX: Strict Alphanumeric Validation & URL Encoding
        if (!externalOrderId || !/^[a-zA-Z0-9_-]+$/.test(String(externalOrderId))) {
          logger.warn('Aborting Shopify sync: Invalid externalOrderId format (Path Traversal Protection)', { externalOrderId });
          return;
        }

        const token: string = shopifyCreds.token;
        const { markShopifyOrderPaid, addShopifyOrderTags } = require('./shopify-admin');
        const discount = order.codConversion?.incentiveOffered || 0;
        const paid = typeof amountPaidInr === 'number' ? amountPaidInr : Math.max(0, order.orderValue - discount);

        if (isFullPayment) {
          // Record the external payment for the outstanding balance (GraphQL orderMarkAsPaid).
          await markShopifyOrderPaid(domain, token, externalOrderId);
          await addShopifyOrderTags(domain, token, externalOrderId, ['RescueShip_Prepaid', `RescueShip_Paid_${Math.round(paid)}`]);
        } else {
          // Partial payment: never mark the order paid — only tag it with the real amount.
          await addShopifyOrderTags(domain, token, externalOrderId, ['RescueShip_Partial_Payment', `RescueShip_Paid_${Math.round(paid)}`]);
        }

        logger.info('Synced RescueShip payment to Shopify', { orderId: externalOrderId, paid, isFullPayment });
      }
    } catch (err: any) {
      logger.error('Failed to sync order status to platform', { orderId: order?.externalOrderId, error: err.message });
    }
  }

  /** Resolve + decrypt the WooCommerce REST API credentials stored by the connect flow / settings. */
  private resolveWooCommerceCredentials(merchant: any): { url: string; key: string; secret: string } | null {
    const pc = merchant?.platformConfig;
    if (!pc?.woocommerceUrl || !pc?.woocommerceKey || !pc?.woocommerceSecret) return null;
    let key: string, secret: string;
    try {
      key = encryptionService.decrypt(pc.woocommerceKey);
      secret = encryptionService.decrypt(pc.woocommerceSecret);
    } catch {
      logger.error('Stored WooCommerce credentials cannot be decrypted; merchant must reconnect WooCommerce', { merchantId: merchant?._id });
      return null;
    }
    return { url: String(pc.woocommerceUrl).replace(/\/+$/, ''), key, secret };
  }

  /** After a successful prepaid conversion, mark the WooCommerce order paid + attach a note. */
  private async syncWooCommerceOrder(order: any, creds: { url: string; key: string; secret: string }, amountPaidInr?: number, isFullPayment = true): Promise<void> {
    const externalOrderId = String(order.externalOrderId || '');
    if (!/^[0-9]+$/.test(externalOrderId)) {
      logger.warn('Aborting WooCommerce sync: invalid externalOrderId', { externalOrderId });
      return;
    }
    const discount = order.codConversion?.incentiveOffered || 0;
    const paid = typeof amountPaidInr === 'number' ? amountPaidInr : Math.max(0, order.orderValue - discount);
    const auth = { username: creds.key, password: creds.secret };

    if (isFullPayment) {
      // WooCommerce 'processing' = paid but not yet shipped.
      await axios.put(
        `${creds.url}/wp-json/wc/v3/orders/${externalOrderId}`,
        { status: 'processing', transaction_id: `rs_${externalOrderId}` },
        { auth, timeout: 10000 }
      );
    }

    await axios.post(
      `${creds.url}/wp-json/wc/v3/orders/${externalOrderId}/notes`,
      { note: isFullPayment
        ? `RescueShip: customer paid ₹${paid} online (discount ₹${discount}). Order is prepaid.`
        : `RescueShip: customer paid ₹${paid} online as a partial payment. Remaining balance stays cash on delivery.` },
      { auth, timeout: 10000 }
    ).catch((err: any) => {
      logger.warn('Failed to add WooCommerce order note', { orderId: externalOrderId, error: err.message });
    });

    logger.info('Synced RescueShip payment to WooCommerce', { orderId: externalOrderId, paid, isFullPayment });
  }

  /**
   * Generates a retention UPI payment link for COD orders in the NDR rescue flow.
   * Gated by merchant payment credentials and tied directly to the merchant gateway.
   */
  public async generateRetentionPaymentLink(
    order: any,
    merchant: any,
    finalAmount?: number,
    discount?: number
  ): Promise<{ linkId: string; shortUrl: string } | null> {
    const { canOfferOnlinePayment } = require('./payment-guard');
    const guard = canOfferOnlinePayment(order, merchant);
    if (!guard.ok) {
      logger.info('Retention payment link not generated (payment guard)', { orderId: order?._id, reason: guard.reason });
      return null;
    }
    const codConv = merchant?.settings?.codConversion;
    const incentiveType = codConv?.incentiveType || 'percentage';
    const incentiveAmount = codConv?.incentiveAmount ?? 5;
    const discountCap = codConv?.discountCap;

    let computedDiscount: number;
    if (discount !== undefined) {
      computedDiscount = discount;
    } else if (codConv?.enabled === false || incentiveType === 'none') {
      computedDiscount = 0;
    } else if (incentiveType === 'flat') {
      computedDiscount = incentiveAmount;
    } else if (incentiveType === 'percentage') {
      let pctDiscount = Math.round(((order.orderValue || 0) * incentiveAmount) / 100);
      if (discountCap && discountCap > 0) {
        pctDiscount = Math.min(pctDiscount, discountCap);
      }
      computedDiscount = pctDiscount;
    } else {
      computedDiscount = 0;
    }

    const minVal = codConv?.minOrderValue || 0;
    if ((order.orderValue || 0) < minVal) {
      computedDiscount = 0;
    }

    const computedFinalAmount: number =
      finalAmount !== undefined
        ? finalAmount
        : (order.orderValue || 0) - computedDiscount;

    // 🛡️ ANTI-EXPLOITATION GUARD: Never generate payment link if finalAmount <= 0
    if (computedFinalAmount <= 0) {
      logger.warn('Retention payment link rejected: finalAmount <= 0', {
        orderId: order._id,
        orderValue: order.orderValue,
        discount: computedDiscount,
        finalAmount: computedFinalAmount,
      });
      return null;
    }

    const pc: any = merchant?.paymentConfig || {};
    const paymentProvider: 'razorpay' | 'cashfree' = pc.provider || pc.gateway || 'razorpay';

    if (!pc.keyId || !pc.keySecret) {
      if (process.env.NODE_ENV === 'test') {
        const simLink = {
          linkId: `plink_ret_${Date.now()}`,
          shortUrl: `https://pay.rescueship.io/retention/${order.externalOrderId}`,
        };
        order.paymentLinkId = simLink.linkId;
        if (!order.codConversion) order.codConversion = {} as any;
        order.codConversion.paymentLinkId = simLink.linkId;
        order.codConversion.incentiveOffered = computedDiscount;
        if (typeof order.save === 'function') await order.save();
        return simLink;
      }
      logger.warn('Retention payment link skipped: merchant has no connected payment gateway', {
        merchantId: merchant?._id,
      });
      return null;
    }

    let keyId: string;
    let keySecret: string;
    try {
      keyId = encryptionService.decrypt(pc.keyId);
      keySecret = encryptionService.decrypt(pc.keySecret);
    } catch (err: any) {
      logger.error('Failed to decrypt gateway keys for retention link', { merchantId: merchant?._id });
      return null;
    }

    const normalizedPhone = normalizeIndianPhone(order.customerPhone);
    try {
      const paymentLink = await paymentService.createPaymentLink(
        paymentProvider,
        {
          amount: computedFinalAmount,
          currency: 'INR',
          description: `Order #${order.externalOrderId} Priority Fast-Track`,
          customerName: order.customerName || 'Customer',
          customerPhone: normalizedPhone.startsWith('91') ? `+${normalizedPhone}` : normalizedPhone,
          orderId: order.externalOrderId,
          expiresInMinutes: 1440,
        },
        paymentProvider === 'razorpay'
          ? { keyId, keySecret }
          : { clientId: keyId, clientSecret: keySecret }
      );

      if (paymentLink?.linkId) {
        order.paymentLinkId = paymentLink.linkId;
        if (!order.codConversion) order.codConversion = {} as any;
        order.codConversion.paymentLinkId = paymentLink.linkId;
        order.codConversion.incentiveOffered = computedDiscount;
        if (typeof order.save === 'function') await order.save();
      }

      return paymentLink;
    } catch (linkErr: any) {
      // Never invent a fallback URL: the customer would pay somewhere the merchant's
      // gateway (and our signed webhook) never sees. Caller falls back to reschedule/keep-COD.
      logger.error('Failed to create retention payment link', { orderId: order._id, error: linkErr.message });
      return null;
    }
  }
}

export const orderService = OrderService.getInstance();
