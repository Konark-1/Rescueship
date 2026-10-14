import { paymentWebhookReady } from './payment-guard';
import { IMerchant, IOrder, Order, AuditLog } from '../models';
import { paymentService } from './payment.service';
import { whatsAppService } from './whatsapp.service';
import { encryptionService } from './encryption.service';
import { logger } from '../utils/logger';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';

export class PincodeGuardService {
  private static instance: PincodeGuardService;

  private constructor() {}

  public static getInstance(): PincodeGuardService {
    if (!PincodeGuardService.instance) {
      PincodeGuardService.instance = new PincodeGuardService();
    }
    return PincodeGuardService.instance;
  }

  /**
   * Evaluates incoming orders against merchant pincode guard rules.
   * If a matching rule mandates ₹50 advance or forces prepaid:
   * 1. Places order on hold (status: 'awaiting_deposit' or 'awaiting_prepaid_conversion')
   * 2. Generates Razorpay/Cashfree payment link
   * 3. Dispatches automated WhatsApp message to the buyer
   * 4. Returns true to halt standard direct dispatch
   */
  public async checkAndHoldIfRequired(
    merchant: IMerchant,
    order: IOrder,
    customerPhone: string
  ): Promise<boolean> {
    const rules = merchant.pincodeRules || (merchant.settings as any)?.pincodeRules || [];
    if (!rules || rules.length === 0) {
      return false;
    }

    const orderPincode = (order.shippingPincode || '').trim().replace(/\D/g, '');
    if (!orderPincode) {
      return false;
    }

    const matchedRule = rules.find(
      (r: any) => String(r.pincode).trim().replace(/\D/g, '') === orderPincode
    );

    if (!matchedRule) {
      return false;
    }

    // Only COD orders require deposit or prepayment enforcement
    if (order.paymentMethod !== 'cod') {
      logger.info('Pincode guard check skipped: order is already prepaid', {
        merchantId: merchant._id,
        orderId: order._id,
        pincode: orderPincode,
      });
      return false;
    }

    // Resolve merchant payment credentials
    const pc: any = merchant.paymentConfig || {};
    const paymentProvider: 'razorpay' | 'cashfree' = pc.provider || pc.gateway || 'razorpay';
    let keyId: string | undefined;
    let keySecret: string | undefined;

    if (pc.keyId && pc.keySecret) {
      try {
        keyId = encryptionService.decrypt(pc.keyId);
        keySecret = encryptionService.decrypt(pc.keySecret);
      } catch (decErr: any) {
        logger.warn('Failed to decrypt payment credentials in PincodeGuard; rule will not be applied', {
          merchantId: merchant._id,
          error: decErr?.message,
        });
      }
    }

    const normalizedPhone = normalizeIndianPhone(customerPhone || order.customerPhone || '');
    const phoneWithPlus = normalizedPhone.startsWith('91') ? `+${normalizedPhone}` : normalizedPhone;
    const customerName = order.customerName || 'Customer';
    const city = order.shippingCity || 'your delivery location';

    // ─── 1. MANDATE ADVANCE DEPOSIT (e.g. ₹50) ───
    if (matchedRule.mandateAdvance) {
      const depositAmount = matchedRule.advanceAmount && matchedRule.advanceAmount > 0
        ? matchedRule.advanceAmount
        : 50;
      const remainingAmount = Math.max(0, order.orderValue - depositAmount);

      logger.info('🛡️ Pincode Guard triggered: Mandating advance deposit', {
        merchantId: merchant._id,
        externalOrderId: order.externalOrderId,
        pincode: orderPincode,
        depositAmount,
      });

      let paymentLink: { linkId: string; shortUrl: string };
      if (!paymentWebhookReady(merchant)) return this.skipHold(merchant, order, 'payment_webhook_unverified');
      try {
        if (keyId && keySecret) {
          paymentLink = await paymentService.createPaymentLink(
            paymentProvider,
            {
              amount: depositAmount,
              currency: 'INR',
              description: `Advance deposit for Order #${order.externalOrderId}`,
              customerName,
              customerPhone: phoneWithPlus,
              orderId: order.externalOrderId,
              expiresInMinutes: 240, // 4 hours
            },
            paymentProvider === 'razorpay'
              ? { keyId, keySecret }
              : { clientId: keyId, clientSecret: keySecret }
          );
        } else {
          return this.skipHold(merchant, order, 'no_payment_gateway');
        }
      } catch (plErr: any) {
        logger.error('Failed to create advance deposit payment link', {
          merchantId: merchant._id,
          orderId: order._id,
          error: plErr.message,
        });
        return this.skipHold(merchant, order, 'payment_link_failed');
      }

      // Update Order with Awaiting Deposit status
      await Order.findByIdAndUpdate(order._id, {
        status: 'awaiting_deposit',
        pincodeHoldReason: 'require_deposit',
        depositAmount,
        depositPaymentLinkId: paymentLink.linkId,
        paymentLinkUrl: paymentLink.shortUrl,
        depositRequestedAt: new Date(),
      });

      // Send WhatsApp message to buyer
      await this.sendDepositRequestWhatsApp({
        merchant,
        phone: normalizedPhone,
        customerName,
        externalOrderId: order.externalOrderId,
        depositAmount,
        remainingAmount,
        city,
        shortUrl: paymentLink.shortUrl,
        linkId: paymentLink.linkId,
      });

      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'pincode_guard_held_for_deposit',
        source: 'pincode_guard_service',
        payload: {
          pincode: orderPincode,
          depositAmount,
          paymentLinkId: paymentLink.linkId,
          externalOrderId: order.externalOrderId,
        },
        status: 'success',
      });

      return true;
    }

    // ─── 2. FORCE 100% PREPAID CONVERSION ───
    if (matchedRule.forcePrepaid) {
      logger.info('🛡️ Pincode Guard triggered: Forcing 100% Prepaid Conversion', {
        merchantId: merchant._id,
        externalOrderId: order.externalOrderId,
        pincode: orderPincode,
        orderValue: order.orderValue,
      });

      let paymentLink: { linkId: string; shortUrl: string };
      if (!paymentWebhookReady(merchant)) return this.skipHold(merchant, order, 'payment_webhook_unverified');
      try {
        if (keyId && keySecret) {
          paymentLink = await paymentService.createPaymentLink(
            paymentProvider,
            {
              amount: order.orderValue,
              currency: 'INR',
              description: `Prepaid Order #${order.externalOrderId}`,
              customerName,
              customerPhone: phoneWithPlus,
              orderId: order.externalOrderId,
              expiresInMinutes: 240, // 4 hours
            },
            paymentProvider === 'razorpay'
              ? { keyId, keySecret }
              : { clientId: keyId, clientSecret: keySecret }
          );
        } else {
          return this.skipHold(merchant, order, 'no_payment_gateway');
        }
      } catch (plErr: any) {
        logger.error('Failed to create force-prepaid payment link', {
          merchantId: merchant._id,
          orderId: order._id,
          error: plErr.message,
        });
        return this.skipHold(merchant, order, 'payment_link_failed');
      }

      await Order.findByIdAndUpdate(order._id, {
        status: 'awaiting_prepaid_conversion',
        pincodeHoldReason: 'force_prepaid',
        depositAmount: order.orderValue,
        depositPaymentLinkId: paymentLink.linkId,
        paymentLinkUrl: paymentLink.shortUrl,
        depositRequestedAt: new Date(),
      });

      await this.sendForcePrepaidWhatsApp({
        merchant,
        phone: normalizedPhone,
        customerName,
        externalOrderId: order.externalOrderId,
        orderValue: order.orderValue,
        city,
        pincode: orderPincode,
        shortUrl: paymentLink.shortUrl,
        linkId: paymentLink.linkId,
      });

      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'pincode_guard_held_for_prepaid',
        source: 'pincode_guard_service',
        payload: {
          pincode: orderPincode,
          orderValue: order.orderValue,
          paymentLinkId: paymentLink.linkId,
          externalOrderId: order.externalOrderId,
        },
        status: 'success',
      });

      return true;
    }

    return false;
  }

  /**
   * No working gateway (or no verified webhook): never invent a payment URL and never
   * hold the order on a link that cannot confirm. The order continues as normal COD and
   * the merchant sees why the pincode rule was not applied.
   */
  private async skipHold(merchant: any, order: any, reason: string): Promise<boolean> {
    logger.warn('Pincode guard rule not applied', { merchantId: merchant._id, orderId: order._id, reason });
    await AuditLog.create({
      merchantId: merchant._id,
      orderId: order._id,
      action: 'pincode_guard_skipped',
      source: 'pincode_guard_service',
      payload: { reason, externalOrderId: order.externalOrderId },
      status: 'failed',
      error: reason,
    }).catch(() => {});
    return false;
  }

  /**
   * Dispatches WhatsApp deposit request notification
   */
  private async sendDepositRequestWhatsApp(params: {
    merchant: IMerchant;
    phone: string;
    customerName: string;
    externalOrderId: string;
    depositAmount: number;
    remainingAmount: number;
    city: string;
    shortUrl: string;
    linkId: string;
  }): Promise<void> {
    const { merchant, phone, customerName, externalOrderId, depositAmount, remainingAmount, shortUrl, linkId } = params;

    let waToken: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch {
        waToken = undefined;
      }
    }

    const waConfig = {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: waToken,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };

    try {
      // 1. Try Meta registered template if available
      await whatsAppService.sendTemplate(
        phone,
        'ndr_deposit_request_en',
        'en',
        [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName },
              { type: 'text', text: String(externalOrderId) },
              { type: 'text', text: String(depositAmount) },
              { type: 'text', text: String(remainingAmount) },
            ],
          },
          {
            type: 'button',
            index: '0',
            sub_type: 'url',
            parameters: [{ type: 'text', text: linkId }],
          },
        ],
        waConfig
      );
      logger.info('Dispatched WhatsApp deposit request template', { phone, orderId: externalOrderId });
    } catch (templateErr: any) {
      logger.warn('WhatsApp template ndr_deposit_request_en unavailable, sending direct text message', {
        error: templateErr?.message,
      });

      // 2. Fallback to direct interactive text message with link
      const textMessage =
        `Hi ${customerName}! 👋 To confirm Order #${externalOrderId} for express delivery, please pay a ₹${depositAmount} advance deposit via UPI (remaining ₹${remainingAmount} payable on delivery):\n\n` +
        `👉 Secure UPI Link: ${shortUrl}\n\n` +
        `Once paid, your parcel will be dispatched immediately. Thank you!`;

      try {
        await whatsAppService.sendText(phone, textMessage, waConfig);
      } catch (textErr: any) {
        logger.error('Failed to send fallback WhatsApp text message for deposit', {
          phone,
          error: textErr?.message,
        });
      }
    }
  }

  /**
   * Dispatches WhatsApp force prepaid notification
   */
  private async sendForcePrepaidWhatsApp(params: {
    merchant: IMerchant;
    phone: string;
    customerName: string;
    externalOrderId: string;
    orderValue: number;
    city: string;
    pincode: string;
    shortUrl: string;
    linkId: string;
  }): Promise<void> {
    const { merchant, phone, customerName, externalOrderId, orderValue, pincode, shortUrl } = params;

    let waToken: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch {
        waToken = undefined;
      }
    }

    const waConfig = {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: waToken,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };

    const textMessage =
      `Hi ${customerName}! 👋 Cash on Delivery is temporarily restricted for delivery zone ${pincode}.\n\n` +
      `To confirm and dispatch Order #${externalOrderId} (₹${orderValue}), please complete your payment online via UPI/Card:\n\n` +
      `👉 Payment Link: ${shortUrl}\n\n` +
      `Orders not confirmed will be automatically released. Thank you!`;

    try {
      await whatsAppService.sendText(phone, textMessage, waConfig);
      logger.info('Dispatched WhatsApp force-prepaid message', { phone, orderId: externalOrderId });
    } catch (textErr: any) {
      logger.error('Failed to send WhatsApp force-prepaid message', {
        phone,
        error: textErr?.message,
      });
    }
  }
}

export const pincodeGuardService = PincodeGuardService.getInstance();
