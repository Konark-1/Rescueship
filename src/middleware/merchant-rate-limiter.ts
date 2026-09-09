/**
 * merchant-rate-limiter.ts
 * ─────────────────────────────────────────────────────────────
 * Per-merchant API rate limiting using Redis sliding window.
 * Prevents a single merchant from exhausting global API capacity.
 *
 * Limits:
 *   - Standard API: 100 req/min per merchant
 *   - Export API: 5 req/min per merchant
 *   - Webhook ingestion: 500 req/min per merchant
 */

import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'rl:merchant',
};

const EXPORT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'rl:export',
};

const WEBHOOK_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 500,
  keyPrefix: 'rl:webhook',
};

/**
 * Atomic sliding-window limiter (single Lua round-trip, no check-then-set race).
 * KEYS[1]=zset key, ARGV[1]=now ms, ARGV[2]=window ms, ARGV[3]=max, ARGV[4]=member
 * Returns [allowed(0|1), count_after, oldest_score_or_-1]
 */
const SLIDING_WINDOW_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, tonumber(ARGV[1]) - tonumber(ARGV[2]))
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, count, oldest[2] and tonumber(oldest[2]) or -1}
end
redis.call('ZADD', KEYS[1], tonumber(ARGV[1]), ARGV[4])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]) + 1000)
return {1, count + 1, -1}
`;

/**
 * Bounded in-process fallback used ONLY when Redis is unreachable. Keeps the API
 * usable for legitimate merchants while still capping abuse per instance instead of
 * failing open entirely.
 */
const localFallback = new Map<string, { count: number; resetAt: number }>();
function localCheck(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let e = localFallback.get(key);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + config.windowMs };
    localFallback.set(key, e);
  }
  if (localFallback.size > 10000) localFallback.clear(); // memory guard
  e.count++;
  return { allowed: e.count <= config.maxRequests, remaining: Math.max(0, config.maxRequests - e.count), resetMs: e.resetAt - now };
}

async function checkRateLimit(
  merchantId: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const key = `${config.keyPrefix}:${merchantId}`;
  const now = Date.now();
  try {
    const member = `${now}:${Math.random().toString(36).slice(2)}`;
    const [allowed, count, oldest] = (await redisConnection.eval(
      SLIDING_WINDOW_LUA, 1, key, String(now), String(config.windowMs), String(config.maxRequests), member
    )) as [number, number, number];

    if (allowed !== 1) {
      const resetMs = oldest > 0 ? Math.max(1, oldest + config.windowMs - now) : config.windowMs;
      return { allowed: false, remaining: 0, resetMs };
    }
    return { allowed: true, remaining: Math.max(0, config.maxRequests - count), resetMs: config.windowMs };
  } catch (err: any) {
    // Redis unavailable: degrade to a per-instance limiter (never fully fail open).
    logger.warn('Rate limiter Redis unavailable, using bounded local fallback', { error: err.message });
    return localCheck(key, config);
  }
}

/**
 * Express middleware factory for per-merchant rate limiting.
 */
export function merchantRateLimiter(config: RateLimitConfig = DEFAULT_CONFIG) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Extract merchantId from JWT (set by authenticateToken middleware)
    const merchantId = (req as any).merchant?.merchantId;

    if (!merchantId) {
      // No merchant context (public routes) — skip per-merchant limiting
      next();
      return;
    }

    const result = await checkRateLimit(merchantId, config);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000));

    if (!result.allowed) {
      logger.warn('Per-merchant rate limit exceeded', {
        merchantId,
        prefix: config.keyPrefix,
        limit: config.maxRequests,
      });

      res.status(429).json({
        error: 'Rate limit exceeded for your account',
        retryAfterSeconds: Math.ceil(result.resetMs / 1000),
        limit: config.maxRequests,
        window: `${config.windowMs / 1000}s`,
      });
      return;
    }

    next();
  };
}

// Pre-configured middleware instances
export const standardMerchantLimiter = merchantRateLimiter(DEFAULT_CONFIG);
export const exportMerchantLimiter = merchantRateLimiter(EXPORT_CONFIG);
export const webhookMerchantLimiter = merchantRateLimiter(WEBHOOK_CONFIG);
