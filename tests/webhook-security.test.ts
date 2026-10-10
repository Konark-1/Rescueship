process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import shopifyRouter from '../src/webhooks/shopify.webhook';
import razorpayRouter from '../src/webhooks/razorpay.webhook';
import whatsappRouter from '../src/webhooks/whatsapp.webhook';
import { Merchant, Order } from '../src/models';
import { encryptionService } from '../src/services/encryption.service';
import { config } from '../src/config/env';

jest.mock('../src/models', () => ({
  Merchant: {
    findOne: jest.fn(),
  },
  Order: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  },
  AuditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  WebhookEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
  MessageLog: {
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../src/config/redis', () => ({
  redisConnection: {
    status: 'ready',
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job_123' }),
  })),
}));

jest.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    onRenewalCharged: jest.fn().mockResolvedValue(undefined),
    reconcileIntroPayment: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/utils/idempotency', () => ({
  IdempotencyGuard: {
    key: jest.fn().mockReturnValue('mock_idem_key'),
    claim: jest.fn().mockResolvedValue('acquired'),
    release: jest.fn().mockResolvedValue(undefined),
    markProcessed: jest.fn().mockResolvedValue(undefined),
  },
  IdempotencyUnavailableError: class IdempotencyUnavailableError extends Error {},
}));

describe('Webhook Security & Signature Verification', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    // Middleware to simulate rawBody capture as implemented in server index.ts
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.use('/webhooks/shopify', shopifyRouter);
    app.use('/webhooks/razorpay', razorpayRouter);
    app.use('/webhooks/whatsapp', whatsappRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Shopify Webhook Security', () => {
    const shopDomain = 'secure-store.myshopify.com';
    const rawSecret = 'shopify_secret_key_1234567890';
    const encryptedSecret = encryptionService.encrypt(rawSecret);

    const mockMerchant = {
      _id: '507f1f77bcf86cd799439011',
      shopify: {
        shopDomain,
        apiSecret: encryptedSecret,
      },
    };

    it('rejects request with missing HMAC signature header (401)', async () => {
      const payload = { id: 1001, total_price: '500.00' };
      const res = await request(app)
        .post('/webhooks/shopify')
        .set('X-Shopify-Shop-Domain', shopDomain)
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing HMAC signature');
    });

    it('rejects request with missing or invalid shop domain (401)', async () => {
      const payload = { id: 1001 };
      const bodyStr = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', rawSecret).update(bodyStr).digest('base64');

      const res = await request(app)
        .post('/webhooks/shopify')
        .set('X-Shopify-Hmac-Sha256', signature)
        .set('X-Shopify-Shop-Domain', 'evil-attacker.com') // Not .myshopify.com
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid Shopify store identity');
    });

    it('rejects request for unknown shop not registered in database (401)', async () => {
      (Merchant.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const payload = { id: 1001 };
      const bodyStr = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', rawSecret).update(bodyStr).digest('base64');

      const res = await request(app)
        .post('/webhooks/shopify')
        .set('X-Shopify-Hmac-Sha256', signature)
        .set('X-Shopify-Shop-Domain', 'unregistered.myshopify.com')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unknown Shopify store');
    });

    it('rejects request when HMAC signature does not match (401)', async () => {
      (Merchant.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockMerchant),
      });

      const payload = { id: 1001, total_price: '500.00' };
      const invalidSignature = Buffer.from('invalid_forged_signature_hash_bytes_123').toString('base64');

      const res = await request(app)
        .post('/webhooks/shopify')
        .set('X-Shopify-Hmac-Sha256', invalidSignature)
        .set('X-Shopify-Shop-Domain', shopDomain)
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid HMAC signature');
    });

    it('accepts request with valid HMAC signature (200)', async () => {
      (Merchant.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockMerchant),
      });
      (Order.findOne as jest.Mock).mockResolvedValue(null);

      const payload = {
        id: 1001,
        name: '#ORD-1001',
        financial_status: 'pending',
        gateway: 'cash_on_delivery',
        total_price: '799.00',
        shipping_address: {
          phone: '+919876543210',
          first_name: 'Aditya',
          zip: '110001',
          city: 'New Delhi',
        },
      };

      const bodyStr = JSON.stringify(payload);
      const validSignature = crypto.createHmac('sha256', rawSecret).update(bodyStr).digest('base64');

      const res = await request(app)
        .post('/webhooks/shopify')
        .set('X-Shopify-Hmac-Sha256', validSignature)
        .set('X-Shopify-Shop-Domain', shopDomain)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('queued');
    });
  });

  describe('Razorpay Webhook Security', () => {
    it('rejects request with missing X-Razorpay-Signature (401)', async () => {
      const res = await request(app)
        .post('/webhooks/razorpay/payment')
        .send({ event: 'payment.captured' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing X-Razorpay-Signature header');
    });

    it('rejects request with invalid signature (401)', async () => {
      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_123', amount: 50000 } } },
      };

      const res = await request(app)
        .post('/webhooks/razorpay/payment')
        .set('X-Razorpay-Signature', 'bad_signature_hash_0000000000000000000000000000000000000000000000000000000000000000')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid Razorpay signature');
    });

    it('accepts request with valid signature against platform webhook secret (200)', async () => {
      const webhookSecret = 'test_razorpay_secret_platform';
      (config.razorpay as any).webhookSecret = webhookSecret;

      const payload = {
        event: 'subscription.charged',
        payload: { subscription: { entity: { id: 'sub_test_123' } } },
      };
      const bodyStr = JSON.stringify(payload);
      const validSig = crypto.createHmac('sha256', webhookSecret).update(bodyStr).digest('hex');

      const res = await request(app)
        .post('/webhooks/razorpay/payment')
        .set('X-Razorpay-Signature', validSig)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
    });
  });

  describe('WhatsApp Webhook Security', () => {
    it('GET verification: succeeds when hub.verify_token matches (200)', async () => {
      const verifyToken = config.whatsapp.verifyToken || 'test_token';
      (config.whatsapp as any).verifyToken = verifyToken;

      const res = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': 'challenge_code_12345',
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('challenge_code_12345');
    });

    it('GET verification: rejects when hub.verify_token is incorrect (403)', async () => {
      (config.whatsapp as any).verifyToken = 'correct_token';

      const res = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_code_12345',
        });

      expect(res.status).toBe(403);
    });

    it('POST: rejects when X-Hub-Signature-256 header is missing (401)', async () => {
      (config.whatsapp as any).appSecret = 'wa_secret_123';

      const res = await request(app)
        .post('/webhooks/whatsapp')
        .send({ object: 'whatsapp_business_account' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing X-Hub-Signature-256 header');
    });

    it('POST: rejects when X-Hub-Signature-256 signature is invalid (401)', async () => {
      (config.whatsapp as any).appSecret = 'wa_secret_123';

      const res = await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', 'sha256=bad_hex_signature_0000000000000000000000000000000000000000000000000000000000000000')
        .send({ object: 'whatsapp_business_account' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid WhatsApp signature');
    });

    it('POST: accepts when X-Hub-Signature-256 is valid (200)', async () => {
      const appSecret = 'wa_app_secret_xyz';
      (config.whatsapp as any).appSecret = appSecret;

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: 'wamid_123', status: 'delivered' }],
                },
              },
            ],
          },
        ],
      };
      const bodyStr = JSON.stringify(payload);
      const hash = crypto.createHmac('sha256', appSecret).update(bodyStr).digest('hex');
      const signature = `sha256=${hash}`;

      const res = await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    });
  });
});
