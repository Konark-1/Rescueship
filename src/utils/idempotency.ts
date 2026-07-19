import { redisConnection } from '../config/redis';
import { logger } from './logger';

export class IdempotencyGuard {
  private static readonly KEY_PREFIX = 'idempotency:';
  private static readonly DEFAULT_TTL_SECONDS = 86400; // 24 hours

  /**
   * Check if a key (e.g., webhook ID) has already been processed.
   * @param key The unique identifier to check.
   * @returns Promise<boolean> True if processed, false otherwise.
   */
  public static async isProcessed(key: string): Promise<boolean> {
    const fullKey = `${this.KEY_PREFIX}${key}`;
    try {
      const exists = await redisConnection.exists(fullKey);
      return exists === 1;
    } catch (err: any) {
      logger.error('Error checking idempotency in Redis', { key, error: err.message });
      // In case of Redis error, we default to false to allow processing (fail-open)
      // but log it prominently.
      return false;
    }
  }

  /**
   * Mark a key as processed with a TTL.
   * @param key The unique identifier.
   * @param ttlSeconds Time to live in seconds (default 24 hours).
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
