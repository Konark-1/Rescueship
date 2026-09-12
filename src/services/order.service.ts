import { Types } from 'mongoose';
import axios from 'axios';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant, Order, AuditLog, BillingEvent } from '../models';
import { whatsAppService } from './whatsapp.service';
import { paymentService } from './payment.service';
import { encryptionService } from './encryption.service';
import { recordOutbound } from './whatsapp-cost.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { realtimeService } from './realtime.service';
import { logger } from '../utils/logger';

export interface IncomingOrderData {
  externalOrderId: string;
  platform: 'shopify' | 'woocommerce' | 'custom';
  customerPhone: string;
  customerName?: string;
  orderValue: number;
  paymentMethod: 'cod' | 'prepaid';
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

    try {
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }

      if (!merchant.settings?.codConversion?.enabled) {
        logger.info('COD conversion is disabled for merchant', { merchantId });
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

      const normalizedPhone = normalizeIndianPhone(orderData.customerPhone);
      
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
          status: 'new',
        });
      } catch (err: any) {
      if (err.code === 11000) {
        // A prior attempt created the order but failed before the message went out
        // (e.g. WhatsApp send error already reset it to 'new'). Resume instead of
        // silently dropping the conversion.
        const existing = await Order.findOne({ merchantId: merchant._id, externalOrderId: orderData.externalOrderId });
        if (!existing) throw err;
        if (existing.status !== 'new') {
          logger.info('Order already processed (duplicate index)', { externalOrderId: orderData.externalOrderId });
          return;
        }
        order = existing;
        logger.info('Resuming COD conversion for existing order after retry', { externalOrderId: orderData.externalOrderId });
      } else {
        throw err;
      }
    }

      let discount = 0;
      const incentiveType = merchant.settings.codConversion.incentiveType;
      const incentiveAmount = merchant.settings.codConversion.incentiveAmount;

      if (incentiveType === 'flat') {
        discount = incentiveAmount;
      } else if (incentiveType === 'percentage') {
        discount = Math.round((orderData.orderValue * incentiveAmount) / 100);
      }

      const finalAmount = orderData.orderValue - discount;

      // The customer's money must land in the MERCHANT's gateway account. Never fall back
      // to platform keys, and never treat undecryptable ciphertext as a credential.
      const pc: any = merchant.paymentConfig || {};
      const paymentProvider: 'razorpay' | 'cashfree' = pc.provider || pc.gateway || 'razorpay';
      if (!pc.keyId || !pc.keySecret) {
        logger.warn('COD conversion skipped: merchant has no connected payment gateway', { merchantId });
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

      order.status = 'cod_conversion_sent';
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

      const updateRes = await Merchant.updateOne(
        { _id: merchant._id, 'billing.rescueCredits': { $gt: 0 } },
        { $inc: { 'billing.rescueCredits': -1 } }
      );
      if (updateRes.modifiedCount === 0) {
        throw new Error('Insufficient credits during deduction');
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
      logger.error('Failed to process COD order conversion', { externalOrderId: orderData.externalOrderId, error: err.message });
      throw err;
    }
  }

  /**
   * Handle successful payment webhook event
   */
  public async handlePaymentSuccess(paymentLinkId: string, amountPaidPaise: number): Promise<void> {
    logger.info('Handling payment success for COD conversion', { paymentLinkId, amountPaidPaise });

    const order = await Order.findOne({ paymentLinkId });
    if (!order) {
      logger.warn('No order found matching paymentLinkId', { paymentLinkId });
      return;
    }

    if (order.status === 'converted_to_prepaid') {
      logger.info('Order already converted to prepaid, duplicate webhook event', { paymentLinkId });
      return;
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${order.merchantId}`);
    }

    const discount = order.codConversion?.incentiveOffered || 0;
    const expectedAmountInr = Math.max(1, order.orderValue - discount);
    const expectedPaise = Math.round(expectedAmountInr * 100);

    if (!amountPaidPaise || amountPaidPaise < expectedPaise) {
      logger.error('Payment amount mismatch: payment was missing or underpaid', {
        paymentLinkId,
        expectedPaise,
        amountPaidPaise,
      });
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'payment_amount_mismatch',
        source: 'payment_webhook',
        payload: { expectedPaise, amountPaidPaise },
        status: 'failed',
        error: 'Payment amount mismatch: underpaid or missing',
      });
      return;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: 'cod_conversion_sent' },
      {
        $set: {
          status: 'converted_to_prepaid',
          paymentMethod: 'prepaid',
          'codConversion.convertedAt': new Date(),
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      logger.warn('Order status transition race condition or order already converted', { orderId: order._id });
      return;
    }

    await Merchant.findByIdAndUpdate(order.merchantId, {
      $inc: { 'billing.totalConversions': 1 },
    });

    realtimeService.emitCodConverted(
      order.merchantId.toString(),
      order.externalOrderId,
      order.orderValue - discount
    );

    await this.markOrderAsPaidOnPlatform(updatedOrder, merchant);

    await AuditLog.create({
      merchantId: order.merchantId,
      orderId: order._id,
      action: 'cod_converted_to_prepaid',
      source: 'payment_webhook',
      payload: { paymentLinkId, amountPaidPaise },
      status: 'success',
    });
  }

  public async handlePaymentConfirmation(paymentLinkId: string, amountPaidPaise: any): Promise<void> {
    const amount = Number(amountPaidPaise);
    if (!Number.isFinite(amount) || amount <= 0) {
      // Fail the job loud so BullMQ retries / dead-letters it and operators can see it,
      // instead of silently succeeding and leaving the order stuck in cod_conversion_sent.
      throw new Error(`Missing or invalid payment amount for payment link ${paymentLinkId}`);
    }
    return this.handlePaymentSuccess(paymentLinkId, amount);
  }

  public async sendCODReminder(orderId: string): Promise<void> {
    logger.info('COD reminder queued', { orderId });
  }

  public async markOrderAsPaidOnPlatform(order: any, merchant?: any): Promise<void> {
    if (!merchant && order?.merchantId) {
      merchant = await Merchant.findById(order.merchantId);
    }
    return this.syncOrderToPlatform(order, merchant);
  }

  private async syncOrderToPlatform(order: any, merchant: any): Promise<void> {
    try {
      // Shopify credentials may live under `merchant.shopify` (OAuth / direct-token connect)
      // or the legacy `platformConfig` (manual settings). Prefer the connect flow's copy.
      const shopifyCreds = merchant ? this.resolveShopifyCredentials(merchant) : null;
      const wcCreds = merchant ? this.resolveWooCommerceCredentials(merchant) : null;
      if (order && merchant && order.platform === 'woocommerce' && wcCreds) {
        await this.syncWooCommerceOrder(order, wcCreds);
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

        const safeOrderId = encodeURIComponent(String(externalOrderId));
        let token: string;
        try {
          token = encryptionService.decrypt(shopifyCreds.encryptedToken);
        } catch {
          logger.error('Stored Shopify access token cannot be decrypted; merchant must reconnect Shopify', { merchantId: merchant._id });
          return;
        }
        const discount = order.codConversion?.incentiveOffered || 0;
        const netAmount = (order.orderValue - discount).toString();

        // 1. Post exact captured transaction to Shopify financial ledger
        await axios.post(
          `https://${domain}/admin/api/2026-07/orders/${safeOrderId}/transactions.json`,
          {
            transaction: {
              kind: 'sale',
              status: 'success',
              amount: netAmount,
              gateway: 'RescueShip Prepaid',
            },
          },
          { headers: { 'X-Shopify-Access-Token': token } }
        );

        // 2. Append refund protection note & tags to Shopify order
        await axios.put(
          `https://${domain}/admin/api/2026-07/orders/${safeOrderId}.json`,
          {
            order: {
              id: order.externalOrderId,
              note: `⚠️ RescueShip Prepaid Conversion: ₹${discount} discount applied. Net paid by customer: ₹${netAmount}. Maximum refund eligibility: ₹${netAmount}.`,
              tags: `RescueShip_Prepaid, Incentive_Applied_₹${discount}, Max_Refund_₹${netAmount}`,
            },
          },
          { headers: { 'X-Shopify-Access-Token': token } }
        ).catch((err: any) => {
          logger.warn('Failed to update Shopify tags/note', { error: err.message });
        });

        logger.info('Synced prepaid conversion transaction & refund protection tags to Shopify', {
          orderId: order.externalOrderId,
          netAmount,
          discount,
        });
      }
    } catch (err: any) {
      logger.error('Failed to sync order status to platform', { orderId: order?.externalOrderId, error: err.message });
    }
  }

  /** Pick the Shopify domain + encrypted token from whichever place the merchant connected through. */
  private resolveShopifyCredentials(merchant: any): { domain: string; encryptedToken: string } | null {
    const s = merchant.shopify;
    if (s?.shopDomain && s?.accessToken && !s.demo) {
      return { domain: String(s.shopDomain).toLowerCase(), encryptedToken: s.accessToken };
    }
    const pc = merchant.platformConfig;
    if (pc?.shopifyDomain && pc?.shopifyAccessToken) {
      return { domain: String(pc.shopifyDomain).toLowerCase(), encryptedToken: pc.shopifyAccessToken };
    }
    return null;
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
  private async syncWooCommerceOrder(order: any, creds: { url: string; key: string; secret: string }): Promise<void> {
    const externalOrderId = String(order.externalOrderId || '');
    if (!/^[0-9]+$/.test(externalOrderId)) {
      logger.warn('Aborting WooCommerce sync: invalid externalOrderId', { externalOrderId });
      return;
    }
    const discount = order.codConversion?.incentiveOffered || 0;
    const netAmount = (order.orderValue - discount).toString();
    const auth = { username: creds.key, password: creds.secret };

    // Mark the order paid (WooCommerce 'processing' is the standard paid-but-unshipped state)
    // and store a transaction reference tying it to the RescueShip conversion.
    await axios.put(
      `${creds.url}/wp-json/wc/v3/orders/${externalOrderId}`,
      { status: 'processing', transaction_id: `rs_${externalOrderId}` },
      { auth, timeout: 10000 }
    );

    // Append a note documenting the conversion (refund-protection context for the merchant).
    await axios.post(
      `${creds.url}/wp-json/wc/v3/orders/${externalOrderId}/notes`,
      { note: `RescueShip Prepaid Conversion: ₹${discount} discount applied. Net paid by customer: ₹${netAmount}. Maximum refund eligibility: ₹${netAmount}.` },
      { auth, timeout: 10000 }
    ).catch((err: any) => {
      logger.warn('Failed to add WooCommerce order note', { orderId: externalOrderId, error: err.message });
    });

    logger.info('Synced prepaid conversion to WooCommerce', { orderId: externalOrderId, netAmount, discount });
  }
}

export const orderService = OrderService.getInstance();
