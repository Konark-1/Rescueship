import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { Merchant, Order, NdrCase } from '../src/models';
import dashboardRouter from '../src/api/dashboard.api';
import { generateToken } from '../src/middleware/auth';

describe('GET /api/dashboard/attention', () => {
  const merchantId = new Types.ObjectId().toString();
  const app = express();
  app.use('/api/dashboard', dashboardRouter);

  const chain = (rows: any[]) => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve(rows) }) }) }) });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Merchant, 'findById').mockImplementation((() => {
      const doc = {
        _id: merchantId, tokenVersion: 1, email: 'm@x.com', emailVerified: false,
        connections: {
          shopify: { status: 'error', lastError: 'Shopify rejected the stored token', health: { ok: false, detail: 'Shopify rejected the stored token' } },
          carrier: { status: 'connected', health: { ok: true, detail: 'ok' } },
        },
      };
      const p: any = Promise.resolve(doc);
      p.select = () => Promise.resolve(doc);
      return p;
    }) as any);
    jest.spyOn(Order, 'find').mockReturnValue(chain([
      { _id: new Types.ObjectId(), externalOrderName: '#1001', customerName: 'Asha', codConversion: { refundStatus: 'pending_approval', refundAmount: 499, refundReason: 'order_cancelled' } },
    ]) as any);
    jest.spyOn(NdrCase, 'find').mockReturnValue(chain([
      { orderId: new Types.ObjectId(), externalOrderId: '1002', customerResponseType: 'RESCHEDULE', carrierReattemptStatus: 'FAILED', updatedAt: new Date() },
    ]) as any);
  });

  it('lists broken connections, unverified email, refunds and failed courier actions (scoped to the merchant)', async () => {
    const res = await request(app).get('/api/dashboard/attention').set('Authorization', `Bearer ${generateToken(merchantId, 1)}`);
    expect(res.status).toBe(200);
    const types = res.body.items.map((i: any) => i.type);
    expect(types).toEqual(expect.arrayContaining(['connection', 'email_unverified', 'refund', 'courier_action']));
    expect(res.body.items.filter((i: any) => i.type === 'connection')).toHaveLength(1);
    expect(res.body.items[0].severity).toBe('high');
    expect((Order.find as jest.Mock).mock.calls[0][0].merchantId).toBe(merchantId);
    expect((NdrCase.find as jest.Mock).mock.calls[0][0].merchantId).toBe(merchantId);
  });
});
