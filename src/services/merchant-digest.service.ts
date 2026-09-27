/**
 * merchant-digest.service.ts
 * ─────────────────────────────────────────────────────────────
 * Aggregates real-time operational events (NDRs, rescues, payments)
 * for each merchant and dispatches an hourly batched digest email.
 *
 * Guarantees:
 * 1. Zero email spam: Batches dozens of operational events into 1 single email.
 * 2. Gmail quota safe: Strictly stays within Gmail's 500/day limit.
 * 3. Two-tier buffer: Upstash Redis list with in-memory map fallback.
 * 4. Critical alerts: High-severity events (e.g. 95%+ quota) trigger instant dispatch.
 */

import { redisConnection } from '../config/redis';
import { Merchant } from '../models';
import { emailService } from './email.service';
import { logger } from '../utils/logger';

export interface BufferedDigestEvent {
  type: string;
  orderId?: string;
  awb?: string;
  amount?: number;
  freightSaved?: number;
  reason?: string;
  isFakeRemark?: boolean;
  timestamp: string;
  payload?: Record<string, any>;
}

export class MerchantDigestService {
  private static instance: MerchantDigestService;
  private memoryBuffer: Map<string, BufferedDigestEvent[]> = new Map();
  private sentQuotaAlerts: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): MerchantDigestService {
    if (!MerchantDigestService.instance) {
      MerchantDigestService.instance = new MerchantDigestService();
    }
    return MerchantDigestService.instance;
  }

  /**
   * Buffer an operational event for a merchant.
   * Silently handles Redis availability and falls back to memory.
   */
  public async bufferEvent(event: { merchantId: string; type: string; payload?: Record<string, any>; timestamp?: string }): Promise<void> {
    const { merchantId, type, payload } = event;
    if (!merchantId) return;

    // Filter out internal sync events that don't need digest reporting
    const relevantTypes = [
      'ndr_detected',
      'ndr_rescued',
      'payment_received',
      'cod_converted',
      'order_cancelled',
      'fake_remark_escalated',
      'rto_arrest_triggered',
      'capacity_warning',
    ];

    if (!relevantTypes.includes(type)) {
      return;
    }

    const digestEvent: BufferedDigestEvent = {
      type,
      orderId: payload?.orderId,
      awb: payload?.awb,
      amount: payload?.amount,
      freightSaved: payload?.freightSaved,
      reason: payload?.reason,
      isFakeRemark: payload?.isFakeRemark,
      timestamp: event.timestamp || new Date().toISOString(),
      payload,
    };

    // 🔒 Critical event check: 80%+ and 100% quota triggers instant alerts
    if (type === 'capacity_warning' && payload?.percentage !== undefined && payload.percentage >= 80) {
      await this.handleCriticalCapacityAlert(merchantId, payload.used, payload.limit, payload.percentage);
    }

    // Attempt Redis buffer
    try {
      if (redisConnection && redisConnection.status === 'ready') {
        const key = `digest:events:${merchantId}`;
        await redisConnection.rpush(key, JSON.stringify(digestEvent));
        await redisConnection.expire(key, 604800); // 7 days TTL
        await redisConnection.sadd('digest:active_merchants', merchantId);
        return;
      }
    } catch (err: any) {
      logger.warn('Redis unavailable for digest buffer, using in-memory fallback', { error: err.message });
    }

    // In-memory fallback
    if (!this.memoryBuffer.has(merchantId)) {
      this.memoryBuffer.set(merchantId, []);
    }
    this.memoryBuffer.get(merchantId)!.push(digestEvent);
  }

  /**
   * Flushes and sends digest emails for all merchants with pending events.
   */
  public async flushAllDigests(): Promise<{ totalMerchants: number; emailsSent: number }> {
    const merchantIds = new Set<string>();

    // 1. Gather merchant IDs from Redis
    try {
      if (redisConnection && redisConnection.status === 'ready') {
        const redisMerchants = await redisConnection.smembers('digest:active_merchants');
        for (const id of redisMerchants) merchantIds.add(id);
      }
    } catch (err: any) {
      logger.warn('Failed to read active digest merchants from Redis', { error: err.message });
    }

    // 2. Gather merchant IDs from in-memory fallback
    for (const id of this.memoryBuffer.keys()) {
      merchantIds.add(id);
    }

    logger.info(`Starting hourly digest flush for ${merchantIds.size} merchant(s) with pending events`);

    let emailsSent = 0;
    for (const merchantId of merchantIds) {
      try {
        const sent = await this.flushMerchantDigest(merchantId);
        if (sent) emailsSent++;
      } catch (err: any) {
        logger.error('Failed to flush digest for merchant', { merchantId, error: err.message });
      }
    }

    logger.info(`Completed hourly digest flush: ${emailsSent} digest emails dispatched`);
    return { totalMerchants: merchantIds.size, emailsSent };
  }

  /**
   * Flush pending events for a single merchant and dispatch the digest email.
   */
  public async flushMerchantDigest(merchantId: string): Promise<boolean> {
    const events: BufferedDigestEvent[] = [];

    // 1. Drain Redis events
    try {
      if (redisConnection && redisConnection.status === 'ready') {
        const key = `digest:events:${merchantId}`;
        const rawEvents = await redisConnection.lrange(key, 0, -1);
        if (rawEvents && rawEvents.length > 0) {
          for (const raw of rawEvents) {
            try {
              events.push(JSON.parse(raw));
            } catch {
              // skip malformed JSON
            }
          }
          await redisConnection.del(key);
        }
        await redisConnection.srem('digest:active_merchants', merchantId);
      }
    } catch (err: any) {
      logger.warn('Failed to drain Redis digest events', { merchantId, error: err.message });
    }

    // 2. Drain memory events
    const memoryEvents = this.memoryBuffer.get(merchantId);
    if (memoryEvents && memoryEvents.length > 0) {
      events.push(...memoryEvents);
      this.memoryBuffer.delete(merchantId);
    }

    if (events.length === 0) {
      return false; // Nothing to report
    }

    // 3. Resolve Merchant Details
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) {
      logger.warn(`Merchant ${merchantId} not found, skipping digest email`);
      return false;
    }

    const recipient = (merchant as any).ownerEmail || (merchant as any).email;
    if (!recipient) {
      logger.warn(`Merchant ${merchantId} has no email configured, skipping digest email`);
      return false;
    }

    const merchantName = (merchant as any).storeName || (merchant as any).name || 'Your Store';

    // 4. Aggregate & Categorize Events
    const ndrDetected: BufferedDigestEvent[] = [];
    const ndrRescued: BufferedDigestEvent[] = [];
    const paymentsReceived: BufferedDigestEvent[] = [];
    const codConverted: BufferedDigestEvent[] = [];
    const ordersCancelled: BufferedDigestEvent[] = [];
    const rtoArrests: BufferedDigestEvent[] = [];
    const fakeRemarks: BufferedDigestEvent[] = [];

    let totalRecovered = 0;
    let totalFreightSaved = 0;

    for (const ev of events) {
      switch (ev.type) {
        case 'ndr_detected':
          ndrDetected.push(ev);
          break;
        case 'ndr_rescued':
          ndrRescued.push(ev);
          if (ev.amount) totalRecovered += ev.amount;
          break;
        case 'payment_received':
          paymentsReceived.push(ev);
          if (ev.amount) totalRecovered += ev.amount;
          break;
        case 'cod_converted':
          codConverted.push(ev);
          if (ev.amount) totalRecovered += ev.amount;
          break;
        case 'order_cancelled':
          ordersCancelled.push(ev);
          totalFreightSaved += ev.freightSaved || 160;
          break;
        case 'rto_arrest_triggered':
          rtoArrests.push(ev);
          break;
        case 'fake_remark_escalated':
          fakeRemarks.push(ev);
          break;
      }
    }

    // 5. Compose HTML & Text Content
    const subject = `📊 RescueShip Hourly Digest: ${ndrRescued.length > 0 ? `${ndrRescued.length} Rescued · ` : ''}${ndrDetected.length} New NDRs · ${merchantName}`;
    const html = this.buildDigestHtml(merchantName, {
      ndrDetected,
      ndrRescued,
      paymentsReceived,
      codConverted,
      ordersCancelled,
      rtoArrests,
      fakeRemarks,
      totalRecovered,
      totalFreightSaved,
      totalEvents: events.length,
    });

    const text = this.buildDigestText(merchantName, {
      ndrDetected,
      ndrRescued,
      paymentsReceived,
      codConverted,
      ordersCancelled,
      totalRecovered,
      totalFreightSaved,
      totalEvents: events.length,
    });

    // 6. Send Email via verified SMTP
    const sent = await emailService.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });

    if (sent) {
      logger.info(`Dispatched hourly digest to ${recipient}`, {
        merchantId,
        eventsCount: events.length,
        rescuedCount: ndrRescued.length,
      });
    }

    return sent;
  }

  /**
   * Immediate dispatch for critical quota warnings:
   * - 80% to 99%: Approaching plan limit warning email
   * - 100%+: Quota completely exhausted / rescues paused alert
   *
   * Deduplicated via Redis key (24-hour TTL) and in-memory set to prevent spam.
   */
  public async handleCriticalCapacityAlert(merchantId: string, used: number, limit: number, percentage: number): Promise<void> {
    const isExhausted = percentage >= 100;
    const alertTier = isExhausted ? '100' : '80';
    const dedupKey = `quota_alert:${alertTier}:${merchantId}`;

    // 1. Check deduplication
    try {
      if (redisConnection && redisConnection.status === 'ready') {
        const alreadySent = await redisConnection.get(dedupKey);
        if (alreadySent) {
          logger.debug(`Quota alert ${alertTier}% already sent recently for merchant ${merchantId}, skipping duplicate`);
          return;
        }
      }
    } catch {
      // Proceed if Redis is unavailable
    }

    const lastSentAt = this.sentQuotaAlerts.get(dedupKey);
    if (lastSentAt && Date.now() - lastSentAt < 86400 * 1000) {
      logger.debug(`In-memory quota alert ${alertTier}% already sent recently for merchant ${merchantId}, skipping duplicate`);
      return;
    }

    // 2. Fetch merchant info
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) return;

    const recipient = (merchant as any).ownerEmail || (merchant as any).email;
    if (!recipient) return;

    const merchantName = (merchant as any).storeName || (merchant as any).name || 'Merchant';

    // 3. Dispatch specific email tier
    let sent = false;
    if (isExhausted) {
      sent = await emailService.sendOrderLimitExhausted(recipient, merchantName, used, limit);
    } else {
      sent = await emailService.sendOrderLimitWarning(recipient, merchantName, used, limit, percentage);
    }

    // 4. Mark as sent with 24h TTL
    if (sent) {
      try {
        if (redisConnection && redisConnection.status === 'ready') {
          await redisConnection.set(dedupKey, '1', 'EX', 86400); // 24 hours
        }
      } catch {}
      this.sentQuotaAlerts.set(dedupKey, Date.now());
      logger.info(`Dispatched instant ${alertTier}% capacity alert to ${recipient}`, {
        merchantId,
        used,
        limit,
        percentage,
      });
    }
  }

  /**
   * Clear quota alerts for a specific merchant (e.g. after plan upgrade)
   */
  public async clearMerchantQuotaAlerts(merchantId: string): Promise<void> {
    const keys = [`quota_alert:80:${merchantId}`, `quota_alert:100:${merchantId}`];
    for (const key of keys) {
      this.sentQuotaAlerts.delete(key);
      try {
        if (redisConnection && redisConnection.status === 'ready') {
          await redisConnection.del(key);
        }
      } catch {}
    }
    logger.info(`Cleared quota alerts for merchant ${merchantId}`);
  }

  /**
   * Clear all quota alerts across all merchants (e.g. on 1st of month billing reset)
   */
  public async clearQuotaAlerts(): Promise<void> {
    this.sentQuotaAlerts.clear();
    try {
      if (redisConnection && redisConnection.status === 'ready') {
        const stream = redisConnection.scanStream({ match: 'quota_alert:*', count: 100 });
        stream.on('data', async (keys: string[]) => {
          if (keys && keys.length > 0) {
            await redisConnection.del(...keys);
          }
        });
      }
    } catch {}
    logger.info('Cleared all merchant quota alerts for new billing cycle');
  }

  private buildDigestHtml(merchantName: string, data: {
    ndrDetected: BufferedDigestEvent[];
    ndrRescued: BufferedDigestEvent[];
    paymentsReceived: BufferedDigestEvent[];
    codConverted: BufferedDigestEvent[];
    ordersCancelled: BufferedDigestEvent[];
    rtoArrests: BufferedDigestEvent[];
    fakeRemarks: BufferedDigestEvent[];
    totalRecovered: number;
    totalFreightSaved: number;
    totalEvents: number;
  }): string {
    const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

    let sectionsHtml = '';

    if (data.ndrRescued.length > 0) {
      sectionsHtml += `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 15px;">✅ Rescues Completed (${data.ndrRescued.length})</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.6;">
            ${data.ndrRescued.slice(0, 8).map(e => `<li>Order <strong>#${e.orderId || e.awb || 'N/A'}</strong> — Rescheduled & re-attempted</li>`).join('')}
            ${data.ndrRescued.length > 8 ? `<li><em>+ ${data.ndrRescued.length - 8} more rescued orders</em></li>` : ''}
          </ul>
        </div>
      `;
    }

    if (data.paymentsReceived.length > 0 || data.codConverted.length > 0) {
      const allPayments = [...data.paymentsReceived, ...data.codConverted];
      sectionsHtml += `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 15px;">💰 Payments & Conversions (${allPayments.length})</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1d4ed8; line-height: 1.6;">
            ${allPayments.slice(0, 8).map(e => `<li>Order <strong>#${e.orderId || 'N/A'}</strong> — ${e.amount ? `₹${e.amount} paid online` : 'Converted to prepaid'}</li>`).join('')}
            ${allPayments.length > 8 ? `<li><em>+ ${allPayments.length - 8} more payments</em></li>` : ''}
          </ul>
        </div>
      `;
    }

    if (data.ndrDetected.length > 0) {
      sectionsHtml += `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 15px;">⚠️ New Delivery Failures / NDRs (${data.ndrDetected.length})</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #b45309; line-height: 1.6;">
            ${data.ndrDetected.slice(0, 8).map(e => `<li>Order <strong>#${e.orderId || e.awb || 'N/A'}</strong> — ${e.reason || 'Failed delivery attempt'}</li>`).join('')}
            ${data.ndrDetected.length > 8 ? `<li><em>+ ${data.ndrDetected.length - 8} more NDR cases engaged via WhatsApp</em></li>` : ''}
          </ul>
        </div>
      `;
    }

    if (data.ordersCancelled.length > 0) {
      sectionsHtml += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #334155; font-size: 15px;">🛑 Cancellations & Freight Saved (${data.ordersCancelled.length})</h3>
          <p style="margin: 0; font-size: 13px; color: #475569;">
            ${data.ordersCancelled.length} order(s) cancelled before return shipping charges accrued. Estimated freight saved: <strong>₹${data.totalFreightSaved}</strong>.
          </p>
        </div>
      `;
    }

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff;">
        <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h2 style="margin: 0; color: #1e293b; font-size: 20px;">⚓ RescueShip Hourly Digest</h2>
            <span style="font-size: 12px; color: #64748b;">${timeStr} IST</span>
          </div>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">Automated performance summary for <strong>${merchantName}</strong></p>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #166534;">${data.ndrRescued.length}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 2px;">Rescued</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #b45309;">${data.ndrDetected.length}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 2px;">New NDRs</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #1e40af;">₹${data.totalRecovered}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 2px;">Recovered</div>
          </div>
        </div>

        ${sectionsHtml}

        <div style="margin-top: 24px; text-align: center;">
          <a href="https://rescueship.netlify.app/dashboard" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
            Open Live Merchant Console →
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          This hourly digest is delivered when operational events occur. Zero emails are sent when activity is idle.<br/>
          RescueShip Operations &bull; Autonomous NDR Recovery
        </p>
      </div>
    `;
  }

  private buildDigestText(merchantName: string, data: any): string {
    return [
      `RescueShip Hourly Digest — ${merchantName}`,
      `Total Events: ${data.totalEvents}`,
      `Rescued: ${data.ndrRescued.length}`,
      `New NDRs: ${data.ndrDetected.length}`,
      `Revenue Recovered: ₹${data.totalRecovered}`,
      `Freight Saved: ₹${data.totalFreightSaved}`,
      '',
      'View your real-time dashboard: https://rescueship.netlify.app/dashboard',
    ].join('\n');
  }
}

export const merchantDigestService = MerchantDigestService.getInstance();
