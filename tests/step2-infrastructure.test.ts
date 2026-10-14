process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import axiosLib, { AxiosError } from 'axios';
import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import { CarrierRateLimitError } from '../src/utils/errors.util';
import { setupCarrierAxiosInterceptor } from '../src/services/carrier-connect.service';
import { acquireLock, releaseLock, LUA_RELEASE_LOCK } from '../src/utils/distributed-lock.util';
import { createCarrierNdrHandler } from '../src/webhooks/carrier-ndr.handler';
import { redisConnection } from '../src/config/redis';
import { logisticsService } from '../src/services/logistics.service';
import { logger } from '../src/utils/logger';

// ─── MOCKS ───
jest.mock('../src/config/redis', () => {
  const store = new Map<string, string>();
  return {
    redisConnection: {
      get: jest.fn(async (key: string) => store.get(key) || null),
      set: jest.fn(async (key: string, val: string, pxFlag?: string, ttl?: number, nxFlag?: string) => {
        // Handle SET key value PX ttl NX or SET key value NX PX ttl
        if (store.has(key)) {
          return null; // Key already exists (NX failure)
        }
        store.set(key, val);
        return 'OK';
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
    },
  };
});

jest.mock('../src/utils/idempotency', () => ({
  IdempotencyGuard: {
    key: jest.fn().mockReturnValue('mock_idem_key'),
    claim: jest.fn().mockResolvedValue('acquired'),
    markProcessed: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  },
  IdempotencyUnavailableError: class extends Error {},
}));

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'dlq_job_123' }),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      run: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
    })),
  };
});

jest.mock('../src/models', () => {
  const mockMerchant = {
    _id: new Types.ObjectId('650000000000000000000001'),
    name: 'Test Merchant',
    tier: 'scale',
    apiKeys: ['test-platform-secret'],
    carrierConfig: {},
  };

  return {
    Merchant: {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMerchant),
        }),
      }),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMerchant),
        }),
      }),
    },
    Order: {
      findOne: jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          _id: new Types.ObjectId(),
          merchantId: mockMerchant._id,
          awb: 'AWB-RETRY-STORM-001',
          externalOrderId: 'ORD-STORM-1',
          status: 'in_transit',
        };
      }),
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
    RescueLedger: {
      reconcileOutcomes: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../src/services/logistics.service', () => ({
  logisticsService: {
    rescheduleDelivery: jest.fn(),
    updateDeliveryAddress: jest.fn(),
    cancelDelivery: jest.fn(),
    adjustCodAmount: jest.fn(),
  },
}));

describe('🛡️ STEP 2: INFRASTRUCTURE RESILIENCE & QUEUE MANAGEMENT', () => {
  const store = (redisConnection as any)._store as Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TASK 2.1: BullMQ Dead Letter Queues (DLQ) for HTTP 429 Rate Limits
  // ═════════════════════════════════════════════════════════════════════════
  describe('TASK 2.1: CarrierRateLimitError & Axios 429 Interceptor', () => {
    it('2.1.1: should instantiate CarrierRateLimitError with status 429 and expected name', () => {
      const err = new CarrierRateLimitError('Custom 429 Throttled');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CarrierRateLimitError);
      expect(err.name).toBe('CarrierRateLimitError');
      expect(err.statusCode).toBe(429);
      expect(err.message).toBe('Custom 429 Throttled');
    });

    it('2.1.2: should intercept HTTP 429 responses in Axios and throw CarrierRateLimitError', async () => {
      const testAxiosInstance = axiosLib.create();
      setupCarrierAxiosInterceptor(testAxiosInstance);

      // Simulate a 429 response from carrier API
      const error429 = {
        isAxiosError: true,
        response: {
          status: 429,
          data: { message: 'Carrier Too Many Requests' },
        },
      } as AxiosError;

      // Invoking the rejection interceptor
      const interceptor = (testAxiosInstance.interceptors.response as any).handlers[0];
      expect(interceptor).toBeDefined();

      expect(() => {
        interceptor.rejected(error429);
      }).toThrow(CarrierRateLimitError);

      try {
        interceptor.rejected(error429);
      } catch (err: any) {
        expect(err.name).toBe('CarrierRateLimitError');
        expect(err.statusCode).toBe(429);
        expect(err.message).toBe('Carrier Too Many Requests');
      }
    });

    it('2.1.3: should not throw CarrierRateLimitError on non-429 errors (e.g. HTTP 500 or 401)', async () => {
      const testAxiosInstance = axiosLib.create();
      setupCarrierAxiosInterceptor(testAxiosInstance);

      const error500 = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Carrier Internal Server Error' },
        },
      } as AxiosError;

      const interceptor = (testAxiosInstance.interceptors.response as any).handlers[0];

      await expect(interceptor.rejected(error500)).rejects.toEqual(error500);
    });

  });

  // ═════════════════════════════════════════════════════════════════════════
  // TASK 2.2: Redis SET NX Concurrency Locks & Retry Storm Defense
  // ═════════════════════════════════════════════════════════════════════════
  describe('TASK 2.2: Redis SET NX Concurrency Locks & Lua Safe Release', () => {
    it('2.2.1: should acquire lock when key does not exist and deny when key is locked', async () => {
      const lockKey = 'lock:ndr:shiprocket:987654321';
      const token1 = 'worker-uuid-1';
      const token2 = 'worker-uuid-2';

      // First attempt succeeds
      const acquired1 = await acquireLock(lockKey, 10000, token1);
      expect(acquired1).toBe(true);
      expect(store.get(lockKey)).toBe(token1);

      // Second attempt for the same key while locked fails
      const acquired2 = await acquireLock(lockKey, 10000, token2);
      expect(acquired2).toBe(false);
      expect(store.get(lockKey)).toBe(token1); // Still held by worker 1
    });

    it('2.2.2: should atomically release lock using Lua script only if token matches', async () => {
      const lockKey = 'lock:ndr:shiprocket:987654321';
      const token1 = 'worker-uuid-1';
      const token2 = 'worker-uuid-2';

      await acquireLock(lockKey, 10000, token1);
      expect(store.get(lockKey)).toBe(token1);

      // Verify Lua script definition matches required atomicity contract
      expect(LUA_RELEASE_LOCK).toContain('redis.call("get", KEYS[1]) == ARGV[1]');
      expect(LUA_RELEASE_LOCK).toContain('redis.call("del", KEYS[1])');

      // Worker 2 attempts to release Worker 1's lock with wrong token -> fails, lock stays
      await releaseLock(lockKey, token2);
      expect(store.get(lockKey)).toBe(token1);

      // Worker 1 releases with matching token -> succeeds, lock is deleted
      await releaseLock(lockKey, token1);
      expect(store.has(lockKey)).toBe(false);
    });

    it('2.2.3: Retry Storm Protection: 5 concurrent identical webhooks -> serialized by the lock, 1 processed, 4 deduped with HTTP 200', async () => {
      // Requests wait for the lock instead of being dropped; once the first finishes, the
      // idempotency claim marks the rest as duplicates (same event id).
      const { IdempotencyGuard } = require('../src/utils/idempotency');
      (IdempotencyGuard.claim as jest.Mock).mockReset();
      (IdempotencyGuard.claim as jest.Mock).mockResolvedValueOnce('acquired').mockResolvedValue('duplicate');
      const app = express();
      app.use(express.json());

      const handler = createCarrierNdrHandler(
        'shiprocket',
        () => 'test-platform-secret',
        (req) => ({
          awb: req.body.awb,
          externalOrderId: req.body.order_id,
          reason: req.body.reason || 'Customer Refused',
          status: 'UNDELIVERED',
          isNdr: true,
          eventId: req.body.event_id,
        })
      );

      app.post('/api/webhooks/shiprocket/ndr', handler);

      // Prepare 5 identical concurrent webhook requests for the same AWB
      const webhookPayload = {
        awb: 'AWB-RETRY-STORM-001',
        order_id: 'ORD-STORM-1',
        reason: 'Customer unreachable',
        event_id: 'EVT-STORM-001',
      };

      const sendWebhook = () =>
        request(app)
          .post('/api/webhooks/shiprocket/ndr?merchant_id=650000000000000000000001')
          .set('x-api-key', 'test-platform-secret')
          .send(webhookPayload);

      // Fire 5 identical webhooks simultaneously (Retry Storm)
      const results = await Promise.all([
        sendWebhook(),
        sendWebhook(),
        sendWebhook(),
        sendWebhook(),
        sendWebhook(),
      ]);

      // All 5 must return HTTP 200 so carriers don't spam retries
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // Exactly 1 request acquires lock (returns queued or success)
      const accepted = results.filter((r) => r.body.status === 'queued' || r.body.status === 'success');
      // The other 4 were serialized behind the lock and then recognised as duplicates.
      const dropped = results.filter((r) => r.body.status === 'ignored' && r.body.reason === 'duplicate');

      expect(accepted.length).toBe(1);
      expect(dropped.length).toBe(4);
      (IdempotencyGuard.claim as jest.Mock).mockReset();
      (IdempotencyGuard.claim as jest.Mock).mockResolvedValue('acquired');

      // Confirm lock was released in finally block after the 1st completed
      expect(store.has('lock:ndr:650000000000000000000001:shiprocket:AWB-RETRY-STORM-001')).toBe(false);
    });
  });
});
