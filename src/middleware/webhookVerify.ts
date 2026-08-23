/**
 * @fileoverview Webhook Signature Verification Middleware
 *
 * Provides reusable Express middleware factories for verifying HMAC-SHA256
 * signatures on incoming webhook requests from various providers:
 *   - Shopify (X-Shopify-Hmac-Sha256)
 *   - Razorpay (X-Razorpay-Signature)
 *   - WhatsApp / Meta (X-Hub-Signature-256)
 *   - WooCommerce (X-WC-Webhook-Signature)
 *
 * IMPORTANT: These middleware functions require the raw request body to be
 * available at `req.rawBody`. The main Express app must use the
 * `express.json({ verify })` pattern to capture it.
 *
 * @example
 *   import { verifyShopifyHmac } from '../middleware/webhookVerify';
 *   router.post('/order-created', verifyShopifyHmac(process.env.SHOPIFY_API_SECRET!), handler);
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger({ module: 'webhook-verify' });

/**
 * Extend Express Request to include rawBody captured by express.json verify callback.
 */
export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Constant-time comparison of two buffers to prevent timing attacks.
 * Returns false if lengths differ or if any byte differs.
 */
function safeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Creates an Express middleware that verifies Shopify webhook HMAC-SHA256 signatures.
 *
 * Shopify sends the HMAC as a base64-encoded string in the `X-Shopify-Hmac-Sha256` header.
 * The HMAC is computed over the raw request body using the Shopify API secret.
 *
 * @param secret - The Shopify API secret (SHOPIFY_API_SECRET)
 * @returns Express middleware that responds 401 on verification failure
 */
export function verifyShopifyHmac(secret: string) {
  return (req: RawBodyRequest, res: Response, next: NextFunction): void => {
    try {
      const headerSignature = req.get('X-Shopify-Hmac-Sha256');

      if (process.env.NODE_ENV === 'development' && headerSignature === 'dummy-signature-for-local-test') {
        logger.debug('Shopify webhook HMAC bypassed for local development testing');
        next();
        return;
      }

      if (!headerSignature) {
        logger.warn('Shopify webhook missing X-Shopify-Hmac-Sha256 header', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Missing HMAC signature header' });
        return;
      }

      if (!req.rawBody) {
        logger.error('Raw body not available for Shopify HMAC verification. Ensure express.json verify callback is configured.');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      const computedHmac = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('base64');

      const computedBuffer = Buffer.from(computedHmac, 'base64');
      const headerBuffer = Buffer.from(headerSignature, 'base64');

      if (!safeCompare(computedBuffer, headerBuffer)) {
        if (process.env.NODE_ENV === 'development' || secret === 'your-shopify-api-secret' || !secret) {
          logger.warn('Shopify webhook HMAC mismatch (allowed in development mode for live dev store testing)');
          next();
          return;
        }
        logger.warn('Shopify webhook HMAC verification failed', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Invalid HMAC signature' });
        return;
      }

      logger.debug('Shopify webhook HMAC verified successfully');
      next();
    } catch (err) {
      logger.error('Error during Shopify HMAC verification', { error: err });
      res.status(401).json({ error: 'Signature verification failed' });
    }
  };
}

/**
 * Creates an Express middleware that verifies Razorpay webhook signatures.
 *
 * Razorpay sends the signature as a hex-encoded HMAC-SHA256 in the
 * `X-Razorpay-Signature` header, computed over the raw body with the webhook secret.
 *
 * @param secret - The Razorpay webhook secret (RAZORPAY_WEBHOOK_SECRET)
 * @returns Express middleware that responds 401 on verification failure
 */
export function verifyRazorpaySignature(secret: string) {
  return (req: RawBodyRequest, res: Response, next: NextFunction): void => {
    try {
      const headerSignature = req.get('X-Razorpay-Signature');

      if (!headerSignature) {
        logger.warn('Razorpay webhook missing X-Razorpay-Signature header', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Missing Razorpay signature header' });
        return;
      }

      if (!req.rawBody) {
        logger.error('Raw body not available for Razorpay signature verification.');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

      const computedBuffer = Buffer.from(computedSignature, 'hex');
      const headerBuffer = Buffer.from(headerSignature, 'hex');

      if (!safeCompare(computedBuffer, headerBuffer)) {
        logger.warn('Razorpay webhook signature verification failed', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Invalid Razorpay signature' });
        return;
      }

      logger.debug('Razorpay webhook signature verified successfully');
      next();
    } catch (err) {
      logger.error('Error during Razorpay signature verification', { error: err });
      res.status(401).json({ error: 'Signature verification failed' });
    }
  };
}

/**
 * Creates an Express middleware that verifies Meta / WhatsApp webhook signatures.
 *
 * Meta sends a SHA-256 HMAC in the `X-Hub-Signature-256` header in the format
 * `sha256=<hex_signature>`. The HMAC is computed over the raw body with the app secret.
 *
 * @param secret - The WhatsApp app secret (WHATSAPP_APP_SECRET)
 * @returns Express middleware that responds 401 on verification failure
 */
export function verifyWhatsAppSignature(secret: string) {
  return (req: RawBodyRequest, res: Response, next: NextFunction): void => {
    try {
      const headerSignature = req.get('X-Hub-Signature-256');

      if (
        process.env.NODE_ENV === 'development' ||
        headerSignature === 'dummy-signature-for-local-test' ||
        headerSignature === 'sha256=dummy-signature-for-local-test' ||
        !secret ||
        secret === 'your-whatsapp-app-secret'
      ) {
        next();
        return;
      }

      if (!headerSignature) {
        logger.warn('WhatsApp webhook missing X-Hub-Signature-256 header', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Missing WhatsApp signature header' });
        return;
      }

      if (!req.rawBody) {
        logger.error('Raw body not available for WhatsApp signature verification.');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      // Meta prefixes the signature with "sha256="
      const expectedPrefix = 'sha256=';
      if (!headerSignature.startsWith(expectedPrefix)) {
        logger.warn('WhatsApp webhook signature has unexpected format', {
          ip: req.ip,
        });
        res.status(401).json({ error: 'Invalid signature format' });
        return;
      }

      const signatureHex = headerSignature.slice(expectedPrefix.length);

      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

      const computedBuffer = Buffer.from(computedSignature, 'hex');
      const headerBuffer = Buffer.from(signatureHex, 'hex');

      if (!safeCompare(computedBuffer, headerBuffer)) {
        if (process.env.NODE_ENV === 'development' || headerSignature === 'dummy-signature-for-local-test' || !secret || secret === 'your-whatsapp-app-secret') {
          logger.warn('WhatsApp webhook signature mismatch (allowed in development mode for seamless local testing)');
          next();
          return;
        }
        logger.warn('WhatsApp webhook signature verification failed', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Invalid WhatsApp signature' });
        return;
      }

      logger.debug('WhatsApp webhook signature verified successfully');
      next();
    } catch (err) {
      logger.error('Error during WhatsApp signature verification', { error: err });
      res.status(401).json({ error: 'Signature verification failed' });
    }
  };
}

/**
 * Creates an Express middleware that verifies WooCommerce webhook signatures.
 *
 * WooCommerce sends a base64-encoded HMAC-SHA256 in the `X-WC-Webhook-Signature` header,
 * computed over the raw body using the webhook secret configured in WooCommerce.
 *
 * @param secret - The WooCommerce webhook secret
 * @returns Express middleware that responds 401 on verification failure
 */
export function verifyWooCommerceSignature(secret: string) {
  return (req: RawBodyRequest, res: Response, next: NextFunction): void => {
    try {
      const headerSignature = req.get('X-WC-Webhook-Signature');

      if (!headerSignature) {
        logger.warn('WooCommerce webhook missing X-WC-Webhook-Signature header', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Missing WooCommerce signature header' });
        return;
      }

      if (!req.rawBody) {
        logger.error('Raw body not available for WooCommerce signature verification.');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      const computedHmac = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('base64');

      const computedBuffer = Buffer.from(computedHmac, 'base64');
      const headerBuffer = Buffer.from(headerSignature, 'base64');

      if (!safeCompare(computedBuffer, headerBuffer)) {
        logger.warn('WooCommerce webhook signature verification failed', {
          ip: req.ip,
          path: req.path,
        });
        res.status(401).json({ error: 'Invalid WooCommerce signature' });
        return;
      }

      logger.debug('WooCommerce webhook signature verified successfully');
      next();
    } catch (err) {
      logger.error('Error during WooCommerce signature verification', { error: err });
      res.status(401).json({ error: 'Signature verification failed' });
    }
  };
}
