import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { logger, maskPhone } from '../utils/logger';
import { assertSafeCopy } from '../utils/customer-copy-guard';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { resolveTemplate } from './whatsapp/template-registry';

export interface WhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
  appSecret?: string;
}

export interface ButtonConfig {
  id: string;
  title: string;
}

export interface WhatsAppResponse {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  success?: boolean;
  suppressed?: boolean;
  reason?: string;
}

export interface ParsedMessage {
  from: string;
  type: 'text' | 'button' | 'location' | 'other';
  text?: string;
  buttonPayload?: string;
  messageId?: string;
  timestamp?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export class WhatsAppService {
  private static instance: WhatsAppService;
  private readonly defaultApiVersion: string;
  private readonly defaultPhoneNumberId: string;
  private readonly defaultAccessToken: string;

  private constructor() {
    this.defaultApiVersion = config.whatsapp.apiVersion || 'v22.0';
    this.defaultPhoneNumberId = config.whatsapp.phoneNumberId;
    this.defaultAccessToken = config.whatsapp.accessToken;
  }

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /**
   * Simulation is an explicit opt-in, never an implicit side effect of an error.
   * - NODE_ENV=test: always simulated (unit tests mock nothing external).
   * - WHATSAPP_SIMULATE=true: local dev without a real WABA.
   * - A dummy_ token is a marker for seeded dev/sandbox merchants.
   * Production can never simulate, regardless of flags.
   */
  private shouldSimulate(accessToken?: string): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    if (process.env.NODE_ENV === 'test') return true;
    if (process.env.WHATSAPP_SIMULATE === 'true') return true;
    return !!accessToken && accessToken.startsWith('dummy_');
  }

  private simulatedResponse(to: string): WhatsAppResponse {
    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: to, wa_id: to }],
      messages: [{ id: `wamid_sim_${Date.now()}` }],
    };
  }

  /**
   * Resolve the sending identity. Customer-facing sends MUST come from the merchant's
   * own number: falling back to the platform WABA would deliver a tenant's message from
   * RescueShip's identity (cross-tenant leak) and burn the platform's quality rating.
   * The platform number is used only when the caller passes no config at all
   * (internal/ops sends such as owner alerts).
   */
  private resolveCredentials(merchantConfig?: WhatsAppConfig): { phoneNumberId: string; accessToken: string } {
    if (merchantConfig?.phoneNumberId && merchantConfig?.accessToken) {
      return { phoneNumberId: merchantConfig.phoneNumberId, accessToken: merchantConfig.accessToken };
    }
    // Platform-managed mode: fall back to RescueShip official WABA credentials
    if (!this.defaultPhoneNumberId || !this.defaultAccessToken || this.defaultAccessToken.startsWith('your-')) {
      if (this.shouldSimulate(this.defaultAccessToken)) return { phoneNumberId: 'simulated', accessToken: 'dummy_sim' };
      throw new Error('Platform WhatsApp credentials are not configured');
    }
    return { phoneNumberId: this.defaultPhoneNumberId, accessToken: this.defaultAccessToken };
  }


  /**
   * Single choke point before any outbound message:
   *  - merchant global pause (settings.globalPause) stops every send for that merchant,
   *  - opt-out suppression is scoped to the sending merchant (a STOP to one brand
   *    does not silence every other brand); platform/ops sends check any suppression.
   */
  private async checkSendBlocked(normalizedTo: string, merchantConfig?: WhatsAppConfig, ctx?: { templateMap?: Record<string, string> }): Promise<any | null> {
    let merchantId: any = null;
    if (merchantConfig?.phoneNumberId) {
      try {
        const mongoose = (await import('mongoose')).default;
        const { Merchant } = await import('../models/Merchant');
        // Skip the lookup when the DB is not connected (unit tests / boot) instead of
        // letting Mongoose buffer the query for 10s.
        const m: any = mongoose.connection.readyState === 1
          ? await (Merchant as any).findOne({ 'whatsappConfig.phoneNumberId': merchantConfig.phoneNumberId }).select('_id settings.globalPause whatsappConfig.templateMap')
          : null;
        if (m?.settings?.globalPause === true) {
          logger.warn('WhatsApp message aborted: merchant has paused all automations', { merchantId: m._id });
          return { success: false, suppressed: true, reason: 'merchant_paused' };
        }
        merchantId = m?._id || null;
        if (ctx && m?.whatsappConfig?.templateMap) ctx.templateMap = m.whatsappConfig.templateMap;
      } catch (err: any) {
        logger.warn('Could not resolve merchant for pause check', { error: err?.message });
      }
    }
    const { SuppressedPhone } = await import('../models/SuppressedPhone');
    const query: any = merchantId
      ? { phone: normalizedTo, $or: [{ merchantId }, { merchantId: null }] }
      : { phone: normalizedTo };
    const isSuppressed = await SuppressedPhone.exists(query);
    if (isSuppressed) {
      logger.warn('WhatsApp message aborted: phone is on opt-out suppression list', { phone: maskPhone(normalizedTo) });
      return { success: false, suppressed: true, reason: 'customer_opted_out' };
    }
    return null;
  }

  /**
   * Send a plain text message.
   */
  public async sendText(
    to: string,
    text: string,
    merchantConfig?: WhatsAppConfig
  ): Promise<WhatsAppResponse> {
    assertSafeCopy(text); // R4 Boundary Guard
    const normalizedTo = normalizeIndianPhone(to);
    const blocked = await this.checkSendBlocked(normalizedTo, merchantConfig);
    if (blocked) return blocked;
    return this.sendInteractiveButtons(to, text, [], merchantConfig);
  }

  /**
   * Alias for sendText
   */
  public async sendTextMessage(
    to: string,
    text: string,
    merchantConfig?: WhatsAppConfig
  ): Promise<WhatsAppResponse> {
    return this.sendText(to, text, merchantConfig);
  }

  /**
   * Send a WhatsApp template message
   */
  public async sendTemplate(
    to: string,
    templateName: string,
    language: string,
    components: any[],
    merchantConfig?: WhatsAppConfig
  ): Promise<WhatsAppResponse> {
    const normalizedTo = normalizeIndianPhone(to);
    const ctx: { templateMap?: Record<string, string> } = {};
    const blocked = await this.checkSendBlocked(normalizedTo, merchantConfig, ctx);
    if (blocked) return blocked;

    // Logical → registered name, language fallback and parameter shape (template-registry).
    const resolved = resolveTemplate(templateName, language, components, (merchantConfig as any)?.templateMap || ctx.templateMap);
    if (resolved.error) {
      logger.error('WhatsApp template payload does not match the registered template', { templateName, registered: resolved.name, error: resolved.error });
      throw new Error(resolved.error);
    }
    const registeredName = resolved.name;
    language = resolved.language;
    components = resolved.components;
    const { phoneNumberId, accessToken } = this.resolveCredentials(merchantConfig);
    const version = this.defaultApiVersion;

    if (this.shouldSimulate(accessToken)) {
      logger.warn('[WhatsApp Simulation] Template simulated', { to, templateName, language });
      return this.simulatedResponse(to);
    }

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: registeredName,
        language: {
          code: language,
        },
        components,
      },
    };

    try {
      logger.info('Sending WhatsApp template message', { to, templateName, language });
      const response = await axios.post<WhatsAppResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp template message', {
        to,
        templateName,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Alias for sendTemplate
   */
  public async sendTemplateMessage(
    to: string,
    templateName: string,
    language: string,
    components: any[],
    merchantConfig?: WhatsAppConfig
  ): Promise<WhatsAppResponse> {
    return this.sendTemplate(to, templateName, language, components, merchantConfig);
  }

  /**
   * Send an interactive quick-reply button message
   */
  public async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: ButtonConfig[],
    merchantConfig?: WhatsAppConfig
  ): Promise<WhatsAppResponse> {
    assertSafeCopy(bodyText); // R4 Boundary Guard

    const normalizedTo = normalizeIndianPhone(to);
    const blocked = await this.checkSendBlocked(normalizedTo, merchantConfig);
    if (blocked) return blocked;

    const { phoneNumberId, accessToken } = this.resolveCredentials(merchantConfig);
    const version = this.defaultApiVersion;

    if (this.shouldSimulate(accessToken)) {
      logger.warn('[WhatsApp Simulation] Message simulated', { to, bodyText, buttonCount: (buttons || []).length });
      return this.simulatedResponse(to);
    }

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

    const formattedButtons = (buttons || []).slice(0, 3).map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title,
      },
    }));

    const interactivePayload: any = {
      type: formattedButtons.length > 0 ? 'button' : 'text',
      body: {
        text: bodyText,
      },
    };

    if (formattedButtons.length > 0) {
      interactivePayload.action = { buttons: formattedButtons };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: formattedButtons.length > 0 ? 'interactive' : 'text',
      text: formattedButtons.length === 0 ? { body: bodyText } : undefined,
      interactive: formattedButtons.length > 0 ? interactivePayload : undefined,
    };

    try {
      logger.info('Sending WhatsApp message', { to, buttonCount: (buttons || []).length });
      const response = await axios.post<WhatsAppResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message', {
        to,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  public parseIncomingMessage(body: any): ParsedMessage | null {
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (!message) return null;

      const from = message.from;
      const type = message.type;
      const messageId = message.id;
      const timestamp = message.timestamp;

      if (type === 'text') {
        return {
          from,
          type: 'text',
          text: message.text?.body,
          ...(messageId ? { messageId } : {}),
          ...(timestamp ? { timestamp } : {}),
        };
      } else if (type === 'button') {
        return {
          from,
          type: 'button',
          buttonPayload: message.button?.payload || message.button?.text,
          text: message.button?.text,
          ...(messageId ? { messageId } : {}),
          ...(timestamp ? { timestamp } : {}),
        };
      } else if (type === 'interactive' && message.interactive?.type === 'button_reply') {
        return {
          from,
          type: 'button',
          buttonPayload: message.interactive.button_reply?.id,
          text: message.interactive.button_reply?.title,
          ...(messageId ? { messageId } : {}),
          ...(timestamp ? { timestamp } : {}),
        };
      } else if (type === 'location') {
        return {
          from,
          type: 'location',
          location: {
            latitude: message.location?.latitude,
            longitude: message.location?.longitude,
            name: message.location?.name,
            address: message.location?.address,
          },
          ...(messageId ? { messageId } : {}),
          ...(timestamp ? { timestamp } : {}),
        };
      }

      return {
        from,
        type: 'other',
        ...(messageId ? { messageId } : {}),
        ...(timestamp ? { timestamp } : {}),
      };
    } catch (err: any) {
      logger.error('Failed to parse incoming WhatsApp message', { error: err.message });
      return null;
    }
  }

  public verifyWebhookSignature(rawBody: string | Buffer, signature: string, appSecret: string): boolean {
    try {
      if (!appSecret || !signature || !rawBody) {
        return false;
      }

      const elements = signature.split('=');
      const signatureHash = elements[1] || elements[0];
      const expectedHash = crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(signatureHash, 'utf8');
      const expectedBuf = Buffer.from(expectedHash, 'utf8');

      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch (err) {
      return false;
    }
  }
}

export const whatsAppService = WhatsAppService.getInstance();
