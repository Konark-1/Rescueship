/**
 * dashboard-and-risk-actions.test.ts
 *
 * Comprehensive tests for:
 * 1. GET /api/dashboard/summary (date filtering, defaults, meta tier)
 * 2. POST /api/orders/:orderId/risk-action (triage actions, audit logging, tenant isolation)
 * 3. GET /api/orders (riskLevel filtering, pagination)
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import dashboardRouter from '../src/api/dashboard.api';
import ordersRouter from '../src/api/orders.api';
import { Order, Merchant, AuditLog } from '../src/models';
import { whatsAppDispatcherService } from '../src/services/whatsapp/whatsapp-dispatcher.service';
import { config } from '../src/config/env';

jest.mock('../src/models', () => ({
  Order: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
  Merchant: {
    findById: jest.fn(),
  },
  AuditLog: {
    create: jest.fn(),
  },
}));

jest.mock('../src/models/Merchant', () => ({
  Merchant: {
    findById: jest.fn(),
  },
}));

jest.mock('../src/services/whatsapp/whatsapp-dispatcher.service', () => ({
  whatsAppDispatcherService: {
    checkMetaTierLimit: jest.fn(),
  },
}));

describe('Dashboard Summary & Order Risk Actions API', () => {
  let app: express.Application;
  const merchantId = '507f1f77bcf86cd799439011';
  let validToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/dashboard', dashboardRouter);
    app.use('/api/orders', ordersRouter);

    validToken = jwt.sign(
      { merchantId, email: 'merchant@test.com', tokenVersion: 1 },
      config.jwt.secret || '12345678901234567890123456789012'
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    const mockMerchantSelect = {
      _id: new Types.ObjectId(merchantId),
      tokenVersion: 1,
      metaTierLimit: 1000,
    };

    // Default mock for Merchant token validation
    (Merchant.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(mockMerchantSelect),
    });

    const { Merchant: MerchantDirect } = require('../src/models/Merchant');
    (MerchantDirect.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(mockMerchantSelect),
    });

    // Default mock for meta tier limit check
    (whatsAppDispatcherService.checkMetaTierLimit as jest.Mock).mockResolvedValue({
      limit: 1000,
      current: 45,
      allowed: true,
    });
  });

  describe('GET /api/dashboard/summary', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('returns default monthly summary when no date range query params are provided', async () => {
      (Order.countDocuments as jest.Mock)
        .mockResolvedValueOnce(15) // rescuedCount
        .mockResolvedValueOnce(8)  // conversionCount
        .mockResolvedValueOnce(5); // rtoArrestCount

      (Order.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ total: 3750 }]); // sumRtoResult

      const mockOrdersNeedingAttention = [
        {
          _id: new Types.ObjectId(),
          orderId: 'ORD_101',
          status: 'ndr_detected',
          orderValue: 1200,
          customerName: 'Test Buyer',
        },
      ];

      (Order.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockOrdersNeedingAttention),
        }),
      });

      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rescuedCount).toBe(15);
      expect(res.body.conversionCount).toBe(8);
      expect(res.body.rtoArrestCount).toBe(5);
      expect(res.body.totalSaved).toBe(3750);
      expect(res.body.ordersNeedingAttention).toHaveLength(1);
      expect(res.body.metaTier).toEqual({
        metaTierLimit: 1000,
        current24hCount: 45,
        isLimitReached: false,
      });

      // Assert createdAt filter was applied
      const countCall = (Order.countDocuments as jest.Mock).mock.calls[0][0];
      expect(countCall.createdAt).toBeDefined();
      expect(countCall.createdAt.$gte).toBeInstanceOf(Date);
    });

    it('respects custom startDate and endDate query params', async () => {
      (Order.countDocuments as jest.Mock)
        .mockResolvedValueOnce(20) // rescuedCount
        .mockResolvedValueOnce(10) // conversionCount
        .mockResolvedValueOnce(4);  // rtoArrestCount

      (Order.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ total: 5000 }]);

      (Order.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      });

      const customStart = '2026-10-01T00:00:00.000Z';
      const customEnd = '2026-10-07T23:59:59.999Z';

      const res = await request(app)
        .get('/api/dashboard/summary')
        .query({ startDate: customStart, endDate: customEnd })
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalSaved).toBe(5000);

      // Verify date filter bounded to specified range
      const countCall = (Order.countDocuments as jest.Mock).mock.calls[0][0];
      expect(countCall.createdAt.$gte).toEqual(new Date(customStart));
      expect(countCall.createdAt.$lte).toEqual(new Date(customEnd));
    });
  });

  describe('POST /api/orders/:orderId/risk-action', () => {
    const validOrderId = new Types.ObjectId().toString();

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post(`/api/orders/${validOrderId}/risk-action`)
        .send({ action: 'manual_review_approve' });

      expect(res.status).toBe(401);
    });

    it('rejects invalid order ID format with 400', async () => {
      const res = await request(app)
        .post('/api/orders/not-a-valid-id/risk-action')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ action: 'manual_review_approve' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid order ID/i);
    });

    it('returns 404 when order does not exist or belongs to another merchant', async () => {
      (Order.findOne as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/orders/${validOrderId}/risk-action`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ action: 'manual_review_approve' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Order not found/i);
    });

    it('returns 400 on unrecognized action name', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(validOrderId),
        merchantId: new Types.ObjectId(merchantId),
        save: jest.fn().mockResolvedValue(true),
      };
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app)
        .post(`/api/orders/${validOrderId}/risk-action`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ action: 'unknown_action_xyz' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Unknown risk action/i);
    });

    it('handles manual_review_approve: overrides score to 0, level to LOW, saves order and creates AuditLog', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(validOrderId),
        merchantId: new Types.ObjectId(merchantId),
        rtoRisk: {
          score: 85,
          level: 'HIGH',
          factors: ['critical_pincode'],
          recommendedAction: 'require_deposit',
        },
        save: jest.fn().mockResolvedValue(true),
      };
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
      (AuditLog.create as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId() });

      const res = await request(app)
        .post(`/api/orders/${validOrderId}/risk-action`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ action: 'manual_review_approve' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockOrder.rtoRisk.level).toBe('LOW');
      expect(mockOrder.rtoRisk.score).toBe(0);
      expect(mockOrder.rtoRisk.factors).toContain('merchant_overridden');
      expect(mockOrder.rtoRisk.recommendedAction).toBe('auto_ship');
      expect(mockOrder.save).toHaveBeenCalled();

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rto_risk_overridden_by_merchant',
          status: 'success',
        })
      );
    });

    it('handles whatsapp_verify: creates AuditLog and returns success', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(validOrderId),
        merchantId: new Types.ObjectId(merchantId),
        rtoRisk: { score: 70, level: 'HIGH', factors: [] },
        save: jest.fn().mockResolvedValue(true),
      };
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
      (AuditLog.create as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId() });

      const res = await request(app)
        .post(`/api/orders/${validOrderId}/risk-action`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ action: 'whatsapp_verify' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rto_whatsapp_verify_requested',
          status: 'success',
        })
      );
    });

    it('handles require_deposit: creates AuditLog and returns success', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(validOrderId),
        merchantId: new Types.ObjectId(merchantId),
        rtoRisk: { score: 92, level: 'HIGH', factors: [] },
        save: jest.fn().mockResolvedValue(true),
      };
      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
      (AuditLog.create as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId() });

      const res = await request(app)
        .post(`/api/orders/${validOrderId}/risk-action`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ action: 'require_deposit' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rto_partial_deposit_requested',
          status: 'success',
        })
      );
    });
  });

  describe('GET /api/orders with riskLevel filter', () => {
    it('filters orders by riskLevel=HIGH', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          orderId: 'ORD_HIGH_1',
          rtoRisk: { score: 85, level: 'HIGH' },
        },
      ];

      (Order.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });
      (Order.countDocuments as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/orders')
        .query({ riskLevel: 'HIGH' })
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);

      const queryArg = (Order.find as jest.Mock).mock.calls[0][0];
      expect(queryArg['rtoRisk.level']).toBe('HIGH');
    });
  });
});
