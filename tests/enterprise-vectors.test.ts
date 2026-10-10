process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
process.env.META_VERIFY_TOKEN = 'test_meta_webhook_secret_xyz';

import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import { createCarrierNdrHandler } from '../src/webhooks/carrier-ndr.handler';
import { whatsAppDispatcherService } from '../src/services/whatsapp/whatsapp-dispatcher.service';
import whatsappWebhookRouter from '../src/webhooks/whatsapp.webhook';
import { stopAllWorkers } from '../src/jobs';
import { redisConnection } from '../src/config/redis';
import { logger } from '../src/utils/logger';

// ─── REDIS IN-MEMORY MOCK STORE ───
jest.mock('../src/config/redis', () => {
  const store = new Map<string, string>();
  const ttlStore = new Map<string, number>();

  return {
    redisConnection: {
      get: jest.fn(async (key: string) => store.get(key) || null),
      set: jest.fn(async (key: string, val: string, pxFlag?: string, ttl?: number, nxFlag?: string) => {
        if (nxFlag === 'NX' || pxFlag === 'NX') {
          if (store.has(key)) return null;
        }
        store.set(key, val);
        return 'OK';
      }),
      incr: jest.fn(async (key: string) => {
        const current = parseInt(store.get(key) || '0', 10);
        const next = current + 1;
        store.set(key, String(next));
        return next;
      }),
      expire: jest.fn(async (key: string, seconds: number) => {
        ttlStore.set(key, seconds);
        return 1;
      }),
      del: jest.fn(async (key: string) => {
        const deleted = store.delete(key);
        return deleted ? 1 : 0;
      }),
      eval: jest.fn(async (script: string, numKeys: number, key: string, argValue: string) => {
        const currentVal = store.get(key);
        if (currentVal === argValue) {
          store.delete(key);
          return 1;
        }
        return 0;
      }),
      status: 'ready',
      on: jest.fn(),
      _store: store,
      _ttlStore: ttlStore,
    },
    connectRedis: jest.fn().mockResolvedValue(true),
    disconnectRedis: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../src/config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/utils/idempotency', () => ({
  IdempotencyGuard: {
    key: jest.fn((provider, merchantId, eventId) => `mock_idem_${provider}_${merchantId}_${eventId}`),
    claim: jest.fn().mockResolvedValue('acquired'),
    markProcessed: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  },
  IdempotencyUnavailableError: class extends Error {},
}));

const mockQueuedJobs: any[] = [];
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name) => ({
    name,
    add: jest.fn(async (jobName, data, opts) => {
      mockQueuedJobs.push({ queue: name, jobName, data, opts });
      return { id: `mock_job_${Date.now()}` };
    }),
  })),
  Worker: jest.fn().mockImplementation((name) => ({
    name,
    on: jest.fn(),
    run: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    isRunning: jest.fn().mockReturnValue(true),
  })),
}));

import { DeliveryAttempt } from '../src/models';

const mockMerchantA = {
  _id: new Types.ObjectId('650000000000000000000001'),
  name: 'Merchant Alpha',
  tier: 'scale',
  apiKeys: ['secret_alpha'],
  carrierConfig: { webhookSecret: 'enc_secret_alpha' },
  metaTierLimit: 1000,
  billing: { rescueCredits: 50 },
  settings: { ndrRescue: { messageLanguage: 'en' } },
  whatsappConfig: { accessToken: 'encrypted_tok', phoneNumberId: 'phone_1' },
};

const mockMerchantB = {
  _id: new Types.ObjectId('650000000000000000000002'),
  name: 'Merchant Beta',
  tier: 'growth',
  apiKeys: ['secret_beta'],
  carrierConfig: { webhookSecret: 'enc_secret_beta' },
  metaTierLimit: 100,
  billing: { rescueCredits: 20 },
  settings: { ndrRescue: { messageLanguage: 'en' } },
  whatsappConfig: { accessToken: 'encrypted_tok', phoneNumberId: 'phone_2' },
};

jest.mock('../src/models', () => {
  return {
    Merchant: {
      findById: jest.fn((id: any) => {
        const idStr = id?.toString();
        const found = idStr === '650000000000000000000001' ? { ...mockMerchantA }
                    : idStr === '650000000000000000000002' ? { ...mockMerchantB }
                    : null;
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(found),
          }),
          then: (resolve: any, reject: any) => Promise.resolve(found).then(resolve, reject),
        };
      }),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn(async () => mockMerchantA),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    },
    Order: {
      findOne: jest.fn(async () => ({
        _id: new Types.ObjectId(),
        merchantId: mockMerchantA._id,
        awb: 'AWB-COLLISION-123',
        status: 'in_transit',
        paymentMethod: 'cod',
      })),
      findById: jest.fn(async () => ({
        _id: new Types.ObjectId(),
        merchantId: mockMerchantA._id,
        status: 'in_transit',
        paymentMethod: 'cod',
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    },
    Shipment: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    DeliveryAttempt: {
      create: jest.fn().mockResolvedValue({}),
    },
    WebhookEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    AuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    MessageLog: {
      countDocuments: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    },
    BillingEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    RescueLedger: {
      reconcileOutcomes: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../src/services/whatsapp.service', () => ({
  whatsAppService: {
    sendTemplate: jest.fn().mockResolvedValue({
      messages: [{ id: 'wamid.HBgLMTIzNDU2' }],
    }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../src/services/whatsapp/template-mapper.service', () => ({
  templateMapperService: {
    getMappingForCategory: jest.fn().mockReturnValue({
      templateName: 'ndr_reschedule_en',
      language: 'en',
    }),
    validateTemplatePayload: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    buildTemplateComponents: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../src/services/encryption.service', () => ({
  encryptionService: {
    decrypt: jest.fn((val: string) => {
      if (val === 'enc_secret_alpha') return 'secret_alpha';
      if (val === 'enc_secret_beta') return 'secret_beta';
      return 'decrypted_token';
    }),
  },
}));

describe('🛡️ 5 INVISIBLE ENTERPRISE VECTORS VERIFICATION SUITE', () => {
  let app: Express;
  const redisStore = (redisConnection as any)._store as Map<string, string>;
  const redisTtlStore = (redisConnection as any)._ttlStore as Map<string, number>;

  beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    redisTtlStore.clear();
    mockQueuedJobs.length = 0;

    app = express();
    app.use(express.json());

    const carrierHandler = createCarrierNdrHandler(
      'shiprocket',
      () => 'shared_platform_secret',
      (req) => ({
        awb: req.body.awb,
        externalOrderId: req.body.order_id,
        reason: req.body.reason || 'Customer not available',
        status: 'UNDELIVERED',
        isNdr: true,
        eventId: req.body.event_id,
        attemptTime: req.body.attempt_time ? new Date(req.body.attempt_time) : undefined,
      })
    );

    app.post('/api/webhooks/shiprocket/ndr', carrierHandler);
    app.use('/webhooks/whatsapp', whatsappWebhookRouter);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // VECTOR 1: Cross-Tenant Redis Lock Collision (P0 Security / Data Isolation)
  // ═════════════════════════════════════════════════════════════════════════
  describe('VECTOR 1: Cross-Tenant Redis Lock Isolation', () => {
    it('1.1: should allow concurrent identical AWBs across different merchants without collision', async () => {
      const sharedAwb = 'AWB-RECYCLED-99999';

      // Both merchants receive a webhook for the exact same AWB at the exact same moment
      const reqMerchantA = request(app)
        .post('/api/webhooks/shiprocket/ndr?merchant_id=650000000000000000000001')
        .set('x-api-key', 'secret_alpha')
        .send({ awb: sharedAwb, order_id: 'ORD-A-1', reason: 'Unreachable' });

      const reqMerchantB = request(app)
        .post('/api/webhooks/shiprocket/ndr?merchant_id=650000000000000000000002')
        .set('x-api-key', 'secret_beta')
        .send({ awb: sharedAwb, order_id: 'ORD-B-1', reason: 'Customer absent' });

      const [resA, resB] = await Promise.all([reqMerchantA, reqMerchantB]);

      // Both merchants must succeed and queue their NDR without one blocking the other
      expect(resA.status).toBe(200);
      expect(resA.body.status).toBe('queued');

      expect(resB.status).toBe(200);
      expect(resB.body.status).toBe('queued');

      // Verify that lock keys were isolated per tenant
      expect(mockQueuedJobs.length).toBe(2);
      expect(mockQueuedJobs[0].data.merchantId).toBe('650000000000000000000001');
      expect(mockQueuedJobs[1].data.merchantId).toBe('650000000000000000000002');
    });

    it('1.2: should drop duplicate retry storm webhooks for the same merchant and AWB', async () => {
      const awb = 'AWB-STORM-SAME-TENANT';

      // Simulate active lock already held for this merchant + AWB
      const activeLockKey = `lock:ndr:650000000000000000000001:shiprocket:${awb}`;
      redisStore.set(activeLockKey, 'worker-token-active');

      const res = await request(app)
        .post('/api/webhooks/shiprocket/ndr?merchant_id=650000000000000000000001')
        .set('x-api-key', 'secret_alpha')
        .send({ awb, order_id: 'ORD-A-2' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ignored',
        reason: 'duplicate_lock_active',
        lockKey: activeLockKey,
      });
      // No job queued
      expect(mockQueuedJobs.length).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // VECTOR 2: Delayed Retry Idempotency Bypass (P0 Customer Experience)
  // ═════════════════════════════════════════════════════════════════════════
  describe('VECTOR 2: Delayed Retry Duplicate Scan Interception (MongoDB 11000)', () => {
    it('2.1: should catch MongoDB 11000 duplicate scan error and return HTTP 200 { status: "ignored", reason: "duplicate_scan" }', async () => {
      const awb = 'AWB-DELAYED-RETRY-45S';

      // Simulate carrier sending delayed retry 45s later: DeliveryAttempt.create throws E11000 duplicate key
      const mongo11000Error: any = new Error(
        'E11000 duplicate key error collection: rescueship.deliveryattempts index: idx_unique_carrier_scan dup key: { awb: "AWB-DELAYED-RETRY-45S", carrier: "shiprocket", carrierScanCode: "UNDELIVERED", scanTimestamp: new Date(1760000000000) }'
      );
      mongo11000Error.code = 11000;
      mongo11000Error.name = 'MongoServerError';

      (DeliveryAttempt.create as jest.Mock).mockRejectedValueOnce(mongo11000Error);

      const res = await request(app)
        .post('/api/webhooks/shiprocket/ndr?merchant_id=650000000000000000000001')
        .set('x-api-key', 'secret_alpha')
        .send({
          awb,
          order_id: 'ORD-DELAYED-1',
          reason: 'Customer not reachable',
          attempt_time: '2026-10-08T10:00:00.000Z',
        });

      // Must respond 200 duplicate_scan and prevent downstream dispatch
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ignored',
        reason: 'duplicate_scan',
      });

      // Crucial: No job must be placed on ndr-rescue queue!
      expect(mockQueuedJobs.length).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // VECTOR 3: Meta Cloud API Outbound Tier Throttling (P0 WABA Suspension Defense)
  // ═════════════════════════════════════════════════════════════════════════
  describe('VECTOR 3: Meta 24-Hour Outbound Tier Sliding Window Throttling', () => {
    it('3.1: should allow outbound dispatch when under merchant metaTierLimit and increment counter with 24h TTL', async () => {
      const merchantId = '650000000000000000000001';
      redisStore.set(`meta:24h:${merchantId}`, '450');

      const result = await whatsAppDispatcherService.dispatchNdrRescue({
        merchantId,
        orderId: '650000000000000000000099',
        phone: '9876543210',
        category: 'CUSTOMER_NOT_AVAILABLE',
        variables: { customer_name: 'Rahul', order_id: 'ORD-101' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.HBgLMTIzNDU2');

      // Counter should now be incremented to 451
      expect(redisStore.get(`meta:24h:${merchantId}`)).toBe('451');
    });

    it('3.2: should throttle and suppress dispatch when merchant exceeds 24-hour metaTierLimit (e.g. 1000/1000)', async () => {
      const merchantId = '650000000000000000000001'; // Limit is 1000
      redisStore.set(`meta:24h:${merchantId}`, '1000');

      const result = await whatsAppDispatcherService.dispatchNdrRescue({
        merchantId,
        orderId: '650000000000000000000099',
        phone: '9876543210',
        category: 'CUSTOMER_NOT_AVAILABLE',
        variables: { customer_name: 'Rahul', order_id: 'ORD-101' },
      });

      // Must be cleanly suppressed to prevent WABA suspension
      expect(result.success).toBe(false);
      expect(result.suppressed).toBe(true);
      expect(result.suppressReason).toContain('Meta 24h tier limit reached');

      // Counter must not be incremented
      expect(redisStore.get(`meta:24h:${merchantId}`)).toBe('1000');
    });

    it('3.3: should respect lower tier limit for Tier 0/1 merchants (e.g. 100 limit)', async () => {
      const merchantId = '650000000000000000000002'; // Limit is 100
      redisStore.set(`meta:24h:${merchantId}`, '100');

      const result = await whatsAppDispatcherService.dispatchNdrRescue({
        merchantId,
        orderId: '650000000000000000000099',
        phone: '9876543210',
        category: 'CUSTOMER_NOT_AVAILABLE',
        variables: { customer_name: 'Aarav', order_id: 'ORD-202' },
      });

      expect(result.success).toBe(false);
      expect(result.suppressed).toBe(true);
      expect(result.suppressReason).toBe('Meta 24h tier limit reached (100/100)');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // VECTOR 4: Graceful Shutdown on SIGTERM/SIGINT (P1 Infrastructure Stability)
  // ═════════════════════════════════════════════════════════════════════════
  describe('VECTOR 4: Graceful Shutdown Worker Draining', () => {
    it('4.1: should stopAllWorkers cleanly without throwing even when workers are undefined/null', async () => {
      await expect(stopAllWorkers()).resolves.not.toThrow();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // VECTOR 5: Meta Webhook Verify Token Handshake (P1 API Integration)
  // ═════════════════════════════════════════════════════════════════════════
  describe('VECTOR 5: Meta Webhook GET Verification Handshake', () => {
    it('5.1: should return HTTP 200 with challenge when mode=subscribe and token matches META_VERIFY_TOKEN', async () => {
      const challengeCode = '1158201444_random_challenge_hash';

      const res = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_meta_webhook_secret_xyz',
          'hub.challenge': challengeCode,
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe(challengeCode);
    });

    it('5.2: should return HTTP 403 when verify_token does not match', async () => {
      const res = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'invalid_secret_attack',
          'hub.challenge': '1158201444',
        });

      expect(res.status).toBe(403);
    });

    it('5.3: should return HTTP 403 when hub.mode is not "subscribe"', async () => {
      const res = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test_meta_webhook_secret_xyz',
          'hub.challenge': '1158201444',
        });

      expect(res.status).toBe(403);
    });

    it('5.4: should return HTTP 403 on missing parameters', async () => {
      const res = await request(app).get('/webhooks/whatsapp');
      expect(res.status).toBe(403);
    });
  });
});
