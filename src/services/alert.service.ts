import { Merchant, IMerchant } from '../models/Merchant';
import { emailService } from './email.service';
import { logger } from '../utils/logger';

export interface QualityCheckResult {
  merchantId: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  messagingLimitTier: string;
  templatesRejected: string[];
  action: 'none' | 'warn' | 'pause';
}

class AlertService {
  /**
   * WABA quality dropped to YELLOW or templates rejected.
   */
  async sendQualityWarning(merchant: IMerchant, result: QualityCheckResult): Promise<void> {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'quality_warning' as const,
      severity: 'warning' as const,
      title: result.qualityRating === 'YELLOW'
        ? '⚠️ Your WhatsApp quality rating dropped to YELLOW'
        : '⚠️ One or more message templates were rejected',
      body: this.buildQualityBody(result),
      createdAt: new Date(),
      read: false,
      actionUrl: '/dashboard/quality',
    };

    await this.pushAlert((merchant as any)._id || (merchant as any).id, alert);
    await this.sendEmail(merchant, alert.title, alert.body);
    logger.info(`[Alert] Quality warning sent to ${(merchant as any)._id || (merchant as any).id}`);
  }

  /**
   * WABA quality is RED — merchant paused.
   */
  async sendQualityPause(merchant: IMerchant, result: QualityCheckResult): Promise<void> {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'quality_pause' as const,
      severity: 'critical' as const,
      title: '🚨 Rescue messages paused — WhatsApp quality rating is RED',
      body: `Your WhatsApp Business Account quality rating has dropped to RED. ` +
        `Meta may restrict your messaging limits. RescueShip has paused outbound messages ` +
        `to protect your account.\n\n` +
        `To resolve:\n` +
        `1. Reduce message frequency\n` +
        `2. Ensure customers have opted in\n` +
        `3. Wait 24-48h for Meta to re-evaluate\n\n` +
        `Messages will auto-resume when your rating returns to YELLOW or GREEN.`,
      createdAt: new Date(),
      read: false,
      actionUrl: '/dashboard/quality',
    };

    await this.pushAlert((merchant as any)._id || (merchant as any).id, alert);
    await this.sendEmail(merchant, alert.title, alert.body);
    logger.warn(`[Alert] Quality PAUSE sent to ${(merchant as any)._id || (merchant as any).id}`);
  }

  /**
   * WABA quality recovered (YELLOW/GREEN) after a quality pause — billing resumed.
   */
  async sendQualityResumed(merchantId: string, rating: string): Promise<void> {
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) return;

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'quality_resumed' as const,
      severity: 'info' as const,
      title: '✅ Rescue messages resumed — WhatsApp quality rating recovered',
      body: `Your WhatsApp Business Account quality rating has returned to ${rating}. ` +
        `RescueShip has automatically resumed outbound rescue messages and reactivated your billing.`,
      createdAt: new Date(),
      read: false,
      actionUrl: '/dashboard/quality',
    };

    await this.pushAlert(merchantId, alert);
    await this.sendEmail(merchant as any, alert.title, alert.body);
    logger.info(`[Alert] Quality RESUME sent to ${merchantId}`);
  }

  /**
   * A specific template was rejected by Meta.
   */
  async sendTemplateRejection(merchantId: string, templateName: string, reason: string): Promise<void> {
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) return;

    const friendlyName = this.templateFriendlyName(templateName);
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'template_rejected' as const,
      severity: 'warning' as const,
      title: `📋 Template "${friendlyName}" was rejected by Meta`,
      body: `Meta rejected your message template "${friendlyName}".\n\n` +
        `Reason: ${reason}\n\n` +
        `This template is used for ${this.templatePurpose(templateName)}. ` +
        `RescueShip will continue using other templates, but this specific flow may be degraded.\n\n` +
        `You can request re-registration from Settings → WhatsApp → Templates.`,
      createdAt: new Date(),
      read: false,
      actionUrl: '/settings/whatsapp',
    };

    await this.pushAlert(merchantId, alert);
    await this.sendEmail(merchant as any, alert.title, alert.body);
  }

  /**
   * Template approval timed out after 24h of polling.
   */
  async sendTemplateTimeout(merchantId: string, templateName: string): Promise<void> {
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) return;

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'template_timeout' as const,
      severity: 'info' as const,
      title: `⏳ Template "${this.templateFriendlyName(templateName)}" still pending approval`,
      body: `It's been over 24 hours and Meta hasn't approved/rejected this template yet. ` +
        `This is unusual. You can check status manually in Meta Business Manager → WhatsApp → Message Templates.`,
      createdAt: new Date(),
      read: false,
      actionUrl: '/settings/whatsapp',
    };

    await this.pushAlert(merchantId, alert);
    await this.sendEmail(merchant as any, alert.title, alert.body);
  }

  /**
   * Subscription lifecycle event (from Razorpay webhook / lifecycle watchdog).
   * `opts.email = false` pushes only the in-app alert — used when a branded
   * email (e.g. the dunning template) is sent separately.
   */
  async sendBillingAlert(merchantId: string, event: string, detail: string, opts?: { email?: boolean }): Promise<void> {
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) return;

    const titles: Record<string, string> = {
      'subscription.paused': '⏸️ Your subscription is paused',
      'subscription.cancelled': '❌ Your subscription has been cancelled',
      'subscription.expired': '⌛ Your subscription has expired',
      'subscription.halted': '⏸️ Subscription charges halted — action required',
      'subscription.resumed': '▶️ Your subscription has resumed',
      'payment.failed': '💳 Payment failed — action required',
    };

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'billing' as const,
      severity: event === 'payment.failed' || event === 'subscription.halted' ? 'warning' as const : 'critical' as const,
      title: titles[event] || `Billing update: ${event}`,
      body: detail,
      createdAt: new Date(),
      read: false,
      actionUrl: '/billing',
    };

    await this.pushAlert(merchantId, alert);
    if (opts?.email !== false) {
      await this.sendEmail(merchant as any, alert.title, alert.body);
    }
  }

  private async pushAlert(merchantId: string, alert: any): Promise<void> {
    await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $push: { 'alerts': { $each: [alert], $position: 0, $slice: 50 } },
      }
    );
  }

  private async sendEmail(merchant: IMerchant, subject: string, body: string): Promise<void> {
    const ownerEmail = (merchant as any).email || (merchant as any).ownerEmail;
    if (!ownerEmail) {
      logger.warn(`[Alert] No email for merchant ${(merchant as any)._id || (merchant as any).id}, skipping email notification`);
      return;
    }

    try {
      await emailService.sendEmail({
        to: ownerEmail,
        subject: `[RescueShip Alert] ${subject}`,
        text: body,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 580px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${subject}</h2>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; white-space: pre-line;">
            ${body}
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">RescueShip Operations &bull; <a href="https://rescueship.netlify.app/dashboard" style="color: #2563eb;">Open Dashboard</a></p>
        </div>`,
      });
      logger.info(`[Alert] Email notification dispatched successfully: "${subject}" → ${ownerEmail}`);
    } catch (err: any) {
      logger.error(`[Alert] Failed to dispatch email notification: "${subject}" → ${ownerEmail}`, { error: err.message });
    }
  }

  private buildQualityBody(result: QualityCheckResult): string {
    let body = `Your WhatsApp Business Account quality rating is now: ${result.qualityRating}\n`;
    body += `Messaging limit tier: ${result.messagingLimitTier}\n\n`;

    if (result.templatesRejected.length > 0) {
      body += `Rejected templates:\n`;
      for (const t of result.templatesRejected) {
        body += `  • ${t}\n`;
      }
      body += `\n`;
    }

    body += `If your rating drops to RED, RescueShip will automatically pause outbound messages `;
    body += `to protect your WABA from permanent restriction.\n\n`;
    body += `Best practices:\n`;
    body += `• Only message customers who have an active NDR event\n`;
    body += `• Keep rescue messages concise and actionable\n`;
    body += `• Avoid sending more than 2 messages per NDR event`;

    return body;
  }

  private templateFriendlyName(name: string): string {
    const map: Record<string, string> = {
      ndr_rescue_en: 'NDR Rescue',
      cod_confirm_en: 'COD Confirmation',
      cod_convert_en: 'COD Convert',
      address_pin_en: 'Address/PIN Verification',
      rescue_done_en: 'Rescue Complete',
      rs_test_pulse_en: 'Test Pulse',
    };
    return map[name] || name;
  }

  private templatePurpose(name: string): string {
    const map: Record<string, string> = {
      ndr_rescue_en: 'rescuing failed delivery attempts (your core flow)',
      cod_confirm_en: 'confirming COD orders before shipment',
      cod_convert_en: 'converting COD orders to prepaid',
      address_pin_en: 'verifying customer address/PIN code',
      rescue_done_en: 'notifying customers their rescue is complete',
      rs_test_pulse_en: 'sandbox testing only',
    };
    return map[name] || 'automated messaging';
  }
}

export const alertService = new AlertService();
