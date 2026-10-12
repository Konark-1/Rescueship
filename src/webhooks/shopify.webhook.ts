import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { config } from '../config/env';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { AuditLog, Merchant, Order, WebhookEvent } from '../models';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';
import { makeJobId } from '../utils/job-id';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';

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

const COMPLIANCE_TOPICS = new Set(['customers/data_request', 'customers/redact', 'shop/redact']);
const TERMINAL_STATUSES = ['delivered', 'returned', 'rto', 'cancelled'] as const;
const PRE_SHIP_STATUSES = ['new', 'confirmed', 'converted_to_prepaid'] as const;

function trackingNumbersOf(f: any): string[] {
  const out = new Set<string>();
  if (f?.tracking_number) out.add(String(f.tracking_number).trim());
  if (Array.isArray(f?.tracking_numbers)) f.tracking_numbers.forEach((t: unknown) => t && out.add(String(t).trim()));
  return [...out].filter((t) => t && t.length <= 64);
}

/** Store order name (#1001) and number so carrier webhooks that send the channel order id still match. */
function orderIdentity(body: any) {
  return {
    externalOrderName: body?.name ? String(body.name).slice(0, 64) : null,
    externalOrderNumber: body?.order_number !== undefined && body?.order_number !== null ? String(body.order_number).slice(0, 32) : null,
  };
}

/**
 * Link Shopify fulfillments (tracking numbers) to our order so carrier NDR events can be
 * matched by AWB, and un-quarantine shipments that arrived before the order.
 */
async function linkFulfillments(merchantId: any, externalOrderId: string, orderNumber: string | null, fulfillments: any[]): Promise<number> {
  let linked = 0;
  for (const f of fulfillments || []) {
    if (f?.status && ['cancelled', 'error', 'failure'].includes(String(f.status))) continue;
    for (const awb of trackingNumbersOf(f)) {
      try {
        const res = await Order.updateOne(
          { merchantId, externalOrderId, $or: [{ awb: null }, { awb: { $exists: false } }] },
          { $set: { awb } }
        );
        if (res.modifiedCount) {
          linked++;
          await Order.updateOne({ merchantId, externalOrderId, status: { $in: [...PRE_SHIP_STATUSES] } }, { $set: { status: 'shipped' } });
        }
      } catch (err: any) {
        // 11000: this AWB already belongs to another order of the merchant; leave both untouched.
        logger.warn('Could not link Shopify fulfillment AWB to order', { merchantId, externalOrderId, awb, error: err?.code || err?.message });
      }
      try {
        const { Shipment } = require('../models');
        const quarantined = await Shipment.findOne({ merchantId, awbNumber: awb });
        if (quarantined) {
          quarantined.shopifyOrderId = externalOrderId;
          quarantined.orderNumber = String(orderNumber || externalOrderId);
          const order = await Order.findOne({ merchantId, externalOrderId }, { _id: 1 });
          if (order && !quarantined.orderId) quarantined.orderId = order._id;
          if (quarantined.isQuarantined) {
            quarantined.isQuarantined = false;
            quarantined.quarantineReason = null;
          }
          await quarantined.save();
          logger.info('Auto-reconciled quarantined shipment from Shopify fulfillment', { awb, externalOrderId });
        }
      } catch (shipmentReconcileErr: any) {
        logger.warn('Failed to auto-reconcile quarantined shipment', { error: shipmentReconcileErr?.message });
      }
    }
  }
  return linked;
}

async function cancelOrder(merchantId: any, externalOrderId: string, reason: string): Promise<boolean> {
  const res = await Order.updateOne(
    { merchantId, externalOrderId, status: { $nin: [...TERMINAL_STATUSES] } },
    { $set: { status: 'cancelled' } }
  );
  if (res.modifiedCount) {
    await AuditLog.create({ merchantId, action: 'order_cancelled_on_platform', source: 'shopify', payload: { externalOrderId, reason }, status: 'success' });
  }
  return res.modifiedCount > 0;
}

async function redactOrders(filter: Record<string, unknown>): Promise<number> {
  const res = await Order.updateMany({ ...filter, piiAnonymized: { $ne: true } }, {
    $set: {
      customerPhone: 'REDACTED',
      customerName: 'REDACTED',
      shippingAddress: 'REDACTED',
      'customer.phone': 'REDACTED',
      'customer.name': 'REDACTED',
      'customer.address': 'REDACTED',
      piiAnonymized: true,
    },
  } as any);
  return res.modifiedCount || 0;
}

/**
 * Non-order topics: fulfillments, cancellations, uninstall and GDPR compliance.
 * Returns the JSON body to send (always 200 once verified).
 */
async function handleLifecycleTopic(topic: string, merchant: any, body: any, shopDomain: string): Promise<Record<string, unknown>> {
  const merchantId = merchant._id;
  switch (topic) {
    case 'orders/updated': {
      const externalOrderId = String(body.id ?? '');
      if (!externalOrderId) return { status: 'ignored', reason: 'no_order_id' };
      if (body.cancelled_at) {
        const cancelled = await cancelOrder(merchantId, externalOrderId, String(body.cancel_reason || 'cancelled'));
        return { status: cancelled ? 'cancelled' : 'ignored' };
      }
      const identity = orderIdentity(body);
      await Order.updateOne({ merchantId, externalOrderId, externalOrderName: null }, { $set: identity });
      const linked = await linkFulfillments(merchantId, externalOrderId, identity.externalOrderNumber, body.fulfillments || []);
      return { status: 'updated', linked };
    }
    case 'orders/cancelled': {
      const cancelled = await cancelOrder(merchantId, String(body.id ?? ''), String(body.cancel_reason || 'cancelled'));
      return { status: cancelled ? 'cancelled' : 'ignored' };
    }
    case 'fulfillments/create':
    case 'fulfillments/update': {
      const externalOrderId = String(body.order_id ?? '');
      if (!externalOrderId) return { status: 'ignored', reason: 'no_order_id' };
      const linked = await linkFulfillments(merchantId, externalOrderId, null, [body]);
      return { status: 'fulfillment_linked', linked };
    }
    case 'app/uninstalled': {
      await Merchant.updateOne({ _id: merchantId }, {
        $set: {
          'shopify.uninstalledAt': new Date(),
          'shopify.webhooksRegistered': false,
          'connections.shopify.status': 'disconnected',
          'connections.shopify.lastError': 'RescueShip was uninstalled from the Shopify store',
        },
        // Keep apiSecret so the follow-up shop/redact webhook can still be verified.
        $unset: { 'shopify.accessToken': 1, 'shopify.tokenExpiresAt': 1 },
      });
      await AuditLog.create({ merchantId, action: 'shopify_app_uninstalled', source: 'shopify', payload: { shopDomain }, status: 'success' });
      return { status: 'uninstalled' };
    }
    case 'customers/data_request': {
      // The merchant must send the customer their data; record the request for follow-up.
      await AuditLog.create({
        merchantId, action: 'gdpr_customer_data_request', source: 'shopify',
        payload: { shopDomain, customerId: body.customer?.id, ordersRequested: body.orders_requested, dataRequestId: body.data_request?.id, requiresMerchantAction: true },
        status: 'success',
      });
      return { status: 'recorded' };
    }
    case 'customers/redact': {
      const ids: string[] = Array.isArray(body.orders_to_redact) ? body.orders_to_redact.map((x: unknown) => String(x)) : [];
      const or: Record<string, unknown>[] = [];
      if (ids.length) or.push({ externalOrderId: { $in: ids } });
      if (body.customer?.phone) or.push({ customerPhone: normalizeIndianPhone(String(body.customer.phone)) });
      const redacted = or.length ? await redactOrders({ merchantId, $or: or }) : 0;
      await AuditLog.create({ merchantId, action: 'gdpr_customer_redact', source: 'shopify', payload: { shopDomain, customerId: body.customer?.id, orders: ids.length, redacted }, status: 'success' });
      return { status: 'redacted', redacted };
    }
    case 'shop/redact': {
      const redacted = await redactOrders({ merchantId });
      await AuditLog.create({ merchantId, action: 'gdpr_shop_redact', source: 'shopify', payload: { shopDomain, redacted }, status: 'success' });
      return { status: 'redacted', redacted };
    }
    default:
      return { status: 'ignored', reason: 'topic_not_handled' };
  }
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

  if (!merchant && COMPLIANCE_TOPICS.has(topic) && verifyShopifyHmacForMerchant(rawBody, headerSig, null)) {
    // Store already removed from RescueShip: nothing left to redact, but Shopify needs a 200.
    logger.info('Shopify compliance webhook for unknown store acknowledged', { shopDomain, topic });
    res.status(200).json({ status: 'ignored', reason: 'unknown_store' });
    return;
  }
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
    // Only order creation drives COD conversion; lifecycle topics keep our copy in sync.
    if (!topic.startsWith('orders/create')) {
      const result = await handleLifecycleTopic(topic, merchant, body, shopDomain);
      await IdempotencyGuard.markProcessed(idemKey);
      res.status(200).json(result);
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
      logger.info('Shopify order is prepaid, storing order record and skipping conversion', { merchantId, orderId: body.id });
      const rawPhone = body.customer?.phone || body.billing_address?.phone || body.shipping_address?.phone || '';
      const phone = rawPhone ? normalizeIndianPhone(rawPhone) : '0000000000';
      const zip = body.shipping_address?.zip || body.billing_address?.zip || null;
      const city = body.shipping_address?.city || body.billing_address?.city || null;
      const province = body.shipping_address?.province || body.billing_address?.province || null;
      const externalOrderId = String(body.id);
      try {
        await Order.create({
          merchantId,
          externalOrderId,
          platform: 'shopify',
          customerPhone: phone || '0000000000',
          customerName: `${body.customer?.first_name || ''} ${body.customer?.last_name || ''}`.trim() || 'Customer',
          orderValue: parseFloat(body.total_price) || 0,
          paymentMethod: 'prepaid',
          shippingPincode: zip,
          shippingCity: city,
          shippingState: province,
          shippingAddress: body.shipping_address || body.billing_address || null,
          ...orderIdentity(body),
          failureSource: 'NONE',
          attemptCount: 0,
          status: 'new',
        });
        await Merchant.updateOne({ _id: merchantId }, { $inc: { 'billing.currentMonthOrders': 1 } });
      } catch { /* already exists */ }
      await linkFulfillments(merchantId, externalOrderId, orderIdentity(body).externalOrderNumber, body.fulfillments || []);

      try {
        await WebhookEvent.create({
          merchantId,
          source: 'SHOPIFY',
          topic,
          eventId,
          rawPayload: body,
          processed: true,
          duplicate: false,
          processedAt: new Date(),
        });
      } catch { /* ignore */ }

      await AuditLog.create({
        merchantId,
        action: 'webhook_received',
        source: 'shopify',
        payload: { webhookId: shopifyWebhookId, orderId: body.id, total: body.total_price, shopDomain, paymentMethod: 'prepaid' },
        status: 'success',
      });

      await IdempotencyGuard.markProcessed(idemKey);
      res.status(200).json({ status: 'stored', message: 'Prepaid Shopify order ingested for NDR tracking' });
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
          pincode: body.shipping_address?.zip || body.billing_address?.zip || undefined,
          city: body.shipping_address?.city || body.billing_address?.city || undefined,
          state: body.shipping_address?.province || body.billing_address?.province || undefined,
          shippingAddress: body.shipping_address || body.billing_address || undefined,
          ...orderIdentity(body),
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
