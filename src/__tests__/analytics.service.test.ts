import { analyticsService } from '../../src/services/analytics.service';
import { Order } from '../../src/models';

jest.mock('../../src/models', () => ({
  Order: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMerchantDashboard', () => {
    it('should calculate metrics correctly', async () => {
      const mockSummary = [{
        totalOrders: 100,
        codOrders: 60,
        prepaidOrders: 40,
        conversionCount: 15,
        ndrCount: 20,
        rescuedCount: 10,
      }];
      const mockCarrierStats = [{
        carrier: 'delhivery',
        totalNDR: 20,
        rescued: 10,
        rescueRate: 50,
      }];

      (Order.aggregate as jest.Mock)
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockCarrierStats);

      const result = await analyticsService.getMerchantDashboard('507f1f77bcf86cd799439011', {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31')
      });

      expect(result.totalOrders).toBe(100);
      expect(result.rescueRate).toBe(50); // (10/20)*100
      expect(result.conversionRate).toBe(25); // (15/60)*100
      expect(result.totalRevenueSaved).toBe(4000); // 10 * 400
      expect(result.carrierBreakdown).toEqual(mockCarrierStats);
    });

    it('should handle zero states correctly', async () => {
      const mockSummary = [{
        totalOrders: 0,
        codOrders: 0,
        prepaidOrders: 0,
        conversionCount: 0,
        ndrCount: 0,
        rescuedCount: 0,
      }];
      
      (Order.aggregate as jest.Mock)
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce([]); // carrier stats

      const result = await analyticsService.getMerchantDashboard('507f1f77bcf86cd799439011', {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31')
      });

      expect(result.rescueRate).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.totalRevenueSaved).toBe(0);
    });
  });
});
