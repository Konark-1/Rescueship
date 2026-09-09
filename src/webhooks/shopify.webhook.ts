import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { config } from '../config/env';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { AuditLog, Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';

const router = Router();
const codConversionQueue = new Queue('cod-conversion', { connection: redisConnection as any });

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

function safeEqualBase64(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'base64');
  const bb = Buffer.from(b, 'base64');
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify the Shopify HMAC against every secret this merchant could legitimately
 * be signed with: their own custom-app secret (direct-token connect) and/or the
 * platform Partner-app secret (OAuth connect). Returns true on any match.
 */
function verifyShopifyHmacForMerchant(rawBody: Buffer, headerSig: string, merchant: any): boolean {
  const candidates: string[] = [];
  const perMerchant = merchant?.shopify?.apiSecret;
  if (perMerchant) {
    try { candidates.push(encryptionService.decrypt(perMerchant)); } catch { /* ignore undecryptable */ }
  }
  if (config.shopify.apiSecret) candidates.push(config.shopify.apiSecret);

  for (const secret of candidates) {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    if (safeEqualBase64(computed, headerSig)) return true;
  }
  return false;
}

/**
 * POST /webhooks/shopify
 *
 * Tenant resolution is derived from the signed request (X-Shopify-Shop-Domain
 * + HMAC), never from a caller-supplied merchant_id. Unknown shops are rejected.
 */
router.post(['/', '/order-created'], async (req: Request, res: Response): Promise<void> => {
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const headerSig = req.get('X-Shopify-Hmac-Sha256');
  const shopDomain = (req.get('X-Shopify-Shop-Domain') || '').toLowerCase().trim();
  const topic = req.get('X-Shopify-Topic') || 'orders/create';

  if (!rawBody || !headerSig) {
    res.status(401).json({ error: 'Missing HMAC signature or body' });
    return;
  }
  if (!shopDomain || !SHOP_DOMAIN_RE.test(shopDomain)) {
    logger.warn('Shopify webhook rejected: missing/invalid X-Shopify-Shop-Domain', { ip: req.ip });
    res.status(401).json({ error: 'Invalid Shopify store identity' });
    return;
  }

  // Resolve tenant strictly by the store domain the request claims to come from.
  const merchant = await Merchant.findOne({
    $or: [{ 'shopify.shopDomain': shopDomain }, { 'platformConfig.shopifyDomain': shopDomain }],
  }).select('_id shopify.apiSecret shopify.shopDomain platformConfig.shopifyDomain');

  if (!merchant) {
    logger.warn('Shopify webhook rejected: unknown store', { shopDomain });
    res.status(401).json({ error: 'Unknown Shopify store' });
    return;
  }

  // The HMAC binds the payload to this store's app credentials.
  if (!verifyShopifyHmacForMerchant(rawBody, headerSig, merchant)) {
    logger.warn('Shopify webhook HMAC verification failed', { shopDomain, merchantId: merchant._id });
    res.status(401).json({ error: 'Invalid HMAC signature' });
    return;
  }

  const merchantId = merchant._id;
  const body = req.body ?? {};
  const shopifyWebhookId = req.get('X-Shopify-Webhook-Id');
  const eventId = shopifyWebhookId || `${topic}_${body.id ?? 'unknown'}_${body.updated_at ?? ''}`;
  const idemKey = IdempotencyGuard.key('shopify', merchantId.toString(), eventId);

  let claim;
  try {
    claim = await IdempotencyGuard.claim(idemKey);
  } catch (err) {
    if (err instanceof IdempotencyUnavailableError) {
      // Do NOT ack with 200 — Shopify will retry once Redis is back.
      res.status(503).json({ error: 'Temporarily unavailable, retry later' });
      return;
    }
    throw err;
  }
  if (claim === 'duplicate') {
    logger.info('Duplicate Shopify webhook, skipping', { merchantId, eventId });
    res.status(200).json({ status: 'ignored', reason: 'duplicate' });
    return;
  }

  try {
    // Only order creation drives COD conversion. Other topics are acknowledged.
    if (!topic.startsWith('orders/create')) {
      res.status(200).json({ status: 'ignored', reason: 'topic_not_handled' });
      return;
    }

    // Detect and skip test pings before COD processing
    const isTestPing = !body.gateway && (body.id === 820982911946154500 || body.test || !body.line_items);
    if (isTestPing) {
      logger.info('Shopify test ping received, acknowledging without processing', { merchantId, orderId: body.id });
      res.status(200).json({ status: 'ignored', reason: 'test_ping' });
      return;
    }

    const gateway = String(body.gateway || '').toLowerCase();
    const gateways: string[] = Array.isArray(body.payment_gateway_names)
      ? body.payment_gateway_names.map((g: unknown) => String(g).toLowerCase())
      : [];
    const isCOD = gateway.includes('cod') || gateway.includes('cash') ||
      gateways.some((g) => g.includes('cod') || g.includes('cash'));

    if (!isCOD) {
      logger.info('Shopify order is prepaid, skipping conversion', { merchantId, orderId: body.id });
      res.status(200).json({ status: 'ignored', reason: 'prepaid' });
      return;
    }

    // No dev-mode fake phone fallback: never message a number the order did not provide.
    const phone = body.customer?.phone || body.billing_address?.phone || body.shipping_address?.phone;
    if (!phone || typeof phone !== 'string') {
      logger.info('Shopify order lacks phone number, skipping', { merchantId, orderId: body.id });
      res.status(200).json({ status: 'ignored', reason: 'no_phone' });
      return;
    }

    const orderValue = parseFloat(body.total_price);
    if (!Number.isFinite(orderValue) || orderValue <= 0 || body.id === undefined || body.id === null) {
      res.status(200).json({ status: 'ignored', reason: 'invalid_order' });
      return;
    }

    const externalOrderId = String(body.id);

    await codConversionQueue.add(
      'convert-cod',
      {
        action: 'process_new_cod',
        merchantId: merchantId.toString(),
        orderData: {
          externalOrderId,
          platform: 'shopify',
          customerPhone: phone,
          customerName: `${body.customer?.first_name || ''} ${body.customer?.last_name || ''}`.trim() || 'Customer',
          orderValue,
          paymentMethod: 'cod',
        },
      },
      {
        // Stable per-tenant job ID makes queue enqueue idempotent even if Redis idempotency lapses.
        jobId: makeJobId('cod', merchantId.toString(), 'shopify', externalOrderId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await AuditLog.create({
      merchantId,
      action: 'webhook_received',
      source: 'shopify',
      payload: { webhookId: shopifyWebhookId, orderId: body.id, total: body.total_price, shopDomain },
      status: 'success',
    });

    await IdempotencyGuard.markProcessed(idemKey);
    res.status(200).json({ status: 'queued', message: 'Webhook registered successfully' });
  } catch (err: any) {
    logger.error('Failed to handle Shopify webhook', { merchantId, eventId, error: err.message });
    // Nothing durable happened before the queue add succeeded; release so a retry can be processed.
    await IdempotencyGuard.release(idemKey);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
