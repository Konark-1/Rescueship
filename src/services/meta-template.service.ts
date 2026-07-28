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

interface TplDef { name: string; category: 'UTILITY' | 'MARKETING'; language: string; body: string; buttons?: { type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }[]; }

/** Logical name = registered name (engine compatibility). */
export const TEMPLATE_DEFS: TplDef[] = [
  { name: 'ndr_rescue_en', category: 'UTILITY', language: 'en',
    body: "Hi {{1}}, we couldn't confirm a delivery attempt on order {{2}}. Can you help us verify so we can get this to you?",
    buttons: [ { type: 'QUICK_REPLY', text: "Yes I'm home" }, { type: 'QUICK_REPLY', text: 'Reschedule' }, { type: 'QUICK_REPLY', text: 'Share location' }, { type: 'QUICK_REPLY', text: 'Cancel order' } ] },
  { name: 'cod_confirm_en', category: 'UTILITY', language: 'en',   // utility-first default (L-3)
    body: 'Hi {{1}}, confirm order {{2}} by paying online to lock your delivery slot. No cash needed at the door.',
    buttons: [ { type: 'URL', text: 'Pay Now', url: '{{3}}' } ] },
  { name: 'cod_convert_en', category: 'MARKETING', language: 'en', // incentive variant (costlier)
    body: 'Hi {{1}}, pay online for order {{2}} now and get {{3}} off. Tap Pay Now to confirm.',
    buttons: [ { type: 'URL', text: 'Pay Now', url: '{{4}}' } ] },
  { name: 'address_pin_en', category: 'UTILITY', language: 'en',
    body: 'Hi {{1}}, please share your exact delivery location pin for order {{2}} so the driver can find you.' },
  { name: 'rescue_done_en', category: 'UTILITY', language: 'en',
    body: 'Great news — order {{1}} is back on track and will be delivered {{2}}. Thank you!' },
  { name: 'rs_test_pulse_en', category: 'UTILITY', language: 'en',
    body: 'RescueShip is connected. This is a test rescue for {{1}} — your WhatsApp recovery is live.' },
];

function buildComponents(d: TplDef) {
  const comps: any[] = [{ type: 'BODY', text: d.body }];
  if (d.buttons?.length) {
    comps.push({ type: 'BUTTONS', buttons: d.buttons.map((b) =>
      b.type === 'QUICK_REPLY' ? { type: 'QUICK_REPLY', text: b.text } : { type: 'URL', text: b.text, url: b.url, example: [b.url?.replace(/{{\d+}}/g, 'https://pay.example.com')] }) });
  }
  return comps;
}

export class MetaTemplateService {
  private token(merchant: any): string {
    const enc = merchant.whatsappConfig?.accessToken;
    if (!enc) throw new Error('WhatsApp not connected');
    return encryptionService.decrypt(enc);
  }

  async submitAll(merchantId: string) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    const wabaId = (merchant as any).whatsappConfig?.wabaId;
    if (!wabaId) throw new Error('No WABA on merchant');
    const token = this.token(merchant);
    const results: any[] = [];
    for (const d of TEMPLATE_DEFS) {
      try {
        await axios.post(`${G}/${wabaId}/message_templates`, {
          name: d.name, category: d.category, language: d.language, components: buildComponents(d),
        }, { headers: { Authorization: `Bearer ${token}` } });
        results.push({ name: d.name, status: 'PENDING' });
      } catch (e: any) {
        // 400 "template already exists" is fine — we'll read its status in poll
        const code = e.response?.data?.error?.code;
        if (code === 100 || /already exists|duplicate/i.test(e.response?.data?.error?.message || '')) {
          results.push({ name: d.name, status: 'PENDING' });
        } else {
          logger.error('Template submit failed', { name: d.name, message: e.response?.data?.error?.message });
          results.push({ name: d.name, status: 'FAILED', reason: e.response?.data?.error?.message });
        }
      }
    }
    if (!(merchant as any).whatsappConfig) (merchant as any).whatsappConfig = {};
    (merchant as any).whatsappConfig.templates = results;
    (merchant as any).connections = { ...((merchant as any).connections || {}), whatsapp: { ...((merchant as any).connections?.whatsapp || {}), status: 'templates_pending' } };
    await merchant.save();

    // Enqueue status polling for submitted templates
    const createdTemplates = results
      .filter((r) => r.status === 'PENDING')
      .map((r) => ({ id: r.name, name: r.name }));
    if (createdTemplates.length > 0) {
      await enqueueTemplatePolls(
        merchantId,
        wabaId,
        token,
        createdTemplates
      );
    }

    return results;
  }

  /** Read live statuses from Meta; flip connection to 'active' when all approved. */
  async pollStatus(merchantId: string) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    const wabaId = (merchant as any).whatsappConfig?.wabaId;
    const token = this.token(merchant);
    const names = TEMPLATE_DEFS.map((d) => d.name);
    const { data } = await axios.get(`${G}/${wabaId}/message_templates`, {
      params: { fields: 'name,status,rejected_reason', limit: 100 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const byName = new Map((data.data || []).map((t: any) => [t.name, t]));
    const merged = names.map((n) => {
      const live: any = byName.get(n);
      return { name: n, status: live?.status || 'PENDING', rejectedReason: live?.rejected_reason || null };
    });
    if (!(merchant as any).whatsappConfig) (merchant as any).whatsappConfig = {};
    (merchant as any).whatsappConfig.templates = merged;
    const allApproved = merged.every((m) => m.status === 'APPROVED');
    const anyRejected = merged.some((m) => m.status === 'REJECTED');
    (merchant as any).connections = {
      ...((merchant as any).connections || {}),
      whatsapp: {
        ...((merchant as any).connections?.whatsapp || {}),
        status: allApproved ? 'connected' : anyRejected ? 'templates_rejected' : 'templates_pending',
      },
    };
    await merchant.save();
    return { status: (merchant as any).connections.whatsapp.status, templates: merged };
  }
}
export const metaTemplateService = new MetaTemplateService();
