import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { checkDeadLetterQueue, checkWebhookFailureRate } from '../services/liveops-watchtower.service';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';

const router = Router();

/** Ops endpoints need X-Ops-Key = OPS_API_KEY. Without the env var they are closed. */
function hasOpsKey(req: Request): boolean {
  const expected = process.env.OPS_API_KEY || '';
  const given = req.get('x-ops-key') || '';
  if (!expected || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
function requireOpsKey(req: Request, res: Response, next: NextFunction): void {
  if (!hasOpsKey(req)) {
    res.status(401).json({ error: 'Ops key required' });
    return;
  }
  next();
}

/**
 * GET /api/liveops/status
 * Public or admin monitoring endpoint for Render/uptime watchtower
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [dlqResult, webhookResult] = await Promise.all([
      checkDeadLetterQueue().catch((err: any) => ({
        status: 'error',
        error: err?.message,
        timestamp: new Date().toISOString(),
      })),
      checkWebhookFailureRate(60).catch((err: any) => ({
        status: 'error',
        error: err?.message,
        timestamp: new Date().toISOString(),
      })),
    ]);

    const isDegraded =
      (dlqResult as any).status === 'critical' ||
      (dlqResult as any).status === 'degraded' ||
      (webhookResult as any).status === 'critical';

    // Uptime monitors get only the verdict; queue/webhook details need the ops key.
    res.status(isDegraded ? 503 : 200).json({
      status: isDegraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      ...(hasOpsKey(req) ? { checks: { deadLetterQueue: dlqResult, webhookFailureRate: webhookResult } } : {}),
    });
  } catch (error: any) {
    logger.error('Failed to compute liveops telemetry', { error: error?.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to compute liveops telemetry',
    });
  }
});

/**
 * POST /api/liveops/check-and-alert
 * Invoked by automated cron / scheduled health monitor
 */
router.post('/check-and-alert', requireOpsKey, async (_req: Request, res: Response) => {
  try {
    const [dlq, webhook] = await Promise.all([
      checkDeadLetterQueue().catch(() => null),
      checkWebhookFailureRate(60).catch(() => null),
    ]);

    const issues: string[] = [];

    if (dlq && (dlq.deadLetterQueue.failed > 0 || dlq.totalFailedAcrossQueues > 0)) {
      issues.push(`• Dead-letter failed jobs detected: ${dlq.deadLetterQueue.failed} in DLQ, ${dlq.totalFailedAcrossQueues} across worker queues.`);
    }

    if (webhook && webhook.failureRatePercentage > 2.0 && webhook.totalEvents > 5) {
      issues.push(`• Webhook failure rate elevated: ${webhook.failureRatePercentage.toFixed(1)}% (${webhook.failedEvents}/${webhook.totalEvents} failed).`);
    }

    const alertTo = process.env.OPS_ALERT_EMAIL;
    if (issues.length > 0 && alertTo) {
      logger.warn('[LiveOps Watchtower] Dispatched incident alert', { issues });
      await emailService.sendEmail({
        to: alertTo,
        subject: `⚠️ [RescueShip Watchtower Alert] Operational Incidents Detected`,
        text: `RescueShip LiveOps Watchtower detected the following system anomalies:\n\n${issues.join('\n')}\n\nTime: ${new Date().toISOString()}\nHost: rescueship.onrender.com`,
      }).catch((e) => logger.warn('Failed to send watchtower incident email', { error: e?.message }));
    }

    res.json({
      success: true,
      hasIssues: issues.length > 0,
      issuesFound: issues,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

export default router;
