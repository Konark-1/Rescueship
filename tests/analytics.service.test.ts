import { analyticsService } from '../src/../src/services/analytics.service';
import { Order } from '../src/../src/models';

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
const mockSort = jest.fn().mockReturnValue({ limit: mockLimit, lean: mockLean });
const mockSelect = jest.fn().mockReturnValue({ sort: mockSort, lean: mockLean });

jest.mock('../src/../src/models', () => ({
  Order: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn().mockImplementation(() => ({
      select: mockSelect,
      sort: mockSort,
      lean: mockLean,
    })),
  },
  Merchant: {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        settings: { estimatedRtoLossPerOrder: 140 },
        licenseStatus: 'ACTIVE',
      }),
    }),
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

  describe('getFinancialROI', () => {
    it('should compute financial ROI based on (Rescued * 140) + (GMV * 0.20) - HSM Costs', async () => {
      const mockRoiSummary = [{
        totalOrders: 50,
        ndrCount: 20,
        rescuedOrders: 10,
        retainedGmv: 15000,
        codToPrepaidCount: 5,
        codToPrepaidGmv: 5000,
        ndrMessagesCount: 30,
        codMessagesCount: 10,
      }];

      (Order.aggregate as jest.Mock).mockResolvedValueOnce(mockRoiSummary);

      const roi = await analyticsService.getFinancialROI(
        '507f1f77bcf86cd799439011',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      // Calculations:
      // Rescued Orders: 10
      // Freight Savings: 10 * 140 = 1400
      // Retained GMV: 15000 + 5000 = 20000
      // Margin GMV Savings: 20000 * 0.20 = 4000
      // Gross Savings: 1400 + 4000 = 5400
      // Total HSM Messages: 30 + 10 = 40
      // WhatsApp HSM Costs: 40 * 0.80 = 32
      // Net Savings: 5400 - 32 = 5368
      // Rescue Rate: (10 / 20) * 100 = 50%
      expect(roi.rescuedOrders).toBe(10);
      expect(roi.freightSavings).toBe(1400);
      expect(roi.retainedGmv).toBe(20000);
      expect(roi.gmvMarginSavings).toBe(4000);
      expect(roi.totalHsmMessages).toBe(40);
      expect(roi.whatsappHsmCosts).toBe(32);
      expect(roi.grossSavings).toBe(5400);
      expect(roi.netSavings).toBe(5368);
      expect(roi.rescueRate).toBe(50);
      expect(roi.codToPrepaidCount).toBe(5);
      expect(roi.codToPrepaidGmv).toBe(5000);
      expect(roi.roiMultiple).toBeGreaterThan(0);
      expect(roi.currency).toBe('INR');
    });

    it('should handle zero orders gracefully with benchmark ROI', async () => {
      (Order.aggregate as jest.Mock).mockResolvedValueOnce([]);

      const roi = await analyticsService.getFinancialROI('507f1f77bcf86cd799439011');
      expect(roi.rescuedOrders).toBe(0);
      expect(roi.freightSavings).toBe(0);
      expect(roi.grossSavings).toBe(0);
      expect(roi.netSavings).toBe(0);
      expect(roi.rescueRate).toBe(0);
    });
  });

  describe('getFraudIndex', () => {
    it('should aggregate fake attempts grouped by carrier', async () => {
      const mockCarrierFraud = [
        {
          _id: 'delhivery',
          totalOrders: 100,
          totalNDR: 20,
          fakeAttempts: 8,
          avgFakeScore: 85.0,
        },
        {
          _id: 'shadowfax',
          totalOrders: 50,
          totalNDR: 10,
          fakeAttempts: 4,
          avgFakeScore: 78.5,
        },
      ];

      (Order.aggregate as jest.Mock).mockResolvedValueOnce(mockCarrierFraud);

      const fraud = await analyticsService.getFraudIndex('507f1f77bcf86cd799439011');

      expect(fraud.carriers.length).toBe(2);
      expect(fraud.carriers[0].carrier).toBe('delhivery');
      expect(fraud.carriers[0].fakeAttempts).toBe(8);
      expect(fraud.carriers[0].fakeAttemptRate).toBe(40); // (8 / 20) * 100
      expect(fraud.carriers[0].disputedFreightValue).toBe(8 * 140);
      expect(fraud.totalFakeAttempts).toBe(12);
      expect(fraud.totalDisputedFreight).toBe(12 * 140);
      expect(fraud.flaggedCarriersCount).toBe(2);
      expect(fraud.overallFakeRate).toBe(40); // (12 / 30) * 100
    });
  });

  describe('getRescueFunnelStats', () => {
    it('should calculate accurate conversion drop-offs across funnel stages', async () => {
      const mockFunnelData = [{
        ndrTriggered: 100,
        whatsappSent: 90,
        customerReplied: 60,
        rescued: 45,
        addressesAttempted: 30,
        addressesParsed: 28,
      }];

      (Order.aggregate as jest.Mock).mockResolvedValueOnce(mockFunnelData);

      const funnel = await analyticsService.getRescueFunnelStats('507f1f77bcf86cd799439011');

      expect(funnel.ndrTriggered).toBe(100);
      expect(funnel.whatsappSent).toBe(90);
      expect(funnel.customerReplied).toBe(60);
      expect(funnel.rescued).toBe(45);
      expect(funnel.overallRescueRate).toBe(45.0);

      expect(funnel.stages.length).toBe(4);
      expect(funnel.stages[0].stage).toBe('ndr_triggered');
      expect(funnel.stages[0].count).toBe(100);
      expect(funnel.stages[1].stage).toBe('whatsapp_sent');
      expect(funnel.stages[1].conversionRateFromPrevious).toBe(90.0);
      expect(funnel.stages[2].stage).toBe('customer_replied');
      expect(funnel.stages[2].conversionRateFromPrevious).toBe(66.7);
      expect(funnel.stages[3].stage).toBe('rescued');
      expect(funnel.stages[3].conversionRateFromPrevious).toBe(75.0);

      expect(funnel.aiTelemetry.parserSuccessRate).toBe(93.3);
      expect(funnel.aiTelemetry.addressesParsedCount).toBe(28);
    });
  });

  describe('getDisputeExportRows', () => {
    it('should format disputed fake attempts for CSV generation', async () => {
      mockLean.mockResolvedValueOnce([
        {
          awb: 'AWB12345678',
          carrier: 'delhivery',
          ndr: {
            reason: 'Customer not available at address',
            lastMessageSentAt: new Date('2026-01-15T12:00:00Z'),
            fakeRemarkScore: 89,
          },
        },
      ]);

      const rows = await analyticsService.getDisputeExportRows('507f1f77bcf86cd799439011', 'delhivery');
      expect(rows.length).toBe(1);
      expect(rows[0].awb).toBe('AWB12345678');
      expect(rows[0].carrier).toBe('delhivery');
      expect(rows[0].courierRemark).toBe('Customer not available at address');
      expect(rows[0].proofOfFakeAttempt).toContain('89/100');
    });
  });
});
