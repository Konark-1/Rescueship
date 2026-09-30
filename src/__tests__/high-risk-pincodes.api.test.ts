/**
 * high-risk-pincodes.api.test.ts
 *
 * Tests for GET /api/analytics/high-risk-pincodes endpoint.
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import analyticsRouter from '../api/analytics.api';
import { pincodeRiskService } from '../services/analytics/pincode-risk.service';
import { config } from '../config/env';

jest.mock('../services/analytics/pincode-risk.service', () => ({
  pincodeRiskService: {
    getTopRiskPincodes: jest.fn(),
  },
}));

jest.mock('../services/analytics.service', () => ({
  analyticsService: {
    getMerchantDashboard: jest.fn(),
    getCarrierPerformance: jest.fn(),
  },
}));

jest.mock('../models/Merchant', () => ({
  Merchant: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        tokenVersion: 1,
      }),
    }),
  },
}));

describe('GET /api/analytics/high-risk-pincodes', () => {
  let app: express.Application;
  const merchantId = '507f1f77bcf86cd799439011';
  let validToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRouter);

    validToken = jwt.sign(
      { merchantId, email: 'merchant@test.com', tokenVersion: 1 },
      config.jwt.secret || 'test-jwt-secret-key-123456789012'
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/analytics/high-risk-pincodes');
    expect(res.status).toBe(401);
  });

  it('returns high risk pincodes with 200 and meta information for authenticated merchants', async () => {
    const mockPincodes = [
      {
        pincode: '110006',
        city: 'New Delhi',
        state: 'Delhi',
        totalOrders: 15,
        deliveredOrders: 6,
        failedOrders: 9,
        rtoRate: 60,
        riskScore: 0.65,
        riskLevel: 'CRITICAL',
        fakeAttempts: 2,
        failureReasons: ['Customer not available'],
        recommendedAction: 'Require UPI deposit or mandatory phone verification',
      },
    ];

    (pincodeRiskService.getTopRiskPincodes as jest.Mock).mockResolvedValue(mockPincodes);

    const res = await request(app)
      .get('/api/analytics/high-risk-pincodes?limit=5')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].pincode).toBe('110006');
    expect(res.body.meta).toMatchObject({
      count: 1,
      limit: 5,
      periodDays: 30,
    });
    expect(pincodeRiskService.getTopRiskPincodes).toHaveBeenCalledWith(merchantId, 5);
  });

  it('handles service errors gracefully with 500', async () => {
    (pincodeRiskService.getTopRiskPincodes as jest.Mock).mockRejectedValue(new Error('Database timeout'));

    const res = await request(app)
      .get('/api/analytics/high-risk-pincodes')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Failed to retrieve high-risk pincodes');
  });
});
