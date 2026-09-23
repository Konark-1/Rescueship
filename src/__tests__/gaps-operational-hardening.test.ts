/**
 * gaps-operational-hardening.test.ts
 * ─────────────────────────────────────────────────────────────
 * Verification test suite for the 5 operational gaps ("Missing Links"):
 * 1. Doorstep COD Balance Adjustment & Carrier Integration
 * 2. Weekly Sunday ROI Reports with RescueLedger Attribution
 * 3. NDR Lifecycle & 72h Stale Expiry Worker
 * 4. Centralized Order State Machine Engine
 * 5. "RTO Arrest" Logic
 */

process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_KEY = 'this_is_a_very_secret_encryption_key_32';

import { codAdjustmentService } from '../services/courier/cod-adjustment.service';
import { logisticsService } from '../services/logistics.service';
import { roiCalculatorService } from '../services/analytics/roi-calculator.service';
import { setupWeeklyRoiReportWorker, scheduleWeeklyRoiReport, weeklyRoiReportQueue } from '../jobs/weeklyRoiReport.job';
import { expireStaleNdrCases72h, scheduleNdrLifecycle, ndrLifecycleQueue } from '../jobs/ndr-lifecycle.job';
import { orderStateMachineService } from '../services/state-machine/order-state-machine.service';
import { rtoArrestService } from '../services/rto-arrest.service';
import { whatsAppDispatcherService } from '../services/whatsapp/whatsapp-dispatcher.service';
import { whatsAppService } from '../services/whatsapp.service';
import { Order, Merchant, NdrCase, AuditLog, Shipment, RescueLedger } from '../models';

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
  Queue: jest.fn().mockImplementation((name) => ({
    name,
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJob: jest.fn().mockResolvedValue({ remove: jest.fn().mockResolvedValue(true) }),
    upsertJobScheduler: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation((queueName, processor, opts) => ({
    name: queueName,
    processor,
    opts,
    on: jest.fn(),
    run: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    isRunning: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../services/whatsapp.service', () => ({
  whatsAppService: {
    sendTemplate: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid_tpl_123' }] }),
    sendText: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid_txt_123' }] }),
  },
}));

jest.mock('../services/logistics.service', () => ({
  logisticsService: {
    adjustCodAmount: jest.fn().mockResolvedValue({ success: true, message: 'COD amended' }),
    rescheduleDelivery: jest.fn().mockResolvedValue({ success: true, message: 'Rescheduled' }),
  },
}));

jest.mock('../models', () => ({
  Order: {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  },
  Merchant: {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  },
  NdrCase: {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  AuditLog: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn().mockResolvedValue({ _id: 'mock_audit_id' }),
  },
  Shipment: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  BillingEvent: {
    create: jest.fn(),
  },
  RescueLedger: {
    find: jest.fn(),
  },
}));

describe('Operational Gaps & Missing Implementations Hardening', () => {
  const merchantId = '507f1f77bcf86cd799439011';
  const orderId = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. Doorstep COD Balance Adjustment & Carrier Integration
  // ═══════════════════════════════════════════════════════════
  describe('Gap 1: Doorstep COD Balance Adjustment', () => {
    test('Partial payment (₹99 on ₹1000) reduces collectable COD to ₹901 and notifies courier', async () => {
      const mockOrder = {
        _id: orderId,
        merchantId,
        orderValue: 1000,
        awb: 'AWB_SR_123',
        carrier: 'shiprocket',
        status: 'ndr_rescue_sent',
      };
      const mockMerchant = {
        _id: merchantId,
        carrierConfig: { provider: 'shiprocket' },
      };

      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (AuditLog.findOne as jest.Mock).mockResolvedValue(null);
      (Shipment.findOne as jest.Mock).mockResolvedValue({
        save: jest.fn().mockResolvedValue(true),
        codAmendmentHistory: [],
      });
      (logisticsService.adjustCodAmount as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Successfully amended COD amount to ₹901',
      });

      const result = await codAdjustmentService.adjustCodAmount({
        orderId,
        paymentId: 'pay_partial_99',
        paidAmountInInr: 99,
      });

      expect(result.success).toBe(true);
      expect(result.previousCodAmount).toBe(1000);
      expect(result.newCodAmount).toBe(901);
      expect(result.isOverpayment).toBe(false);
      expect(logisticsService.adjustCodAmount).toHaveBeenCalledWith(
        'shiprocket',
        expect.objectContaining({ awb: 'AWB_SR_123', newCodAmount: 901 }),
        expect.any(Object)
      );
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COD_AMENDMENT',
          status: 'success',
        })
      );
    });

    test('Overpayment (₹1500 paid on ₹1000 order) clamps collectable COD to ₹0 and flags overpayment', async () => {
      const mockOrder = {
        _id: orderId,
        merchantId,
        orderValue: 1000,
        awb: 'AWB_DEL_456',
        carrier: 'delhivery',
        status: 'ndr_detected',
      };
      const mockMerchant = {
        _id: merchantId,
        carrierConfig: { provider: 'delhivery' },
      };

      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (AuditLog.findOne as jest.Mock).mockResolvedValue(null);
      (Shipment.findOne as jest.Mock).mockResolvedValue({
        save: jest.fn().mockResolvedValue(true),
        codAmendmentHistory: [],
      });
      (logisticsService.adjustCodAmount as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Successfully amended COD amount to ₹0',
      });

      const result = await codAdjustmentService.adjustCodAmount({
        orderId,
        paymentId: 'pay_overpay_1500',
        paidAmountInInr: 1500,
      });

      expect(result.newCodAmount).toBe(0);
      expect(result.isOverpayment).toBe(true);
      expect(result.overpaymentAmount).toBe(500);
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cod_overpayment_detected',
          payload: expect.objectContaining({ originalCod: 1000, paidAmountInInr: 1500, overpaymentAmount: 500 }),
        })
      );
    });

    test('Carrier rejection triggers COD_AMENDMENT_MANUAL_REQUIRED and flags manual action', async () => {
      const mockOrder = {
        _id: orderId,
        merchantId,
        orderValue: 1200,
        awb: 'AWB_CP_789',
        carrier: 'clickpost',
        status: 'ndr_rescue_sent',
      };
      const mockMerchant = {
        _id: merchantId,
        carrierConfig: { provider: 'clickpost' },
      };

      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (AuditLog.findOne as jest.Mock).mockResolvedValue(null);
      (Shipment.findOne as jest.Mock).mockResolvedValue({
        save: jest.fn().mockResolvedValue(true),
        codAmendmentHistory: [],
      });
      (logisticsService.adjustCodAmount as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Carrier does not support automated reduction once run sheet is printed',
      });

      const result = await codAdjustmentService.adjustCodAmount({
        orderId,
        paymentId: 'pay_rejected_1',
        paidAmountInInr: 100,
      });

      expect(result.manualActionRequired).toBe(true);
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COD_AMENDMENT_MANUAL_REQUIRED',
          status: 'failed',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Weekly Sunday ROI Reports
  // ═══════════════════════════════════════════════════════════
  describe('Gap 2: Weekly Sunday ROI Reports', () => {
    test('Repeatable cron job schedules with 0 9 * * 0 pattern', async () => {
      await scheduleWeeklyRoiReport();
      expect(weeklyRoiReportQueue.add).toHaveBeenCalledWith(
        'send-weekly-roi-reports',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 9 * * 0' },
        })
      );
    });

    test('getWeeklyReportMetrics aggregates RescueLedger and calculates netFreightSaved', async () => {
      const mockMerchant = {
        _id: merchantId,
        storeName: 'Test Brand',
        ownerPhone: '+919876543210',
        settings: { estimatedRtoLossPerOrder: 150 },
      };
      (Merchant.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMerchant),
      });
      (NdrCase.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { customerResponseType: 'LOCATION_PIN' },
          { customerResponseType: 'TEXT_ADDRESS' },
        ]),
      });
      (Order.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { rtoFeeSaved: 150 },
            { rtoFeeSaved: 150 },
          ]),
        }),
      });
      (RescueLedger.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { rescued: true, metaCostInr: 2.5 },
          { rescued: true, metaCostInr: 2.5 },
        ]),
      });

      const metrics = await roiCalculatorService.getWeeklyReportMetrics(
        merchantId,
        new Date(Date.now() - 7 * 86400000),
        new Date()
      );

      expect(metrics).not.toBeNull();
      expect(metrics?.interceptedCount).toBe(2);
      expect(metrics?.rescuedCount).toBe(2);
      expect(metrics?.rtoFeesSaved).toBe(300);
      expect(metrics?.metaCostInr).toBe(5);
      expect(metrics?.netFreightSaved).toBe(295); // 300 - 5 = 295
      expect(metrics?.summaryMessage).toContain('saved you ₹295 in return shipping costs.');
    });

    test('setupWeeklyRoiReportWorker dispatches summary to merchant owner', async () => {
      const mockMerchant = {
        _id: merchantId,
        ownerPhone: '+919876543210',
        licenseStatus: 'ACTIVE',
      };
      (Merchant.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockMerchant]),
      });
      (Merchant.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockMerchant, storeName: 'Store A' }),
      });
      (NdrCase.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      (Order.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      });
      (RescueLedger.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const worker: any = setupWeeklyRoiReportWorker();
      const result = await worker.processor({ id: 'job_roi_1' });

      expect(result.total).toBe(1);
      expect(result.dispatchedCount).toBe(1);
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'weekly_roi_report_dispatched',
          status: 'success',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. NDR Lifecycle & 72h Stale Expiry Worker
  // ═══════════════════════════════════════════════════════════
  describe('Gap 3: NDR Lifecycle & 72h Stale Expiry Worker', () => {
    test('expireStaleNdrCases72h finds open cases older than 72h and marks them EXPIRED', async () => {
      const staleCase = {
        _id: 'case_stale_72',
        merchantId,
        orderId,
        awb: 'AWB_STALE_72',
        status: 'OPEN',
        createdAt: new Date(Date.now() - 75 * 3600 * 1000), // 75h old
      };
      (NdrCase.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([staleCase]),
      });

      const result = await expireStaleNdrCases72h();

      expect(result.expiredCount).toBe(1);
      expect(NdrCase.findByIdAndUpdate).toHaveBeenCalledWith(
        'case_stale_72',
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'EXPIRED',
            outcome: 'RTO',
          }),
        })
      );
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ndr_case_expired_72h',
          status: 'success',
        })
      );
    });

    test('scheduleNdrLifecycle schedules repeatable daily 72h audit with 0 0 * * *', async () => {
      await scheduleNdrLifecycle();
      expect(ndrLifecycleQueue.add).toHaveBeenCalledWith(
        'ndr-lifecycle-daily-72h-expiry',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 0 * * *' },
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Centralized Order State Machine Engine
  // ═══════════════════════════════════════════════════════════
  describe('Gap 4: Centralized Order State Machine Engine', () => {
    test('Allows legal state progression: new -> cod_conversion_sent -> converted_to_prepaid', async () => {
      expect(orderStateMachineService.canTransition('new', 'cod_conversion_sent')).toBe(true);
      expect(orderStateMachineService.canTransition('cod_conversion_sent', 'converted_to_prepaid')).toBe(true);
      expect(orderStateMachineService.canTransition('converted_to_prepaid', 'out_for_delivery')).toBe(true);
      expect(orderStateMachineService.canTransition('out_for_delivery', 'delivered')).toBe(true);
    });

    test('Protects terminal states: rejects delivered -> ndr_detected with AuditLog', async () => {
      const deliveredOrder = {
        _id: orderId,
        merchantId,
        status: 'delivered',
        save: jest.fn(),
      };

      const result = await orderStateMachineService.transitionOrder(deliveredOrder, 'ndr_detected');

      expect(result.success).toBe(false);
      expect(result.reason).toContain("Order is already in terminal state 'delivered'");
      expect(deliveredOrder.save).not.toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'state_transition_rejected_terminal',
          status: 'failed',
        })
      );
    });

    test('Rejects stale out-of-order webhook timestamp with AuditLog', async () => {
      const order = {
        _id: orderId,
        merchantId,
        status: 'shipped',
        lastEventTimestamp: new Date('2026-09-23T12:00:00Z'),
        save: jest.fn(),
      };
      const staleTimestamp = new Date('2026-09-23T11:00:00Z'); // 1 hour older

      const result = await orderStateMachineService.transitionOrder(order, 'out_for_delivery', staleTimestamp);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Stale out-of-order event timestamp.');
      expect(order.save).not.toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'state_transition_rejected_stale_timestamp',
          status: 'failed',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. "RTO Arrest" Logic
  // ═══════════════════════════════════════════════════════════
  describe('Gap 5: RTO Arrest Logic', () => {
    test('rtoArrestService triggers urgent WhatsApp intercept when order enters rto_initiated', async () => {
      const mockOrder: any = {
        _id: orderId,
        merchantId,
        externalOrderId: 'ORD_ARREST_1',
        customerPhone: '+919876543210',
        customerName: 'Aarav Sharma',
        orderValue: 1200,
        status: 'rto_initiated',
        awb: 'AWB_ARREST_1',
        carrier: 'shiprocket',
        rtoArrestAttemptedAt: null,
        rtoArrestStatus: null,
        save: jest.fn().mockResolvedValue(true),
      };
      const mockMerchant = {
        _id: merchantId,
        settings: { ndrRescue: { rtoArrestEnabled: true } },
      };

      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (AuditLog.findOne as jest.Mock).mockResolvedValue(null);
      (NdrCase.findOne as jest.Mock).mockResolvedValue(null);
      jest.spyOn(whatsAppDispatcherService, 'dispatchNdrRescue').mockResolvedValue({
        success: true,
        messageId: 'wamid_arrest_123',
      });

      const result = await rtoArrestService.executeRtoArrest({
        merchantId,
        orderId,
        awb: 'AWB_ARREST_1',
        reason: 'Customer unreachable, RTO initiated',
        carrier: 'shiprocket',
      });

      expect(result.success).toBe(true);
      expect(result.arrestTriggered).toBe(true);
      expect(mockOrder.rtoArrestStatus).toBe('TRIGGERED');
      expect(mockOrder.rtoArrestAttemptedAt).toBeInstanceOf(Date);
      expect(whatsAppDispatcherService.dispatchNdrRescue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'RTO_ARREST',
          isRtoArrest: true,
          orderId,
        })
      );
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rto_arrest_triggered',
          status: 'success',
        })
      );
    });

    test('rtoArrestService deduplicates repeated calls for same order', async () => {
      const mockOrder = {
        _id: orderId,
        merchantId,
        status: 'rto_initiated',
        rtoArrestAttemptedAt: new Date(), // Already attempted
        save: jest.fn(),
      };
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Merchant.findById as jest.Mock).mockResolvedValue({ _id: merchantId });

      const result = await rtoArrestService.executeRtoArrest({
        merchantId,
        orderId,
      });

      expect(result.arrestTriggered).toBe(false);
      expect(result.message).toContain('already attempted');
    });

    test('abortRtoAndReattempt instructs carrier to abort RTO and transitions order to ndr_rescued', async () => {
      const mockOrder: any = {
        _id: orderId,
        merchantId,
        status: 'rto_initiated',
        awb: 'AWB_ARREST_1',
        carrier: 'shiprocket',
        save: jest.fn().mockResolvedValue(true),
      };
      const mockMerchant = {
        _id: merchantId,
        carrierConfig: { provider: 'shiprocket' },
      };

      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (logisticsService.rescheduleDelivery as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Reattempt scheduled on carrier',
      });

      const result = await rtoArrestService.abortRtoAndReattempt({
        orderId,
        reason: 'Customer confirmed reattempt on WhatsApp',
      });

      expect(result.success).toBe(true);
      expect(logisticsService.rescheduleDelivery).toHaveBeenCalledWith(
        'shiprocket',
        expect.objectContaining({ awb: 'AWB_ARREST_1', reason: 'Customer confirmed reattempt on WhatsApp' }),
        expect.any(Object)
      );
      expect(mockOrder.status).toBe('ndr_rescued');
      expect(mockOrder.rtoArrestStatus).toBe('RESCUED');
      expect(NdrCase.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: mockOrder._id }),
        expect.objectContaining({ $set: expect.objectContaining({ status: 'REATTEMPT_REQUESTED' }) })
      );
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rto_arrest_courier_override',
          status: 'success',
        })
      );
    });
  });
});
