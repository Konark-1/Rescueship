import { redisConnection } from '../config/redis';
import { logger } from './logger';

/**
 * Best-effort Redis for caches and soft dedupe. The shared ioredis client queues commands
 * while disconnected (maxRetriesPerRequest: null, needed by BullMQ), so a plain `await
 * redisConnection.get()` hangs for as long as Redis is down. Here a call returns null
 * immediately when the client is not ready, and gives up after a short timeout otherwise.
 *
 * Do NOT use this for idempotency claims or locks: those must fail closed (see utils/idempotency).
 */
const TIMEOUT_MS = 1500;

function usable(): boolean {
  const c: any = redisConnection;
  if (!c) return false;
  return c.status === undefined || c.status === 'ready';
}

async function withTimeout<T>(p: Promise<T>): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), TIMEOUT_MS); });
  try {
    return await Promise.race([p, timeout]);
  } catch (err: any) {
    logger.debug('redis-cache command failed', { error: err?.message });
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const redisCache = {
  async get(key: string): Promise<string | null> {
    if (!usable() || typeof (redisConnection as any).get !== 'function') return null;
    return withTimeout((redisConnection as any).get(key));
  },
  /** Same arguments as ioredis `set` (e.g. 'EX', ttl, 'NX'). Returns 'OK', null on NX miss or when unavailable. */
  async set(key: string, value: string, ...args: any[]): Promise<string | null> {
    if (!usable() || typeof (redisConnection as any).set !== 'function') return null;
    return withTimeout((redisConnection as any).set(key, value, ...args));
  },
};
