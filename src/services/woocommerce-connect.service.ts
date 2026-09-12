/**
 * woocommerce-connect.service.ts
 * ─────────────────────────────────────────────────────────────
 * Validate-then-store for WooCommerce stores. Mirrors the Shopify service:
 * we hit a cheap read endpoint with the consumer key/secret (Basic auth)
 * BEFORE encrypting+saving, so a merchant can never store dead keys. Then we
 * register an `order.created` webhook with a per-merchant HMAC secret so the
 * EXISTING /webhooks/woocommerce ingestion route can verify inbound events.
 */
import crypto from 'crypto';
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

const HTTP_TIMEOUT_MS = 10000;

/** Resolve the absolute base URL the merchant's webhook (and only webhooks) POST to. */
const backendPublic = () => (process.env.API_PUBLIC_URL || process.env.API_BASE_URL || '').replace(/\/$/, '');

export function woocommerceWebhookUrl(merchantId: string): string {
  const base = backendPublic() || 'http://localhost:3000';
  return `${base}/webhooks/woocommerce?merchant_id=${encodeURIComponent(merchantId)}`;
}

/** Create a fresh per-merchant HMAC secret for inbound webhook signature verification. */
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export class WooCommerceConnectService {
  async connect(
    merchantId: string,
    creds: { url: string; consumerKey: string; consumerSecret: string }
  ): Promise<{ status: string; url: string; webhookUrl: string; webhookSecret?: string; needsManualWebhook?: boolean }> {
    // 1. Normalise + validate the store URL (SSRF guard: https, no embedded creds).
    const rawUrl = (creds.url || '').trim().replace(/\/+$/, '');
    let parsed: URL | null = null;
    try { parsed = new URL(rawUrl); } catch { parsed = null; }
    if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new Error('Enter a valid https:// store URL (e.g. https://yourstore.com).');
    }
    const storeUrl = rawUrl;

    const consumerKey = (creds.consumerKey || '').trim();
    const consumerSecret = (creds.consumerSecret || '').trim();
    if (!consumerKey || !consumerSecret) throw new Error('WooCommerce consumer key and secret are both required.');

    // 2. Validate live against the merchant's own store (fail closed → nothing stored).
    await axios.get(`${storeUrl}/wp-json/wc/v3/orders`, {
      auth: { username: consumerKey, password: consumerSecret },
      params: { per_page: 1, status: 'any' },
      timeout: HTTP_TIMEOUT_MS,
    }).catch((e: any) => {
      const sc = e.response?.status;
      if (sc === 401) throw new Error('WooCommerce rejected the keys (401) — check the consumer key/secret and ensure the REST API is enabled.');
      if (sc === 404) throw new Error('Store or WooCommerce REST API not found (404) — check the URL and enable the REST API (WooCommerce → Settings → Advanced → REST API).');
      throw new Error(`Could not reach the WooCommerce store (${sc || e.code || 'network error'}). Try again in a moment.`);
    });

    // 3. Assert this store is not already claimed by another account (tenant identity).
    const other = await Merchant.findOne({
      _id: { $ne: merchantId },
      'platformConfig.woocommerceUrl': storeUrl,
    }).select('_id');
    if (other) throw new Error('This WooCommerce store is already connected to another RescueShip account.');

    // 4. Preserve an existing webhook secret across reconnects (merchant's Woocommerce panel keeps working).
    const existingMerchant = await Merchant.findById(merchantId);
    if (!existingMerchant) throw new Error('Merchant not found');

    const pc = (existingMerchant as any).platformConfig || {};
    let webhookSecretPlain: string;
    if (pc.woocommerceWebhookSecret) {
      try { webhookSecretPlain = encryptionService.decrypt(pc.woocommerceWebhookSecret); }
      catch { webhookSecretPlain = generateWebhookSecret(); }
    } else {
      webhookSecretPlain = generateWebhookSecret();
    }

    // 5. Register the `order.created` webhook (idempotent by delivery_url+secret).
    const webhookUrl = woocommerceWebhookUrl(merchantId);
    let needsManualWebhook = false;
    try {
      await axios.post(`${storeUrl}/wp-json/wc/v3/webhooks`, {
        name: 'RescueShip — order.created',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: webhookSecretPlain,
        status: 'active',
      }, {
        auth: { username: consumerKey, password: consumerSecret },
        timeout: HTTP_TIMEOUT_MS,
      });
    } catch (e: any) {
      // Soft fail: connection still succeeds — surface manual webhook instructions instead.
      logger.warn('WooCommerce webhook auto-registration failed; merchant may need to add it manually', {
        merchantId,
        status: e.response?.status,
      });
      needsManualWebhook = true;
    }

    // 6. Store encrypted credentials + mark the connection.
    (existingMerchant as any).platform = 'woocommerce';
    (existingMerchant as any).platformConfig = {
      ...pc,
      woocommerceUrl: storeUrl,
      woocommerceKey: encryptionService.encrypt(consumerKey),
      woocommerceSecret: encryptionService.encrypt(consumerSecret),
      woocommerceWebhookSecret: encryptionService.encrypt(webhookSecretPlain),
    };
    existingMerchant.markModified('platformConfig');

    const currentConn = (existingMerchant as any).connections || {};
    (existingMerchant as any).connections = {
      shopify: currentConn.shopify || { status: 'disconnected' },
      whatsapp: currentConn.whatsapp || { status: 'disconnected' },
      carrier: currentConn.carrier || { status: 'disconnected' },
      payment: currentConn.payment || { status: 'disconnected' },
      woocommerce: { status: 'connected', connectedAt: new Date(), url: storeUrl, lastError: null },
    };
    existingMerchant.markModified('connections');
    await existingMerchant.save();

    logger.info('WooCommerce connected', { merchantId, url: storeUrl, needsManualWebhook });
    return { status: 'connected', url: storeUrl, webhookUrl, webhookSecret: needsManualWebhook ? webhookSecretPlain : undefined, needsManualWebhook };
  }
}

export const woocommerceConnectService = new WooCommerceConnectService();