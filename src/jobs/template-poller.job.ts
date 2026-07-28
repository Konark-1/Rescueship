import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant } from '../models/Merchant';
import { alertService } from '../services/alert.service';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'template-poller';

export const templatePollerQueue = new Queue(QUEUE_NAME, { connection: redisConnection as any });

export interface TemplatePollPayload {
  merchantId: string;
  templateId: string;       // Meta's template ID (e.g., "123456789")
  templateName: string;     // logical name (e.g., "ndr_rescue_en")
  wabaId: string;
  systemUserToken: string;
  pollCount: number;
  maxPolls: number;
}

async function getTemplateStatus(templateId: string, token: string): Promise<string> {
  const url = `https://graph.facebook.com/v22.0/${templateId}?fields=status&access_token=${token}`;
  const res = await fetch(url);
  const data: any = await res.json();
  return data.status || 'UNKNOWN';
}

async function getTemplateRejection(templateId: string, token: string): Promise<string> {
  const url = `https://graph.facebook.com/v22.0/${templateId}?fields=rejection_reason&access_token=${token}`;
  const res = await fetch(url);
  const data: any = await res.json();
  return data.rejection_reason || 'No reason provided by Meta';
}

/**
 * Polls a single template's approval status.
 * Scheduled with exponential backoff: 30s, 60s, 120s, ... up to maxPolls.
 * After maxPolls (default 48 ≈ 24h), gives up and alerts.
 */
export function startTemplatePollerWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<TemplatePollPayload>) => {
      const { merchantId, templateId, templateName, wabaId, systemUserToken, pollCount, maxPolls } = job.data;

      logger.info(`[TemplatePoller] Poll #${pollCount} for ${templateName}`, { merchantId, templateId });

      try {
        const status = await getTemplateStatus(templateId, systemUserToken);

        if (status === 'APPROVED') {
          // Update merchant's template registry
          await Merchant.findByIdAndUpdate(
            merchantId,
            {
              $set: {
                [`whatsappConfig.templates.${templateName}.status`]: 'APPROVED',
                [`whatsappConfig.templates.${templateName}.approvedAt`]: new Date(),
              },
            }
          );
          logger.info(`[TemplatePoller] ✓ ${templateName} APPROVED for ${merchantId}`);
          return { status: 'APPROVED' };
        }

        if (status === 'REJECTED') {
          const rejection = await getTemplateRejection(templateId, systemUserToken);
          await Merchant.findByIdAndUpdate(
            merchantId,
            {
              $set: {
                [`whatsappConfig.templates.${templateName}.status`]: 'REJECTED',
                [`whatsappConfig.templates.${templateName}.rejectionReason`]: rejection,
              },
            }
          );
          await alertService.sendTemplateRejection(merchantId, templateName, rejection);
          logger.warn(`[TemplatePoller] ✗ ${templateName} REJECTED for ${merchantId}: ${rejection}`);
          return { status: 'REJECTED', reason: rejection };
        }

        // Still PENDING — schedule next poll
        if (pollCount < maxPolls) {
          const delay = Math.min(30_000 * Math.pow(2, pollCount - 1), 3_600_000); // cap at 1hr
          await templatePollerQueue.add(
            `poll-${merchantId}-${templateName}`,
            { ...job.data, pollCount: pollCount + 1 },
            { delay, removeOnComplete: true }
          );
          return { status: 'PENDING', nextPollInMs: delay };
        }

        // Exhausted polls
        await alertService.sendTemplateTimeout(merchantId, templateName);
        logger.warn(`[TemplatePoller] Gave up on ${templateName} for ${merchantId} after ${maxPolls} polls`);
        return { status: 'TIMEOUT' };

      } catch (err: any) {
        logger.error(`[TemplatePoller] Error polling ${templateName}`, { error: err.message });
        // Retry on transient errors
        if (pollCount < maxPolls) {
          await templatePollerQueue.add(
            `poll-${merchantId}-${templateName}`,
            { ...job.data, pollCount: pollCount + 1 },
            { delay: 60_000, removeOnComplete: true }
          );
        }
        throw err;
      }
    },
    { connection: redisConnection as any, concurrency: 5 }
  );

  logger.info('[TemplatePoller] Worker started');
  return worker;
}

/**
 * Enqueue polling for all templates after Meta Embedded Signup completes.
 */
export async function enqueueTemplatePolls(
  merchantId: string,
  wabaId: string,
  systemUserToken: string,
  templates: Array<{ id: string; name: string }>
): Promise<void> {
  for (const tpl of templates) {
    await templatePollerQueue.add(
      `poll-${merchantId}-${tpl.name}`,
      {
        merchantId,
        templateId: tpl.id,
        templateName: tpl.name,
        wabaId,
        systemUserToken,
        pollCount: 1,
        maxPolls: 48,
      } as TemplatePollPayload,
      { delay: 30_000, removeOnComplete: true }
    );
  }
  logger.info(`[TemplatePoller] Enqueued ${templates.length} template polls for ${merchantId}`);
}
