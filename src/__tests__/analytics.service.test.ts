import { analyticsService } from '../../src/services/analytics.service';
import { Order } from '../../src/models';

const mockLean = jest.fn().mockResolvedValue([
  {
    externalOrderId: 'ORD-101',
    customerName: 'Alice',
    customerPhone: '919876543210',
    status: 'delivered',
    orderValue: 1200,
    createdAt: new Date('2026-01-15T10:00:00Z'),
  },
]);

const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });

jest.mock('../../src/models', () => ({
  Order: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn().mockImplementation(() => ({
      sort: mockSort,
    })),
  },
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLean.mockResolvedValue([
      {
        externalOrderId: 'ORD-101',
        customerName: 'Alice',
        customerPhone: '919876543210',
        status: 'delivered',
        orderValue: 1200,
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
    ]);
  });

  describe('getMerchantDashboard & getDashboardData', () => {
    it('should calculate metrics correctly', async () => {
      const mockSummary = [{
        totalOrders: 100,
        codOrders: 60,
        prepaidOrders: 40,
        conversionCount: 15,
        ndrCount: 20,
        rescuedCount: 10,
        activeNdrCases: 5,
        revenueSaved: 4000,
      }];
      const mockDailyConversions = [{ date: '2026-01-15', conversions: 5 }];
      const mockNdrReasons = [{ name: 'Customer Refused', value: 10 }];
      const mockCarrierStats = [{
        _id: 'delhivery',
        carrier: 'delhivery',
        totalNDR: 20,
        rescued: 10,
        rto: 5,
        rescueRate: 50,
      }];

      (Order.aggregate as jest.Mock)
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockDailyConversions)
        .mockResolvedValueOnce(mockNdrReasons)
        .mockResolvedValueOnce(mockCarrierStats);

      const result = await analyticsService.getDashboardData('507f1f77bcf86cd799439011', {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31')
      });

      expect(result.totalOrders).toBe(100);
      expect(result.rescueRate).toBe(50); // (10/20)*100
      expect(result.conversionRate).toBe(25); // (15/60)*100
      expect(result.revenueSaved).toBe(4000);
      expect(result.activeNdrCases).toBe(5);
      expect(result.codToPrepaid).toEqual({ count: 15, conversionRate: 25 });
      expect(result.ndrRescues).toEqual({ count: 10, rescueRate: 50 });
      expect(result.dailyConversions).toEqual(mockDailyConversions);
      expect(result.ndrReasons).toEqual(mockNdrReasons);
      expect(result.carrierPerformance).toEqual([{
        carrier: 'delhivery',
        totalNDR: 20,
        rescued: 10,
        rto: 5,
        rescueRate: 50,
      }]);
      expect(result.recentOrders.length).toBe(1);
      expect(result.recentOrders[0].id).toBe('ORD-101');
    });

    it('should handle zero states correctly', async () => {
      const mockSummary = [{
        totalOrders: 0,
        codOrders: 0,
        prepaidOrders: 0,
        conversionCount: 0,
        ndrCount: 0,
        rescuedCount: 0,
        activeNdrCases: 0,
        revenueSaved: 0,
      }];
      
      (Order.aggregate as jest.Mock)
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockLean.mockResolvedValueOnce([]);

      const result = await analyticsService.getMerchantDashboard('507f1f77bcf86cd799439011', {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31')
      });

      expect(result.rescueRate).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.revenueSaved).toBe(0);
      expect(result.activeNdrCases).toBe(0);
      expect(result.recentOrders).toEqual([]);
    });

    it('should calculate revenueSaved fallback when orderValue sum is 0', async () => {
      const mockSummary = [{
        totalOrders: 10,
        codOrders: 5,
        prepaidOrders: 5,
        conversionCount: 1,
        ndrCount: 2,
        rescuedCount: 1,
        activeNdrCases: 1,
        revenueSaved: 0,
      }];

      (Order.aggregate as jest.Mock)
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await analyticsService.getDashboardData('507f1f77bcf86cd799439011');
      // 1 conversion + 1 rescue = 2 orders * ₹430 = 860
      expect(result.revenueSaved).toBe(860);
    });
  });
});
