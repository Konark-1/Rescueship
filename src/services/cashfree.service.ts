import axios from 'axios';
import { config } from '../config/env';
import { Order } from '../models';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export interface CashfreeOrderResponse {
  paymentSessionId: string;
  orderId: string;
  cfOrderId?: string;
  orderStatus?: string;
  orderAmount: number;
  orderCurrency: string;
  paymentLinkUrl?: string;
}

export interface GenerateUpiIntentOptions {
  customerName?: string;
  customerEmail?: string;
  merchantConfig?: {
    clientId?: string;
    clientSecret?: string;
    token?: string;
  };
  returnUrl?: string;
  notifyUrl?: string;
}

export class CashfreeService {
  private static instance: CashfreeService;

  private constructor() {}

  public static getInstance(): CashfreeService {
    if (!CashfreeService.instance) {
      CashfreeService.instance = new CashfreeService();
    }
    return CashfreeService.instance;
  }

  /**
   * Cashfree Create Order (v2023 API) to generate UPI Intent / Payment Session.
   *
   * Requirement:
   * - Headers include x-api-version: 2023-08-01 and Authorization: Bearer <token>
   * - Store the returned payment_session_id in the Order model
   */
  public async generateUpiIntent(
    orderId: string,
    amount: number,
    customerPhone: string,
    options?: GenerateUpiIntentOptions
  ): Promise<CashfreeOrderResponse> {
    const isProd = config.server.nodeEnv === 'production';
    const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    const url = `${baseUrl}/orders`;

    const clientId = options?.merchantConfig?.clientId || config.cashfree.clientId;
    const clientSecret = options?.merchantConfig?.clientSecret || config.cashfree.clientSecret;
    const token = options?.merchantConfig?.token || clientSecret || process.env.CASHFREE_API_TOKEN || 'cf_token_placeholder';
    const apiVersion = config.cashfree.apiVersion || '2023-08-01';

    const safeAmount = Math.max(1, Math.round(amount * 100) / 100);
    const sanitizedPhone = customerPhone.replace(/\D/g, '') || '9999999999';
    const sanitizedOrderId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45);

    const apiBaseUrl = (process.env.API_PUBLIC_URL || config.server.apiBaseUrl).replace(/\/$/, '');
    const notifyUrl = options?.notifyUrl || `${apiBaseUrl}/webhooks/cashfree/payment`;

    const payload = {
      order_id: sanitizedOrderId,
      order_amount: safeAmount,
      order_currency: 'INR',
      customer_details: {
        customer_id: `cust_${sanitizedPhone.slice(-10)}`,
        customer_phone: sanitizedPhone.slice(-10),
        customer_name: (options?.customerName || 'Customer').slice(0, 50),
        customer_email: options?.customerEmail || 'customer@rescueship.io',
      },
      order_meta: {
        notify_url: notifyUrl,
        payment_methods: 'upi',
        ...(options?.returnUrl && { return_url: options.returnUrl }),
      },
    };

    const headers: Record<string, string> = {
      'x-api-version': apiVersion,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (clientId) {
      headers['x-client-id'] = clientId;
    }
    if (clientSecret) {
      headers['x-client-secret'] = clientSecret;
    }

    try {
      logger.info('Creating Cashfree order for UPI intent', {
        orderId: sanitizedOrderId,
        amount: safeAmount,
        phone: customerPhone,
      });

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      const data = response.data;
      const paymentSessionId = data.payment_session_id;

      if (!paymentSessionId) {
        throw new Error('Cashfree did not return a payment_session_id');
      }

      // Store the returned payment_session_id in the Order model
      const query: any = {};
      if (Types.ObjectId.isValid(orderId)) {
        query.$or = [{ _id: orderId }, { externalOrderId: orderId }, { cashfreeOrderId: sanitizedOrderId }];
      } else {
        query.$or = [{ externalOrderId: orderId }, { cashfreeOrderId: sanitizedOrderId }];
      }

      await Order.findOneAndUpdate(
        query,
        {
          $set: {
            payment_session_id: paymentSessionId,
            paymentSessionId: paymentSessionId,
            cashfreeOrderId: data.order_id || sanitizedOrderId,
            paymentGateway: 'cashfree',
          },
        },
        { new: true }
      );

      logger.info('Cashfree payment_session_id persisted to Order model', {
        orderId: sanitizedOrderId,
        paymentSessionId,
      });

      return {
        paymentSessionId,
        orderId: data.order_id || sanitizedOrderId,
        cfOrderId: data.cf_order_id,
        orderStatus: data.order_status,
        orderAmount: data.order_amount || safeAmount,
        orderCurrency: data.order_currency || 'INR',
        paymentLinkUrl: data.payment_link || data.payments?.url,
      };
    } catch (error: any) {
      logger.error('Failed to create Cashfree order for UPI intent', {
        orderId: sanitizedOrderId,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }
}

export const cashfreeService = CashfreeService.getInstance();
