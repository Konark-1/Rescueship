/**
 * license-and-roi.test.ts
 * ─────────────────────────────────────────────────────────────
 * Comprehensive tests for the 90-Day License Key Model and
 * Anti-Refund ROI Engine:
 * 1. Outbound WhatsApp suppression when license is expired
 * 2. Successful dispatch when license is active
 * 3. License status transitions (ACTIVE, APPROACHING_EXPIRY, EXPIRED)
 * 4. Exact reverse-logistics savings calculations (₹140 default)
 * 5. Custom merchant RTO loss per order setting support
 * 6. Order terminal reconciliation saves rtoFeeSaved on delivery
 * 7. Weekly Sunday ROI summary generation & WhatsApp dispatch
 */

import { whatsAppDispatcherService } from '../services/whatsapp/whatsapp-dispatcher.service';
import { roiCalculatorService } from '../services/analytics/roi-calculator.service';
import { orderStateMachineService } from '../services/state-machine/order-state-machine.service';
import { setupWeeklyRoiReportWorker } from '../jobs/weeklyRoiReport.job';
import { whatsAppService } from '../services/whatsapp.service';
import { Order, Merchant, NdrCase, AuditLog } from '../models';

jest.mock('../config/redis', () => ({
  redisConnection: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    status: 'ready',
  },
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJob: jest.fn().mockResolvedValue(null),
  })),
  Worker: jest.fn().mockImplementation((queueName, processor, opts) => {
    const workerInstance = {
      name: queueName,
      processor,
      opts,
      on: jest.fn(),
      run: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
    };
    return workerInstance;
  }),
  Job: jest.fn(),
}));

jest.mock('../services/whatsapp.service', () => ({
  whatsAppService: {
    sendTemplate: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid_12345' }] }),
    sendText: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid_text_123' }] }),
  },
}));

jest.mock('../services/encryption.service', () => ({
  encryptionService: {
    decrypt: jest.fn().mockImplementation((val) => val),
    encrypt: jest.fn().mockImplementation((val) => val),
  },
}));

jest.mock('../models', () => {
  const original = jest.requireActual('../models');
  return {
    ...original,
    Order: {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      find: jest.fn(),
    },
    Merchant: {
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    },
    AuditLog: {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
    },
    NdrCase: {
      create: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      find: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      exists: jest.fn().mockResolvedValue({ _id: 'case_123' }),
    },
    Shipment: {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    },
    DeliveryAttempt: {
      create: jest.fn().mockResolvedValue({}),
    },
    MessageLog: {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    },
    WebhookEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    BillingEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    RescueLedger: {
      recordDecision: jest.fn().mockResolvedValue({}),
      reconcileOutcomes: jest.fn().mockResolvedValue(1),
    },
  };
});

describe('90-Day License Key & Anti-Refund ROI Engine', () => {
  const merchantId = '6512bd349182ab0012345678';
  const orderId = '6512bd349182ab0012349999';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. 90-Day License Expiry Gating', () => {
    it('should suppress outbound WhatsApp dispatch when license is expired', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const expiredMerchant: any = {
        _id: merchantId,
        storeName: 'Test Brand',
        accessGrantedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
        accessExpiresAt: expiredDate,
        licenseStatus: 'EXPIRED',
        licensePlan: '90_day_license',
        settings: {
          ndr: { enabled: true },
        },
        whatsappConfig: {
          phoneNumberId: 'phone_123',
          accessToken: 'token_123',
        },
      };

      const mockOrder: any = {
        _id: orderId,
        merchantId,
        customerPhone: '+919876543210',
        customerName: 'Aarav Sharma',
        externalOrderId: 'ORD-101',
        orderValue: 1200,
        status: 'ndr_detected',
      };

      (Merchant.findById as jest.Mock).mockResolvedValue(expiredMerchant);

      const result = await whatsAppDispatcherService.dispatchNdrRescue({
        merchantId,
        orderId,
        phone: '+919876543210',
        category: 'CUSTOMER_NOT_AVAILABLE',
        variables: { customer_name: 'Aarav Sharma', brand_name: 'Test Brand' },
        order: mockOrder,
      });

      expect(result.success).toBe(false);
      expect(result.suppressed).toBe(true);
      expect(result.suppressReason).toBe('License Expired');
      expect(whatsAppService.sendTemplate).not.toHaveBeenCalled();
    });

    it('should successfully dispatch outbound WhatsApp when license is active', async () => {
      const activeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days remaining
      const activeMerchant: any = {
        _id: merchantId,
        storeName: 'Test Brand',
        accessGrantedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        accessExpiresAt: activeDate,
        licenseStatus: 'ACTIVE',
        licensePlan: '90_day_license',
        settings: {
          ndr: { enabled: true },
        },
        whatsappConfig: {
          phoneNumberId: 'phone_123',
          accessToken: 'token_123',
        },
      };

      const mockOrder: any = {
        _id: orderId,
        merchantId,
        customerPhone: '+919876543210',
        customerName: 'Aarav Sharma',
        externalOrderId: 'ORD-102',
        orderValue: 1500,
        status: 'ndr_detected',
        deliveryAddress: { city: 'Bengaluru' },
      };

      (Merchant.findById as jest.Mock).mockResolvedValue(activeMerchant);

      const result = await whatsAppDispatcherService.dispatchNdrRescue({
        merchantId,
        orderId,
        phone: '+919876543210',
        category: 'CUSTOMER_NOT_AVAILABLE',
        variables: { customerName: 'Aarav Sharma', externalOrderId: 'ORD-102' },
        order: mockOrder,
      });

      expect(result.success).toBe(true);
      expect(result.suppressed).toBeFalsy();
      expect(whatsAppService.sendTemplate).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Anti-Refund ROI Calculator (Golden Metric ₹140)', () => {
    it('should calculate month and total RTO fees saved at ₹140 baseline per rescued order', async () => {
      const mockMerchant: any = {
        _id: merchantId,
        storeName: 'D2C Apparel',
        settings: {
          estimatedRtoLossPerOrder: 140, // ₹70 forward + ₹70 reverse
        },
        accessGrantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        accessExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        licenseStatus: 'ACTIVE',
      };

      (Merchant.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMerchant),
      });

      // 5 rescued orders this month
      const mockRescuedOrders = [
        { _id: 'o1', orderValue: 1000, rtoFeeSaved: 140, status: 'ndr_rescued' },
        { _id: 'o2', orderValue: 1200, rtoFeeSaved: 140, status: 'converted_to_prepaid' },
        { _id: 'o3', orderValue: 800, rtoFeeSaved: 140, status: 'ndr_rescued' },
        { _id: 'o4', orderValue: 1500, rtoFeeSaved: 140, status: 'ndr_rescued' },
        { _id: 'o5', orderValue: 2000, rtoFeeSaved: 140, status: 'converted_to_prepaid' },
      ];

      (Order.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockRescuedOrders),
        }),
      });

      const summary = await roiCalculatorService.getMerchantRoiSummary(merchantId);

      expect(summary.estimatedRtoLossPerOrder).toBe(140);
      expect(summary.monthRescuedCount).toBe(5);
      expect(summary.monthRtoFeesSaved).toBe(5 * 140); // ₹700
      expect(summary.monthRevenueProtected).toBe(1000 + 1200 + 800 + 1500 + 2000); // ₹6,500
      expect(summary.dashboardHeaderMessage).toBe('RescueShip has saved you ₹700 in RTO fees this month.');
      expect(summary.license.status).toBe('ACTIVE');
      expect(summary.license.daysRemaining).toBeGreaterThan(50);
    });

    it('should respect custom merchant estimatedRtoLossPerOrder setting', async () => {
      const mockMerchant: any = {
        _id: merchantId,
        storeName: 'Heavy Goods Brand',
        settings: {
          estimatedRtoLossPerOrder: 250, // ₹125 forward + ₹125 reverse for heavy bulky item
        },
        accessExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days remaining
        licenseStatus: 'APPROACHING_EXPIRY',
      };

      (Merchant.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMerchant),
      });

      // 4 rescued orders without manual rtoFeeSaved set -> should use 250 default
      const mockRescuedOrders = [
        { _id: 'o1', orderValue: 3000, status: 'ndr_rescued' },
        { _id: 'o2', orderValue: 4500, status: 'ndr_rescued' },
        { _id: 'o3', orderValue: 2800, status: 'ndr_rescued' },
        { _id: 'o4', orderValue: 3200, status: 'ndr_rescued' },
      ];

      (Order.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockRescuedOrders),
        }),
      });

      const summary = await roiCalculatorService.getMerchantRoiSummary(merchantId);

      expect(summary.estimatedRtoLossPerOrder).toBe(250);
      expect(summary.monthRescuedCount).toBe(4);
      expect(summary.monthRtoFeesSaved).toBe(4 * 250); // ₹1,000
      expect(summary.dashboardHeaderMessage).toBe('RescueShip has saved you ₹1,000 in RTO fees this month.');
      expect(summary.license.status).toBe('APPROACHING_EXPIRY');
      expect(summary.license.daysRemaining).toBe(10);
    });
  });

  describe('3. Terminal Reconciliation Populates RTO Savings', () => {
    it('should assign rtoFeeSaved to Order and NdrCase upon transition to delivered', async () => {
      const mockOrder: any = {
        _id: orderId,
        merchantId,
        status: 'ndr_rescued',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockMerchant: any = {
        _id: merchantId,
        settings: {
          estimatedRtoLossPerOrder: 140,
        },
      };

      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (NdrCase.exists as jest.Mock).mockResolvedValue({ _id: 'case_123' });

      await orderStateMachineService.onTerminalTransition(orderId, 'delivered');

      // Order should have rtoFeeSaved recorded
      expect(mockOrder.rtoFeeSaved).toBe(140);
      expect(mockOrder.save).toHaveBeenCalled();

      // NdrCase should be updated with DELIVERED status and rtoFeeSaved
      expect(NdrCase.updateMany).toHaveBeenCalledWith(
        {
          orderId,
          status: {
            $in: [
              'OPEN',
              'WAITING_CUSTOMER',
              'CUSTOMER_RESPONDED',
              'ADDRESS_RECEIVED',
              'LOCATION_RECEIVED',
              'REATTEMPT_REQUESTED',
            ],
          },
        },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'DELIVERED',
            outcome: 'DELIVERED',
            rtoFeeSaved: 140,
            estimatedLossPrevented: 140,
          }),
        })
      );
    });
  });

  describe('4. Weekly Sunday Automated ROI Report Job', () => {
    it('should generate formatted anti-refund metrics for Sunday report', async () => {
      const mockMerchant: any = {
        _id: merchantId,
        storeName: 'Glow Cosmetics',
        ownerPhone: '+919999988888',
        settings: {
          estimatedRtoLossPerOrder: 140,
        },
      };

      (Merchant.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMerchant),
      });

      const mockCases = [
        { _id: 'c1', customerResponseType: 'LOCATION_PIN', status: 'CUSTOMER_RESPONDED' },
        { _id: 'c2', customerResponseType: 'LOCATION_PIN', status: 'CUSTOMER_RESPONDED' },
        { _id: 'c3', customerResponseType: 'TEXT_ADDRESS', status: 'CUSTOMER_RESPONDED' },
        { _id: 'c4', customerResponseType: 'PAYMENT', status: 'CUSTOMER_RESPONDED' },
        { _id: 'c5', status: 'REATTEMPT_REQUESTED', resolutionType: 'rescheduled' },
      ];

      (NdrCase.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCases),
      });

      const mockRescued = [
        { _id: 'o1', rtoFeeSaved: 140 },
        { _id: 'o2', rtoFeeSaved: 140 },
        { _id: 'o3', rtoFeeSaved: 140 },
      ];

      (Order.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockRescued),
        }),
      });

      const startDate = new Date('2026-03-15T00:00:00Z');
      const endDate = new Date('2026-03-22T00:00:00Z');

      const metrics = await roiCalculatorService.getWeeklyReportMetrics(merchantId, startDate, endDate);

      expect(metrics).not.toBeNull();
      expect(metrics?.interceptedCount).toBe(5);
      expect(metrics?.locationPinsSecured).toBe(2);
      expect(metrics?.addressesUpdated).toBe(1);
      expect(metrics?.convertedPrepaidCount).toBe(1);
      expect(metrics?.rescuedCount).toBe(3);
      expect(metrics?.rtoFeesSaved).toBe(420); // 3 * 140

      expect(metrics?.summaryMessage).toContain('We intercepted 5 failed deliveries this week.');
      expect(metrics?.summaryMessage).toContain('saved you ₹420 in return shipping costs.');
    });

    it('should run weekly worker and dispatch WhatsApp messages to active merchants', async () => {
      const activeMerchants = [
        {
          _id: merchantId,
          storeName: 'Active Store',
          ownerPhone: '+919876500000',
          licenseStatus: 'ACTIVE',
          whatsappConfig: {
            phoneNumberId: 'waba_phone_1',
            accessToken: 'token_abc',
          },
        },
      ];

      (Merchant.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(activeMerchants),
      });

      (Merchant.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(activeMerchants[0]),
      });

      (NdrCase.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'c1', customerResponseType: 'LOCATION_PIN' },
          { _id: 'c2', customerResponseType: 'LOCATION_PIN' },
        ]),
      });

      (Order.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: 'o1', rtoFeeSaved: 140 },
            { _id: 'o2', rtoFeeSaved: 140 },
          ]),
        }),
      });

      const worker: any = setupWeeklyRoiReportWorker();
      const mockJob: any = { id: 'job_weekly_test' };

      const result = await worker.processor(mockJob);

      expect(result.dispatchedCount).toBe(1);
      expect(whatsAppService.sendText).toHaveBeenCalledWith(
        '+919876500000',
        expect.stringContaining('Weekly Rescue Report'),
        expect.objectContaining({
          phoneNumberId: 'waba_phone_1',
          accessToken: 'token_abc',
        })
      );
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'weekly_roi_report_dispatched',
          status: 'success',
        })
      );
    });
  });
});
