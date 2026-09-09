/**
 * carrier-auth.ts
 * ─────────────────────────────────────────────────────────────
 * Shared tenant resolution + authentication for carrier NDR webhooks
 * (Shiprocket / ClickPost / Delhivery).
 *
 * Threat model: carriers deliver webhooks per merchant account, so the
 * credential presented MUST be bound to one tenant. A single platform-wide
 * secret is not acceptable — every merchant who configures it in their
 * carrier panel would know it and could forge events for other tenants.
 *
 * Resolution order:
 *   1. `merchant_id` query param is used ONLY as a lookup hint (validated ObjectId).
 *   2. The merchant's per-tenant `carrierConfig.webhookSecret` is the authority.
 *   3. Legacy fallback: if the merchant has no per-tenant secret yet, the
 *      platform env secret is accepted — but events are still scoped to that
 *      merchant only. A warning is logged so operators migrate.
 *
 * Both raw-token (`x-api-key` / `authorization`) and HMAC-SHA256 over the raw
 * body (`x-<provider>-signature`) presentations are supported.
 */
import { Request } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

export type CarrierProvider = 'shiprocket' | 'clickpost' | 'delhivery';

export interface CarrierAuthResult {
  ok: true;
  merchantId: Types.ObjectId;
}
export interface CarrierAuthFailure {
  ok: false;
  status: number;
  error: string;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function presentedCredential(req: Request, provider: CarrierProvider): { value: string; isHmac: boolean } | null {
  const hmacHeader = req.get(`x-${provider}-signature`);
  if (hmacHeader) return { value: hmacHeader.trim(), isHmac: true };
  const token = req.get('x-api-key') || req.get(`x-${provider}-token`) || req.get('authorization');
  if (token) return { value: token.replace(/^Bearer\s+/i, '').trim(), isHmac: false };
  return null;
}

function credentialMatches(secret: string, presented: { value: string; isHmac: boolean }, rawBody?: Buffer): boolean {
  if (presented.isHmac) {
    if (!rawBody) return false;
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    let sigBuf: Buffer;
    try { sigBuf = Buffer.from(presented.value, 'hex'); } catch { return false; }
    return safeEqual(Buffer.from(computed, 'hex'), sigBuf);
  }
  return safeEqual(Buffer.from(secret), Buffer.from(presented.value));
}

/**
 * Authenticate a carrier webhook and return the tenant it is bound to.
 */
export async function authenticateCarrierWebhook(
  req: Request,
  provider: CarrierProvider,
  platformSecret: string | undefined
): Promise<CarrierAuthResult | CarrierAuthFailure> {
  const merchantIdStr = typeof req.query.merchant_id === 'string' ? req.query.merchant_id : '';
  if (!merchantIdStr || !Types.ObjectId.isValid(merchantIdStr)) {
    return { ok: false, status: 401, error: 'Webhook is not bound to a merchant' };
  }

  const presented = presentedCredential(req, provider);
  if (!presented) {
    return { ok: false, status: 401, error: `Missing ${provider} signature header` };
  }

  const merchant = await Merchant.findById(merchantIdStr).select('carrierConfig').lean();
  const carrierConfig: any = (merchant as any)?.carrierConfig;
  // Uniform 401 for unknown merchant and bad credential: no enumeration oracle.
  if (!merchant) {
    return { ok: false, status: 401, error: `Invalid ${provider} signature` };
  }

  const rawBody: Buffer | undefined = (req as any).rawBody;
  let perTenantSecret: string | undefined;
  if (carrierConfig?.webhookSecret) {
    try {
      perTenantSecret = encryptionService.decrypt(carrierConfig.webhookSecret);
    } catch (err: any) {
      logger.error('Carrier webhook secret cannot be decrypted; rejecting until reconnected', { merchantId: merchantIdStr, provider });
      return { ok: false, status: 401, error: `Invalid ${provider} signature` };
    }
  }

  if (perTenantSecret) {
    if (credentialMatches(perTenantSecret, presented, rawBody)) {
      return { ok: true, merchantId: new Types.ObjectId(merchantIdStr) };
    }
    return { ok: false, status: 401, error: `Invalid ${provider} signature` };
  }

  // Legacy path — platform-wide secret, still tenant-scoped.
  if (platformSecret && credentialMatches(platformSecret, presented, rawBody)) {
    logger.warn('Carrier webhook accepted with platform-wide secret (legacy). Reconnect carrier to issue a per-merchant secret.', {
      merchantId: merchantIdStr,
      provider,
    });
    return { ok: true, merchantId: new Types.ObjectId(merchantIdStr) };
  }

  if (!platformSecret) {
    logger.warn(`${provider} webhook rejected: no per-merchant webhook secret and no platform secret configured`, { merchantId: merchantIdStr });
  }
  return { ok: false, status: 401, error: `Invalid ${provider} signature` };
}

/** Generate a fresh per-merchant webhook secret (URL-safe, 256-bit). */
export function generateCarrierWebhookSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}
