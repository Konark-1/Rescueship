/**
 * analytics-enterprise-routes.test.ts
 *
 * Unit tests for enterprise analytics routes:
 * - GET /api/analytics/roi
 * - GET /api/analytics/fraud-index
 * - GET /api/analytics/funnel
 * - GET /api/analytics/fraud-disputes/export
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import analyticsRouter from '../api/analytics.api';
import { analyticsService } from '../services/analytics.service';
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
    getFinancialROI: jest.fn(),
    getFraudIndex: jest.fn(),
    getRescueFunnelStats: jest.fn(),
    getDisputeExportRows: jest.fn(),
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

describe('Enterprise Analytics API Routes', () => {
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

  describe('GET /api/analytics/roi', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/analytics/roi');
      expect(res.status).toBe(401);
    });

    it('returns ROI calculations with 200 for authenticated merchant', async () => {
      const mockRoi = {
        rescuedOrders: 14,
        avgFreightSavedPerOrder: 140,
        freightSavings: 1960,
        retainedGmv: 24000,
        margin: 0.20,
        gmvMarginSavings: 4800,
        totalHsmMessages: 45,
        hsmCostPerMessage: 0.80,
        whatsappHsmCosts: 36,
        grossSavings: 6760,
        netSavings: 6724,
        rescueRate: 46.7,
        codToPrepaidCount: 8,
        codToPrepaidGmv: 9600,
        roiMultiple: 187.8,
        currency: 'INR',
        period: {
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
        },
      };

      (analyticsService.getFinancialROI as jest.Mock).mockResolvedValueOnce(mockRoi);

      const res = await request(app)
        .get('/api/analytics/roi?startDate=2026-01-01&endDate=2026-01-31')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.netSavings).toBe(6724);
      expect(res.body.rescueRate).toBe(46.7);
      expect(res.body.codToPrepaidGmv).toBe(9600);
      expect(res.body.roiMultiple).toBe(187.8);
    });
  });

  describe('GET /api/analytics/fraud-index', () => {
    it('returns fraud index grouped by carrier with 200', async () => {
      const mockFraudIndex = {
        carriers: [
          {
            carrier: 'delhivery',
            totalOrders: 120,
            totalNDR: 30,
            fakeAttempts: 12,
            fakeAttemptRate: 40.0,
            disputedFreightValue: 1680,
            legitimateNDR: 18,
            avgFakeScore: 84.5,
          },
        ],
        totalOrders: 120,
        totalNDR: 30,
        totalFakeAttempts: 12,
        overallFakeRate: 40.0,
        totalDisputedFreight: 1680,
        flaggedCarriersCount: 1,
        period: {
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
        },
      };

      (analyticsService.getFraudIndex as jest.Mock).mockResolvedValueOnce(mockFraudIndex);

      const res = await request(app)
        .get('/api/analytics/fraud-index')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.carriers.length).toBe(1);
      expect(res.body.totalFakeAttempts).toBe(12);
      expect(res.body.totalDisputedFreight).toBe(1680);
    });
  });

  describe('GET /api/analytics/funnel', () => {
    it('returns AI rescue funnel with drop-off conversion stages', async () => {
      const mockFunnel = {
        stages: [
          { stage: 'ndr_triggered', label: 'NDR Triggered', count: 100, conversionRateFromPrevious: 100, conversionRateFromStart: 100, dropOffCount: 10 },
          { stage: 'whatsapp_sent', label: 'WhatsApp Sent', count: 90, conversionRateFromPrevious: 90, conversionRateFromStart: 90, dropOffCount: 30 },
          { stage: 'customer_replied', label: 'Customer Replied', count: 60, conversionRateFromPrevious: 66.7, conversionRateFromStart: 60, dropOffCount: 15 },
          { stage: 'rescued', label: 'Delivery Rescued', count: 45, conversionRateFromPrevious: 75, conversionRateFromStart: 45, dropOffCount: 0 },
        ],
        ndrTriggered: 100,
        whatsappSent: 90,
        customerReplied: 60,
        rescued: 45,
        overallRescueRate: 45.0,
        aiTelemetry: {
          parserSuccessRate: 95.2,
          sampleBefore: 'gali no 4...',
          sampleAfter: 'H-42...',
          addressesParsedCount: 35,
        },
      };

      (analyticsService.getRescueFunnelStats as jest.Mock).mockResolvedValueOnce(mockFunnel);

      const res = await request(app)
        .get('/api/analytics/funnel')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stages.length).toBe(4);
      expect(res.body.overallRescueRate).toBe(45.0);
      expect(res.body.aiTelemetry.parserSuccessRate).toBe(95.2);
    });
  });

  describe('GET /api/analytics/fraud-disputes/export', () => {
    it('exports CSV of disputed fake delivery attempts', async () => {
      const mockRows = [
        {
          awb: 'AWB99887766',
          carrier: 'shadowfax',
          courierRemark: 'Customer refused delivery',
          customerReplyTimestamp: '2026-01-15T14:30:00.000Z',
          proofOfFakeAttempt: 'Flagged fake attempt with risk score 88/100',
        },
      ];

      (analyticsService.getDisputeExportRows as jest.Mock).mockResolvedValueOnce(mockRows);

      const res = await request(app)
        .get('/api/analytics/fraud-disputes/export?carrier=shadowfax')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('AWB,Carrier,Courier Remark');
      expect(res.text).toContain('AWB99887766');
      expect(res.text).toContain('shadowfax');
    });
  });
});
