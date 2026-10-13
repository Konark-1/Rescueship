/**
 * payment-connect.service.ts — validate-then-store for Razorpay / Cashfree.
 */
import axios from 'axios';
import crypto from 'crypto';
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
      try {
        await axios.get('https://api.razorpay.com/v1/orders?count=1', {
          auth: { username: keyId.trim(), password: keySecret.trim() },
          timeout: 10000,
        });
      } catch (err: any) {
        if (err.response?.status === 401) {
          throw new Error('Invalid Razorpay Key ID or Key Secret. Please check your credentials from the Razorpay Dashboard.');
        }
        throw new Error(err.response?.data?.error?.description || err.message || 'Razorpay connection failed');
      }
    } else {
      // Validate against the same environment the runtime will charge through.
      const env = process.env.CASHFREE_ENV || (config.server.nodeEnv === 'production' ? 'production' : 'sandbox');
      const base = env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
      try {
        await axios.get(`${base}/orders?limit=1`, {
          headers: { 'x-client-id': keyId.trim(), 'x-client-secret': keySecret.trim(), 'x-api-version': config.cashfree.apiVersion || '2023-08-01' },
          timeout: 10000,
        });
      } catch (err: any) {
        if (err.response?.status === 401) {
          throw new Error('Invalid Cashfree App ID or Secret Key. Please check your credentials from the Cashfree Dashboard.');
        }
        throw new Error(err.response?.data?.message || err.message || 'Cashfree connection failed');
      }
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const existing: any = (merchant as any).paymentConfig || {};
    // Razorpay signs webhooks with a secret the merchant sets on the webhook in their
    // dashboard (not the API key secret). If they did not give us one, generate it and
    // show it once so they can paste it there. Cashfree signs with the client secret.
    let generatedSecret: string | undefined;
    let hookSecret = webhookSecret && webhookSecret.trim() ? webhookSecret.trim() : undefined;
    if (gateway === 'razorpay' && !hookSecret && !existing.webhookSecret) {
      generatedSecret = crypto.randomBytes(24).toString('hex');
      hookSecret = generatedSecret;
    }
    const sameAccount = existing.keyId && (() => { try { return encryptionService.decrypt(existing.keyId) === keyId; } catch { return false; } })();
    // `provider` is the canonical key read by order.service / webhooks; `gateway` kept as alias.
    (merchant as any).paymentConfig = {
      ...existing,
      provider: gateway,
      gateway,
      keyId: encryptionService.encrypt(keyId),
      keySecret: encryptionService.encrypt(keySecret),
      ...(hookSecret ? { webhookSecret: encryptionService.encrypt(hookSecret) } : {}),
      // A new account or a new secret must prove itself again with a signed webhook.
      webhookVerifiedAt: sameAccount && !hookSecret ? existing.webhookVerifiedAt : undefined,
    };
    merchant.markModified('paymentConfig');
    (merchant as any).connections = { ...((merchant as any).connections || {}), payment: { status: 'connected', connectedAt: new Date(), gateway, lastError: null } };
    merchant.markModified('connections');
    await merchant.save();
    logger.info('Payment gateway connected', { merchantId, gateway, hasWebhookSecret: !!hookSecret });
    const apiBase = (process.env.API_PUBLIC_URL || config.server.apiBaseUrl || '').replace(/\/$/, '');
    return {
      status: 'connected',
      gateway,
      webhookVerified: Boolean((merchant as any).paymentConfig.webhookVerifiedAt),
      webhook: {
        url: gateway === 'razorpay' ? `${apiBase}/webhooks/payment` : `${apiBase}/webhooks/cashfree/payment`,
        events: gateway === 'razorpay' ? ['payment_link.paid'] : ['PAYMENT_LINK_EVENT'],
        // Shown once; RescueShip stores it encrypted and never returns it again.
        ...(generatedSecret ? { secret: generatedSecret } : {}),
      },
    };
  }

  /**
   * ₹1 self-test: creates a payment link on the merchant's own account. When the merchant
   * pays it, the signed webhook marks the gateway as verified (payment.webhook). The ₹1
   * lands in the merchant's own account.
   */
  async createWebhookTestLink(merchantId: string): Promise<{ shortUrl: string; linkId: string }> {
    const merchant: any = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    const pc = merchant.paymentConfig || {};
    const provider: PaymentGateway = pc.provider || pc.gateway;
    if (!pc.keyId || !pc.keySecret || (provider !== 'razorpay' && provider !== 'cashfree')) throw new Error('Connect a payment gateway first');
    const keyId = encryptionService.decrypt(pc.keyId);
    const keySecret = encryptionService.decrypt(pc.keySecret);
    const { paymentService } = require('./payment.service');
    const phone = String(merchant.ownerPhone || '').replace(/\D/g, '').slice(-10);
    const link = await paymentService.createPaymentLink(
      provider,
      { amount: 1, currency: 'INR', description: 'RescueShip webhook test (₹1 to your own account)', customerName: merchant.storeName || 'Merchant', customerPhone: phone ? `+91${phone}` : '+919999999999', orderId: `wbtest_${String(merchant._id).slice(-8)}`, expiresInMinutes: 60 },
      provider === 'razorpay' ? { keyId, keySecret } : { clientId: keyId, clientSecret: keySecret }
    );
    await Merchant.updateOne({ _id: merchant._id }, { $set: { 'paymentConfig.testLinkId': link.linkId } });
    return { shortUrl: link.shortUrl, linkId: link.linkId };
  }

  async webhookStatus(merchantId: string): Promise<{ verified: boolean; verifiedAt?: Date }> {
    const merchant: any = await Merchant.findById(merchantId).select('paymentConfig.webhookVerifiedAt');
    const at = merchant?.paymentConfig?.webhookVerifiedAt;
    return { verified: Boolean(at), ...(at ? { verifiedAt: at } : {}) };
  }
}
export const paymentConnectService = new PaymentConnectService();
