import { Router, Request, Response, NextFunction } from 'express';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { redisConnection } from '../config/redis';
import { verifyShopifyHmac } from '../middleware/webhookVerify';
import { config } from '../config/env';
import { IdempotencyGuard } from '../utils/idempotency';
import { AuditLog } from '../models';
import { logger } from '../utils/logger';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

router.post(
  '/order-created',
  verifyShopifyHmac(config.shopify.apiSecret),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const webhookId = req.get('X-Shopify-Webhook-Id') || `shopify_${req.body.id}_${Date.now()}`;
    let merchantIdStr = req.query.merchant_id as string;

    if (!merchantIdStr) {
      // For local testing convenience, if no merchant_id is passed, grab the first one from DB
      const Merchant = require('../models/Merchant').Merchant;
      const firstMerchant = await Merchant.findOne();
      if (firstMerchant) {
        merchantIdStr = firstMerchant._id.toString();
      } else {
        res.status(400).json({ error: 'Missing merchant_id and no test merchants exist in DB' });
        return;
      }
    }

    try {
      // Check Idempotency
      const isProcessed = await IdempotencyGuard.isProcessed(webhookId);
      if (isProcessed) {
        logger.info('Duplicate Shopify webhook, skipping', { webhookId });
        res.status(200).json({ status: 'ignored', reason: 'duplicate' });
        return;
      }

      const body = req.body;
      const gateway = (body.gateway || '').toLowerCase();
      const gateways = (body.payment_gateway_names || []).map((g: string) => g.toLowerCase());
      
      const isCOD = gateway.includes('cod') || 
                    gateway.includes('cash') || 
                    gateways.some((g: string) => g.includes('cod') || g.includes('cash'));

      if (!isCOD) {
        logger.info('Shopify order is prepaid, skipping conversion', { orderId: body.id });
        await IdempotencyGuard.markProcessed(webhookId);
        res.status(200).json({ status: 'ignored', reason: 'prepaid' });
        return;
      }

      // Extract phone number from fallback chain
      const phone = body.customer?.phone || 
                    body.billing_address?.phone || 
                    body.shipping_address?.phone;

      if (!phone) {
        logger.info('Shopify order lacks phone number, skipping', { orderId: body.id });
        await IdempotencyGuard.markProcessed(webhookId);
        res.status(200).json({ status: 'ignored', reason: 'no_phone' });
        return;
      }

      // Add to BullMQ queue
      await codConversionQueue.add(
        'convert-cod',
        {
          action: 'process_new_cod',
          merchantId: merchantIdStr,
          orderData: {
            externalOrderId: body.id.toString(),
            platform: 'shopify',
            customerPhone: phone,
            customerName: `${body.customer?.first_name || ''} ${body.customer?.last_name || ''}`.trim() || 'Customer',
            orderValue: parseFloat(body.total_price),
            paymentMethod: 'cod',
          },
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: true,
        }
      );

      // Record in AuditLog
      await AuditLog.create({
        merchantId: new Types.ObjectId(merchantIdStr),
        action: 'webhook_received',
        source: 'shopify',
        payload: { webhookId, orderId: body.id, total: body.total_price },
        status: 'success',
      });

      // Mark processed
      await IdempotencyGuard.markProcessed(webhookId);

      res.status(200).json({ status: 'queued', message: 'Webhook registered successfully' });
    } catch (err: any) {
      logger.error('Failed to handle Shopify webhook', { webhookId, error: err.message });
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  }
);

export default router;
