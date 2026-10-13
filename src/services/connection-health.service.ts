/**
 * connection-health.service.ts
 * ─────────────────────────────────────────────────────────────
 * Connections go stale silently: a Shopify token is revoked, a 24h WhatsApp test token
 * expires, nobody ever added the Razorpay webhook. Before this check, the dashboard still
 * said "connected" while every order event or payment confirmation was being lost.
 *
 * Read-only probes per merchant; results are stored on connections.<kind>.health and a
 * failing check flips that connection to 'error' (WhatsApp: 'token_expired') so the merchant
 * sees it. A later passing check restores 'connected' only if this service set the error.
 */
import axios from 'axios';
import { Merchant } from '../models';
import { encryptionService } from './encryption.service';
import { logger } from '../utils/logger';

export interface HealthResult {
  /** true = working, false = broken, null = not connected / not checkable */
  ok: boolean | null;
  detail: string;
  checkedAt: Date;
}

type Kind = 'shopify' | 'whatsapp' | 'payment' | 'carrier';

const dec = (v?: string): string | undefined => {
  if (!v) return undefined;
  try { return encryptionService.decrypt(v); } catch { return undefined; }
};
const apiBase = () => (process.env.API_PUBLIC_URL || process.env.API_BASE_URL || '').replace(/\/$/, '');
const result = (ok: boolean | null, detail: string): HealthResult => ({ ok, detail, checkedAt: new Date() });
const errText = (e: any) => String(e?.response?.data?.error?.message || e?.response?.data?.errors || e?.response?.data?.message || e?.message || 'request failed').slice(0, 200);

export async function checkShopify(merchant: any): Promise<HealthResult> {
  if (!merchant?.shopify?.shopDomain && !merchant?.platformConfig?.shopifyDomain) return result(null, 'Not connected');
  const { getShopifyAccess, shopifyGraphql } = require('./shopify-admin');
  const access = await getShopifyAccess(merchant);
  if (!access) return result(false, 'No usable Shopify token. Reconnect the store.');
  try {
    await shopifyGraphql(access.domain, access.token, '{ shop { name } }');
    return result(true, 'Shopify API reachable');
  } catch (e: any) {
    const status = e?.response?.status;
    return result(false, status === 401 || status === 403
      ? 'Shopify rejected the stored token (app uninstalled or token revoked). Reconnect the store.'
      : `Shopify check failed: ${errText(e)}`);
  }
}

export async function checkWhatsApp(merchant: any): Promise<HealthResult> {
  const w = merchant?.whatsappConfig || {};
  if (!w.phoneNumberId) return result(null, 'Not connected');
  const token = dec(w.accessToken);
  if (!token) return result(false, 'No usable WhatsApp token. Reconnect WhatsApp.');
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v22.0/${encodeURIComponent(w.phoneNumberId)}`, {
      params: { fields: 'id,quality_rating,status' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return result(true, `Number ${data.status || 'reachable'}, quality ${data.quality_rating || 'unknown'}`);
  } catch (e: any) {
    const code = e?.response?.data?.error?.code;
    return result(false, code === 190
      ? 'WhatsApp access token expired. Use a permanent System User token.'
      : `WhatsApp check failed: ${errText(e)}`);
  }
}

export async function checkPayment(merchant: any): Promise<HealthResult> {
  const pc = merchant?.paymentConfig || {};
  const provider = pc.provider || pc.gateway;
  if (!provider || !pc.keyId) return result(null, 'Not connected');
  const keyId = dec(pc.keyId);
  const keySecret = dec(pc.keySecret);
  if (!keyId || !keySecret) return result(false, 'Stored gateway keys cannot be read. Reconnect the gateway.');

  if (provider === 'razorpay') {
    const auth = { username: keyId, password: keySecret };
    try {
      await axios.get('https://api.razorpay.com/v1/payment_links', { params: { count: 1 }, auth, timeout: 10000 });
    } catch (e: any) {
      return result(false, e?.response?.status === 401 ? 'Razorpay rejected the API keys.' : `Razorpay check failed: ${errText(e)}`);
    }
    // Is a webhook pointing at us with payment_link.paid? Without it, paid links never confirm.
    try {
      const { data } = await axios.get('https://api.razorpay.com/v1/webhooks', { auth, timeout: 10000 });
      const target = `${apiBase()}/webhooks/payment`;
      const items: any[] = data?.items || [];
      const ours = items.find((w) => String(w.url || '').replace(/\/$/, '') === target && w.active !== false);
      if (!ours) {
        return result(false, `No Razorpay webhook for ${target}. Add it with the payment_link.paid event, then run the ₹1 test.`);
      }
      if (!(ours.events && ours.events['payment_link.paid'])) {
        return result(false, 'The Razorpay webhook does not include the payment_link.paid event.');
      }
    } catch {
      // Listing webhooks is not available on every account; fall back to the signed-event proof.
    }
    return pc.webhookVerifiedAt
      ? result(true, 'Keys valid, signed webhook received')
      : result(false, 'Keys valid, but no signed webhook received yet. Run the ₹1 test link.');
  }

  if (provider === 'cashfree') {
    const env = process.env.CASHFREE_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
    const base = env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    try {
      await axios.get(`${base}/orders`, { params: { limit: 1 }, headers: { 'x-client-id': keyId, 'x-client-secret': keySecret, 'x-api-version': '2023-08-01' }, timeout: 10000 });
    } catch (e: any) {
      if (e?.response?.status === 401) return result(false, 'Cashfree rejected the API keys.');
    }
    return pc.webhookVerifiedAt
      ? result(true, 'Keys valid, signed webhook received')
      : result(false, 'Keys valid, but no signed webhook received yet. Run the ₹1 test link.');
  }
  return result(null, `Unsupported gateway ${provider}`);
}

export async function checkCarrier(merchant: any): Promise<HealthResult> {
  const cc = merchant?.carrierConfig || {};
  const provider = cc.provider;
  if (!provider) return result(null, 'Not connected');
  const specific = cc.carriers?.[provider] || cc;
  if (specific.mode === 'webhook_only') return result(null, 'Webhook-only: courier actions are manual');
  if (provider === 'shiprocket') {
    const email = dec(specific.email);
    const password = dec(specific.password);
    if (!email || !password) return result(false, 'Shiprocket API user missing. Reconnect Shiprocket.');
    try {
      const { data } = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', { email, password }, { timeout: 15000 });
      return data?.token ? result(true, 'Shiprocket API login works') : result(false, 'Shiprocket login returned no token');
    } catch (e: any) {
      return result(false, `Shiprocket login failed: ${errText(e)}`);
    }
  }
  return result(null, `${provider}: no automatic check yet`);
}

const CHECKS: Record<Kind, (m: any) => Promise<HealthResult>> = {
  shopify: checkShopify,
  whatsapp: checkWhatsApp,
  payment: checkPayment,
  carrier: checkCarrier,
};

/** Run all checks for one merchant and persist the results. */
export async function checkMerchantConnections(merchantId: string): Promise<Record<Kind, HealthResult>> {
  const merchant: any = await Merchant.findById(merchantId);
  if (!merchant) throw new Error('Merchant not found');
  const out = {} as Record<Kind, HealthResult>;
  const $set: Record<string, unknown> = {};

  for (const kind of Object.keys(CHECKS) as Kind[]) {
    let r: HealthResult;
    try {
      r = await CHECKS[kind](merchant);
    } catch (e: any) {
      r = result(null, `Check could not run: ${errText(e)}`);
    }
    out[kind] = r;
    $set[`connections.${kind}.health`] = r;
    const current = merchant.connections?.[kind] || {};
    if (r.ok === false) {
      const broken = kind === 'whatsapp' && /expired/i.test(r.detail) ? 'token_expired' : 'error';
      // Payment "webhook not proven yet" is a setup step, not a broken connection.
      if (!(kind === 'payment' && /no signed webhook received yet/.test(r.detail))) {
        $set[`connections.${kind}.status`] = broken;
        $set[`connections.${kind}.lastError`] = r.detail;
        $set[`connections.${kind}.brokenByHealthCheck`] = true;
      }
    } else if (r.ok === true && current.brokenByHealthCheck) {
      $set[`connections.${kind}.status`] = 'connected';
      $set[`connections.${kind}.lastError`] = null;
      $set[`connections.${kind}.brokenByHealthCheck`] = false;
    }
  }

  await Merchant.updateOne({ _id: merchant._id }, { $set });
  const failing = (Object.keys(out) as Kind[]).filter((k) => out[k].ok === false);
  if (failing.length) logger.warn('Connection health: problems found', { merchantId, failing });
  return out;
}

/** Sweep every merchant that finished onboarding (used by the daily job). */
export async function checkAllMerchants(): Promise<{ checked: number; failing: number }> {
  const merchants = await Merchant.find({ onboardingStatus: 'completed' }).select('_id').lean();
  let failing = 0;
  for (const m of merchants) {
    try {
      const r = await checkMerchantConnections(String(m._id));
      if (Object.values(r).some((x) => x.ok === false)) failing++;
    } catch (e: any) {
      logger.warn('Connection health check failed for merchant', { merchantId: String(m._id), error: e?.message });
    }
  }
  return { checked: merchants.length, failing };
}
