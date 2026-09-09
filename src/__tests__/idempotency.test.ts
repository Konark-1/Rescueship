import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { redisConnection } from '../config/redis';

jest.mock('../config/redis', () => ({
  redisConnection: { set: jest.fn(), del: jest.fn(), exists: jest.fn() },
}));

const redis = redisConnection as unknown as { set: jest.Mock; del: jest.Mock; exists: jest.Mock };

describe('IdempotencyGuard (atomic claim)', () => {
  it('claims with SET NX and a TTL — exactly one winner', async () => {
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const key = IdempotencyGuard.key('shopify', 'm1', 'evt-1');

    await expect(IdempotencyGuard.claim(key)).resolves.toBe('claimed');
    await expect(IdempotencyGuard.claim(key)).resolves.toBe('duplicate');

    expect(redis.set).toHaveBeenCalledWith('idempotency:shopify:m1:evt-1', 'processing', 'EX', 86400, 'NX');
  });

  it('namespaces keys by provider and tenant so one tenant cannot pre-seed another', () => {
    expect(IdempotencyGuard.key('woocommerce', 'A', '7')).not.toBe(IdempotencyGuard.key('woocommerce', 'B', '7'));
    expect(IdempotencyGuard.key('shopify', 'A', '7')).not.toBe(IdempotencyGuard.key('woocommerce', 'A', '7'));
  });

  it('throws IdempotencyUnavailableError when Redis is down (callers must NOT ack with 200)', async () => {
    redis.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(IdempotencyGuard.claim('x')).rejects.toBeInstanceOf(IdempotencyUnavailableError);

    redis.exists.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(IdempotencyGuard.isProcessed('x')).rejects.toBeInstanceOf(IdempotencyUnavailableError);
  });

  it('release deletes the claim so a provider retry can be processed', async () => {
    redis.del.mockResolvedValueOnce(1);
    await IdempotencyGuard.release('k');
    expect(redis.del).toHaveBeenCalledWith('idempotency:k');
  });
});
