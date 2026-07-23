/**
 * @fileoverview Redis connection manager for RescueShip.
 *
 * Creates and exports a shared `ioredis` instance (`redisConnection`) that is
 * reused across the application — including by BullMQ workers and queues.
 *
 * Call `connectRedis()` at boot to validate the connection and attach event
 * listeners. The instance handles automatic reconnection via ioredis defaults.
 *
 * Usage:
 * ```ts
 * import { redisConnection, connectRedis } from '@config/redis';
 * await connectRedis();
 *
 * // Pass to BullMQ
 * const queue = new Queue('myQueue', { connection: redisConnection });
 * ```
 */

import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';
import { logger } from '../utils/logger';

/* ------------------------------------------------------------------ */
/*  Build Redis options                                                */
/* ------------------------------------------------------------------ */

const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required by BullMQ — never give up on a request
  enableReadyCheck: true,
  retryStrategy(times: number): number | null {
    if (times > 20) {
      logger.error(`Redis: exceeded 20 reconnection attempts — giving up`);
      return null; // stop reconnecting
    }
    // exponential back-off capped at 10 s
    const delay = Math.min(times * 500, 10_000);
    logger.warn(`Redis: reconnection attempt ${times} in ${delay}ms`);
    return delay;
  },
  reconnectOnError(err: Error): boolean | 1 | 2 {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
    if (targetErrors.some((e) => err.message.includes(e))) {
      return 2; // reconnect and retry the failed command
    }
    return false;
  },
  lazyConnect: true, // don't connect until we explicitly call `.connect()`
};

/* ------------------------------------------------------------------ */
/*  Shared Redis instance                                              */
/* ------------------------------------------------------------------ */

/**
 * Shared ioredis instance.
 *
 * Use this everywhere a Redis / BullMQ connection is needed so we maintain
 * a single connection pool.
 */
export const redisConnection: Redis = new Redis(redisOptions);

/* ------------------------------------------------------------------ */
/*  Event listeners                                                    */
/* ------------------------------------------------------------------ */

redisConnection.on('connect', () => {
  logger.info('🔌  Redis: TCP connection established');
});

redisConnection.on('ready', () => {
  logger.info('✅  Redis: ready to accept commands');
});

redisConnection.on('close', () => {
  logger.warn('⚠️  Redis: connection closed');
});

redisConnection.on('error', (err: Error) => {
  // ioredis emits 'error' for every failed connection attempt while retrying.
  // We log at warn level to avoid flooding error-tracking services.
  logger.warn('❌  Redis connection error', { error: err.message });
});

redisConnection.on('reconnecting', () => {
  logger.info('🔄  Redis: reconnecting…');
});

redisConnection.on('end', () => {
  logger.warn('🛑  Redis: connection ended (no more reconnections)');
});

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Explicitly connects to Redis and verifies the connection with a PING.
 *
 * Call this once during application bootstrap. If the connection fails the
 * error is logged but **not** re-thrown — the retry strategy will keep
 * attempting in the background.
 *
 * @example
 * ```ts
 * await connectRedis();
 * ```
 */
export async function connectRedis(): Promise<void> {
  try {
    logger.info('🔌  Connecting to Redis…', {
      host: config.redis.host,
      port: config.redis.port,
    });

    if (redisConnection.status === 'wait' || redisConnection.status === 'end') {
      await redisConnection.connect();
    }

    // Verify with a PING
    const pong = await redisConnection.ping();
    if (pong === 'PONG') {
      logger.info('✅  Redis PING successful');
    }
  } catch (err) {
    logger.error('Failed to connect to Redis', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't throw — ioredis retry strategy will keep trying in the background
  }
}

/**
 * Gracefully disconnects from Redis.
 *
 * Useful in tests or during a manual shutdown flow.
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redisConnection.quit();
    logger.info('🛑  Redis disconnected gracefully');
  } catch (err) {
    logger.error('Error disconnecting Redis', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Force-close if quit fails
    redisConnection.disconnect();
  }
}
