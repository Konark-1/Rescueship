import { Queue, Worker, Job } from 'bullmq';
import axios from 'axios';
import { redisConnection } from '../config/redis';
import { Merchant } from '../models/Merchant';
import { alertService } from '../services/alert.service';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

const QUEUE_NAME = 'template-poller';
const G = 'https://graph.facebook.com/v22.0';

export const templatePollerQueue = new Queue(QUEUE_NAME, { connection: redisConnection as any });

/**
 * Job data is stored in Redis in plaintext — it carries identifiers only.
 * The access token is re-read (and decrypted) from the merchant record per poll.
 */
export interface TemplatePollPayload {
  merchantId: string;
  templateName: string; // registered name (e.g. "ndr_rescue_en")
  wabaId: string;
  pollCount: number;
  maxPolls: number;
}

interface LiveTemplate { name: string; status: string; rejected_reason?: string; id?: string }

/** Look a template up BY NAME on the WABA (we never persisted Meta's numeric id). */
async function fetchTemplateByName(wabaId: string, name: string, token: string): Promise<LiveTemplate | null> {
  const { data } = await axios.get(`${G}/${wabaId}/message_templates`, {
    params: { name, fields: 'id,name,status,rejected_reason', limit: 5 },
    headers: { Authorization: `Bearer ${token}` }, // token in header, never in the URL/logs
    timeout: 10000,
  });
  const list: LiveTemplate[] = data?.data || [];
  return list.find((t) => t.name === name) || null;
}

async function merchantToken(merchantId: string): Promise<string> {
  const m = await Merchant.findById(merchantId).select('whatsappConfig.accessToken').lean();
  const enc = (m as any)?.whatsappConfig?.accessToken;
  if (!enc) throw new Error('WhatsApp not connected');
  return encryptionService.decrypt(enc);
}

/** `whatsappConfig.templates` is an ARRAY of {name,status,...}; update the matching element. */
async function setTemplateStatus(merchantId: string, name: string, patch: Record<string, unknown>): Promise<void> {
  const $set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) $set[`whatsappConfig.templates.$[t].${k}`] = v;
  const r = await Merchant.updateOne(
    { _id: merchantId },
    { $set },
    { arrayFilters: [{ 't.name': name }] }
  );
  if (r.matchedCount === 0 || r.modifiedCount === 0) {
    // Entry missing (e.g. templates array not initialised yet) — append it.
    await Merchant.updateOne(
      { _id: merchantId, 'whatsappConfig.templates.name': { $ne: name } },
      { $push: { 'whatsappConfig.templates': { name, ...patch } } }
    );
  }
}

async function recomputeConnectionStatus(merchantId: string): Promise<void> {
  const m: any = await Merchant.findById(merchantId).select('whatsappConfig.templates connections').lean();
  const tpls: any[] = m?.whatsappConfig?.templates || [];
  if (!tpls.length) return;
  const allApproved = tpls.every((t) => t.status === 'APPROVED');
  const anyRejected = tpls.some((t) => t.status === 'REJECTED');
  const status = allApproved ? 'connected' : anyRejected ? 'templates_rejected' : 'templates_pending';
  await Merchant.updateOne({ _id: merchantId }, { $set: { 'connections.whatsapp.status': status } });
}

/**
 * Polls a single template's approval status.
 * Scheduled with exponential backoff: 30s, 60s, 120s, ... capped at 1h, up to maxPolls.
 */
export function startTemplatePollerWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<TemplatePollPayload>) => {
      const { merchantId, templateName, wabaId, pollCount, maxPolls } = job.data;
      logger.info(`[TemplatePoller] Poll #${pollCount} for ${templateName}`, { merchantId });

      const requeue = async (delay: number) => {
        await templatePollerQueue.add(
          `poll-${templateName}`,
          { ...job.data, pollCount: pollCount + 1 },
          { delay, removeOnComplete: true, removeOnFail: true, jobId: makeJobId('tplpoll', merchantId, templateName, pollCount + 1) }
        );
      };

      try {
        const token = await merchantToken(merchantId);
        const live = await fetchTemplateByName(wabaId, templateName, token);
        const status = live?.status || 'PENDING';

        if (status === 'APPROVED') {
          await setTemplateStatus(merchantId, templateName, { status: 'APPROVED', approvedAt: new Date(), metaId: live?.id });
          await recomputeConnectionStatus(merchantId);
          logger.info(`[TemplatePoller] ✓ ${templateName} APPROVED for ${merchantId}`);
          return { status: 'APPROVED' };
        }

        if (status === 'REJECTED') {
          const rejection = live?.rejected_reason || 'No reason provided by Meta';
          await setTemplateStatus(merchantId, templateName, { status: 'REJECTED', rejectedReason: rejection, metaId: live?.id });
          await recomputeConnectionStatus(merchantId);
          await alertService.sendTemplateRejection(merchantId, templateName, rejection);
          logger.warn(`[TemplatePoller] ✗ ${templateName} REJECTED for ${merchantId}: ${rejection}`);
          return { status: 'REJECTED', reason: rejection };
        }

        if (pollCount < maxPolls) {
          const delay = Math.min(30_000 * Math.pow(2, pollCount - 1), 3_600_000);
          await requeue(delay);
          return { status: 'PENDING', nextPollInMs: delay };
        }

        await alertService.sendTemplateTimeout(merchantId, templateName);
        logger.warn(`[TemplatePoller] Gave up on ${templateName} for ${merchantId} after ${maxPolls} polls`);
        return { status: 'TIMEOUT' };
      } catch (err: any) {
        logger.error(`[TemplatePoller] Error polling ${templateName}`, { merchantId, error: err.response?.data?.error?.message || err.message });
        if (pollCount < maxPolls) {
          await requeue(60_000);
          return { status: 'RETRY_SCHEDULED' }; // do not also fail the job (would double-schedule)
        }
        await alertService.sendTemplateTimeout(merchantId, templateName);
        return { status: 'TIMEOUT', error: err.message };
      }
    },
    { connection: redisConnection as any, concurrency: 5 }
  );

  worker.on('error', (err) => {
    logger.warn('[TemplatePoller] Worker Redis error', { error: err.message });
  });

  logger.info('[TemplatePoller] Worker started');
  return worker;
}

/**
 * Enqueue polling for all templates after submission.
 */
export async function enqueueTemplatePolls(
  merchantId: string,
  wabaId: string,
  templates: Array<{ name: string }>
): Promise<void> {
  for (const tpl of templates) {
    await templatePollerQueue.add(
      `poll-${tpl.name}`,
      { merchantId, templateName: tpl.name, wabaId, pollCount: 1, maxPolls: 48 } as TemplatePollPayload,
      { delay: 30_000, removeOnComplete: true, removeOnFail: true, jobId: makeJobId('tplpoll', merchantId, tpl.name, 1) }
    );
  }
  logger.info(`[TemplatePoller] Enqueued ${templates.length} template polls for ${merchantId}`);
}
