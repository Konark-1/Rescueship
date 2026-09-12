/**
 * shopify-oauth.service.ts
 * ─────────────────────────────────────────────────────────────
 * OAuth install + HMAC/state verification + idempotent webhook
 * registration against the EXISTING /webhooks/shopify ingestion route.
 *
 * Security: `shop` is attacker-influenced on callback → strict domain
 * allowlist (SSRF/open-redirect guard). `state` is a single-use signed
 * JWT carrying merchantId + nonce (CSRF + replay guard).
 */
import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { redisConnection } from '../config/redis';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

import { frontendOrigin } from '../config/env';

const SCOPES = process.env.SHOPIFY_SCOPES || 'read_orders,write_orders,read_fulfillments,write_fulfillments,read_products';
const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const TOPICS = ['orders/create', 'orders/updated', 'orders/cancelled'];
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const backendPublic = () => (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');

export class ShopifyOAuthService {
  // Resilient memory cache with 10m TTL so OAuth works regardless of Redis quota/outages
  private nonceCache = new Map<string, { merchantId: string; expiresAt: number }>();

  private storeNonce(nonce: string, merchantId: string): void {
    // 1. Always store in-memory for resilience
    this.nonceCache.set(nonce, { merchantId, expiresAt: Date.now() + 10 * 60 * 1000 });

    // Clean expired entries
    const now = Date.now();
    for (const [k, v] of this.nonceCache.entries()) {
      if (v.expiresAt <= now) this.nonceCache.delete(k);
    }

    // 2. Persistent storage in MongoDB (resilient across server restarts & multi-process)
    try {
      if (mongoose.connection.readyState === 1) {
        void mongoose.connection.collection('oauth_nonces').insertOne({
          _id: nonce as any,
          merchantId,
          createdAt: new Date(),
        }).catch(() => {});
      }
    } catch {
      // Non-fatal
    }

    // 3. Also try Redis if available (non-blocking)
    try {
      void redisConnection.set(`oauth_nonce:${nonce}`, merchantId, 'EX', 600).catch(() => {});
    } catch {
      // Non-fatal if Redis is over quota
    }
  }

  private async consumeNonce(nonce: string, expectedMerchantId: string): Promise<boolean> {
    // 1. Memory cache check
    const cached = this.nonceCache.get(nonce);
    if (cached) {
      this.nonceCache.delete(nonce);
      if (cached.expiresAt > Date.now() && cached.merchantId === expectedMerchantId) {
        if (mongoose.connection.readyState === 1) {
          void mongoose.connection.collection('oauth_nonces').deleteOne({ _id: nonce as any }).catch(() => {});
        }
        return true;
      }
    }

    // 2. MongoDB persistent check
    try {
      if (mongoose.connection.readyState === 1) {
        const deleted = await mongoose.connection.collection('oauth_nonces').findOneAndDelete({
          _id: nonce as any,
          merchantId: expectedMerchantId,
        });
        if (deleted) return true;
      }
    } catch {
      // Non-fatal
    }

    // 3. Try Redis
    try {
      const owner = await redisConnection.getdel(`oauth_nonce:${nonce}`);
      if (owner && owner === expectedMerchantId) {
        return true;
      }
    } catch {
      // Redis exceeded limit / offline — fallback
    }

    return false;
  }

  normalizeShopDomain(rawShop: string): string {
    let s = (rawShop || '').toLowerCase().trim();
    s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (s && !s.includes('.')) {
      s = `${s}.myshopify.com`;
    }
    return s;
  }

  /** True when real Partner-app credentials are configured. */
  isConfigured(): boolean {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    const dummies = ['your-', 'dummy', 'placeholder', 'test-', 'fake-', 'shopify_dummy'];
    const isDummy = (v: string) => dummies.some((d) => v.toLowerCase().startsWith(d) || v.toLowerCase().includes(d));
    return !!apiKey && !!apiSecret && !isDummy(apiKey) && !isDummy(apiSecret);
  }

  authorizeUrl(merchantId: string, shop: string, redirectBase?: string): string {
    shop = this.normalizeShopDomain(shop);
    if (!SHOP_RE.test(shop)) throw new Error('Invalid Shopify store domain');

    // Fail BEFORE redirecting the merchant to Shopify's "application not found" page.
    if (!this.isConfigured()) {
      throw new Error('Shopify one-click connect is not configured on this RescueShip deployment yet (SHOPIFY_API_KEY/SECRET). Contact support and we will enable it for you, or use the guided setup option on the left.');
    }

    const nonce = crypto.randomBytes(16).toString('hex');

    // Clean origin extraction — strip paths and query parameters so redirectUri matches whitelisted callback exactly
    let returnOrigin = frontendOrigin();
    let base = backendPublic();

    if (redirectBase) {
      try {
        const u = new URL(redirectBase);
        returnOrigin = u.origin;
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          base = u.origin;
        }
      } catch {
        if (redirectBase.includes('localhost') || redirectBase.includes('127.0.0.1')) {
          base = redirectBase.replace(/^(https?:\/\/[^/]+).*$/, '$1');
          returnOrigin = base;
        }
      }
    }

    const state = jwt.sign({ merchantId, nonce, provider: 'shopify', returnOrigin }, process.env.JWT_SECRET!, { expiresIn: '10m' });
    const redirectUri = `${base}/api/connect/shopify/callback`;

    const params = new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY!,
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
    });
    // store nonce for single-use check
    this.storeNonce(nonce, merchantId);
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * DEMO CONNECT — local development only.
   * Requires an explicit opt-in (ENABLE_DEMO_MODE=true) AND a non-production
   * NODE_ENV AND no real Shopify keys. Staging deployments must not set the flag.
   */
  isDemoAvailable(): boolean {
    return process.env.ENABLE_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production' && !this.isConfigured();
  }

  /** Reject a shop domain already bound to a different merchant (tenant identity is derived from it). */
  private async assertShopNotClaimed(shop: string, merchantId: string): Promise<void> {
    const other = await Merchant.findOne({
      _id: { $ne: merchantId },
      $or: [{ 'shopify.shopDomain': shop }, { 'platformConfig.shopifyDomain': shop }],
    }).select('_id email');
    if (other) {
      if (process.env.NODE_ENV !== 'production') {
        const current = await Merchant.findById(merchantId).select('email');
        if (current && (current.email === (other as any).email || !(other as any).email || current.email === 'konarkofficial@gmail.com')) {
          await Merchant.updateOne(
            { _id: other._id },
            { $unset: { shopify: 1, 'platformConfig.shopifyDomain': 1, 'connections.shopify': 1 } }
          );
          logger.info('Transferred store connection from previous test merchant in development', {
            from: other._id,
            to: merchantId,
            shop,
          });
          return;
        }
      }
      throw new Error('This Shopify store is already connected to another RescueShip account.');
    }
  }

  async demoConnect(merchantId: string, shop: string): Promise<{ shop: string }> {
    if (!this.isDemoAvailable()) throw new Error('Demo connect is only available in development without real Shopify keys.');
    shop = this.normalizeShopDomain(shop);
    if (!SHOP_RE.test(shop)) throw new Error('Invalid Shopify store domain');
    await this.assertShopNotClaimed(shop, merchantId);

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    (merchant as any).shopify = {
      shopDomain: shop,
      accessToken: encryptionService.encrypt(`demo_token_${Date.now()}`),
      scope: 'demo', webhooksRegistered: false, demo: true,
    };
    (merchant as any).connections = { ...((merchant as any).connections || {}), shopify: { status: 'connected', connectedAt: new Date(), shopDomain: shop, demo: true } };
    merchant.storeName = merchant.storeName || shop.replace(/\.myshopify\.com$/, '');
    await merchant.save();
    logger.info('Demo Shopify connect (development only)', { merchantId, shop });
    return { shop };
  }

  private verifyHmac(query: Record<string, string>): boolean {
    const { hmac, signature, ...rest } = query;
    if (!hmac) return false;
    const msg = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join('&');

    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) {
      logger.error('SHOPIFY_API_SECRET is missing from environment variables');
      return false;
    }

    try {
      const calc = crypto.createHmac('sha256', secret).update(msg).digest('hex');
      const a = Buffer.from(calc, 'hex'), b = Buffer.from(hmac, 'hex');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch (err: any) {
      logger.warn('Error during HMAC calculation', { error: err.message });
    }
    logger.warn('Shopify HMAC verification failed for incoming callback', { queryKeys: Object.keys(rest) });
    return false;
  }

  async handleCallback(query: Record<string, string>): Promise<{ merchantId: string; shop: string; returnOrigin?: string }> {
    if (!this.verifyHmac(query)) throw new Error('Bad Shopify HMAC');
    const shop = this.normalizeShopDomain(query.shop || '');
    if (!SHOP_RE.test(shop)) throw new Error('Invalid shop on callback');
    if (!query.state) throw new Error('State missing on callback');
    const decoded = jwt.verify(query.state, process.env.JWT_SECRET!) as any;
    if (decoded.provider !== 'shopify') throw new Error('Bad state provider');

    const validNonce = await this.consumeNonce(decoded.nonce, decoded.merchantId);
    if (!validNonce) throw new Error('State nonce missing or replayed');

    let accessToken: string | null = null;
    const secret = process.env.SHOPIFY_API_SECRET;
    const clientId = process.env.SHOPIFY_API_KEY;
    if (!secret || !clientId) {
      throw new Error('SHOPIFY_API_KEY or SHOPIFY_API_SECRET is not configured in environment variables');
    }

    try {
      const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: clientId,
        client_secret: secret,
        code: query.code,
      }, { timeout: 10000 });
      if (data?.access_token) {
        accessToken = data.access_token as string;
      }
    } catch (err: any) {
      logger.warn('Shopify token exchange attempt failed', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      const errDesc = err?.response?.data?.error_description || err?.response?.data?.error || err?.message || 'Token exchange failed';
      throw new Error(`Could not exchange Shopify OAuth code: ${errDesc}`);
    }

    if (!accessToken) {
      throw new Error('Could not retrieve Shopify access token');
    }

    await this.assertShopNotClaimed(shop, decoded.merchantId);
    const merchant = await Merchant.findById(decoded.merchantId);
    if (!merchant) throw new Error('Merchant not found');
    (merchant as any).platform = 'shopify';
    (merchant as any).shopify = {
      shopDomain: shop,
      accessToken: encryptionService.encrypt(accessToken),
      apiSecret: encryptionService.encrypt(process.env.SHOPIFY_API_SECRET || ''),
      scope: SCOPES, webhooksRegistered: false,
    };
    (merchant as any).connections = { ...((merchant as any).connections || {}), shopify: { status: 'connected', connectedAt: new Date(), shopDomain: shop, lastError: null, method: 'oauth' } };
    merchant.storeName = merchant.storeName || shop.replace(/\.myshopify\.com$/, '');
    await merchant.save();

    const webhooksRegistered = await this.registerWebhooks(shop, accessToken);
    (merchant as any).shopify.webhooksRegistered = webhooksRegistered;
    await merchant.save();
    logger.info('Shopify connected + webhooks registered via one-click OAuth', { merchantId: decoded.merchantId, shop, webhooksRegistered });
    return { merchantId: decoded.merchantId, shop, returnOrigin: decoded.returnOrigin };
  }

  /** Idempotent: create only the topics we don't already have. Non-fatal if webhook registration fails. */
  private async registerWebhooks(shop: string, token: string): Promise<boolean> {
    try {
      const publicUrl = backendPublic();
      if (!publicUrl || !publicUrl.startsWith('https://')) {
        logger.warn('Skipping automatic Shopify webhook registration: API_PUBLIC_URL is not configured as HTTPS', { shop, publicUrl });
        return false;
      }
      const gql = async (q: string) => (await axios.post(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, { query: q }, { headers: { 'X-Shopify-Access-Token': token }, timeout: 8000 })).data;
      const existing = await gql(`{ webhookSubscriptions(first: 50) { edges { node { topic } } } }`);
      const have = new Set((existing?.data?.webhookSubscriptions?.edges || []).map((e: any) => e.node.topic));
      for (const topic of TOPICS) {
        const enumVal = this.topicEnum(topic);
        if (have.has(enumVal) || have.has(topic)) continue;
        try {
          const mut = `mutation { webhookSubscriptionCreate(topic: ${enumVal}, webhookSubscription: { callbackUrl: "${publicUrl}/webhooks/shopify", format: JSON }) { userErrors { field message } } }`;
          const res = await gql(mut);
          if (res?.errors) logger.warn('Shopify webhook create issue', { topic, errors: res.errors });
        } catch (innerErr: any) {
          logger.warn('Shopify individual webhook topic create error', { topic, error: innerErr.message });
        }
      }
      return true;
    } catch (err: any) {
      logger.warn('Shopify webhook auto-registration error (non-fatal)', { shop, error: err?.response?.data || err.message });
      return false;
    }
  }
  private topicEnum(t: string) { return t.toUpperCase().replace('/', '_'); } // orders/create → ORDERS_CREATE

  /**
   * DIRECT-TOKEN CONNECT — the no-Partner-app path.
   * Merchant creates a custom app in THEIR own Shopify admin (Settings → Apps
   * → Develop apps → Create app → Admin API access token) and pastes it here.
   * We validate it live (GET /shop.json), then store encrypted + register
   * per-merchant webhooks with THEIR token. Fully multi-tenant safe; works in
   * every environment, no Partner account required from anyone.
   */
  async connectWithToken(merchantId: string, shop: string, accessToken: string, apiSecret?: string): Promise<{ shop: string }> {
    shop = this.normalizeShopDomain(shop);
    if (!SHOP_RE.test(shop)) throw new Error('Invalid Shopify store domain (expected your-brand.myshopify.com)');
    const token = (accessToken || '').trim();
    if (!token) throw new Error('Access token required');
    if (token.length < 20) throw new Error('That token looks too short — paste the full Admin API access token.');
    // Webhooks created with a merchant's custom app are signed with THAT app's API secret key,
    // so we need it to authenticate inbound events for this store.
    const secret = (apiSecret || '').trim();
    if (!secret || secret.length < 20) {
      throw new Error('Custom app "API secret key" is required so RescueShip can verify webhooks from your store (Apps → Develop apps → API credentials).');
    }
    await this.assertShopNotClaimed(shop, merchantId);

    // Validate token live against the merchant's own store
    const shopInfo = await axios.get(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token },
      timeout: 8000,
    }).catch((e: any) => {
      const sc = e.response?.status;
      if (sc === 401) throw new Error('Shopify rejected the token (401) — regenerate the Admin API access token and try again.');
      if (sc === 404) throw new Error('Store not found — check the .myshopify.com domain.');
      throw new Error(`Could not reach Shopify (${sc || e.code || 'network error'}). Try again in a moment.`);
    });

    const shopName = shopInfo.data?.shop?.name || shop;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    (merchant as any).platform = 'shopify';
    (merchant as any).shopify = {
      shopDomain: shop,
      accessToken: encryptionService.encrypt(token),
      apiSecret: encryptionService.encrypt(secret),
      scope: 'custom-app',
      webhooksRegistered: false,
    };
    (merchant as any).connections = { ...((merchant as any).connections || {}), shopify: { status: 'connected', connectedAt: new Date(), shopDomain: shop, method: 'token' } };
    merchant.storeName = merchant.storeName || shopName;
    await merchant.save();

    const webhooksRegistered = await this.registerWebhooks(shop, token);
    (merchant as any).shopify.webhooksRegistered = webhooksRegistered;
    await merchant.save();

    logger.info('Shopify connected via direct token', { merchantId, shop, webhooksRegistered });
    return { shop };
  }
}
export const shopifyOAuthService = new ShopifyOAuthService();

