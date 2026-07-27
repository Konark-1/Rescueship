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
    const phoneNumberId = merchantConfig?.phoneNumberId || this.defaultPhoneNumberId;
    const accessToken = merchantConfig?.accessToken || this.defaultAccessToken;
    const version = this.defaultApiVersion;

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
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

    const phoneNumberId = merchantConfig?.phoneNumberId || this.defaultPhoneNumberId;
    const accessToken = merchantConfig?.accessToken || this.defaultAccessToken;
    const version = this.defaultApiVersion;

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
        return { from, type: 'text', text: message.text?.body, messageId, timestamp };
      } else if (type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          return {
            from,
            type: 'button',
            buttonPayload: interactive.button_reply.id,
            messageId,
            timestamp,
          };
        }
      } else if (type === 'button') {
        return {
          from,
          type: 'button',
          buttonPayload: message.button?.payload || message.button?.text,
          messageId,
          timestamp,
        };
      } else if (type === 'location') {
        return {
          from,
          type: 'location',
          location: {
            latitude: message.location.latitude,
            longitude: message.location.longitude,
            name: message.location.name,
            address: message.location.address,
          },
          messageId,
          timestamp,
        };
      }

      return { from, type: 'other', messageId, timestamp };
    } catch (err: any) {
      logger.error('Failed to parse incoming WhatsApp message', { error: err.message });
      return null;
    }
  }

  public verifyWebhookSignature(rawBody: string | Buffer, signature: string, appSecret: string): boolean {
    try {
      const elements = signature.split('=');
      const signatureHash = elements[1];
      const expectedHash = crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'utf8'),
        Buffer.from(expectedHash, 'utf8')
      );
    } catch (err) {
      return false;
    }
  }
}

export const whatsAppService = WhatsAppService.getInstance();
