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

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createLogger } from '../config/logger';

const logger = createLogger('rate-limiter');

/** IP (IPv6-normalised) + target email, so both per-IP spraying and per-account spraying are throttled. */
const ipPlusEmailKey = (req: any): string => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim().slice(0, 254) : '';
  return `${ipKeyGenerator(req.ip || '')}|${email}`;
};

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

/**
 * Strict rate limiter for payment gateway and carrier credential validation operations.
 * Limits attempts to 10 per 15 minutes per IP to prevent outbound gateway DoS.
 */
export const credentialValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many credential validation attempts. Please try again later.',
    retryAfterSeconds: 900,
  },
  handler: (req, res, next, options) => {
    logger.warn('Credential validation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
  skip: (_req) => {
    return process.env.NODE_ENV === 'test';
  },
});

/**
 * 🔒 SEC-03 FIX: Dedicated Brute-Force Protection for Login
 * Limits login attempts to 5 per 15 minutes per IP to prevent credential stuffing.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Per IP + target email pair
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipPlusEmailKey,
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.',
    retryAfterSeconds: 900,
  },
  handler: (req, res, next, options) => {
    logger.warn('Login brute-force rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
  skip: (_req) => {
    return process.env.NODE_ENV === 'test';
  },
  skipSuccessfulRequests: false,
});

/**
 * Limiter for forgot/reset password flows. Keyed on IP + email so that reset
 * tokens cannot be brute-forced and inboxes cannot be flooded.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipPlusEmailKey,
  message: {
    error: 'Too many password reset attempts. Please try again later.',
    retryAfterSeconds: 900,
  },
  handler: (req, res, next, options) => {
    logger.warn('Password reset rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json(options.message);
  },
  skip: (_req) => process.env.NODE_ENV === 'test',
});
