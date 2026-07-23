import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../utils/logger';

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
    const phoneNumberId = merchantConfig?.phoneNumberId || this.defaultPhoneNumberId;
    const accessToken = merchantConfig?.accessToken || this.defaultAccessToken;
    const version = this.defaultApiVersion;

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

    const formattedButtons = buttons.slice(0, 3).map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title,
      },
    }));

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText,
        },
        action: {
          buttons: formattedButtons,
        },
      },
    };

    try {
      logger.info('Sending WhatsApp interactive button message', { to, buttonCount: buttons.length });
      const response = await axios.post<WhatsAppResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp interactive button message', {
        to,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Send an image or media message
   */
  public async sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    merchantConfig?: WhatsAppConfig
  ): Promise<WhatsAppResponse> {
    const phoneNumberId = merchantConfig?.phoneNumberId || this.defaultPhoneNumberId;
    const accessToken = merchantConfig?.accessToken || this.defaultAccessToken;
    const version = this.defaultApiVersion;

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: mediaUrl,
        caption: caption || '',
      },
    };

    try {
      logger.info('Sending WhatsApp media message', { to, mediaUrl });
      const response = await axios.post<WhatsAppResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp media message', { to, error: error.response?.data || error.message });
      throw error;
    }
  }

  /**
   * Parse incoming webhook payload
   */
  public parseIncomingMessage(payload: any): ParsedMessage | null {
    try {
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const val = change?.value;
      const message = val?.messages?.[0];

      if (!message) return null;

      const from = message.from;
      const type = message.type;

      if (type === 'text') {
        return {
          from,
          type: 'text',
          text: message.text?.body,
        };
      } else if (type === 'button') {
        return {
          from,
          type: 'button',
          buttonPayload: message.button?.payload,
          text: message.button?.text,
        };
      } else if (type === 'interactive' && message.interactive?.type === 'button_reply') {
        return {
          from,
          type: 'button',
          buttonPayload: message.interactive.button_reply?.id,
          text: message.interactive.button_reply?.title,
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
        };
      }

      return {
        from,
        type: 'other',
      };
    } catch (error: any) {
      logger.error('Error parsing incoming WhatsApp message', { error: error.message });
      return null;
    }
  }

  /**
   * Verify signature of incoming Meta webhook request
   */
  public verifyWebhookSignature(rawBody: Buffer, signature: string, appSecret?: string): boolean {
    const secret = appSecret || config.whatsapp.appSecret;
    if (!signature || !secret) {
      logger.warn('WhatsApp webhook signature verification skipped: missing signature or secret');
      return false;
    }

    try {
      const parts = signature.split('=');
      const hash = parts[1];
      if (!hash) return false;

      const expectedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
    } catch (error: any) {
      logger.error('Error verifying WhatsApp webhook signature', { error: error.message });
      return false;
    }
  }
}

export const whatsAppService = WhatsAppService.getInstance();
