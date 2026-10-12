import { randomUUID } from 'crypto';
import { redisConnection } from '../config/redis';
import { logger } from './logger';

/**
 * Lua script for atomic distributed lock release.
 * Only deletes the key if the current value matches the token held by this caller.
 */
export const LUA_RELEASE_LOCK = `if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end`;

const activeLocks = new Map<string, string>();
const inMemoryLocks = new Map<string, number>();

/**
 * Acquire a distributed lock using Redis SET key value NX PX ttlMs with in-memory fallback.
 *
 * @param key The Redis lock key (e.g. lock:ndr:shiprocket:AWB12345)
 * @param ttlMs Time-to-live in milliseconds
 * @param customValue Optional unique value/token. If omitted, a random UUID is used.
 * @returns Promise<boolean> true if lock was acquired, false otherwise
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
  customValue?: string
): Promise<boolean> {
  const value = customValue || randomUUID();
  try {
    if (redisConnection.status === 'ready') {
      const result = await (redisConnection as any).set(key, value, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        activeLocks.set(key, value);
        return true;
      }
      return false;
    }
  } catch (err: any) {
    logger.warn(`[DISTRIBUTED LOCK] Redis error, falling back to memory lock for key ${key}`, { error: err?.message });
  }

  // Fallback to in-memory lock
  const now = Date.now();
  const existingExpiry = inMemoryLocks.get(key);
  if (existingExpiry && existingExpiry > now) {
    return false;
  }
  inMemoryLocks.set(key, now + ttlMs);
  activeLocks.set(key, value);
  return true;
}

/**
 * Release a distributed lock atomically via Lua script.
 * Ensures Worker A cannot accidentally release Worker B's lock.
 *
 * @param key The Redis lock key
 * @param value The unique value/token that acquired the lock
 * @returns Promise<void>
 */
export async function releaseLock(key: string, value?: string): Promise<void> {
  inMemoryLocks.delete(key);
  const token = value || activeLocks.get(key) || '';
  activeLocks.delete(key);

  if (!token) {
    return;
  }

  try {
    if (redisConnection.status === 'ready') {
      await (redisConnection as any).eval(
        LUA_RELEASE_LOCK,
        1,
        key,
        token
      );
    }
  } catch (err: any) {
    logger.warn(`[DISTRIBUTED LOCK] Failed to release lock for key ${key}`, { error: err?.message });
  }
}

/**
 * Helper to inspect active lock token in current process memory.
 */
export function getActiveLockToken(key: string): string | undefined {
  return activeLocks.get(key);
}
