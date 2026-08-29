import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { whatsAppService } from './whatsapp.service';
import { encryptionService } from './encryption.service';

export interface PaymentConfig {
  keyId?: string;
  keySecret?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface PaymentLinkParams {
  amount: number; // in Rupees
  currency: 'INR';
  description: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderId: string;
  expiresInMinutes?: number;
}

export interface PaymentLinkResult {
  linkId: string;
  shortUrl: string;
  provider: 'razorpay' | 'cashfree';
}

export class PaymentService {
  private static instance: PaymentService;

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Create a payment link using Razorpay or Cashfree
   */
  public async createPaymentLink(
    provider: 'razorpay' | 'cashfree',
    params: PaymentLinkParams,
    merchantConfig?: PaymentConfig
  ): Promise<PaymentLinkResult> {
    if (provider === 'razorpay') {
      return this.createRazorpayLink(params, merchantConfig);
    } else {
      return this.createCashfreeLink(params, merchantConfig);
    }
  }

  /**
   * Razorpay Link Generation
   */
  private async createRazorpayLink(params: PaymentLinkParams, merchantConfig?: PaymentConfig): Promise<PaymentLinkResult> {
    const keyId = merchantConfig?.keyId || config.razorpay.keyId;
    const keySecret = merchantConfig?.keySecret || config.razorpay.keySecret;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials are not configured');
    }

    const url = 'https://api.razorpay.com/v1/payment_links';

    // Razorpay amount is in paise (1 INR = 100 paise), min ₹1 (100 paise)
    const validAmount = Math.max(1, params.amount);
    const amountInPaise = Math.round(validAmount * 100);

    const safeExpireMinutes = Math.min(params.expiresInMinutes || 1440, 10080); // Max 7 days
    const expireTimestamp = Math.floor(Date.now() / 1000) + safeExpireMinutes * 60;

    const payload = {
      amount: amountInPaise,
      currency: params.currency,
      accept_partial: false,
      description: (params.description || 'Order Upgrade').slice(0, 200),
      customer: {
        name: (params.customerName || 'Customer').slice(0, 50),
        contact: params.customerPhone,
        email: params.customerEmail || 'customer@example.com',
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        orderId: params.orderId,
      },
      expire_by: expireTimestamp,
    };

    try {
      logger.info('Creating Razorpay payment link', { orderId: params.orderId, amount: params.amount });
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        linkId: response.data.id,
        shortUrl: response.data.short_url,
        provider: 'razorpay',
      };
    } catch (error: any) {
      logger.error('Failed to create Razorpay payment link', {
        orderId: params.orderId,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Cashfree Link Generation
   */
  private async createCashfreeLink(params: PaymentLinkParams, merchantConfig?: PaymentConfig): Promise<PaymentLinkResult> {
    const clientId = merchantConfig?.clientId || config.cashfree.clientId;
    const clientSecret = merchantConfig?.clientSecret || config.cashfree.clientSecret;
    const apiVersion = config.cashfree.apiVersion || '2023-08-01';

    if (!clientId || !clientSecret) {
      throw new Error('Cashfree credentials are not configured');
    }

    const isProd = config.server.nodeEnv === 'production';
    const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    const url = `${baseUrl}/links`;

    const linkId = `link_${params.orderId}_${Date.now().toString().slice(-4)}`;
    const safeExpireMinutes = Math.min(params.expiresInMinutes || 1440, 10080); // Max 7 days
    const expiryTime = new Date(Date.now() + safeExpireMinutes * 60 * 1000).toISOString();
    const validAmount = Math.max(1, params.amount);

    const payload = {
      link_id: linkId,
      link_amount: validAmount,
      link_currency: params.currency,
      link_purpose: (params.description || 'Order Upgrade').slice(0, 200),
      customer_details: {
        customer_phone: params.customerPhone,
        customer_email: params.customerEmail || 'customer@example.com',
        customer_name: (params.customerName || 'Customer').slice(0, 50),
      },
      link_meta: {
        notify_url: `${config.server.apiBaseUrl}/webhooks/cashfree/payment`,
        upi_link: true,
      },
      link_expiry_time: expiryTime,
    };

    try {
      logger.info('Creating Cashfree payment link', { orderId: params.orderId, amount: params.amount });
      const response = await axios.post(url, payload, {
        headers: {
          'x-client-id': clientId,
          'x-client-secret': clientSecret,
          'x-api-version': apiVersion,
          'Content-Type': 'application/json',
        },
      });

      return {
        linkId: response.data.link_id,
        shortUrl: response.data.link_url,
        provider: 'cashfree',
      };
    } catch (error: any) {
      logger.error('Failed to create Cashfree payment link', {
        orderId: params.orderId,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Generate QR Code Data URL or Buffer for UPI Payment
   */
  public async generateQRCode(paymentUrl: string): Promise<string> {
    const QRCode = require('qrcode');
    try {
      const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
        margin: 2,
        width: 300,
      });
      return qrDataUrl;
    } catch (err: any) {
      logger.error('Failed to generate QR code', { error: err.message });
      throw err;
    }
  }

  /**
   * Notify Seller when COD conversion payment is received
   */
  public async notifySellerPaymentReceived(
    merchantPhone: string,
    orderId: string,
    amount: number,
    whatsappConfig?: any
  ): Promise<void> {
    try {
      const message = `🎉 Great news! Order #${orderId} has been converted from COD to Prepaid (₹${amount} paid via UPI).`;
      logger.info('Notifying seller of converted payment', { merchantPhone, orderId, amount, message });

      if (merchantPhone && whatsappConfig) {
        let waToken: string | undefined;
        try {
          if (whatsappConfig.accessToken) {
            waToken = encryptionService.decrypt(whatsappConfig.accessToken);
          }
        } catch (err) {
          waToken = whatsappConfig.accessToken;
        }

        await whatsAppService
          .sendTemplate(
            merchantPhone,
            'seller_payment_alert',
            'en',
            [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: orderId },
                  { type: 'text', text: `₹${amount}` },
                ],
              },
            ],
            {
              phoneNumberId: whatsappConfig.phoneNumberId,
              accessToken: waToken,
              businessAccountId: whatsappConfig.businessAccountId,
            }
          )
          .catch((err: any) => {
            logger.warn('Failed sending WhatsApp template to merchant', { error: err.message });
          });
      }
    } catch (err: any) {
      logger.error('Failed to notify seller of payment', { orderId, error: err.message });
    }
  }

  /**
   * Verify signature of Razorpay webhook
   */
  public verifyRazorpayWebhook(rawBody: string, signature: string, secret: string): boolean {
    try {
      if (!secret) {
        logger.error('Razorpay webhook secret is empty — cannot verify signature');
        return false;
      }

      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(rawBody);
      const digest = shasum.digest('hex');
      const digestBuf = Buffer.from(digest, 'hex');
      const sigBuf = Buffer.from(signature, 'hex');
      if (digestBuf.length !== sigBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(digestBuf, sigBuf);
    } catch (error: any) {
      logger.error('Error verifying Razorpay webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Verify signature of Cashfree webhook (v2023-08-01 timestamped signature)
   */
  public verifyCashfreeWebhook(rawBody: string, signature: string, secret: string, timestamp?: string): boolean {
    try {
      if (!secret || !signature || !rawBody) {
        return false;
      }

      // 1. Verify timestamp is within 5 minutes (300 seconds) if provided
      if (timestamp) {
        const tsNum = parseInt(timestamp, 10);
        if (!isNaN(tsNum)) {
          const nowSec = Math.floor(Date.now() / 1000);
          const tsSec = tsNum > 1e11 ? Math.floor(tsNum / 1000) : tsNum;
          if (Math.abs(nowSec - tsSec) > 300) {
            logger.warn('Cashfree webhook timestamp expired or skewed', { timestamp, nowSec });
            return false;
          }
        }
      }

      // 2. Compute signature over timestamp + rawBody
      const payload = timestamp ? `${timestamp}${rawBody}` : rawBody;
      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(payload);
      const digest = shasum.digest('base64');

      const digestBuf = Buffer.from(digest, 'base64');
      const sigBuf = Buffer.from(signature, 'base64');

      if (digestBuf.length === sigBuf.length && crypto.timingSafeEqual(digestBuf, sigBuf)) {
        return true;
      }

      // Fallback for rawBody-only signature if timestamp was provided but gateway used legacy mode
      if (timestamp) {
        const fallbackDigest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
        const fallbackBuf = Buffer.from(fallbackDigest, 'base64');
        if (fallbackBuf.length === sigBuf.length && crypto.timingSafeEqual(fallbackBuf, sigBuf)) {
          return true;
        }
      }

      return false;
    } catch (error: any) {
      logger.error('Error verifying Cashfree webhook signature', { error: error.message });
      return false;
    }
  }
}

export const paymentService = PaymentService.getInstance();
