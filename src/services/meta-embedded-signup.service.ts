/**
 * meta-embedded-signup.service.ts
 * ─────────────────────────────────────────────────────────────
 * Turns the code Meta's Embedded Signup popup returns into a
 * DURABLE, on-behalf-of credential set:
 *   code → user token → business → WABA + phone → system user →
 *   permanent system-user token → assign WABA asset.
 *
 * Idempotent: if the merchant already holds a business + system-user
 * token we verify-and-reuse instead of creating duplicates.
 *
 * NEVER logs tokens. Logs only Meta error.code/type/message.
 */
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

const G = 'https://graph.facebook.com/v22.0';
const SCOPES = ['whatsapp_business_messaging', 'whatsapp_business_management', 'business_management'];

interface Cfg { appId: string; appSecret: string; redirectUri: string; }
function cfg(): Cfg {
  return {
    appId: process.env.META_APP_ID!,
    appSecret: process.env.META_APP_SECRET!,
    redirectUri: process.env.META_REDIRECT_URI!,
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
  /** 1. code → short-lived user access token */
  private async exchangeCode(code: string): Promise<string> {
    const c = cfg();
    const r = await post('/oauth/access_token', {
      client_id: c.appId, client_secret: c.appSecret, redirect_uri: c.redirectUri, code,
    });
    if (!r.access_token) throw new Error('Meta returned no access_token');
    return r.access_token as string;
  }

  /** 2. which business did the user just sign up / select? */
  private async resolveBusiness(userToken: string, hint?: string): Promise<string> {
    if (hint) return hint;
    const me = await get('/me', { fields: 'businesses' }, userToken);
    const id = me.businesses?.data?.[0]?.id;
    if (!id) throw new Error('No Meta Business found on the signed-in account. Are you a Business admin?');
    return id;
  }

  /** 3. read WABA + phone numbers off that business */
  private async resolveWaba(businessId: string, userToken: string) {
    const b = await get(`/${businessId}`, {
      fields: 'whatsapp_business_accounts{id,name,message_template_namespace,phone_numbers{id,display_phone_number,verified_name,quality_rating}}',
    }, userToken);
    const waba = b.whatsapp_business_accounts?.data?.[0];
    if (!waba) throw new Error('No WhatsApp Business Account on this Business. Complete Embedded Signup first.');
    const phones = waba.phone_numbers?.data || [];
    const phone = phones.find((p: any) => p.verified_name) || phones[0];
    if (!phone) throw new Error('No phone number provisioned on the WABA.');
    return { wabaId: waba.id, wabaName: waba.name, namespace: waba.message_template_namespace, phoneId: phone.id, displayPhone: phone.display_phone_number };
  }

  /** 4. permanent system-user token + assign the WABA to it */
  private async provisionSystemUser(businessId: string, wabaId: string, userToken: string) {
    const su = await post(`/${businessId}/system_users`, { name: 'RescueShip Engine', role: 'EMPLOYEE' }, userToken);
    const tok = await post(`/${su.id}/access_tokens`, {
      business_app: cfg().appId, scope: SCOPES, expires_in: 'NEVER',
    }, userToken);
    await post(`/${su.id}/assigned_whatsapp_business_accounts`, {
      whatsapp_business_accounts: [wabaId], access_level: 'MANAGE',
    }, userToken);
    return { systemUserId: su.id, systemUserToken: tok.access_token as string };
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
  async connect(merchantId: string, code: string, businessIdHint?: string) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    // Idempotent reuse
    const existing = (merchant as any).whatsappConfig?.accessToken;
    if (existing && (merchant as any).whatsappConfig?.metaBusinessId) {
      let plain: string;
      try { plain = encryptionService.decrypt(existing); } catch { plain = ''; }
      if (plain && await this.tokenIsValid(plain)) {
        logger.info('Meta connect: reusing existing system-user token', { merchantId });
        return this.summary(merchant);
      }
    }

    const userToken = await this.exchangeCode(code);
    const businessId = await this.resolveBusiness(userToken, businessIdHint);
    const waba = await this.resolveWaba(businessId, userToken);
    const su = await this.provisionSystemUser(businessId, waba.wabaId, userToken);

    (merchant as any).whatsappConfig = {
      ...((merchant as any).whatsappConfig || {}),
      metaBusinessId: businessId,
      wabaId: waba.wabaId,
      wabaName: waba.wabaName,
      phoneNumberId: waba.phoneId,           // drives WABA-scoped inbound matching (L-2)
      displayPhone: waba.displayPhone,
      systemUserId: su.systemUserId,
      accessToken: encryptionService.encrypt(su.systemUserToken),
    };
    (merchant as any).connections = {
      ...((merchant as any).connections || {}),
      whatsapp: { status: 'templates_pending', connectedAt: new Date(), lastError: null },
    };
    await merchant.save();
    logger.info('Meta connect: provisioned', { merchantId, businessId, wabaId: waba.wabaId, phoneMask: mask(waba.phoneId) });
    return this.summary(merchant);
  }

  private summary(m: any) {
    const w = m.whatsappConfig || {};
    return {
      status: m.connections?.whatsapp?.status || 'connected',
      wabaName: w.wabaName, displayPhone: w.displayPhone, phoneNumberId: w.phoneNumberId,
      templates: w.templates || [],
    };
  }
}
export const metaEmbeddedSignupService = new MetaEmbeddedSignupService();
