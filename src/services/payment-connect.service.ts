/**
 * payment-connect.service.ts — validate-then-store for Razorpay / Cashfree.
 */
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export type PaymentGateway = 'razorpay' | 'cashfree';

export class PaymentConnectService {
  async validateAndSave(merchantId: string, gateway: PaymentGateway, keyId: string, keySecret: string, webhookSecret?: string) {
    if (gateway !== 'razorpay' && gateway !== 'cashfree') throw new Error('Unsupported payment gateway');
    if (typeof keyId !== 'string' || typeof keySecret !== 'string' || !keyId.trim() || !keySecret.trim()) {
      throw new Error('keyId and keySecret are required');
    }

    if (gateway === 'razorpay') {
      await axios.get('https://api.razorpay.com/v1/plans?count=1', { auth: { username: keyId, password: keySecret }, timeout: 10000 }); // 401 throws
    } else {
      // Validate against the same environment the runtime will charge through.
      const base = config.server.nodeEnv === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
      await axios.get(`${base}/orders?limit=1`, {
        headers: { 'x-client-id': keyId, 'x-client-secret': keySecret, 'x-api-version': config.cashfree.apiVersion || '2023-08-01' },
        timeout: 10000,
      });
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const existing: any = (merchant as any).paymentConfig || {};
    // `provider` is the canonical key read by order.service / webhooks; `gateway` kept as alias.
    (merchant as any).paymentConfig = {
      ...existing,
      provider: gateway,
      gateway,
      keyId: encryptionService.encrypt(keyId),
      keySecret: encryptionService.encrypt(keySecret),
      ...(webhookSecret && webhookSecret.trim() ? { webhookSecret: encryptionService.encrypt(webhookSecret.trim()) } : {}),
    };
    merchant.markModified('paymentConfig');
    (merchant as any).connections = { ...((merchant as any).connections || {}), payment: { status: 'connected', connectedAt: new Date(), gateway, lastError: null } };
    merchant.markModified('connections');
    await merchant.save();
    logger.info('Payment gateway connected', { merchantId, gateway, hasWebhookSecret: !!webhookSecret });
    return { status: 'connected', gateway };
  }
}
export const paymentConnectService = new PaymentConnectService();
