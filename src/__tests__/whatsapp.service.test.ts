import crypto from 'crypto';
import { whatsAppService } from '../services/whatsapp.service';

jest.mock('../config/env', () => ({
  config: {
    whatsapp: {
      apiVersion: 'v22.0',
      phoneNumberId: 'default_ph_id',
      accessToken: 'default_access_token',
      appSecret: 'test_app_secret',
    },
  },
}));

describe('WhatsAppService - Unit Tests', () => {
  describe('parseIncomingMessage', () => {
    it('should correctly parse text message', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      type: 'text',
                      text: { body: 'Flat 101, Palm Heights' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = whatsAppService.parseIncomingMessage(payload);
      expect(result).toEqual({
        from: '919876543210',
        type: 'text',
        text: 'Flat 101, Palm Heights',
      });
    });

    it('should correctly parse button message', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      type: 'button',
                      button: {
                        payload: 'reschedule:order123',
                        text: 'Reschedule Tomorrow',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = whatsAppService.parseIncomingMessage(payload);
      expect(result).toEqual({
        from: '919876543210',
        type: 'button',
        buttonPayload: 'reschedule:order123',
        text: 'Reschedule Tomorrow',
      });
    });

    it('should correctly parse interactive button_reply message', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'address:order123',
                          title: 'Update Address',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = whatsAppService.parseIncomingMessage(payload);
      expect(result).toEqual({
        from: '919876543210',
        type: 'button',
        buttonPayload: 'address:order123',
        text: 'Update Address',
      });
    });

    it('should correctly parse location message', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      type: 'location',
                      location: {
                        latitude: 19.076,
                        longitude: 72.8777,
                        name: 'Mumbai Landmark',
                        address: '123 Main St, Mumbai',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = whatsAppService.parseIncomingMessage(payload);
      expect(result).toEqual({
        from: '919876543210',
        type: 'location',
        location: {
          latitude: 19.076,
          longitude: 72.8777,
          name: 'Mumbai Landmark',
          address: '123 Main St, Mumbai',
        },
      });
    });

    it('should return null for invalid or empty payload', () => {
      const result = whatsAppService.parseIncomingMessage({});
      expect(result).toBeNull();
    });
  });

  describe('verifyWebhookSignature', () => {
    const appSecret = 'test_app_secret';
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));

    it('should verify valid HMAC signature', () => {
      const hash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const signature = `sha256=${hash}`;

      const isValid = whatsAppService.verifyWebhookSignature(rawBody, signature, appSecret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      const invalidSignature = 'sha256=invalidhashvalue1234567890abcdef1234567890abcdef1234567890abcdef';

      const isValid = whatsAppService.verifyWebhookSignature(rawBody, invalidSignature, appSecret);
      expect(isValid).toBe(false);
    });

    it('should reject when signature or secret is missing', () => {
      const isValid = whatsAppService.verifyWebhookSignature(rawBody, '', appSecret);
      expect(isValid).toBe(false);
    });
  });
});
