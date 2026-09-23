/**
 * whatsapp-dispatcher.service.ts
 * Enterprise WhatsApp Outbound Dispatcher with suppression rules, retry with backoff,
 * rate limiting, atomic credit settlement, and full MessageLog persistence.
 */

import { Types } from 'mongoose';
import { Merchant, Order, MessageLog, AuditLog, BillingEvent } from '../../models';
import { whatsAppService, WhatsAppConfig } from '../whatsapp.service';
import { templateMapperService, NDRCategory, TemplateMapping } from './template-mapper.service';
import { encryptionService } from '../encryption.service';
import { normalizeIndianPhone } from '../../utils/phoneNormalizer';
import { logger, maskPhone } from '../../utils/logger';
import { redisConnection } from '../../config/redis';

export interface DispatchRetryPolicy {
  maxRetries: number;
  backoffMs: number[];
  retryableCodes: number[];
  nonRetryableCodes: number[];
}

export interface DispatchOptions {
  merchantId: string;
  orderId: string;
  phone: string;
  category: NDRCategory;
  variables: Record<string, string>;
  isRtoArrest?: boolean;
  order?: any;
}

export interface DispatchResult {
  success: boolean;
  messageId?: string;
  suppressed?: boolean;
  suppressReason?: string;
  error?: string;
}

export class WhatsAppDispatcherService {
  private static instance: WhatsAppDispatcherService;

  private readonly retryPolicy: DispatchRetryPolicy = {
    maxRetries: 3,
    backoffMs: [1000, 5000, 15000],
    retryableCodes: [429, 500, 502, 503, 504],
    nonRetryableCodes: [400, 401, 403, 131047],
  };

  private constructor() {}

  public static getInstance(): WhatsAppDispatcherService {
    if (!WhatsAppDispatcherService.instance) {
      WhatsAppDispatcherService.instance = new WhatsAppDispatcherService();
    }
    return WhatsAppDispatcherService.instance;
  }

  /**
   * Main entrypoint to dispatch NDR template message with full safeguards.
   */
  public async dispatchNdrRescue(options: DispatchOptions): Promise<DispatchResult> {
    const { merchantId, orderId, phone, category, variables, isRtoArrest } = options;
    const normalizedPhone = normalizeIndianPhone(phone);

    logger.info('WhatsApp Dispatcher evaluating outbound NDR message', {
      merchantId,
      orderId,
      phone: maskPhone(normalizedPhone),
      category,
    });

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${merchantId}`);
    }

    const order = options.order || (await Order.findById(orderId)) || (await Order.findOne({ _id: orderId }));
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // ─── 0. 90-Day License Expiry Gate ───
    if (merchant.accessExpiresAt && new Date(merchant.accessExpiresAt).getTime() < Date.now()) {
      logger.warn('WhatsApp send suppressed: Merchant license has expired', {
        merchantId,
        orderId,
        accessExpiresAt: merchant.accessExpiresAt,
      });
      return { success: false, suppressed: true, suppressReason: 'License Expired' };
    }

    // ─── 1. Suppression Rules ───
    const terminalStates = ['delivered', 'returned', 'cancelled', 'lost'];
    if (terminalStates.includes(order.status)) {
      logger.info('WhatsApp send suppressed: Order is in terminal state', {
        orderId,
        status: order.status,
      });
      return { success: false, suppressed: true, suppressReason: `Terminal state: ${order.status}` };
    }

    if (order.status === 'rto_initiated' && !isRtoArrest) {
      logger.info('WhatsApp send suppressed: Order is rto_initiated, standard NDR template disallowed', {
        orderId,
      });
      return { success: false, suppressed: true, suppressReason: 'rto_initiated requires RTO-arrest template' };
    }

    if (order.status === 'rto') {
      logger.info('WhatsApp send suppressed: Order is fully RTO', { orderId });
      return { success: false, suppressed: true, suppressReason: 'Order is fully RTO' };
    }

    // Check if customer opted out / cancelled
    if (order.ndr?.customerResponse === 'cancel') {
      logger.info('WhatsApp send suppressed: Customer already opted out / cancelled', { orderId });
      return { success: false, suppressed: true, suppressReason: 'Customer opted out' };
    }

    // Check episode message count (Max 3 messages per NDR episode)
    const priorOutboundCount = await MessageLog.countDocuments({
      merchantId: merchant._id,
      orderId: order._id,
      direction: 'OUTBOUND',
    });

    if (priorOutboundCount >= 3) {
      logger.warn('WhatsApp send suppressed: Max 3 messages per NDR episode reached', {
        orderId,
        count: priorOutboundCount,
      });
      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'whatsapp_suppressed_max_messages',
        source: 'whatsapp_dispatcher',
        payload: { priorOutboundCount },
        status: 'success',
      });
      return { success: false, suppressed: true, suppressReason: 'Episode max message limit reached' };
    }

    // ─── 2. Rate Limiting (60s minimum interval per phone) ───
    if (redisConnection) {
      try {
        const rateLimitKey = `wa_dispatch_limit:${merchantId}:${normalizedPhone}`;
        const isLimited = await redisConnection.get(rateLimitKey);
        if (isLimited && process.env.NODE_ENV !== 'test') {
          logger.warn('WhatsApp send rate limited: cooldown active', { phone: maskPhone(normalizedPhone) });
          return { success: false, suppressed: true, suppressReason: 'Rate limit cooldown active' };
        }
      } catch (redisErr: any) {
        logger.warn('Redis rate limit check skipped due to error', { error: redisErr?.message });
      }
    }

    // ─── 3. Template Resolution & Pre-Send Validation ───
    const lang = merchant.settings?.ndrRescue?.messageLanguage || 'en';
    const mapping = templateMapperService.getMappingForCategory(
      category,
      lang,
      (merchant.whatsappConfig as any)?.templateMap
    );

    const validation = templateMapperService.validateTemplatePayload(mapping, variables, normalizedPhone);
    if (!validation.valid) {
      logger.error('WhatsApp template validation failed — send aborted', {
        errors: validation.errors,
        orderId,
      });
      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'template_validation_failed',
        source: 'whatsapp_dispatcher',
        payload: { errors: validation.errors, mapping, variables },
        status: 'failed',
      });
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    // ─── 4. Atomic Credit Deduction ───
    const creditDeducted = await Merchant.updateOne(
      { _id: merchant._id, 'billing.rescueCredits': { $gt: 0 } },
      { $inc: { 'billing.rescueCredits': -1 } }
    );
    if (creditDeducted.modifiedCount === 0) {
      logger.warn('WhatsApp send aborted: Insufficient rescue credits', { merchantId });
      return { success: false, error: 'Insufficient rescue credits' };
    }

    // ─── 5. Meta Send with Retry Policy ───
    const waConfig = this.resolveMerchantWaConfig(merchant);
    const components = templateMapperService.buildTemplateComponents(mapping, variables);

    let lastError: any = null;
    let metaMessageId: string | undefined;

    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      try {
        const response = await whatsAppService.sendTemplate(
          normalizedPhone,
          mapping.templateName,
          mapping.language,
          components,
          waConfig
        );
        metaMessageId = response?.messages?.[0]?.id;
        break; // Success
      } catch (err: any) {
        lastError = err;
        const statusCode = err.response?.status;
        const metaCode = err.response?.data?.error?.code;

        logger.warn(`WhatsApp dispatch attempt ${attempt + 1} failed`, {
          statusCode,
          metaCode,
          error: err.message,
        });

        // Error 131047: Session window expired. Do not retry session; abort
        if (metaCode === 131047 || this.retryPolicy.nonRetryableCodes.includes(statusCode)) {
          break;
        }

        if (attempt < this.retryPolicy.maxRetries && this.retryPolicy.retryableCodes.includes(statusCode)) {
          const delayMs = this.retryPolicy.backoffMs[attempt] || 1000;
          await new Promise((res) => setTimeout(res, delayMs));
        } else {
          break;
        }
      }
    }

    // ─── 6. Outcome Handling & MessageLog Persistence ───
    if (!metaMessageId && lastError) {
      // Refund credit since message was not accepted by Meta
      await Merchant.updateOne(
        { _id: merchant._id },
        { $inc: { 'billing.rescueCredits': 1 } }
      );

      await MessageLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        customerPhone: normalizedPhone,
        direction: 'OUTBOUND',
        templateName: mapping.templateName,
        messageType: 'template',
        status: 'failed',
        error: lastError?.response?.data?.error?.message || lastError.message,
      });

      return { success: false, error: lastError.message };
    }

    // Message accepted by Meta
    await MessageLog.create({
      merchantId: merchant._id,
      orderId: order._id,
      customerPhone: normalizedPhone,
      direction: 'OUTBOUND',
      templateName: mapping.templateName,
      messageType: 'template',
      metaMessageId,
      status: 'sent',
      sentAt: new Date(),
    });

    await BillingEvent.create({
      merchantId: merchant._id,
      eventType: 'whatsapp_template_sent',
      orderId: order._id,
      creditsCost: 1,
    });

    // Set cooldown rate limit in Redis (60 seconds)
    if (redisConnection) {
      try {
        const rateLimitKey = `wa_dispatch_limit:${merchantId}:${normalizedPhone}`;
        await redisConnection.set(rateLimitKey, '1', 'EX', 60);
      } catch (redisErr) {}
    }

    return { success: true, messageId: metaMessageId };
  }

  private resolveMerchantWaConfig(merchant: any): WhatsAppConfig {
    let token: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        token = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch (err: any) {
        logger.error('Stored WhatsApp token cannot be decrypted; merchant must reconnect', { merchantId: merchant._id });
        throw new Error('WhatsApp credentials require reconnection');
      }
    }
    return {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: token,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };
  }
}

export const whatsAppDispatcherService = WhatsAppDispatcherService.getInstance();
