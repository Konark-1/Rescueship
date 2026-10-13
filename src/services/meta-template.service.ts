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
import { DEFAULT_TEMPLATE_MAP, TEMPLATE_DEFS, buildComponents } from './whatsapp/template-registry';
export { DEFAULT_TEMPLATE_MAP, TEMPLATE_DEFS, buildComponents };
export type { TplDef } from './whatsapp/template-registry';

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
    const wabaId = (merchant as any).whatsappConfig?.wabaId || (merchant as any).whatsappConfig?.businessAccountId;
    if (!wabaId) throw new Error('No WABA / business account ID on merchant');
    const token = this.token(merchant);
    const results: any[] = [];

    // Fetch live templates on Meta first to avoid deleting already approved/pending templates
    let existingByName = new Map<string, any>();
    try {
      const existingRes = await axios.get(`${G}/${wabaId}/message_templates`, {
        params: { fields: 'name,status,rejected_reason', limit: 100 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      existingByName = new Map((existingRes.data?.data || []).map((t: any) => [t.name, t]));
    } catch (e: any) {
      logger.debug('Could not pre-fetch existing templates from Meta', { error: e.message });
    }

    for (const d of TEMPLATE_DEFS) {
      const live: any = existingByName.get(d.name);

      // If template is already APPROVED or PENDING on Meta, preserve it
      if (live && (live.status === 'APPROVED' || live.status === 'PENDING')) {
        results.push({ name: d.name, status: live.status, rejectedReason: live.rejected_reason || null });
        continue;
      }

      if (deleteFirst || live?.status === 'REJECTED') {
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
        const subcode = errorData?.error_subcode;
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

        // Deletion lock from Meta (code 2388023 / "Try again in less than 1 minute")
        if (subcode === 2388023 || /content can't be added while the existing English content is being deleted/i.test(msg)) {
          logger.warn('Template deletion lock encountered on Meta, keeping existing state', { name: d.name });
          results.push({ name: d.name, status: live?.status || 'PENDING' });
          continue;
        }

        // If duplicate / already exists, keep as pending
        if (code === 100 || /already exists|duplicate/i.test(msg)) {
          results.push({ name: d.name, status: live?.status || 'PENDING' });
        } else {
          logger.error('Template submit failed', { name: d.name, message: msg });
          results.push({ name: d.name, status: 'FAILED', reason: msg });
        }
      }
    }

    if (!(merchant as any).whatsappConfig) (merchant as any).whatsappConfig = {};
    (merchant as any).whatsappConfig.templates = results;
    (merchant as any).whatsappConfig.templateMap = {
      ...DEFAULT_TEMPLATE_MAP,
      ...((merchant as any).whatsappConfig?.templateMap || {}),
    };
    const allApproved = results.length > 0 && results.every((r) => r.status === 'APPROVED');
    const anyRejected = results.some((r) => r.status === 'FAILED' || r.status === 'REJECTED');
    (merchant as any).connections = {
      ...((merchant as any).connections || {}),
      whatsapp: {
        ...((merchant as any).connections?.whatsapp || {}),
        status: allApproved ? 'connected' : anyRejected ? 'templates_rejected' : 'templates_pending',
        lastError: null,
      },
    };
    merchant.markModified('whatsappConfig');
    merchant.markModified('connections');
    await merchant.save();

    // Enqueue status polling for submitted templates (safe against Redis errors).
    const createdTemplates = results
      .filter((r) => r.status === 'PENDING')
      .map((r) => ({ name: r.name }));
    if (createdTemplates.length > 0) {
      try {
        await enqueueTemplatePolls(merchantId, wabaId, createdTemplates);
      } catch (pollErr: any) {
        logger.warn('Failed to enqueue template polls to Redis', { error: pollErr.message });
      }
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
    // Older connects stored only businessAccountId.
    const wabaId = (merchant as any).whatsappConfig?.wabaId || (merchant as any).whatsappConfig?.businessAccountId;
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
        // A template that is not on the WABA at all was never submitted (e.g. added in a
        // later release): report it so the dashboard offers "Resubmit templates".
        return { name: n, status: live?.status || 'MISSING', rejectedReason: live?.rejected_reason || null };
      });
      if (!(merchant as any).whatsappConfig) (merchant as any).whatsappConfig = {};
      (merchant as any).whatsappConfig.templates = merged;
      (merchant as any).whatsappConfig.templateMap = {
        ...DEFAULT_TEMPLATE_MAP,
        ...((merchant as any).whatsappConfig?.templateMap || {}),
      };
      merchant.markModified('whatsappConfig');
      const allApproved = merged.length > 0 && merged.every((m) => m.status === 'APPROVED');
      const anyRejected = merged.some((m) => m.status === 'REJECTED' || m.status === 'MISSING');
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
