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

/**
 * Acquire a distributed lock using Redis SET key value NX PX ttlMs.
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
  if ((redisConnection as any).status && (redisConnection as any).status !== 'ready') {
    logger.error(`[DISTRIBUTED LOCK] Redis not ready while acquiring ${key}`, { status: (redisConnection as any).status });
    throw new LockUnavailableError();
  }
  try {
    const result = await (redisConnection as any).set(key, value, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      activeLocks.set(key, value);
      return true;
    }
    return false;
  } catch (err: any) {
    // Fail closed: a Redis outage must not look like "someone else holds the lock"
    // (callers would then drop the event with a 200). Callers return 503 so the
    // provider retries later.
    logger.error(`[DISTRIBUTED LOCK] Redis unavailable while acquiring ${key}`, { error: err?.message });
    throw new LockUnavailableError();
  }
}

export class LockUnavailableError extends Error {
  constructor(message = 'Distributed lock store unavailable') {
    super(message);
    this.name = 'LockUnavailableError';
  }
}

/**
 * Acquire with a short wait: a different event for the same key (e.g. an
 * out-for-delivery scan followed by a failed-delivery scan) waits for the first
 * one instead of being dropped as a "duplicate".
 */
export async function acquireLockWithWait(key: string, ttlMs: number, value: string, attempts = 6, delayMs = 400): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await acquireLock(key, ttlMs, value)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
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
  const token = value || activeLocks.get(key) || '';
  activeLocks.delete(key);

  if (!token) {
    return;
  }

  try {
    await (redisConnection as any).eval(
      LUA_RELEASE_LOCK,
      1,
      key,
      token
    );
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
