/**
 * meta-template.service.ts
 * ─────────────────────────────────────────────────────────────
 * Submits the canonical rescue templates to the merchant's WABA and
 * polls approval. Bodies use VERIFICATION framing (L-6) — no template
 * here accuses a courier. The COD template exists in two framings so
 * the merchant's policy can pick utility (cheap) vs marketing (incentive).
 *
 * Names are registered under the LEGACY logical names the engine already
 * sends, so the engine needs no change — the send-boundary resolver in
 * whatsapp.service maps logical→registered.
 */
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { enqueueTemplatePolls } from '../jobs/template-poller.job';
import { logger } from '../utils/logger';

const G = 'https://graph.facebook.com/v22.0';
/**
 * Meta requires URL buttons to have a FIXED host with at most one trailing {{1}}
 * variable. We host a tiny redirector so the payment link (Razorpay/Cashfree,
 * different hosts) can be passed as the dynamic suffix.
 */
const PAY_REDIRECT_BASE = `${(process.env.API_PUBLIC_URL || process.env.API_BASE_URL || 'https://app.rescueship.io').replace(/\/$/, '')}/r/pay/`;

export interface TplDef {
  name: string;
  category: 'UTILITY' | 'MARKETING';
  language: string;
  body: string;
  bodyExample?: string[];
  buttons?: {
    type: 'QUICK_REPLY' | 'URL';
    text: string;
    url?: string;
    example?: string[];
  }[];
}

/** Logical name = registered name (engine compatibility). */
export const TEMPLATE_DEFS: TplDef[] = [
  {
    name: 'ndr_rescue_en',
    category: 'UTILITY',
    language: 'en',
    body: "Hi {{1}}, we couldn't confirm a delivery attempt on order {{2}}. Can you help us verify so we can get this to you?",
    bodyExample: ['John', 'ORD-1001'],
    // Meta allows maximum 3 quick reply buttons
    buttons: [
      { type: 'QUICK_REPLY', text: "Yes I'm home" },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
      { type: 'QUICK_REPLY', text: 'Cancel order' },
    ],
  },
  {
    name: 'cod_confirm_en',
    category: 'UTILITY',
    language: 'en',   // utility-first default (L-3)
    body: 'Hi {{1}}, confirm order {{2}} by paying online to lock your delivery slot. No cash needed at the door.',
    bodyExample: ['John', 'ORD-1001'],
    buttons: [
      {
        type: 'URL',
        text: 'Pay Now',
        url: `${PAY_REDIRECT_BASE}{{1}}`,
        example: [`${PAY_REDIRECT_BASE}plink_example123`],
      },
    ],
  },
  {
    name: 'cod_convert_en',
    category: 'MARKETING',
    language: 'en', // incentive variant (costlier)
    body: 'Hi {{1}}, pay online for order {{2}} now and get {{3}} off. Tap Pay Now to confirm.',
    bodyExample: ['John', 'ORD-1001', '10%'],
    buttons: [
      {
        type: 'URL',
        text: 'Pay Now',
        url: `${PAY_REDIRECT_BASE}{{1}}`,
        example: [`${PAY_REDIRECT_BASE}plink_example123`],
      },
    ],
  },
  {
    name: 'address_pin_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{1}}, please share your exact delivery location pin for order {{2}} so the driver can find you.',
    bodyExample: ['John', 'ORD-1001'],
  },
  {
    name: 'rescue_done_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Great news — order {{1}} is back on track and will be delivered {{2}}. Thank you!',
    bodyExample: ['ORD-1001', 'tomorrow'],
  },
  {
    name: 'rs_test_pulse_en',
    category: 'UTILITY',
    language: 'en',
    body: 'RescueShip is connected. This is a test rescue for {{1}} — your WhatsApp recovery is live.',
    bodyExample: ['Mamaearth Store'],
  },
];

export function buildComponents(d: TplDef) {
  const bodyComp: any = { type: 'BODY', text: d.body };
  if (d.bodyExample && d.bodyExample.length > 0) {
    bodyComp.example = { body_text: [d.bodyExample] };
  }
  const comps: any[] = [bodyComp];
  if (d.buttons?.length) {
    comps.push({
      type: 'BUTTONS',
      buttons: d.buttons.map((b) => {
        if (b.type === 'QUICK_REPLY') {
          return { type: 'QUICK_REPLY', text: b.text };
        }
        const bUrl = b.url || `${PAY_REDIRECT_BASE}{{1}}`;
        const ex = b.example || [bUrl.replace(/{{\d+}}/g, 'plink_example123')];
        return { type: 'URL', text: b.text, url: bUrl, example: ex };
      }),
    });
  }
  return comps;
}

export class MetaTemplateService {
  private token(merchant: any): string {
    const enc = merchant.whatsappConfig?.accessToken;
    if (!enc) throw new Error('WhatsApp not connected');
    return encryptionService.decrypt(enc);
  }

  private async deleteTemplateIfExists(wabaId: string, name: string, token: string): Promise<void> {
    try {
      await axios.delete(`${G}/${wabaId}/message_templates`, {
        params: { name },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      logger.info('Deleted existing template on Meta WABA', { wabaId, name });
    } catch (e: any) {
      // 404 / 100 template not found is fine
      logger.debug('Template delete skipped / not found', { name, error: e.response?.data?.error?.message || e.message });
    }
  }

  async submitAll(merchantId: string, deleteFirst = false) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    const wabaId = (merchant as any).whatsappConfig?.wabaId;
    if (!wabaId) throw new Error('No WABA on merchant');
    const token = this.token(merchant);
    const results: any[] = [];

    for (const d of TEMPLATE_DEFS) {
      if (deleteFirst) {
        await this.deleteTemplateIfExists(wabaId, d.name, token);
      }

      try {
        await axios.post(
          `${G}/${wabaId}/message_templates`,
          {
            name: d.name,
            category: d.category,
            language: d.language,
            components: buildComponents(d),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        results.push({ name: d.name, status: 'PENDING' });
      } catch (e: any) {
        const errorData = e.response?.data?.error;
        const code = errorData?.code;
        const msg = errorData?.message || e.message;

        // Check for token expiry
        if (code === 190 || /OAuthException|expired/i.test(msg)) {
          (merchant as any).connections = {
            ...((merchant as any).connections || {}),
            whatsapp: {
              ...((merchant as any).connections?.whatsapp || {}),
              status: 'token_expired',
              lastError: 'Meta Access Token Expired. Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App Dashboard or use a permanent System User token to resume.',
            },
          };
          merchant.markModified('connections');
          await merchant.save();
          throw new Error('Meta Access Token Expired. Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App Dashboard or use a permanent System User token to resume.');
        }

        // If duplicate / already exists and we didn't delete first, try deleting and recreating once
        if (!deleteFirst && (code === 100 || /already exists|duplicate/i.test(msg))) {
          try {
            await this.deleteTemplateIfExists(wabaId, d.name, token);
            await axios.post(
              `${G}/${wabaId}/message_templates`,
              {
                name: d.name,
                category: d.category,
                language: d.language,
                components: buildComponents(d),
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            results.push({ name: d.name, status: 'PENDING' });
            continue;
          } catch (retryErr: any) {
            logger.warn('Template recreate after delete failed', { name: d.name, error: retryErr.response?.data?.error?.message });
          }
        }

        if (code === 100 || /already exists|duplicate/i.test(msg)) {
          results.push({ name: d.name, status: 'PENDING' });
        } else {
          logger.error('Template submit failed', { name: d.name, message: msg });
          results.push({ name: d.name, status: 'FAILED', reason: msg });
        }
      }
    }

    if (!(merchant as any).whatsappConfig) (merchant as any).whatsappConfig = {};
    (merchant as any).whatsappConfig.templates = results;
    (merchant as any).connections = {
      ...((merchant as any).connections || {}),
      whatsapp: {
        ...((merchant as any).connections?.whatsapp || {}),
        status: results.some((r) => r.status === 'FAILED') ? 'templates_rejected' : 'templates_pending',
        lastError: null,
      },
    };
    merchant.markModified('whatsappConfig');
    merchant.markModified('connections');
    await merchant.save();

    // Enqueue status polling for submitted templates.
    const createdTemplates = results
      .filter((r) => r.status === 'PENDING')
      .map((r) => ({ name: r.name }));
    if (createdTemplates.length > 0) {
      await enqueueTemplatePolls(merchantId, wabaId, createdTemplates);
    }

    return results;
  }

  /** Cleanly delete all rejected/existing templates and resubmit compliant ones */
  async resubmitAll(merchantId: string) {
    return this.submitAll(merchantId, true);
  }

  /** Read live statuses from Meta; flip connection to 'active' when all approved. */
  async pollStatus(merchantId: string) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    const wabaId = (merchant as any).whatsappConfig?.wabaId;
    if (!wabaId) throw new Error('No WABA on merchant');
    const token = this.token(merchant);
    const names = TEMPLATE_DEFS.map((d) => d.name);

    try {
      const { data } = await axios.get(`${G}/${wabaId}/message_templates`, {
        params: { fields: 'name,status,rejected_reason', limit: 100 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      const byName = new Map((data.data || []).map((t: any) => [t.name, t]));
      const merged = names.map((n) => {
        const live: any = byName.get(n);
        return { name: n, status: live?.status || 'PENDING', rejectedReason: live?.rejected_reason || null };
      });
      if (!(merchant as any).whatsappConfig) (merchant as any).whatsappConfig = {};
      (merchant as any).whatsappConfig.templates = merged;
      merchant.markModified('whatsappConfig');
      const allApproved = merged.every((m) => m.status === 'APPROVED');
      const anyRejected = merged.some((m) => m.status === 'REJECTED');
      (merchant as any).connections = {
        ...((merchant as any).connections || {}),
        whatsapp: {
          ...((merchant as any).connections?.whatsapp || {}),
          status: allApproved ? 'connected' : anyRejected ? 'templates_rejected' : 'templates_pending',
          lastError: null,
        },
      };
      merchant.markModified('connections');
      await merchant.save();
      return { status: (merchant as any).connections.whatsapp.status, templates: merged };
    } catch (e: any) {
      const errorData = e.response?.data?.error;
      const code = errorData?.code;
      const msg = errorData?.message || e.message;
      if (code === 190 || /OAuthException|expired/i.test(msg)) {
        (merchant as any).connections = {
          ...((merchant as any).connections || {}),
          whatsapp: {
            ...((merchant as any).connections?.whatsapp || {}),
            status: 'token_expired',
            lastError: 'Meta Access Token Expired. Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App Dashboard or use a permanent System User token to resume.',
          },
        };
        merchant.markModified('connections');
        await merchant.save();
        return {
          status: 'token_expired',
          templates: (merchant as any).whatsappConfig?.templates || [],
          error: 'Meta Access Token Expired. Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App Dashboard or use a permanent System User token to resume.',
        };
      }
      throw e;
    }
  }
}
export const metaTemplateService = new MetaTemplateService();
