/**
 * carrier-connect.service.ts
 * ─────────────────────────────────────────────────────────────
 * Validate-then-store. We hit a cheap read endpoint with the supplied
 * creds BEFORE encrypting+saving, so a merchant can never store dead
 * keys (self-serve safety). Reuses provider base URLs; never logs creds.
 */
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';
import { generateCarrierWebhookSecret } from '../webhooks/carrier-auth';

export type Provider = 'shiprocket' | 'delhivery' | 'clickpost';
export interface CarrierCreds { provider: Provider; email?: string; password?: string; apiToken?: string; apiKey?: string; }

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
  await axios.get('https://track.delhivery.com/api/v1/packages/json', { headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiToken}` }, params: { id: '0' }, timeout: HTTP_TIMEOUT_MS }); // 401/403 throws
}
async function validateClickpost(c: CarrierCreds) {
  const apiKey = assertStr(c.apiKey, 'apiKey');
  await axios.get('https://api.clickpost.in/api/v3/carriers/', { params: { key: apiKey }, timeout: HTTP_TIMEOUT_MS }); // 401 throws
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
    if (creds.provider === 'shiprocket') shiprocketToken = await validateShiprocket(creds);
    else if (creds.provider === 'delhivery') await validateDelhivery(creds);
    else if (creds.provider === 'clickpost') await validateClickpost(creds);
    else throw new Error('Unsupported carrier');

    // 2. store encrypted (engine reads these unchanged)
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    // Per-merchant webhook secret: the carrier presents it as x-api-key / signature.
    // Keep the existing one across reconnects so the merchant's carrier panel keeps working.
    const existing: any = (merchant as any).carrierConfig || {};
    const webhookSecretPlain = existing.webhookSecret
      ? (() => { try { return encryptionService.decrypt(existing.webhookSecret); } catch { return generateCarrierWebhookSecret(); } })()
      : generateCarrierWebhookSecret();

    const store: any = { provider: creds.provider, webhookSecret: encryptionService.encrypt(webhookSecretPlain) };
    if (creds.apiToken) store.apiToken = encryptionService.encrypt(creds.apiToken.trim());
    if (creds.apiKey) {
      const enc = encryptionService.encrypt(creds.apiKey.trim());
      store.apiKey = enc;
      // logistics.service reads piToken for every carrier; keep both names in sync.
      if (creds.provider === 'clickpost' && !creds.apiToken) store.apiToken = enc;
    }
    if (creds.email) store.email = encryptionService.encrypt(creds.email.trim());
    if (creds.password) store.password = encryptionService.encrypt(creds.password);
    if (shiprocketToken) store.shiprocketToken = encryptionService.encrypt(shiprocketToken);
    (merchant as any).carrierConfig = store;
    merchant.markModified('carrierConfig');
    const currentConn = (merchant as any).connections || {};
    (merchant as any).connections = {
      shopify: currentConn.shopify || { status: 'disconnected' },
      whatsapp: currentConn.whatsapp || { status: 'disconnected' },
      payment: currentConn.payment || { status: 'disconnected' },
      carrier: { status: 'connected', connectedAt: new Date(), provider: creds.provider, lastError: null },
    };
    merchant.markModified('connections');
    await merchant.save();
    logger.info('Carrier connected', { merchantId, provider: creds.provider });
    // The merchant pastes webhookUrl + webhookSecret into their carrier panel.
    return {
      status: 'connected',
      provider: creds.provider,
      webhookUrl: carrierWebhookUrl(creds.provider, merchantId),
      webhookSecret: webhookSecretPlain,
    };
  }

  /** Return (and lazily create) the merchant's carrier webhook credentials for display in the dashboard. */
  async webhookCredentials(merchantId: string): Promise<{ provider: Provider | null; webhookUrl: string | null; webhookSecret: string | null }> {
    const merchant = await Merchant.findById(merchantId).select('carrierConfig');
    const cfg: any = (merchant as any)?.carrierConfig;
    if (!merchant || !cfg?.provider) return { provider: null, webhookUrl: null, webhookSecret: null };

    let plain: string | null = null;
    if (cfg.webhookSecret) {
      try { plain = encryptionService.decrypt(cfg.webhookSecret); } catch { plain = null; }
    }
    if (!plain) {
      plain = generateCarrierWebhookSecret();
      await Merchant.updateOne({ _id: merchant._id }, { $set: { 'carrierConfig.webhookSecret': encryptionService.encrypt(plain) } });
    }
    return { provider: cfg.provider, webhookUrl: carrierWebhookUrl(cfg.provider, merchantId), webhookSecret: plain };
  }
}
export const carrierConnectService = new CarrierConnectService();
