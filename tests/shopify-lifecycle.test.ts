process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import shopifyRouter from '../src/webhooks/shopify.webhook';
import { Merchant, Order, AuditLog, Shipment } from '../src/models';
import { encryptionService } from '../src/services/encryption.service';
import { missingScopes } from '../src/services/shopify-oauth.service';

jest.mock('../src/models', () => ({
  Merchant: { findOne: jest.fn(), updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) },
  Order: {
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
  },
  Shipment: { findOne: jest.fn().mockResolvedValue(null) },
  AuditLog: { create: jest.fn().mockResolvedValue({}) },
  WebhookEvent: { create: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../src/config/redis', () => ({ redisConnection: { status: 'ready' } }));
jest.mock('bullmq', () => ({ Queue: jest.fn().mockImplementation(() => ({ add: jest.fn().mockResolvedValue({}) })) }));
jest.mock('../src/utils/idempotency', () => ({
  IdempotencyGuard: {
    key: (...p: string[]) => p.join(':'),
    claim: jest.fn().mockResolvedValue('claimed'),
    markProcessed: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  },
  IdempotencyUnavailableError: class extends Error {},
}));

describe('Shopify lifecycle webhooks', () => {
  const secret = 'shpss_lifecycle_secret_1234567890';
  const merchantId = new Types.ObjectId();
  const shop = 'life-brand.myshopify.com';
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
    app.use('/webhooks/shopify', shopifyRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (Merchant.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: merchantId, shopify: { shopDomain: shop, apiSecret: encryptionService.encrypt(secret) } }),
    });
  });

  const send = (topic: string, body: any, sig?: string) => {
    const raw = JSON.stringify(body);
    return request(app)
      .post('/webhooks/shopify')
      .set('X-Shopify-Hmac-Sha256', sig || crypto.createHmac('sha256', secret).update(raw).digest('base64'))
      .set('X-Shopify-Shop-Domain', shop)
      .set('X-Shopify-Topic', topic)
      .set('X-Shopify-Webhook-Id', `wh_${topic}_${Math.random()}`)
      .set('Content-Type', 'application/json')
      .send(raw);
  };

  it('fulfillments/create links the tracking number to the order as its AWB (tenant-scoped)', async () => {
    const res = await send('fulfillments/create', { id: 1, order_id: 5551, status: 'success', tracking_number: 'SR123456789' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('fulfillment_linked');
    expect(Order.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId, externalOrderId: '5551' }),
      { $set: { awb: 'SR123456789' } }
    );
    expect(Shipment.findOne).toHaveBeenCalledWith({ merchantId, awbNumber: 'SR123456789' });
  });

  it('orders/cancelled marks a non-terminal order cancelled and audits it', async () => {
    const res = await send('orders/cancelled', { id: 777, cancel_reason: 'customer' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(Order.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId, externalOrderId: '777', status: { $nin: ['delivered', 'returned', 'rto', 'cancelled'] } }),
      { $set: { status: 'cancelled' } }
    );
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'order_cancelled_on_platform' }));
  });

  it('orders/updated with cancelled_at cancels; otherwise stores name/number', async () => {
    const res1 = await send('orders/updated', { id: 9, cancelled_at: '2026-10-10T10:00:00Z' });
    expect(res1.body.status).toBe('cancelled');
    (Order.updateOne as jest.Mock).mockClear();
    const res2 = await send('orders/updated', { id: 10, name: '#1010', order_number: 1010, fulfillments: [] });
    expect(res2.body.status).toBe('updated');
    expect(Order.updateOne).toHaveBeenCalledWith(
      { merchantId, externalOrderId: '10', externalOrderName: null },
      { $set: { externalOrderName: '#1010', externalOrderNumber: '1010' } }
    );
  });

  it('app/uninstalled drops the access token and marks the store disconnected', async () => {
    const res = await send('app/uninstalled', { id: 1, domain: shop });
    expect(res.status).toBe(200);
    expect(Merchant.updateOne).toHaveBeenCalledWith(
      { _id: merchantId },
      expect.objectContaining({ $unset: expect.objectContaining({ 'shopify.accessToken': 1 }) })
    );
  });

  it('customers/redact anonymises only that customer\'s orders for this merchant', async () => {
    const res = await send('customers/redact', { shop_domain: shop, customer: { id: 1, phone: '+919876543210' }, orders_to_redact: [11, 12] });
    expect(res.status).toBe(200);
    const [filter] = (Order.updateMany as jest.Mock).mock.calls[0];
    expect(filter.merchantId).toBe(merchantId);
    expect(filter.$or).toEqual(expect.arrayContaining([{ externalOrderId: { $in: ['11', '12'] } }]));
  });

  it('rejects a lifecycle webhook with a bad signature', async () => {
    const res = await send('orders/cancelled', { id: 1 }, 'bm90LWEtdmFsaWQtc2ln');
    expect(res.status).toBe(401);
    expect(Order.updateOne).not.toHaveBeenCalled();
  });

  it('missingScopes requires order read/write', () => {
    expect(missingScopes('read_orders,write_orders')).toEqual([]);
    expect(missingScopes('write_orders')).toEqual([]);
    expect(missingScopes('read_products')).toEqual(['read_orders', 'write_orders']);
  });
});
