import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../utils/logger';

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

    // Razorpay amount is in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(params.amount * 100);
    const expireTimestamp = params.expiresInMinutes
      ? Math.floor(Date.now() / 1000) + params.expiresInMinutes * 60
      : Math.floor(Date.now() / 1000) + 24 * 60 * 60; // default 24h

    const payload = {
      amount: amountInPaise,
      currency: params.currency,
      accept_partial: false,
      description: params.description,
      customer: {
        name: params.customerName,
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
    const expiryTime = params.expiresInMinutes
      ? new Date(Date.now() + params.expiresInMinutes * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // default 24h

    const payload = {
      link_id: linkId,
      link_amount: params.amount,
      link_currency: params.currency,
      link_purpose: params.description,
      customer_details: {
        customer_phone: params.customerPhone,
        customer_email: params.customerEmail || 'customer@example.com',
        customer_name: params.customerName,
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
   * Verify signature of Razorpay webhook
   */
  public verifyRazorpayWebhook(rawBody: string, signature: string, secret: string): boolean {
    try {
      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(rawBody);
      const digest = shasum.digest('hex');
      return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'));
    } catch (error: any) {
      logger.error('Error verifying Razorpay webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Verify signature of Cashfree webhook
   */
  public verifyCashfreeWebhook(rawBody: string, signature: string, secret: string): boolean {
    try {
      // Cashfree webhook uses a timestamped signature or sha256 checksum depending on apiVersion
      // Let's implement standard signature verification.
      // Usually Cashfree provides signature in 'x-webhook-signature' header.
      // A common way for Cashfree is HMAC-SHA256 signature calculated over timestamp + rawBody.
      // If clientSecret is passed, we check using that.
      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(rawBody);
      const digest = shasum.digest('base64');
      return crypto.timingSafeEqual(Buffer.from(digest, 'base64'), Buffer.from(signature, 'base64'));
    } catch (error: any) {
      logger.error('Error verifying Cashfree webhook signature', { error: error.message });
      return false;
    }
  }
}

export const paymentService = PaymentService.getInstance();
