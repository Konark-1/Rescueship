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
import { redisConnection } from '../config/redis';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

const SCOPES = process.env.SHOPIFY_SCOPES || 'read_orders,write_orders,read_fulfillments,write_fulfillments';
const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const TOPICS = ['orders/create', 'orders/updated', 'orders/cancelled', 'fulfillments/create', 'fulfillments/update'];
const backendPublic = () => (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');

export class ShopifyOAuthService {
  /** True when real Partner-app credentials are configured. */
  isConfigured(): boolean {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    return !!apiKey && !!apiSecret && !apiKey.startsWith('your-') && !apiSecret.startsWith('your-');
  }

  authorizeUrl(merchantId: string, shop: string): string {
    if (!SHOP_RE.test(shop)) throw new Error('Invalid Shopify store domain');

    // Fail BEFORE redirecting the merchant to Shopify's "application not found" page.
    if (!this.isConfigured()) {
      throw new Error('Shopify one-click connect is not configured on this RescueShip deployment yet (SHOPIFY_API_KEY/SECRET). Contact support and we will enable it for you, or use the guided setup option on the left.');
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const state = jwt.sign({ merchantId, nonce, provider: 'shopify' }, process.env.JWT_SECRET!, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY!, scope: SCOPES,
      redirect_uri: `${backendPublic()}/api/connect/shopify/callback`, state, grant_options: 'per_access_token',
    });
    // store nonce for single-use check
    void redisConnection.set(`oauth_nonce:${nonce}`, merchantId, 'EX', 600);
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
    }).select('_id');
    if (other) throw new Error('This Shopify store is already connected to another RescueShip account.');
  }

  async demoConnect(merchantId: string, shop: string): Promise<{ shop: string }> {
    if (!this.isDemoAvailable()) throw new Error('Demo connect is only available in development without real Shopify keys.');
    shop = shop.toLowerCase().trim();
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
    const { hmac, ...rest } = query;
    if (!hmac) return false;
    const msg = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join('&');
    const calc = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET!).update(msg).digest('hex');
    const a = Buffer.from(calc, 'hex'), b = Buffer.from(hmac, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async handleCallback(query: Record<string, string>): Promise<{ merchantId: string; shop: string }> {
    if (!this.verifyHmac(query)) throw new Error('Bad Shopify HMAC');
    const shop = (query.shop || '').toLowerCase().trim();
    if (!SHOP_RE.test(shop)) throw new Error('Invalid shop on callback');
    const decoded = jwt.verify(query.state, process.env.JWT_SECRET!) as any;
    if (decoded.provider !== 'shopify') throw new Error('Bad state provider');
    // Atomic single-use: GETDEL prevents two concurrent callbacks from both passing.
    const nonceOwner = await redisConnection.getdel(`oauth_nonce:${decoded.nonce}`);
    if (!nonceOwner || nonceOwner !== decoded.merchantId) throw new Error('State nonce missing or replayed');

    const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY!, client_secret: process.env.SHOPIFY_API_SECRET!, code: query.code,
    }, { timeout: 10000 });
    const accessToken = data.access_token as string;

    await this.assertShopNotClaimed(shop, decoded.merchantId);
    const merchant = await Merchant.findById(decoded.merchantId);
    if (!merchant) throw new Error('Merchant not found');
    (merchant as any).shopify = {
      shopDomain: shop,
      accessToken: encryptionService.encrypt(accessToken),
      scope: SCOPES, webhooksRegistered: false,
    };
    (merchant as any).connections = { ...((merchant as any).connections || {}), shopify: { status: 'connected', connectedAt: new Date(), shopDomain: shop, lastError: null } };
    await merchant.save();

    await this.registerWebhooks(shop, accessToken);
    (merchant as any).shopify.webhooksRegistered = true;
    await merchant.save();
    logger.info('Shopify connected + webhooks registered', { merchantId: decoded.merchantId, shop });
    return { merchantId: decoded.merchantId, shop };
  }

  /** Idempotent: create only the topics we don't already have. */
  private async registerWebhooks(shop: string, token: string) {
    const gql = async (q: string) => (await axios.post(`https://${shop}/admin/api/2026-07/graphql.json`, { query: q }, { headers: { 'X-Shopify-Access-Token': token } })).data;
    const existing = await gql(`{ webhookSubscriptions(first: 50) { edges { node { topic } } } }`);
    const have = new Set((existing.data?.webhookSubscriptions?.edges || []).map((e: any) => e.node.topic));
    for (const topic of TOPICS) {
      if (have.has(topic.toUpperCase().replace('/', '_')) || have.has(topic)) continue;
      const mut = `mutation { webhookSubscriptionCreate(topic: ${this.topicEnum(topic)}, webhookSubscription: { callbackUrl: "${backendPublic()}/webhooks/shopify", format: JSON }) { userErrors { field message } } }`;
      const res = await gql(mut);
      if (res.errors) logger.warn('Shopify webhook create issue', { topic, errors: res.errors }); // not fatal
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
    shop = (shop || '').toLowerCase().trim();
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
    const shopInfo = await axios.get(`https://${shop}/admin/api/2026-07/shop.json`, {
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

    await this.registerWebhooks(shop, token);
    (merchant as any).shopify.webhooksRegistered = true;
    await merchant.save();

    logger.info('Shopify connected via direct token', { merchantId, shop });
    return { shop };
  }
}
export const shopifyOAuthService = new ShopifyOAuthService();
