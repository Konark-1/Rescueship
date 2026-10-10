process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import { IdempotencyGuard } from '../src/utils/idempotency';
import { orderStateMachineService } from '../src/services/state-machine/order-state-machine.service';
import { redisConnection } from '../src/config/redis';

jest.mock('../src/config/redis', () => {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    redisConnection: {
      status: 'ready',
      set: jest.fn(async (key: string, value: string, mode?: string, duration?: number, flag?: string) => {
        const now = Date.now();
        if (flag === 'NX') {
          const existing = store.get(key);
          if (existing && existing.expiresAt > now) {
            return null; // Key already exists (SET NX fails)
          }
        }
        const ttl = (duration || 86400) * 1000;
        store.set(key, { value, expiresAt: now + ttl });
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
      exists: jest.fn(async (key: string) => {
        const existing = store.get(key);
        if (existing && existing.expiresAt > Date.now()) return 1;
        return 0;
      }),
      _clearStore: () => store.clear(),
    },
  };
});

describe('Concurrency & Race Condition Hardening', () => {
  beforeEach(() => {
    (redisConnection as any)._clearStore();
    jest.clearAllMocks();
  });

  describe('Atomic Idempotency Claim under High Concurrency', () => {
    it('guarantees that exactly 1 out of 10 concurrent requests claims the lock', async () => {
      const key = IdempotencyGuard.key('shopify', 'merchant_concurrency_test', 'evt_100_burst');

      // Fire 10 simultaneous claims concurrently
      const promises = Array.from({ length: 10 }, () => IdempotencyGuard.claim(key, 60));
      const results = await Promise.all(promises);

      const claimedCount = results.filter((r) => r === 'claimed').length;
      const duplicateCount = results.filter((r) => r === 'duplicate').length;

      expect(claimedCount).toBe(1);
      expect(duplicateCount).toBe(9);
    });

    it('guarantees that subsequent claims after successful processing remain duplicates', async () => {
      const key = IdempotencyGuard.key('carrier', 'delhivery', 'dlv_ndr_repeat_event');

      const firstClaim = await IdempotencyGuard.claim(key, 60);
      expect(firstClaim).toBe('claimed');

      await IdempotencyGuard.markProcessed(key, 60);

      // 5 concurrent subsequent webhook retries from carrier
      const subsequentRetries = await Promise.all(
        Array.from({ length: 5 }, () => IdempotencyGuard.claim(key, 60))
      );

      for (const res of subsequentRetries) {
        expect(res).toBe('duplicate');
      }
    });

    it('allows retry after releasing claim on pre-effect failure', async () => {
      const key = IdempotencyGuard.key('payment', 'razorpay', 'pay_link_failure_retry');

      const firstClaim = await IdempotencyGuard.claim(key, 60);
      expect(firstClaim).toBe('claimed');

      // Failure occurs before persistent effect, release lock
      await IdempotencyGuard.release(key);

      // Retried webhook from payment gateway can now be claimed successfully
      const retryClaim = await IdempotencyGuard.claim(key, 60);
      expect(retryClaim).toBe('claimed');
    });
  });

  describe('State Machine Terminal State Protection under Race Conditions', () => {
    it('strictly forbids transitions once an order reaches a terminal state', () => {
      const terminalStates = ['delivered', 'returned', 'cancelled', 'lost'];
      const incomingTriggers = ['ndr_detected', 'ndr_rescue_sent', 'out_for_delivery', 'shipped', 'cancelled'];

      for (const terminal of terminalStates) {
        expect(orderStateMachineService.isTerminal(terminal)).toBe(true);

        for (const trigger of incomingTriggers) {
          const allowed = orderStateMachineService.canTransition(terminal, trigger);
          expect(allowed).toBe(false);
        }
      }
    });

    it('rejects stale out-of-order events from concurrent delivery webhooks', () => {
      const lastEventTimestamp = new Date('2026-09-30T10:00:00Z');
      const olderEventTimestamp = new Date('2026-09-30T09:59:59Z');
      const newerEventTimestamp = new Date('2026-09-30T10:00:01Z');

      expect(orderStateMachineService.isStaleEvent(lastEventTimestamp, olderEventTimestamp)).toBe(true);
      expect(orderStateMachineService.isStaleEvent(lastEventTimestamp, newerEventTimestamp)).toBe(false);
    });

    it('allows valid recovery transitions from non-terminal states', () => {
      expect(orderStateMachineService.canTransition('shipped', 'ndr_detected')).toBe(true);
      expect(orderStateMachineService.canTransition('ndr_detected', 'ndr_rescue_sent')).toBe(true);
      expect(orderStateMachineService.canTransition('ndr_rescue_sent', 'ndr_rescued')).toBe(true);
      expect(orderStateMachineService.canTransition('ndr_rescued', 'delivered')).toBe(true);
    });
  });
});
