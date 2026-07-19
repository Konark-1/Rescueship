/**
 * @fileoverview JWT Authentication Middleware
 *
 * Provides Express middleware for protecting dashboard API routes with JWT
 * bearer-token authentication. Also exports a helper to generate tokens.
 *
 * Usage:
 *   import { authenticateToken, generateToken } from '../middleware/auth';
 *
 *   // Protect a route
 *   router.get('/protected', authenticateToken, handler);
 *
 *   // Generate a token on login
 *   const token = generateToken(merchant._id.toString());
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../config/logger';

const logger = createLogger('auth-middleware');

/** Decoded JWT payload attached to req.merchant after successful verification. */
export interface MerchantTokenPayload {
  merchantId: string;
  iat?: number;
  exp?: number;
}

/** Extended Express Request with decoded merchant data. */
export interface AuthenticatedRequest extends Request {
  merchant?: MerchantTokenPayload;
}

/**
 * Returns the JWT secret from environment variables.
 * Throws at startup if not configured.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Cannot authenticate requests.');
  }
  return secret;
}

/**
 * Express middleware that authenticates requests using a JWT bearer token.
 *
 * Expects the token in the `Authorization` header in the format:
 *   Authorization: Bearer <token>
 *
 * On success, attaches `req.merchant` with the decoded token payload.
 * On failure, responds with 401 (missing/invalid token) or 403 (expired/tampered).
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Authentication failed: no Authorization header', {
        ip: req.ip,
        path: req.path,
      });
      res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn('Authentication failed: malformed Authorization header', {
        ip: req.ip,
        path: req.path,
      });
      res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
      return;
    }

    const token = parts[1];
    const secret = getJwtSecret();

    const decoded = jwt.verify(token, secret) as MerchantTokenPayload;

    if (!decoded.merchantId) {
      logger.warn('Authentication failed: token payload missing merchantId', {
        ip: req.ip,
      });
      res.status(403).json({ error: 'Invalid token payload' });
      return;
    }

    req.merchant = decoded;

    logger.debug('Authentication successful', {
      merchantId: decoded.merchantId,
      path: req.path,
    });

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Authentication failed: token expired', { ip: req.ip });
      res.status(403).json({ error: 'Token has expired. Please log in again.' });
      return;
    }

    if (err.name === 'JsonWebTokenError') {
      logger.warn('Authentication failed: invalid token', {
        ip: req.ip,
        message: err.message,
      });
      res.status(403).json({ error: 'Invalid token. Please log in again.' });
      return;
    }

    logger.error('Unexpected error during authentication', { error: err });
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Generates a signed JWT token for a given merchant ID.
 *
 * @param merchantId - The Mongoose ObjectId string of the merchant
 * @returns Signed JWT string
 */
export function generateToken(merchantId: string): string {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const payload: MerchantTokenPayload = { merchantId };

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}
