import { redisConnection } from '../config/redis';
import { logger } from './logger';

/**
 * Thrown when Redis cannot answer an idempotency question. Callers MUST NOT
 * acknowledge the inbound event (return 5xx) so the provider retries later.
 * Acknowledging with 200 during an outage silently drops the event forever.
 */
export class IdempotencyUnavailableError extends Error {
  constructor(message = 'Idempotency store unavailable') {
    super(message);
    this.name = 'IdempotencyUnavailableError';
  }
}

export type ClaimResult = 'claimed' | 'duplicate';

export class IdempotencyGuard {
  private static readonly KEY_PREFIX = 'idempotency:';
  private static readonly DEFAULT_TTL_SECONDS = 86400; // 24 hours

  /**
   * Build a namespaced key. Every inbound webhook key MUST be scoped by the
   * provider and the tenant it was authenticated for, so one tenant cannot
   * pre-seed keys that suppress another tenant's events.
   */
  public static key(provider: string, scope: string, eventId: string): string {
    return `${provider}:${scope}:${eventId}`;
  }

  /**
   * Atomically claim a key (SET NX). Returns 'claimed' exactly once per key
   * within the TTL; every concurrent/subsequent caller receives 'duplicate'.
   * Throws IdempotencyUnavailableError if Redis is unreachable.
   */
  public static async claim(key: string, ttlSeconds: number = this.DEFAULT_TTL_SECONDS): Promise<ClaimResult> {
    const fullKey = `${this.KEY_PREFIX}${key}`;
    try {
      const result = await redisConnection.set(fullKey, 'processing', 'EX', ttlSeconds, 'NX');
      return result === 'OK' ? 'claimed' : 'duplicate';
    } catch (err: any) {
      logger.error('CRITICAL: Redis idempotency claim failed', { key, error: err.message });
      throw new IdempotencyUnavailableError();
    }
  }

  /**
   * Release a claim when processing failed BEFORE any side effect happened,
   * so the provider's retry can be processed. Only call this if nothing was
   * queued/persisted; otherwise leave the claim in place.
   */
  public static async release(key: string): Promise<void> {
    const fullKey = `${this.KEY_PREFIX}${key}`;
    try {
      await redisConnection.del(fullKey);
    } catch (err: any) {
      logger.error('Error releasing idempotency claim in Redis', { key, error: err.message });
    }
  }

  /**
   * Check if a key has already been processed.
   * @deprecated Prefer claim() — check-then-set is racy. Kept for read-only callers.
   * Throws IdempotencyUnavailableError if Redis is unreachable.
   */
  public static async isProcessed(key: string): Promise<boolean> {
    const fullKey = `${this.KEY_PREFIX}${key}`;
    try {
      const exists = await redisConnection.exists(fullKey);
      return exists === 1;
    } catch (err: any) {
      logger.error('CRITICAL: Redis idempotency check failed', { key, error: err.message });
      throw new IdempotencyUnavailableError();
    }
  }

  /**
   * Mark a key as processed with a TTL (upgrades a 'processing' claim to 'processed').
   */
  public static async markProcessed(key: string, ttlSeconds: number = this.DEFAULT_TTL_SECONDS): Promise<void> {
    const fullKey = `${this.KEY_PREFIX}${key}`;
    try {
      await redisConnection.set(fullKey, 'processed', 'EX', ttlSeconds);
    } catch (err: any) {
      logger.error('Error marking idempotency in Redis', { key, error: err.message });
    }
  }
}
