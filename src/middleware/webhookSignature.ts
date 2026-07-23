import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export const verifyShopifyHmac = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
    if (!hmacHeader) {
      logger.warn('Shopify webhook missing HMAC header');
      res.status(401).json({ error: 'Missing HMAC signature' });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const calculatedHmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

    if (!crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(calculatedHmac))) {
      logger.warn('Invalid Shopify HMAC signature');
      res.status(401).json({ error: 'Invalid HMAC signature' });
      return;
    }

    next();
  };
};

export const verifyRazorpaySignature = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      logger.warn('Razorpay webhook missing signature header');
      res.status(401).json({ error: 'Missing Razorpay signature' });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Invalid Razorpay signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  };
};
