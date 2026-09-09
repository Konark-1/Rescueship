import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { assertSafeCopy } from '../utils/customer-copy-guard';

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
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
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
    if (merchantConfig) {
      const phoneNumberId = merchantConfig.phoneNumberId;
      const accessToken = merchantConfig.accessToken;
      if (!phoneNumberId || !accessToken) {
        if (this.shouldSimulate(accessToken)) return { phoneNumberId: phoneNumberId || 'simulated', accessToken: accessToken || 'dummy_sim' };
        throw new Error('WhatsApp is not connected for this merchant (missing phoneNumberId or accessToken)');
      }
      return { phoneNumberId, accessToken };
    }
    if (!this.defaultPhoneNumberId || !this.defaultAccessToken || this.defaultAccessToken.startsWith('your-')) {
      if (this.shouldSimulate(this.defaultAccessToken)) return { phoneNumberId: 'simulated', accessToken: 'dummy_sim' };
      throw new Error('Platform WhatsApp credentials are not configured');
    }
    return { phoneNumberId: this.defaultPhoneNumberId, accessToken: this.defaultAccessToken };
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
    return this.sendInteractiveButtons(to, text, [], merchantConfig);
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
    const map = (merchantConfig as any)?.templateMap || {};
    const registeredName = map[templateName] || templateName;
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
   * Send an interactive quick-reply button message
   */
  public async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: ButtonConfig[],
    merchantConfig?: WhatsAppConfig
  ): Promise<WhatsAppResponse> {
    assertSafeCopy(bodyText); // R4 Boundary Guard

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
