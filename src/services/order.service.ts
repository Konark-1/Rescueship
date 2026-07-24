import { Types } from 'mongoose';
import axios from 'axios';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant, Order, AuditLog, BillingEvent } from '../models';
import { whatsAppService } from './whatsapp.service';
import { paymentService } from './payment.service';
import { encryptionService } from './encryption.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
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

      // Check if COD-to-Prepaid conversion is enabled
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
      
      // Create the Order in our DB FIRST to claim the unique index slot
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
          logger.info('Order already processed (duplicate index)', { externalOrderId: orderData.externalOrderId });
          return;
        }
        throw err;
      }

      // Calculate incentive / discount amount
      let discount = 0;
      const incentiveType = merchant.settings.codConversion.incentiveType;
      const incentiveAmount = merchant.settings.codConversion.incentiveAmount;

      if (incentiveType === 'flat') {
        discount = incentiveAmount;
      } else if (incentiveType === 'percentage') {
        discount = Math.round((orderData.orderValue * incentiveAmount) / 100);
      }

      const finalAmount = orderData.orderValue - discount;

      // Decrypt payment config credentials
      const paymentProvider = merchant.paymentConfig?.provider || 'razorpay';
      let keyId: string | undefined;
      let keySecret: string | undefined;

      try {
        if (merchant.paymentConfig?.keyId) {
          keyId = encryptionService.decrypt(merchant.paymentConfig.keyId);
        }
        if (merchant.paymentConfig?.keySecret) {
          keySecret = encryptionService.decrypt(merchant.paymentConfig.keySecret);
        }
      } catch (decErr: any) {
        logger.warn('Decryption of payment gateway credentials failed, attempting fallback to raw storage', {
          merchantId,
          error: decErr.message,
        });
        keyId = merchant.paymentConfig?.keyId;
        keySecret = merchant.paymentConfig?.keySecret;
      }

      // Create Payment Link
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
            expiresInMinutes: 1440, // 24 hours
          },
          paymentProvider === 'razorpay'
            ? { keyId, keySecret }
            : { clientId: keyId, clientSecret: keySecret }
        );
      } catch (err: any) {
        // If payment link fails, remove the newly created order so it can be retried
        await Order.deleteOne({ _id: order._id });
        throw err;
      }

      // Generate UPI QR Code image Data URL for COD conversion payment link
      try {
        await paymentService.generateQRCode(paymentLink.shortUrl);
        logger.info('Generated UPI QR Code for COD conversion link', { externalOrderId: orderData.externalOrderId });
      } catch (qrErr: any) {
        logger.warn('Failed to generate UPI QR code for payment link', { error: qrErr.message });
      }

      // Update Order with payment link
      order.status = 'cod_conversion_sent';
      order.paymentLinkId = paymentLink.linkId;
      order.paymentLinkUrl = paymentLink.shortUrl;
      order.codConversion = {
        messageSentAt: new Date(),
        incentiveOffered: discount,
        convertedAt: null,
      };
      await order.save();

      // Send WhatsApp Template Message
      // Template expects: {{1}} Customer Name, {{2}} Order ID, {{3}} Order Value, {{4}} Discount Value, {{5}} Payment URL
      let waToken: string | undefined;
      try {
        if (merchant.whatsappConfig?.accessToken) {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        }
      } catch (decErr: any) {
        waToken = merchant.whatsappConfig?.accessToken;
      }

      const lang = merchant.settings.codConversion.messageLanguage || 'en';
      const templateName = `cod_conversion_${lang}`;

      const components = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.customerName || 'Customer' },
            { type: 'text', text: order.externalOrderId },
            { type: 'text', text: `₹${order.orderValue}` },
            { type: 'text', text: `₹${discount}` },
          ],
        },
        {
          type: 'button',
          index: '0',
          sub_type: 'url',
          parameters: [
            { type: 'text', text: paymentLink.shortUrl.replace(/^https?:\/\/[^\/]+\//, '') }, // Meta expects relative URL tail if baseUrl is static, or full URL depending on template setup. We pass shortUrl directly or query tail.
          ],
        },
      ];

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

      // Deduct credit atomically
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

      // Schedule reminder job in 4 hours
      try {
        const conversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });
        await conversionQueue.add(
          'cod-conversion',
          {
            action: 'send_reminder',
            orderId: order._id.toString(),
            merchantId: merchant._id.toString(),
          },
          {
            delay: 4 * 60 * 60 * 1000, // 4 hours
            jobId: `reminder:${order._id}`,
            removeOnComplete: true,
            removeOnFail: true,
          }
        );
        logger.info('Scheduled COD conversion reminder job', { orderId: order._id });
      } catch (qErr: any) {
        logger.warn('Failed to schedule COD conversion reminder job', { error: qErr.message });
      }

      // Log success audit
      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'cod_conversion_sent',
        source: 'order_service',
        payload: { orderId: order.externalOrderId, paymentLinkUrl: paymentLink.shortUrl },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to process COD order conversion', { externalOrderId: orderData.externalOrderId, error: err.message });
      // Write error log
      await AuditLog.create({
        merchantId: new Types.ObjectId(merchantId),
        action: 'cod_conversion_sent',
        source: 'order_service',
        payload: orderData,
        status: 'failed',
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Handle payment link webhook confirmation
   */
  public async handlePaymentConfirmation(paymentLinkId: string, provider: string): Promise<void> {
    logger.info('Processing payment confirmation', { paymentLinkId, provider });

    const order = await Order.findOne({ paymentLinkId });
    if (!order) {
      logger.warn('Order not found for payment link', { paymentLinkId });
      return;
    }

    if (order.status === 'converted_to_prepaid') {
      logger.info('Order is already marked as converted to prepaid', { orderId: order.externalOrderId });
      return;
    }

    try {
      order.status = 'converted_to_prepaid';
      if (order.codConversion) {
        order.codConversion.convertedAt = new Date();
      }
      await order.save();

      // Mark order as paid on the e-commerce platform
      await this.markOrderAsPaidOnPlatform(order);

      // Update merchant billing usage & notify seller via WhatsApp alert
      const merchant = await Merchant.findByIdAndUpdate(
        order.merchantId,
        { $inc: { 'billing.totalConversions': 1 } },
        { new: true }
      );

      if (merchant) {
        const discount = order.codConversion?.incentiveOffered || 0;
        const paidAmount = order.orderValue - discount;
        const merchantPhone = (merchant as any).phone || merchant.whatsappConfig?.phoneNumberId || '';

        await paymentService.notifySellerPaymentReceived(
          merchantPhone,
          order.externalOrderId,
          paidAmount,
          merchant.whatsappConfig
        );
      }

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'converted_to_prepaid',
        source: 'payment_webhook',
        payload: { paymentLinkId, provider, externalOrderId: order.externalOrderId },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to complete payment confirmation flow', { paymentLinkId, error: err.message });
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'converted_to_prepaid',
        source: 'payment_webhook',
        payload: { paymentLinkId, provider },
        status: 'failed',
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Communicate paid status back to Shopify / WooCommerce
   */
  public async markOrderAsPaidOnPlatform(order: any): Promise<void> {
    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${order.merchantId}`);
    }

    if (order.platform === 'shopify') {
      await this.markShopifyOrderPaid(order, merchant);
    } else if (order.platform === 'woocommerce') {
      await this.markWooCommerceOrderPaid(order, merchant);
    } else if (order.platform === 'custom') {
      await this.markCustomOrderPaid(order, merchant);
    } else {
      logger.warn('Unknown platform, skipping automated mark-as-paid sync', { orderId: order.externalOrderId });
    }
  }

  private async markCustomOrderPaid(order: any, merchant: any): Promise<void> {
    const webhookUrl = merchant.platformConfig?.customWebhookUrl;
    
    if (!webhookUrl) {
      logger.info('No custom webhook URL configured for merchant, skipping sync', { merchantId: merchant._id });
      return;
    }

    let secret: string | undefined;
    try {
      if (merchant.platformConfig?.customApiSecret) {
        secret = encryptionService.decrypt(merchant.platformConfig.customApiSecret);
      }
    } catch (err) {
      secret = merchant.platformConfig?.customApiSecret;
    }

    try {
      logger.info('Sending payment confirmation webhook to custom platform', { webhookUrl, orderId: order.externalOrderId });
      
      const payload = {
        order_id: order.externalOrderId,
        status: 'paid',
        payment_link_id: order.paymentLinkId,
        converted_at: order.codConversion?.convertedAt || new Date().toISOString()
      };

      const headers: any = {
        'Content-Type': 'application/json'
      };

      if (secret) {
        headers['Authorization'] = `Bearer ${secret}`;
      }

      await axios.post(webhookUrl, payload, { headers, timeout: 5000 });
      logger.info('Custom platform webhook sent successfully', { orderId: order.externalOrderId });
    } catch (err: any) {
      logger.error('Failed to send webhook to custom platform', { orderId: order.externalOrderId, error: err.message });
      throw err;
    }
  }

  private async markShopifyOrderPaid(order: any, merchant: any): Promise<void> {
    const domain = merchant.platformConfig?.shopifyDomain;
    let accessToken: string | undefined;

    try {
      if (merchant.platformConfig?.shopifyAccessToken) {
        accessToken = encryptionService.decrypt(merchant.platformConfig.shopifyAccessToken);
      }
    } catch (err) {
      accessToken = merchant.platformConfig?.shopifyAccessToken;
    }

    if (!domain || !accessToken) {
      throw new Error('Shopify domain or access token not configured');
    }

    const url = `https://${domain}/admin/api/2024-04/graphql.json`;
    // Shopify orders require ID in global format: gid://shopify/Order/<id>
    const gid = order.externalOrderId.startsWith('gid://')
      ? order.externalOrderId
      : `gid://shopify/Order/${order.externalOrderId}`;

    const query = `
      mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
        orderMarkAsPaid(input: $input) {
          order {
            id
            displayFinancialStatus
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: gid,
      },
    };

    try {
      logger.info('Marking Shopify order as paid', { domain, gid });
      const response = await axios.post(
        url,
        { query, variables },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      const errors = response.data.data?.orderMarkAsPaid?.userErrors;
      if (errors && errors.length > 0) {
        throw new Error(errors.map((e: any) => e.message).join(', '));
      }

      logger.info('Shopify order marked paid successfully', { gid });
    } catch (err: any) {
      logger.error('Failed to mark Shopify order as paid', { gid, error: err.message });
      throw err;
    }
  }

  private async markWooCommerceOrderPaid(order: any, merchant: any): Promise<void> {
    const woocommerceUrl = merchant.platformConfig?.woocommerceUrl;
    let key: string | undefined;
    let secret: string | undefined;

    try {
      if (merchant.platformConfig?.woocommerceKey) {
        key = encryptionService.decrypt(merchant.platformConfig.woocommerceKey);
      }
      if (merchant.platformConfig?.woocommerceSecret) {
        secret = encryptionService.decrypt(merchant.platformConfig.woocommerceSecret);
      }
    } catch (err) {
      key = merchant.platformConfig?.woocommerceKey;
      secret = merchant.platformConfig?.woocommerceSecret;
    }

    if (!woocommerceUrl || !key || !secret) {
      throw new Error('WooCommerce store URL or credentials are not configured');
    }

    // WooCommerce REST API endpoint for order updates
    const url = `${woocommerceUrl}/wp-json/wc/v3/orders/${order.externalOrderId}`;

    try {
      logger.info('Marking WooCommerce order as paid', { woocommerceUrl, orderId: order.externalOrderId });
      const auth = Buffer.from(`${key}:${secret}`).toString('base64');
      await axios.put(
        url,
        {
          status: 'processing', // Typically, marking as paid moves WooCommerce orders to processing status
          set_paid: true,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      logger.info('WooCommerce order marked paid successfully', { orderId: order.externalOrderId });
    } catch (err: any) {
      logger.error('Failed to mark WooCommerce order as paid', { orderId: order.externalOrderId, error: err.message });
      throw err;
    }
  }

  /**
   * Send WhatsApp reminder for COD-to-Prepaid conversion
   */
  public async sendCODReminder(orderId: string): Promise<void> {
    logger.info('Sending COD conversion reminder', { orderId });
    
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        logger.warn('Order not found for reminder', { orderId });
        return;
      }

      // Only send if the customer has not paid/converted yet
      if (order.status !== 'cod_conversion_sent') {
        logger.info('Order is not in cod_conversion_sent status, skipping reminder', { orderId, status: order.status });
        return;
      }

      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      if (merchant.billing.rescueCredits <= 0) {
        logger.info('Insufficient credits for COD reminder', { merchantId: merchant._id });
        return;
      }

      let waToken: string | undefined;
      try {
        if (merchant.whatsappConfig?.accessToken) {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        }
      } catch (err) {
        waToken = merchant.whatsappConfig?.accessToken;
      }

      const lang = merchant.settings.codConversion.messageLanguage || 'en';
      const templateName = `cod_conversion_reminder_${lang}`;
      
      const discount = order.codConversion?.incentiveOffered || 0;

      const components = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.customerName || 'Customer' },
            { type: 'text', text: order.externalOrderId },
            { type: 'text', text: `₹${discount}` },
          ],
        },
        {
          type: 'button',
          index: '0',
          sub_type: 'url',
          parameters: [
            { type: 'text', text: (order.paymentLinkUrl || '').replace(/^https?:\/\/[^\/]+\//, '') },
          ],
        },
      ];

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

      // Deduct credit atomically
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
        action: 'cod_conversion_reminder_sent',
        source: 'order_service',
        payload: { orderId: order.externalOrderId },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to send COD conversion reminder', { orderId, error: err.message });
      throw err;
    }
  }
}

export const orderService = OrderService.getInstance();
