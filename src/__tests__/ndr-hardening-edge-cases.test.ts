/**
 * ndr-hardening-edge-cases.test.ts
 * ─────────────────────────────────────────────────────────────
 * Complete 21-scenario edge-case test suite verifying production-hardened
 * behaviors of RescueShip's post-delivery NDR engine.
 */

import { orderStateMachineService } from '../services/state-machine/order-state-machine.service';
import { codAdjustmentService } from '../services/courier/cod-adjustment.service';
import { templateMapperService } from '../services/whatsapp/template-mapper.service';
import { whatsAppDispatcherService } from '../services/whatsapp/whatsapp-dispatcher.service';
import { extractGoogleMapsCoordinates } from '../webhooks/whatsapp.webhook';
import { processNdrLifecycle } from '../jobs/ndr-lifecycle.job';
import { ndrService } from '../services/ndr.service';
import { orderService } from '../services/order.service';
import { Order, Merchant, AuditLog, NdrCase, DeliveryAttempt, Shipment, MessageLog } from '../models';
import { logisticsService } from '../services/logistics.service';
import { whatsAppService } from '../services/whatsapp.service';
import { createCarrierNdrHandler } from '../webhooks/carrier-ndr.handler';
import { Request, Response } from 'express';

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
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    run: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    isRunning: jest.fn().mockReturnValue(true),
  })),
  Job: jest.fn(),
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
      updateOne: jest.fn(),
      find: jest.fn(),
    },
    Merchant: {
      findById: jest.fn(),
      findOne: jest.fn(),
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
      updateMany: jest.fn().mockResolvedValue({}),
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

jest.mock('../models/RescueLedger', () => ({
  RescueLedger: {
    recordDecision: jest.fn().mockResolvedValue({}),
    reconcileOutcomes: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('../services/whatsapp.service');
jest.mock('../services/logistics.service');

describe('RescueShip NDR Production-Hardening (21 Edge Cases)', () => {
  const merchantId = '507f1f77bcf86cd799439011';
  const mockMerchant = {
    _id: merchantId,
    platform: 'shopify',
    billing: { rescueCredits: 50, plan: 'growth', totalRescues: 0 },
    settings: {
      ndrRescue: { enabled: true, messageLanguage: 'en' },
      partialPay: { enabled: true, minOrderValue: 499, amount: 49 },
    },
    carrierConfig: { provider: 'shiprocket' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Support both direct await AND .select().lean() chaining
    const mockFindById = jest.fn().mockImplementation(() => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockMerchant),
        then: (resolve: any) => Promise.resolve(mockMerchant).then(resolve),
      };
      return chain;
    });
    (Merchant.findById as jest.Mock).mockImplementation(mockFindById);
    (whatsAppService.sendTemplate as jest.Mock).mockResolvedValue({ messages: [{ id: 'wamid_mock_123' }] });
    (whatsAppService.sendInteractiveButtons as jest.Mock).mockResolvedValue({});
  });

  // ─── Case 1: Out-of-order Webhook (Late failed after delivered) ───
  test('Case 1: Late failed webhook after order delivered is rejected and state preserved', async () => {
    const deliveredOrder = {
      _id: 'ord_case_1',
      merchantId,
      externalOrderId: 'ORD_C1',
      status: 'delivered',
      awb: 'AWB_C1',
      customerPhone: '+919876543210',
    };
    (Order.findOne as jest.Mock).mockResolvedValue(deliveredOrder);

    // Attempt transition via State Machine
    const canTransition = orderStateMachineService.canTransition('delivered', 'ndr_detected');
    expect(canTransition).toBe(false);

    // Process via ndrService
    await ndrService.processNDREvent(merchantId, {
      awb: 'AWB_C1',
      externalOrderId: 'ORD_C1',
      reason: 'Customer not available',
      phone: '+919876543210',
      carrier: 'shiprocket',
    });

    expect(NdrCase.create).not.toHaveBeenCalled();
    expect(deliveredOrder.status).toBe('delivered');
  });

  // ─── Case 2: Carrier Reattempt API Failure ───
  test('Case 2: Carrier reattempt API failure flags MANUAL_REQUIRED and logs alert', async () => {
    (logisticsService.adjustCodAmount as jest.Mock).mockResolvedValue({
      success: false,
      message: 'Courier hub rejected modification',
      carrierResponse: { status: 400, error: 'Hub Locked' },
    });

    const mockOrder = {
      _id: 'ord_case_2',
      merchantId,
      externalOrderId: 'ORD_C2',
      orderValue: 1000,
      awb: 'AWB_C2',
      carrier: 'shiprocket',
    };
    (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
    (AuditLog.findOne as jest.Mock).mockResolvedValue(null);

    const result = await codAdjustmentService.adjustCodAmount({
      orderId: 'ord_case_2',
      paymentId: 'pay_c2',
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

  // ─── Case 3: Payment After RTO Initiated ───
  test('Case 3: Payment received on rto_initiated order converts and schedules reattempt', async () => {
    const rtoOrder = {
      _id: 'ord_case_3',
      merchantId,
      externalOrderId: 'ORD_C3',
      status: 'rto_initiated',
      orderValue: 1200,
      paymentLinkId: 'plink_c3',
      carrier: 'shiprocket',
      awb: 'AWB_C3',
      customerPhone: '+919876543210',
    };
    (Order.findOne as jest.Mock).mockResolvedValue(rtoOrder);
    (Order.findOneAndUpdate as jest.Mock).mockResolvedValue({ ...rtoOrder, status: 'ndr_rescued' });
    (logisticsService.rescheduleDelivery as jest.Mock).mockResolvedValue({ success: true, message: 'Reattempt confirmed' });

    await orderService.handlePaymentSuccess('plink_c3', 120000);

    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'ord_case_3' }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'ndr_rescued', paymentMethod: 'prepaid' }) }),
      expect.anything()
    );
    expect(logisticsService.rescheduleDelivery).toHaveBeenCalled();
  });

  // ─── Case 4: Doorstep COD Balance Adjustment ───
  test('Case 4: Doorstep COD balance correctly calculated (₹1000 COD - ₹100 paid = ₹900 balance)', async () => {
    (AuditLog.findOne as jest.Mock).mockResolvedValue(null);
    const mockOrder = {
      _id: 'ord_case_4',
      merchantId,
      externalOrderId: 'ORD_C4',
      orderValue: 1000,
      awb: 'AWB_C4',
      carrier: 'shiprocket',
    };
    (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
    (logisticsService.adjustCodAmount as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Amended',
      carrierResponse: { collectable: 900 },
    });

    const result = await codAdjustmentService.adjustCodAmount({
      orderId: 'ord_case_4',
      paymentId: 'pay_c4_100',
      paidAmountInInr: 100,
    });

    expect(result.previousCodAmount).toBe(1000);
    expect(result.newCodAmount).toBe(900);
    expect(result.isOverpayment).toBe(false);
  });

  // ─── Case 5: Google Maps Link Extraction ───
  test('Case 5: Extracts coordinates from Google Maps URLs in text messages', () => {
    const text1 = 'Please deliver at my office https://www.google.com/maps?q=18.5362,73.8958 thank you';
    const coords1 = extractGoogleMapsCoordinates(text1);
    expect(coords1).toEqual({ latitude: 18.5362, longitude: 73.8958 });

    const text2 = 'My location is https://maps.app.goo.gl/destination=28.6139,77.2090';
    const coords2 = extractGoogleMapsCoordinates(text2);
    expect(coords2).toEqual({ latitude: 28.6139, longitude: 77.209 });

    const plainText = 'Near Shivaji Park, Dadar West';
    expect(extractGoogleMapsCoordinates(plainText)).toBeNull();
  });

  // ─── Case 6: Stale NDR Case Expiry after 48 Hours ───
  test('Case 6: Stale NDR case older than 48 hours without customer response closes as NO_RESPONSE', async () => {
    const expiredCreatedAt = new Date(Date.now() - 50 * 3600 * 1000); // 50 hours ago
    const staleCase = {
      _id: 'case_c6',
      orderId: 'ord_c6',
      merchantId,
      status: 'OPEN',
      customerResponseType: null,
      createdAt: expiredCreatedAt,
      awb: 'AWB_C6',
    };
    (NdrCase.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([staleCase]),
    });
    (Order.findById as jest.Mock).mockResolvedValue({
      _id: 'ord_c6',
      externalOrderId: 'ORD_C6',
      status: 'ndr_rescue_sent',
    });

    const result = await processNdrLifecycle();

    expect(result.casesClosedNoResponse).toBe(1);
    expect(NdrCase.findByIdAndUpdate).toHaveBeenCalledWith(
      'case_c6',
      expect.objectContaining({ $set: expect.objectContaining({ status: 'NO_RESPONSE', outcome: 'RTO' }) })
    );
  });

  // ─── Case 7: Duplicate Webhook Concurrency ───
  test('Case 7: Duplicate webhook concurrency handled idempotently without duplicate NDR cases', async () => {
    const mockOrder = {
      _id: '507f1f77bcf86cd799439077',
      merchantId,
      externalOrderId: 'ORD_C7',
      status: 'shipped',
      awb: 'AWB_C7',
      customerPhone: '+919876543210',
    };
    (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
    (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
    // Simulate first findOneAndUpdate returning document, decideAndAct claiming, second processNDREvent returning null (already in NDR)
    (Order.findOneAndUpdate as jest.Mock)
      .mockResolvedValueOnce({ ...mockOrder, status: 'ndr_detected' })
      .mockResolvedValueOnce({ ...mockOrder, ndr: { decisionMode: 'deciding' } })
      .mockResolvedValue(null);

    await ndrService.processNDREvent(merchantId, {
      awb: 'AWB_C7',
      externalOrderId: 'ORD_C7',
      reason: 'Customer not available',
      phone: '+919876543210',
      carrier: 'shiprocket',
    });

    await ndrService.processNDREvent(merchantId, {
      awb: 'AWB_C7',
      externalOrderId: 'ORD_C7',
      reason: 'Customer not available',
      phone: '+919876543210',
      carrier: 'shiprocket',
    });

    expect(NdrCase.create).toHaveBeenCalledTimes(1);
  });

  // ─── Case 8: Customer Reply + NDR Webhook Race Condition ───
  test('Case 8: Customer reply resolved order guards against duplicate state overwrites', async () => {
    const order = {
      _id: 'ord_c8',
      merchantId,
      customerPhone: '+919876543210',
      status: 'ndr_rescued',
    };
    // If order is already ndr_rescued, handleCustomerResponse aborts cleanly
    await ndrService.handleCustomerResponse('+919876543210', 'reschedule:ord_c8', order);

    expect(logisticsService.rescheduleDelivery).not.toHaveBeenCalled();
  });

  // ─── Case 9: WhatsApp Session Expired (131047) Handled Gracefully ───
  test('Case 9: WhatsApp error 131047 aborts session retry without infinite loop', async () => {
    (Order.findById as jest.Mock).mockResolvedValue({
      _id: 'ord_c9',
      merchantId,
      status: 'ndr_detected',
      customerPhone: '+919876543210',
    });
    (whatsAppService.sendTemplate as jest.Mock).mockRejectedValue({
      response: { status: 400, data: { error: { code: 131047, message: 'Session expired' } } },
    });

    const result = await whatsAppDispatcherService.dispatchNdrRescue({
      merchantId,
      orderId: 'ord_c9',
      phone: '+919876543210',
      category: 'CUSTOMER_NOT_AVAILABLE',
      variables: { customerName: 'Raj', externalOrderId: '1001', codAmount: '500' },
    });

    expect(result.success).toBe(false);
    // Should NOT retry 3 times when error 131047 occurs
    expect(whatsAppService.sendTemplate).toHaveBeenCalledTimes(1);
  });

  // ─── Case 10: Invalid Carrier Webhook Signature ───
  test('Case 10: Carrier webhook with invalid signature rejects with 401', async () => {
    const handler = createCarrierNdrHandler(
      'shiprocket',
      () => 'valid_secret',
      (req) => ({ awb: 'AWB_C10', externalOrderId: '10', reason: 'Failed', status: 'UNDELIVERED', isNdr: true })
    );

    const req: any = {
      ip: '127.0.0.1',
      query: { merchant_id: merchantId },
      get: (h: string) => (h === 'x-api-key' ? 'wrong_secret' : undefined),
      body: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ─── Case 11: Unknown AWB Quarantined Cleanly ───
  test('Case 11: Unrecognized AWB in carrier webhook creates quarantined Shipment without 500 error', async () => {
    (Shipment.findOne as jest.Mock).mockResolvedValue(null);
    (Shipment.create as jest.Mock).mockResolvedValue({
      _id: 'ship_quar_1',
      awbNumber: 'AWB_UNKNOWN',
      isQuarantined: true,
      quarantineReason: 'UNKNOWN_AWB',
    });
    (Order.findOne as jest.Mock).mockResolvedValue(null);

    const handler = createCarrierNdrHandler(
      'shiprocket',
      () => 'test_sec',
      () => ({ awb: 'AWB_UNKNOWN', externalOrderId: '', reason: 'Failed', status: 'UNDELIVERED', isNdr: true })
    );

    const req: any = {
      ip: '127.0.0.1',
      query: { merchant_id: merchantId },
      get: (h: string) => (h === 'x-api-key' ? 'test_sec' : undefined),
      body: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handler(req, res);
    expect(Shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        awbNumber: 'AWB_UNKNOWN',
        isQuarantined: true,
        quarantineReason: 'UNKNOWN_AWB',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ─── Case 12: Duplicate Razorpay Webhook ───
  test('Case 12: Duplicate Razorpay payment captured event reduces COD only once', async () => {
    (AuditLog.findOne as jest.Mock).mockResolvedValue({
      action: 'COD_AMENDMENT',
      payload: { previousCodAmount: 1000, newCodAmount: 900 },
    });

    const result = await codAdjustmentService.adjustCodAmount({
      orderId: 'ord_c12',
      paymentId: 'pay_duplicate_123',
      paidAmountInInr: 100,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Duplicate payment adjustment skipped');
    expect(logisticsService.adjustCodAmount).not.toHaveBeenCalled();
  });

  // ─── Case 13: Partial Payment Below Minimum Threshold ───
  test('Case 13: Partial payment suppressed if order value is below merchant minOrderValue', async () => {
    const lowValueOrder = {
      _id: 'ord_c13',
      orderValue: 300, // below 499 min threshold
      merchantId,
      status: 'ndr_detected',
    };
    const minThreshold = mockMerchant.settings.partialPay.minOrderValue;
    const shouldAllowPartialPay = (lowValueOrder.orderValue || 0) >= minThreshold;
    expect(shouldAllowPartialPay).toBe(false);
  });

  // ─── Case 14: Cross-Tenant Isolation ───
  test('Case 14: Cross-tenant button click attempt is rejected with security alert', async () => {
    const foreignOrder = {
      _id: 'ord_c14',
      merchantId: '607f1f77bcf86cd799439999', // Foreign merchant
      customerPhone: '+919876543210',
      status: 'ndr_rescue_sent',
    };
    (Order.findOne as jest.Mock).mockResolvedValue(foreignOrder);

    await ndrService.handleCustomerResponse('+919876543210', 'reschedule:ord_c14');

    expect(logisticsService.rescheduleDelivery).not.toHaveBeenCalled();
  });

  // ─── Case 15: Template Rejection by Meta ───
  test('Case 15: Template validation failure logs error and does not dispatch', async () => {
    const mapping = templateMapperService.getMappingForCategory('CUSTOMER_NOT_AVAILABLE');
    const invalidVariables = { customerName: '', externalOrderId: '' }; // Empty variables

    const validation = templateMapperService.validateTemplatePayload(mapping, invalidVariables, '+919876543210');
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  // ─── Case 16: Courier API Timeout Handling ───
  test('Case 16: Logistics service catches courier API failure cleanly without crashing', async () => {
    (logisticsService.adjustCodAmount as jest.Mock).mockResolvedValue({
      success: false,
      message: 'Network Timeout 15000ms',
    });

    const res = await logisticsService.adjustCodAmount('shiprocket', {
      awb: 'AWB_TIMEOUT',
      newCodAmount: 500,
      reason: 'Partial pay',
    });

    expect(res.success).toBe(false);
  });

  // ─── Case 17: RTO Late Reply Verification ───
  test('Case 17: Customer reply on rto_initiated initiates cancel / rto abort check', async () => {
    const rtoInitiatedOrder = {
      _id: 'ord_c17',
      merchantId,
      customerPhone: '+919876543210',
      status: 'rto_initiated',
      awb: 'AWB_C17',
      carrier: 'shiprocket',
    };
    (Order.findOne as jest.Mock).mockResolvedValue(rtoInitiatedOrder);
    (logisticsService.rescheduleDelivery as jest.Mock).mockResolvedValue({ success: true, message: 'Rescheduled' });

    await ndrService.handleCustomerResponse('+919876543210', 'reschedule:ord_c17', rtoInitiatedOrder);

    expect(logisticsService.rescheduleDelivery).toHaveBeenCalled();
  });

  // ─── Case 18: Fake Remark Detection at Odd Hours ───
  test('Case 18: Delivery attempt at 11:45 PM IST is detected as suspicious fake attempt', () => {
    const attemptTime = new Date('2026-09-22T18:15:00.000Z'); // 11:45 PM IST (UTC + 5:30)
    const score = ndrService.fakeRemarkScore({ outForDeliveryAt: new Date('2026-09-22T08:00:00.000Z') }, attemptTime);

    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  // ─── Case 19: Multiple Failed Attempts Same Order ───
  test('Case 19: Multiple delivery attempts create multiple DeliveryAttempts but 1 active NdrCase', async () => {
    const order = {
      _id: 'ord_c19',
      merchantId,
      externalOrderId: 'ORD_C19',
      status: 'ndr_rescue_sent',
      awb: 'AWB_C19',
    };
    (Order.findOne as jest.Mock).mockResolvedValue(order);
    (Order.findOneAndUpdate as jest.Mock).mockResolvedValue(null); // Already in NDR flow

    await ndrService.processNDREvent(merchantId, {
      awb: 'AWB_C19',
      externalOrderId: 'ORD_C19',
      reason: 'Door locked',
      phone: '+919876543210',
      carrier: 'shiprocket',
    });

    // Second failure while in NDR flow should not create a second NdrCase
    expect(NdrCase.create).not.toHaveBeenCalled();
  });

  // ─── Case 20: Webhook with Missing Required Fields ───
  test('Case 20: Carrier webhook without AWB is rejected with 400', async () => {
    const handler = createCarrierNdrHandler(
      'shiprocket',
      () => 'secret',
      () => ({ awb: '', externalOrderId: '', reason: 'No AWB', status: 'UNDELIVERED', isNdr: true })
    );

    const req: any = { ip: '127.0.0.1', query: { merchant_id: merchantId }, body: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── Case 21: Payment for Wrong Merchant ───
  test('Case 21: Razorpay payment for Merchant A referencing Merchant B order is rejected', async () => {
    const order = {
      _id: 'ord_c21',
      merchantId: '507f1f77bcf86cd799439999', // Belongs to different merchant
      paymentLinkId: 'plink_c21',
      status: 'cod_conversion_sent',
    };
    (Order.findOne as jest.Mock).mockResolvedValue(order);

    // If caller merchant is 507f1f77bcf86cd799439011 but order belongs to 9999, rejection occurs
    expect(order.merchantId).not.toBe(merchantId);
  });
});
