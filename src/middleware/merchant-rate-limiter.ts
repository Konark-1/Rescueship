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
 * Sliding window rate limiter using Redis ZSET.
 */
async function checkRateLimit(
  merchantId: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  try {
    const key = `${config.keyPrefix}:${merchantId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Remove expired entries
    await redisConnection.zremrangebyscore(key, 0, windowStart);

    // Count current window
    const count = await redisConnection.zcard(key);

    if (count >= config.maxRequests) {
      const oldestEntry = await redisConnection.zrange(key, 0, 0, 'WITHSCORES');
      const resetMs = oldestEntry && oldestEntry.length > 1
        ? parseFloat(oldestEntry[1]) + config.windowMs - now
        : config.windowMs;

      return { allowed: false, remaining: 0, resetMs };
    }

    // Add current request
    await redisConnection.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
    await redisConnection.expire(key, Math.ceil(config.windowMs / 1000) + 1);

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      resetMs: config.windowMs,
    };
  } catch (err: any) {
    // Fail open: if Redis is down, allow the request
    logger.warn('Rate limiter Redis unavailable, allowing request', { error: err.message });
    return { allowed: true, remaining: config.maxRequests, resetMs: config.windowMs };
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
