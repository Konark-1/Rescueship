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
