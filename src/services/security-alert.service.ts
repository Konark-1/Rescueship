import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * SecurityAlertService
 *
 * Dispatches real-time, out-of-band security alerts (Slack, Discord, Opsgenie)
 * when critical security events (IDOR attempts, circuit breaker trips, OAuth takeover probes)
 * occur across the system.
 */
export class SecurityAlertService {
  /**
   * Dispatches an out-of-band alert to the configured webhook.
   */
  public static async sendCriticalAlert(event: string, context: Record<string, any>): Promise<void> {
    logger.warn(`🚨 SECURITY INCIDENT DETECTED: [${event}]`, context);

    const webhookUrl = process.env.SECURITY_ALERT_WEBHOOK;
    if (!webhookUrl) {
      return;
    }

    const payload = {
      text: `🚨 *RESCUESHIP CRITICAL SECURITY ALERT: ${event}*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Security Incident: ${event}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Environment:* \`${process.env.NODE_ENV || 'production'}\`\n*Timestamp:* \`${new Date().toISOString()}\`\n*Details:* \`\`\`${JSON.stringify(
              context,
              null,
              2
            )}\`\`\``,
          },
        },
      ],
    };

    try {
      await axios.post(webhookUrl, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      logger.error('Failed to dispatch out-of-band security webhook', {
        event,
        error: err.message,
      });
    }
  }
}
