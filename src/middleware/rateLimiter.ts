/**
 * @fileoverview Rate Limiting Middleware
 *
 * Configures and exports Express rate limiters for different route groups:
 *   - `webhookLimiter` — High-throughput limit for incoming webhook endpoints (1000/min per IP)
 *   - `apiLimiter` — Standard limit for dashboard API endpoints (100/min per IP)
 *
 * Usage:
 *   import { webhookLimiter, apiLimiter } from '../middleware/rateLimiter';
 *   app.use('/webhooks', webhookLimiter);
 *   app.use('/api', apiLimiter);
 */

import rateLimit from 'express-rate-limit';
import { createLogger } from '../config/logger';

const logger = createLogger('rate-limiter');

/**
 * Rate limiter for webhook endpoints.
 * Webhooks arrive in bursts (e.g., Shopify can send many order events at once),
 * so we allow a high limit: 1000 requests per minute per IP.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many webhook requests from this IP. Please try again later.',
    retryAfterSeconds: 60,
  },
  handler: (req, res, next, options) => {
    logger.warn('Webhook rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
  skip: (_req) => {
    // In test environments, skip rate limiting
    return process.env.NODE_ENV === 'test';
  },
});

/**
 * Rate limiter for dashboard API endpoints.
 * Standard limit: 100 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many API requests from this IP. Please try again later.',
    retryAfterSeconds: 60,
  },
  handler: (req, res, next, options) => {
    logger.warn('API rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
  skip: (_req) => {
    return process.env.NODE_ENV === 'test';
  },
});
