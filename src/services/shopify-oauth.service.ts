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
  authorizeUrl(merchantId: string, shop: string): string {
    if (!SHOP_RE.test(shop)) throw new Error('Invalid Shopify store domain');
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
    const shop = query.shop;
    if (!SHOP_RE.test(shop)) throw new Error('Invalid shop on callback');
    const decoded = jwt.verify(query.state, process.env.JWT_SECRET!) as any;
    if (decoded.provider !== 'shopify') throw new Error('Bad state provider');
    const used = await redisConnection.get(`oauth_nonce:${decoded.nonce}`);
    if (!used) throw new Error('State nonce missing or replayed');
    await redisConnection.del(`oauth_nonce:${decoded.nonce}`); // single use

    const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY!, client_secret: process.env.SHOPIFY_API_SECRET!, code: query.code,
    });
    const accessToken = data.access_token as string;

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
    const gql = async (q: string) => (await axios.post(`https://${shop}/admin/api/2025-01/graphql.json`, { query: q }, { headers: { 'X-Shopify-Access-Token': token } })).data;
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
}
export const shopifyOAuthService = new ShopifyOAuthService();
