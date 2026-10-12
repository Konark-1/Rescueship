/**
 * shopify-admin.ts
 * ─────────────────────────────────────────────────────────────
 * Minimal GraphQL Admin API client (REST Admin is legacy; new public apps
 * must use GraphQL only). One pinned API version for the whole codebase.
 */
import axios from 'axios';
import { logger } from '../utils/logger';

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export class ShopifyAdminError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ShopifyAdminError';
  }
}

export async function shopifyGraphql<T = any>(shopDomain: string, accessToken: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const domain = String(shopDomain || '').toLowerCase();
  if (!SHOP_RE.test(domain)) throw new ShopifyAdminError(`Invalid Shopify domain: ${domain}`);
  const res = await axios.post(
    `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    { query, variables },
    { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (res.data?.errors) {
    throw new ShopifyAdminError('Shopify GraphQL errors', res.data.errors);
  }
  return res.data?.data as T;
}

export const orderGid = (orderId: string | number) => `gid://shopify/Order/${String(orderId).replace(/\D/g, '')}`;

/** Mark the full outstanding balance as paid (external payment). Throws on userErrors. */
export async function markShopifyOrderPaid(domain: string, token: string, orderId: string | number): Promise<void> {
  const data = await shopifyGraphql<any>(domain, token, `mutation markPaid($input: OrderMarkAsPaidInput!) {
    orderMarkAsPaid(input: $input) { order { id displayFinancialStatus } userErrors { field message } }
  }`, { input: { id: orderGid(orderId) } });
  const errs = data?.orderMarkAsPaid?.userErrors || [];
  if (errs.length) throw new ShopifyAdminError('orderMarkAsPaid failed', errs);
}

/** Add tags without overwriting the merchant's existing tags. */
export async function addShopifyOrderTags(domain: string, token: string, orderId: string | number, tags: string[]): Promise<void> {
  const data = await shopifyGraphql<any>(domain, token, `mutation addTags($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
  }`, { id: orderGid(orderId), tags });
  const errs = data?.tagsAdd?.userErrors || [];
  if (errs.length) logger.warn('Shopify tagsAdd userErrors', { orderId, errs });
}

/**
 * Client credentials grant (Dev Dashboard apps installed on the merchant's own store).
 * Since 1 Jan 2026 Shopify no longer lets merchants create legacy custom apps that show a
 * permanent `shpat_` token; new apps get a client id + secret and exchange them for an
 * Admin API token that expires after ~24 hours.
 */
export async function exchangeClientCredentials(shopDomain: string, clientId: string, clientSecret: string): Promise<{ accessToken: string; scope: string; expiresAt: Date }> {
  const domain = String(shopDomain || '').toLowerCase();
  if (!SHOP_RE.test(domain)) throw new ShopifyAdminError(`Invalid Shopify domain: ${domain}`);
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const res = await axios.post(`https://${domain}/admin/oauth/access_token`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  const accessToken = res.data?.access_token;
  if (!accessToken) throw new ShopifyAdminError('Shopify did not return an access token', res.data);
  const expiresIn = Number(res.data?.expires_in) || 86399;
  return { accessToken, scope: String(res.data?.scope || ''), expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

/**
 * Resolve a usable Admin API token for a merchant, refreshing a client-credentials token
 * that is about to expire. Returns null when the store is not connected (or disconnected).
 */
export async function getShopifyAccess(merchant: any): Promise<{ domain: string; token: string } | null> {
  // Lazy imports keep this module free of model/encryption dependencies for tests.
  const { encryptionService } = require('./encryption.service');
  const { Merchant } = require('../models');
  const s = merchant?.shopify;
  if (s?.shopDomain && !s.demo && !s.uninstalledAt) {
    const domain = String(s.shopDomain).toLowerCase();
    const expiresSoon = s.tokenExpiresAt && new Date(s.tokenExpiresAt).getTime() - Date.now() < 5 * 60 * 1000;
    if (s.clientId && s.apiSecret && (!s.accessToken || expiresSoon)) {
      try {
        const secret = encryptionService.decrypt(s.apiSecret);
        const fresh = await exchangeClientCredentials(domain, s.clientId, secret);
        await Merchant.updateOne(
          { _id: merchant._id },
          { $set: { 'shopify.accessToken': encryptionService.encrypt(fresh.accessToken), 'shopify.tokenExpiresAt': fresh.expiresAt, 'shopify.scope': fresh.scope } }
        );
        return { domain, token: fresh.accessToken };
      } catch (err: any) {
        logger.error('Shopify client-credentials token refresh failed; merchant must reconnect', { merchantId: merchant?._id, error: err?.message });
        return null;
      }
    }
    if (s.accessToken) {
      try {
        return { domain, token: encryptionService.decrypt(s.accessToken) };
      } catch {
        logger.error('Stored Shopify access token cannot be decrypted; merchant must reconnect Shopify', { merchantId: merchant?._id });
        return null;
      }
    }
  }
  const pc = merchant?.platformConfig;
  if (pc?.shopifyDomain && pc?.shopifyAccessToken) {
    try {
      return { domain: String(pc.shopifyDomain).toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, ''), token: encryptionService.decrypt(pc.shopifyAccessToken) };
    } catch {
      logger.error('Stored Shopify access token cannot be decrypted; merchant must reconnect Shopify', { merchantId: merchant?._id });
    }
  }
  return null;
}

/** Write a JSON metafield on the shop (GraphQL metafieldsSet; replaces REST 2024-01). */
export async function setShopJsonMetafield(domain: string, token: string, namespace: string, key: string, value: unknown): Promise<void> {
  const shop = await shopifyGraphql<any>(domain, token, `{ shop { id } }`);
  const ownerId = shop?.shop?.id;
  if (!ownerId) throw new ShopifyAdminError('Could not resolve shop id');
  const data = await shopifyGraphql<any>(domain, token, `mutation setMf($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
  }`, { metafields: [{ ownerId, namespace, key, type: 'json', value: JSON.stringify(value) }] });
  const errs = data?.metafieldsSet?.userErrors || [];
  if (errs.length) throw new ShopifyAdminError('metafieldsSet failed', errs);
}
