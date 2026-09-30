/**
 * pincode-risk.service.test.ts
 *
 * Exhaustive unit tests for Pincode Risk & RTO Analytics Engine.
 */

import { Types } from 'mongoose';
import { pincodeRiskService } from '../services/analytics/pincode-risk.service';
import { Order } from '../models';
import { redisConnection } from '../config/redis';

jest.mock('../models', () => ({
  Order: {
    aggregate: jest.fn(),
  },
}));

jest.mock('../config/redis', () => ({
  redisConnection: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('PincodeRiskService', () => {
  const merchantId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveLocation', () => {
    it('resolves Tier-1 metro and NCR pincodes correctly', () => {
      expect(pincodeRiskService.resolveLocation('110001')).toEqual({
        city: 'New Delhi',
        state: 'Delhi',
      });
      expect(pincodeRiskService.resolveLocation('201301')).toEqual({
        city: 'Noida',
        state: 'Uttar Pradesh',
      });
      expect(pincodeRiskService.resolveLocation('400001')).toEqual({
        city: 'Mumbai',
        state: 'Maharashtra',
      });
      expect(pincodeRiskService.resolveLocation('560001')).toEqual({
        city: 'Bengaluru',
        state: 'Karnataka',
      });
    });

    it('falls back to regional zone for unmapped pincodes', () => {
      const loc = pincodeRiskService.resolveLocation('281001');
      expect(loc.state).toContain('Uttar Pradesh');
    });

    it('handles empty or invalid inputs gracefully', () => {
      expect(pincodeRiskService.resolveLocation('')).toEqual({
        city: 'Unknown',
        state: 'India',
      });
    });
  });

  describe('getPincodeRiskScore', () => {
    it('returns higher baseline risk for remote zones when no DB telemetry exists', async () => {
      (Order.aggregate as jest.Mock).mockResolvedValue([]);
      const score = await pincodeRiskService.getPincodeRiskScore('781001', merchantId);
      expect(score).toBe(0.32);
    });

    it('returns lower baseline risk for Tier-1 metros when no DB telemetry exists', async () => {
      (Order.aggregate as jest.Mock).mockResolvedValue([]);
      const score = await pincodeRiskService.getPincodeRiskScore('110001', merchantId);
      expect(score).toBe(0.12);
    });

    it('computes empirical risk from historical orders if telemetry is available', async () => {
      (Order.aggregate as jest.Mock).mockResolvedValue([
        { totalOrders: 10, failedOrders: 4 },
      ]);
      const score = await pincodeRiskService.getPincodeRiskScore('110001', merchantId);
      expect(score).toBe(0.40);
    });

    it('returns cached risk score from Redis if cache hit occurs', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce('0.45');
      const score = await pincodeRiskService.getPincodeRiskScore('110001', merchantId);
      expect(score).toBe(0.45);
      expect(Order.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('getTopRiskPincodes', () => {
    it('returns cached data from Redis if cache hit occurs', async () => {
      const mockCached = [
        {
          pincode: '110006',
          city: 'New Delhi',
          totalOrders: 20,
          deliveredOrders: 10,
          failedOrders: 10,
          rtoRate: 50,
          riskScore: 0.5,
          riskLevel: 'CRITICAL',
          fakeAttempts: 1,
          failureReasons: ['Customer not available'],
          recommendedAction: 'Require UPI deposit or mandatory phone verification',
        },
      ];
      (redisConnection.get as jest.Mock).mockResolvedValue(JSON.stringify(mockCached));

      const result = await pincodeRiskService.getTopRiskPincodes(merchantId, 5);
      expect(result).toEqual(mockCached);
      expect(Order.aggregate).not.toHaveBeenCalled();
    });

    it('aggregates MongoDB orders on cache miss, computes metrics, and writes to Redis', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValue(null);

      const mockDbRows = [
        {
          _id: '110006',
          totalOrders: 10,
          deliveredOrders: 4,
          failedOrders: 6,
          courierReported: 5,
          customerCancelled: 1,
          fakeAttempts: 3,
          totalAttempts: 15,
          cities: ['New Delhi'],
          states: ['Delhi'],
          failureReasons: ['Customer refused', 'Door closed'],
          carriers: ['delhivery'],
        },
        {
          _id: '400001',
          totalOrders: 20,
          deliveredOrders: 18,
          failedOrders: 2,
          courierReported: 1,
          customerCancelled: 1,
          fakeAttempts: 0,
          totalAttempts: 20,
          cities: ['Mumbai'],
          states: ['Maharashtra'],
          failureReasons: ['Address not found'],
          carriers: ['shiprocket'],
        },
        {
          _id: '560001',
          totalOrders: 15,
          deliveredOrders: 10,
          failedOrders: 5,
          courierReported: 4,
          customerCancelled: 1,
          fakeAttempts: 1,
          totalAttempts: 18,
          cities: ['Bengaluru'],
          states: ['Karnataka'],
          failureReasons: ['Customer out of town'],
          carriers: ['delhivery'],
        },
      ];

      (Order.aggregate as jest.Mock).mockResolvedValue(mockDbRows);

      const result = await pincodeRiskService.getTopRiskPincodes(merchantId, 2);

      expect(result).toHaveLength(2);
      // Pincode 110006 has 60% RTO (6/10) with 3 fake attempts -> CRITICAL
      expect(result[0].pincode).toBe('110006');
      expect(result[0].city).toBe('New Delhi');
      expect(result[0].rtoRate).toBe(60);
      expect(result[0].riskLevel).toBe('CRITICAL');
      expect(result[0].fakeAttempts).toBe(3);
      expect(result[0].courierReported).toBe(5);
      expect(result[0].customerCancelled).toBe(1);
      expect(result[0].avgAttempts).toBe(1.5);
      expect(result[0].recommendedAction).toBe('Require UPI deposit or mandatory phone verification');

      // Second is 560001 with 33.3% RTO
      expect(result[1].pincode).toBe('560001');
      expect(result[1].city).toBe('Bengaluru');
      expect(result[1].rtoRate).toBe(33.3);
      expect(result[1].riskLevel).toBe('HIGH');
      expect(result[1].courierReported).toBe(4);
      expect(result[1].customerCancelled).toBe(1);
      expect(result[1].avgAttempts).toBe(1.2);
      expect(result[1].recommendedAction).toBe('Enable pre-delivery confirmation & COD verification');

      // Verify Redis cache set called with 300s TTL
      expect(redisConnection.set).toHaveBeenCalledWith(
        `pincode_risk:${merchantId}:2`,
        expect.any(String),
        'EX',
        300
      );
    });

    it('returns empty array when no orders exist in the 30-day window', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValue(null);
      (Order.aggregate as jest.Mock).mockResolvedValue([]);

      const result = await pincodeRiskService.getTopRiskPincodes(merchantId, 5);
      expect(result).toEqual([]);
    });
  });
});
