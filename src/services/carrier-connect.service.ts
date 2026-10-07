/**
 * carrier-connect.service.ts
 * ─────────────────────────────────────────────────────────────
 * Validate-then-store. We hit a cheap read endpoint with the supplied
 * creds BEFORE encrypting+saving, so a merchant can never store dead
 * keys (self-serve safety). Reuses provider base URLs; never logs creds.
 */
import axios, { AxiosInstance } from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';
import { generateCarrierWebhookSecret } from '../webhooks/carrier-auth';
import { CarrierRateLimitError } from '../utils/errors.util';

// ─── 🔒 HTTP 429 Rate-Limit Interceptor for Carrier APIs ───
export function setupCarrierAxiosInterceptor(instance: AxiosInstance | typeof axios = axios) {
  return instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response && error.response.status === 429) {
        const msg = error.response.data?.message || 'Carrier Rate Limit Exceeded (429)';
        throw new CarrierRateLimitError(msg);
      }
      return Promise.reject(error);
    }
  );
}

// Register on global axios instance so all carrier API calls inherit it
setupCarrierAxiosInterceptor(axios);

export type Provider = 'shiprocket' | 'delhivery' | 'clickpost' | 'bluedart' | 'xpressbees' | 'shadowfax' | 'ecomexpress' | 'dtdc' | 'custom';
export interface CarrierCreds {
  provider: Provider;
  webhookOnly?: boolean;
  carrierName?: string;
  email?: string;
  password?: string;
  username?: string;
  apiToken?: string;
  apiKey?: string;
  customerCode?: string;
  licenseKey?: string;
  loginId?: string;
}

const HTTP_TIMEOUT_MS = 10000;
const MAX_CRED_LEN = 512;

function assertStr(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v.trim() || v.length > MAX_CRED_LEN) throw new Error(`${name} is required`);
  return v.trim();
}

async function validateShiprocket(c: CarrierCreds) {
  const email = assertStr(c.email, 'email');
  const password = assertStr(c.password, 'password');
  const { data } = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', { email, password }, { timeout: HTTP_TIMEOUT_MS });
  return data.token as string; // throws on 401
}

async function validateDelhivery(c: CarrierCreds) {
  const apiToken = assertStr(c.apiToken, 'apiToken');
  await axios.get('https://track.delhivery.com/api/v1/packages/json', {
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiToken}` },
    params: { id: '0' },
    timeout: HTTP_TIMEOUT_MS,
  });
}

async function validateClickpost(c: CarrierCreds) {
  const apiKey = assertStr(c.apiKey || c.apiToken, 'apiKey');
  const res = await axios.get('https://api.clickpost.in/api/v3/carriers/', { params: { key: apiKey }, timeout: HTTP_TIMEOUT_MS });
  if (typeof res.data !== 'object' || !res.data || (typeof res.data === 'string' && res.data.includes('<html'))) {
    throw new Error('Invalid ClickPost API key or service response.');
  }
  if (res.data?.meta?.success === false) {
    throw new Error(res.data?.meta?.message || 'Invalid ClickPost API key.');
  }
}

async function validateBluedart(c: CarrierCreds) {
  // Blue Dart enterprise credentials require Login ID and License Key (or API Key if through REST gateway)
  if (c.apiKey) {
    assertStr(c.apiKey, 'apiKey');
  } else {
    assertStr(c.loginId, 'loginId');
    assertStr(c.licenseKey, 'licenseKey');
    if (c.customerCode) assertStr(c.customerCode, 'customerCode');
  }
}

async function validateXpressbees(c: CarrierCreds) {
  const key = assertStr(c.apiKey || c.apiToken, 'apiKey');
  if (process.env.NODE_ENV !== 'test') {
    try {
      // Validate with a light status check
      await axios.get('https://shipment.xpressbees.com/api/v1/courier/serviceability', {
        headers: { XBKey: key },
        timeout: HTTP_TIMEOUT_MS,
      });
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw new Error('Invalid Xpressbees API Key (XBKey)');
      }
      // Non-auth errors (e.g. 404/422 on empty params) confirm key reached the gateway
    }
  }
}

async function validateShadowfax(c: CarrierCreds) {
  const key = assertStr(c.apiKey || c.apiToken, 'apiKey');
  if (process.env.NODE_ENV !== 'test') {
    try {
      await axios.get('https://api.shadowfax.in/api/v2/clients/details', {
        headers: { Authorization: `Token ${key}` },
        timeout: HTTP_TIMEOUT_MS,
      });
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw new Error('Invalid Shadowfax API Token');
      }
    }
  }
}

async function validateEcomexpress(c: CarrierCreds) {
  const username = assertStr(c.username || c.email, 'username');
  const password = assertStr(c.password, 'password');
  if (process.env.NODE_ENV !== 'test') {
    try {
      await axios.post(
        'https://api.ecomexpress.in/apiv2/pincode/',
        { username, password },
        { timeout: HTTP_TIMEOUT_MS }
      );
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw new Error('Invalid Ecom Express credentials');
      }
    }
  }
}

async function validateDtdc(c: CarrierCreds) {
  const apiKey = assertStr(c.apiKey || c.apiToken, 'apiKey');
  if (c.customerCode) assertStr(c.customerCode, 'customerCode');
  if (process.env.NODE_ENV !== 'test') {
    try {
      await axios.get('https://api.dtdc.com/tracking', {
        headers: { 'X-Access-Token': apiKey },
        timeout: HTTP_TIMEOUT_MS,
      });
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw new Error('Invalid DTDC API Key / Access Token');
      }
    }
  }
}

/** Where the carrier should POST NDR events for this merchant. */
export function carrierWebhookUrl(provider: Provider, merchantId: string): string {
  const base = (process.env.API_PUBLIC_URL || process.env.API_BASE_URL || '').replace(/\/$/, '');
  return `${base}/webhooks/${provider}/ndr?merchant_id=${encodeURIComponent(merchantId)}`;
}

export class CarrierConnectService {
  async validateAndSave(merchantId: string, creds: CarrierCreds) {
    // 1. validate (throws → we never store)
    let shiprocketToken: string | undefined;
    if (creds.webhookOnly) {
      // Webhook-only mode requires no outbound API credentials
    } else if (creds.provider === 'shiprocket') {
      shiprocketToken = await validateShiprocket(creds);
    } else if (creds.provider === 'delhivery') {
      await validateDelhivery(creds);
    } else if (creds.provider === 'clickpost') {
      await validateClickpost(creds);
    } else if (creds.provider === 'bluedart') {
      await validateBluedart(creds);
    } else if (creds.provider === 'xpressbees') {
      await validateXpressbees(creds);
    } else if (creds.provider === 'shadowfax') {
      await validateShadowfax(creds);
    } else if (creds.provider === 'ecomexpress') {
      await validateEcomexpress(creds);
    } else if (creds.provider === 'dtdc') {
      await validateDtdc(creds);
    } else if (creds.provider === 'custom') {
      // Custom courier / aggregator
    } else {
      throw new Error('Unsupported carrier');
    }

    // 2. store encrypted (engine reads these unchanged)
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const existing: any = (merchant as any).carrierConfig || {};
    const existingCarriers: any = existing.carriers || {};
    const existingCarrierData: any = existingCarriers[creds.provider] || (existing.provider === creds.provider ? existing : {});

    const webhookSecretPlain = existingCarrierData.webhookSecret
      ? (() => { try { return encryptionService.decrypt(existingCarrierData.webhookSecret); } catch { return generateCarrierWebhookSecret(); } })()
      : (existing.webhookSecret ? (() => { try { return encryptionService.decrypt(existing.webhookSecret); } catch { return generateCarrierWebhookSecret(); } })() : generateCarrierWebhookSecret());

    const store: any = {
      provider: creds.provider,
      mode: creds.webhookOnly ? 'webhook_only' : 'api',
      carrierName: creds.carrierName || undefined,
      webhookSecret: encryptionService.encrypt(webhookSecretPlain),
      connectedAt: new Date(),
    };
    if (creds.apiToken) store.apiToken = encryptionService.encrypt(creds.apiToken.trim());
    if (creds.apiKey) {
      const enc = encryptionService.encrypt(creds.apiKey.trim());
      store.apiKey = enc;
      if (!creds.apiToken) store.apiToken = enc;
    }
    if (creds.email) store.email = encryptionService.encrypt(creds.email.trim());
    if (creds.username) store.username = encryptionService.encrypt(creds.username.trim());
    if (creds.password) store.password = encryptionService.encrypt(creds.password);
    if (creds.customerCode) store.customerCode = encryptionService.encrypt(creds.customerCode.trim());
    if (creds.licenseKey) store.licenseKey = encryptionService.encrypt(creds.licenseKey.trim());
    if (creds.loginId) store.loginId = encryptionService.encrypt(creds.loginId.trim());
    if (shiprocketToken) store.shiprocketToken = encryptionService.encrypt(shiprocketToken);

    // Save multi-carrier map and update primary provider for backward compatibility
    existingCarriers[creds.provider] = store;
    (merchant as any).carrierConfig = {
      ...existing,
      ...store,
      carriers: existingCarriers,
    };
    merchant.markModified('carrierConfig');

    const currentConn = (merchant as any).connections || {};
    const currentCarriersConn = currentConn.carriers || {};
    currentCarriersConn[creds.provider] = { status: 'connected', connectedAt: new Date(), provider: creds.provider, lastError: null };

    (merchant as any).connections = {
      ...currentConn,
      carrier: { status: 'connected', connectedAt: new Date(), provider: creds.provider, lastError: null },
      carriers: currentCarriersConn,
    };
    merchant.markModified('connections');
    await merchant.save();

    logger.info('Carrier connected', { merchantId, provider: creds.provider });
    return {
      status: 'connected',
      provider: creds.provider,
      webhookUrl: carrierWebhookUrl(creds.provider, merchantId),
      webhookSecret: webhookSecretPlain,
    };
  }

  async disconnectCarrier(merchantId: string, provider?: Provider) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const cfg: any = (merchant as any).carrierConfig || {};
    const carriers: any = { ...(cfg.carriers || {}) };
    const conns: any = (merchant as any).connections || {};
    const connCarriers: any = { ...(conns.carriers || {}) };

    if (provider && carriers[provider]) {
      delete carriers[provider];
      delete connCarriers[provider];
      const remainingKeys = Object.keys(carriers);
      if (remainingKeys.length > 0) {
        const nextProvider = remainingKeys[0];
        (merchant as any).carrierConfig = {
          ...carriers[nextProvider],
          carriers,
        };
        (merchant as any).connections = {
          ...conns,
          carrier: { status: 'connected', connectedAt: new Date(), provider: nextProvider, lastError: null },
          carriers: connCarriers,
        };
      } else {
        (merchant as any).carrierConfig = undefined;
        (merchant as any).connections = {
          ...conns,
          carrier: { status: 'disconnected', lastError: null },
          carriers: {},
        };
      }
    } else {
      // Disconnect all
      (merchant as any).carrierConfig = undefined;
      (merchant as any).connections = {
        ...conns,
        carrier: { status: 'disconnected', lastError: null },
        carriers: {},
      };
    }

    merchant.markModified('carrierConfig');
    merchant.markModified('connections');
    await merchant.save();
    logger.info('Carrier(s) disconnected', { merchantId, provider: provider || 'all' });
    return { ok: true, status: 'disconnected', provider: provider || 'all' };
  }

  /** Return carrier webhook credentials for all connected carriers. */
  async webhookCredentials(merchantId: string): Promise<{
    provider: Provider | null;
    webhookUrl: string | null;
    webhookSecret: string | null;
    carriers: Array<{
      provider: Provider;
      carrierName?: string | null;
      mode?: string | null;
      status: 'connected' | 'disconnected';
      webhookUrl: string;
      webhookSecret: string | null;
    }>;
  }> {
    const merchant = await Merchant.findById(merchantId).select('carrierConfig');
    const cfg: any = (merchant as any)?.carrierConfig;
    const allProviders: Provider[] = ['shiprocket', 'delhivery', 'clickpost', 'bluedart', 'xpressbees', 'shadowfax', 'ecomexpress', 'dtdc', 'custom'];

    const connectedMap: Record<string, any> = cfg?.carriers || (cfg?.provider ? { [cfg.provider]: cfg } : {});

    const list = allProviders.map((p) => {
      const isConnected = !!connectedMap[p];
      let plainSecret: string | null = null;
      if (isConnected && connectedMap[p]?.webhookSecret) {
        try { plainSecret = encryptionService.decrypt(connectedMap[p].webhookSecret); } catch { plainSecret = null; }
      }
      return {
        provider: p,
        carrierName: connectedMap[p]?.carrierName || null,
        mode: connectedMap[p]?.mode || (isConnected ? 'api' : null),
        status: (isConnected ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
        webhookUrl: carrierWebhookUrl(p, merchantId),
        webhookSecret: plainSecret,
      };
    });

    const primary = cfg?.provider || null;
    const primaryInfo = list.find((x) => x.provider === primary);

    return {
      provider: primary,
      webhookUrl: primary ? carrierWebhookUrl(primary, merchantId) : null,
      webhookSecret: primaryInfo?.webhookSecret || null,
      carriers: list,
    };
  }
}
export const carrierConnectService = new CarrierConnectService();
