/**
 * meta-embedded-signup.service.ts
 * ─────────────────────────────────────────────────────────────
 * Turns the code Meta's Embedded Signup popup returns into a working
 * WhatsApp Cloud API connection:
 *   code → business integration token (Tech Provider flow) →
 *   WABA + phone from the popup's session info (verified against the token) →
 *   subscribe our app to the WABA's webhooks → register the number.
 *
 * Idempotent: if the merchant already holds a valid token for the same
 * WABA we verify-and-reuse.
 *
 * NEVER logs tokens. Logs only Meta error.code/type/message.
 */
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

const G = 'https://graph.facebook.com/v22.0';
export const REQUIRED_WA_SCOPES = ['whatsapp_business_messaging', 'whatsapp_business_management'];

interface Cfg { appId: string; appSecret: string; redirectUri?: string; }
function cfg(): Cfg {
  return {
    appId: process.env.META_APP_ID!,
    // One Meta app: the same secret signs webhooks (WHATSAPP_APP_SECRET) and exchanges codes.
    appSecret: process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET!,
    // The JS SDK popup flow has no redirect URI; only send one if the deployment uses a redirect flow.
    redirectUri: process.env.META_REDIRECT_URI || undefined,
  };
}
const mask = (s?: string) => (s ? `${s.slice(0, 4)}…${s.slice(-2)}` : '');

async function post(path: string, params: Record<string, any>, token?: string) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const { data } = await axios.post(`${G}${path}`, null, { params, headers });
    return data;
  } catch (e: any) {
    const m = e.response?.data?.error;
    logger.error('Meta API error', { path, code: m?.code, type: m?.type, message: m?.message }); // no token
    throw new Error(m?.message || e.message);
  }
}
async function get(path: string, params: Record<string, any>, token: string) {
  try {
    const { data } = await axios.get(`${G}${path}`, { params, headers: { Authorization: `Bearer ${token}` } });
    return data;
  } catch (e: any) {
    const m = e.response?.data?.error;
    logger.error('Meta API error', { path, code: m?.code, type: m?.type, message: m?.message });
    throw new Error(m?.message || e.message);
  }
}

export class MetaEmbeddedSignupService {
  /** Check if required Meta OAuth environment variables are configured. */
  public initialize(): { initialized: boolean; error?: string; statusCode?: number } {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;

    if (!appId || !appSecret) {
      const missing = [
        !appId && 'META_APP_ID',
        !appSecret && 'META_APP_SECRET',
      ].filter(Boolean).join(', ');

      return {
        initialized: false,
        error: `Meta Embedded Signup unconfigured: missing ${missing}`,
        statusCode: 503,
      };
    }
    return { initialized: true, statusCode: 200 };
  }

  /** 1. code → business integration system user token (Embedded Signup, Tech Provider) */
  private async exchangeCode(code: string): Promise<string> {
    const c = cfg();
    const r = await post('/oauth/access_token', {
      client_id: c.appId, client_secret: c.appSecret, code,
      ...(c.redirectUri ? { redirect_uri: c.redirectUri } : {}),
    });
    if (!r.access_token) throw new Error('Meta returned no access_token');
    return r.access_token as string;
  }

  /**
   * 2. Resolve the WABA + phone the merchant picked in the popup. The ids come from the
   * browser (session info), so they are only trusted after the token proves access:
   * the phone must be listed under that WABA.
   */
  private async resolveWaba(token: string, wabaIdHint?: string, phoneIdHint?: string) {
    let wabaId = wabaIdHint;
    if (!wabaId) {
      // Fallback for older popups without session info: the token's granular scopes name the WABA.
      const dbg = await get('/debug_token', { input_token: token }, `${cfg().appId}|${cfg().appSecret}`);
      const scopes: any[] = dbg?.data?.granular_scopes || [];
      const ids = new Set<string>();
      scopes.filter((g) => /whatsapp_business_(management|messaging)/.test(g.scope)).forEach((g) => (g.target_ids || []).forEach((x: string) => ids.add(x)));
      if (ids.size !== 1) throw new Error('Could not tell which WhatsApp Business Account you selected. Please run the signup again and finish all steps.');
      wabaId = [...ids][0];
    }
    const waba = await get(`/${wabaId}`, { fields: 'id,name,message_template_namespace' }, token);
    const phones = (await get(`/${wabaId}/phone_numbers`, { fields: 'id,display_phone_number,verified_name,quality_rating,platform_type,status' }, token))?.data || [];
    const phone = phoneIdHint ? phones.find((p: any) => p.id === phoneIdHint) : (phones.length === 1 ? phones[0] : null);
    if (!phone) throw new Error(phoneIdHint ? 'The selected phone number does not belong to this WhatsApp Business Account.' : 'Select one phone number in the signup popup.');
    return { wabaId: String(waba.id), wabaName: waba.name, namespace: waba.message_template_namespace, phoneId: String(phone.id), displayPhone: phone.display_phone_number, platformType: phone.platform_type };
  }

  /**
   * 3. Make the number usable: subscribe the app to the WABA's webhooks (otherwise no
   * inbound messages arrive) and register the number on Cloud API with a 2-step PIN.
   * Never throws: returns what failed so the dashboard can show it.
   */
  async activateNumber(wabaId: string, phoneId: string, token: string, opts: { pin?: string; register?: boolean } = {}): Promise<{ subscribed: boolean; registered: boolean | null; pin?: string; errors: string[] }> {
    const errors: string[] = [];
    let subscribed = false;
    let registered: boolean | null = null;
    let pin: string | undefined;
    try {
      const r = await post(`/${wabaId}/subscribed_apps`, {}, token);
      subscribed = r?.success !== false;
    } catch (e: any) {
      errors.push(`Webhook subscription failed: ${e.message}`);
    }
    if (opts.register) {
      pin = opts.pin && /^\d{6}$/.test(opts.pin) ? opts.pin : String(require('crypto').randomInt(0, 1_000_000)).padStart(6, '0');
      try {
        const r = await post(`/${phoneId}/register`, { messaging_product: 'whatsapp', pin }, token);
        registered = r?.success !== false;
      } catch (e: any) {
        registered = false;
        errors.push(`Number registration failed: ${e.message}. If two-step verification is already on for this number, enter its 6-digit PIN and retry.`);
      }
    }
    return { subscribed, registered, pin, errors };
  }

  /**
   * Inspect a pasted token (manual connect). A token can debug itself, so this works for
   * a merchant's own Meta app too. Temporary tokens from the API Setup page expire in
   * ~24h and must be rejected; System User tokens have expires_at = 0.
   */
  async inspectToken(token: string): Promise<{ valid: boolean; expiresAt: Date | null; scopes: string[]; appId?: string }> {
    const r = await get('/debug_token', { input_token: token }, token);
    const d = r?.data || {};
    const exp = Number(d.expires_at || 0);
    return { valid: !!d.is_valid, expiresAt: exp > 0 ? new Date(exp * 1000) : null, scopes: d.scopes || [], appId: d.app_id };
  }

  /** Verify a stored token is still good (debug_token). */
  async tokenIsValid(token: string): Promise<boolean> {
    try {
      const r = await get('/debug_token', { input_token: token, access_token: `${cfg().appId}|${cfg().appSecret}` }, `${cfg().appId}|${cfg().appSecret}`);
      return !!r.data?.is_valid;
    } catch { return false; }
  }

  /**
   * Full connect. Idempotent on (businessId + systemUserToken).
   * Returns a plain summary — NEVER the raw token.
   */
  async connect(merchantId: string, code: string, session: { businessId?: string; wabaId?: string; phoneNumberId?: string; pin?: string } = {}) {
    const init = this.initialize();
    if (!init.initialized) {
      const err: any = new Error(init.error);
      err.statusCode = init.statusCode || 503;
      throw err;
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    // Idempotent reuse when the popup re-runs for the same WABA.
    const existing = (merchant as any).whatsappConfig?.accessToken;
    const sameWaba = !session.wabaId || session.wabaId === (merchant as any).whatsappConfig?.wabaId;
    if (existing && sameWaba && (merchant as any).whatsappConfig?.wabaId) {
      let plain: string;
      try { plain = encryptionService.decrypt(existing); } catch { plain = ''; }
      if (plain && await this.tokenIsValid(plain)) {
        logger.info('Meta connect: reusing existing token', { merchantId });
        return this.summary(merchant);
      }
    }

    const token = await this.exchangeCode(code);
    const waba = await this.resolveWaba(token, session.wabaId, session.phoneNumberId);

    const { Merchant: M } = require('../models');
    const other = await M.findOne({ _id: { $ne: merchantId }, 'whatsappConfig.phoneNumberId': waba.phoneId }).select('_id');
    if (other) throw new Error('This WhatsApp number is already connected to another RescueShip account.');

    const activation = await this.activateNumber(waba.wabaId, waba.phoneId, token, {
      pin: session.pin,
      register: waba.platformType !== 'CLOUD_API',
    });

    (merchant as any).whatsappConfig = {
      ...((merchant as any).whatsappConfig || {}),
      metaBusinessId: session.businessId || (merchant as any).whatsappConfig?.metaBusinessId,
      wabaId: waba.wabaId,
      businessAccountId: waba.wabaId,
      wabaName: waba.wabaName,
      phoneNumberId: waba.phoneId,           // drives WABA-scoped inbound matching (L-2)
      displayPhone: waba.displayPhone,
      accessToken: encryptionService.encrypt(token),
      connectMethod: 'embedded_signup',
      webhooksSubscribed: activation.subscribed,
      ...(activation.pin && activation.registered ? { registrationPin: encryptionService.encrypt(activation.pin) } : {}),
    };
    const blocking = !activation.subscribed || activation.registered === false;
    (merchant as any).connections = {
      ...((merchant as any).connections || {}),
      whatsapp: {
        status: blocking ? 'error' : 'templates_pending',
        connectedAt: new Date(),
        lastError: activation.errors.length ? activation.errors.join(' ') : null,
      },
    };
    merchant.markModified('whatsappConfig');
    await merchant.save();
    logger.info('Meta connect: provisioned', { merchantId, wabaId: waba.wabaId, phoneMask: mask(waba.phoneId), subscribed: activation.subscribed, registered: activation.registered });
    return this.summary(merchant);
  }

  private summary(m: any) {
    const w = m.whatsappConfig || {};
    return {
      status: m.connections?.whatsapp?.status || 'connected',
      wabaName: w.wabaName, displayPhone: w.displayPhone, phoneNumberId: w.phoneNumberId,
      templates: w.templates || [],
      lastError: m.connections?.whatsapp?.lastError || null,
    };
  }
}
export const metaEmbeddedSignupService = new MetaEmbeddedSignupService();
