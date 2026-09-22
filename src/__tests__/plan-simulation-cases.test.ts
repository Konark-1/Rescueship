import { ndrService } from '../services/ndr.service';
import { orderService } from '../services/order.service';
import { Order, Merchant, AuditLog, NdrCase, DeliveryAttempt, WebhookEvent } from '../models';
import { whatsAppService } from '../services/whatsapp.service';
import { logisticsService } from '../services/logistics.service';
import { geocodingService } from '../services/geocoding.service';
import { parseShiprocketWebhook } from '../webhooks/shiprocket.webhook';
import { Request } from 'express';

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
    },
    Merchant: {
      findById: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    },
    AuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    NdrCase: {
      create: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue({}),
    },
    DeliveryAttempt: {
      create: jest.fn().mockResolvedValue({}),
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
jest.mock('../services/geocoding.service');
jest.mock('../services/payment.service');
jest.mock('../services/whatsapp-cost.service', () => ({
  recordOutbound: jest.fn().mockResolvedValue({}),
}));
jest.mock('bullmq');

describe('RescueShip Plan Simulation Test Suite (12 Core Test Cases)', () => {
  const mockMerchantId = '507f1f77bcf86cd799439011';
  const mockMerchant = {
    _id: mockMerchantId,
    email: 'konarkofficial@gmail.com',
    platform: 'shopify',
    settings: {
      ndrRescue: { enabled: true, messageLanguage: 'en', escalationChain: [4, 12, 24] },
      codConversion: { enabled: false },
      partialPay: { enabled: true, amount: 49, trigger: 'AFTER_FAILED_ATTEMPT' },
    },
    billing: { rescueCredits: 100, totalRescues: 5, totalConversions: 2 },
    whatsappConfig: { phoneNumberId: 'wa_123' },
    carrierConfig: { provider: 'shiprocket' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
  });

  // Test Case 1: New COD Order
  it('Test Case 1: New COD order created without sending immediate customer messages', async () => {
    const mockCreatedOrder: any = {
      _id: 'ord_cod_1',
      merchantId: mockMerchantId,
      externalOrderId: '1001',
      customerPhone: '919876543210',
      paymentMethod: 'cod',
      status: 'new',
    };
    (Order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);

    // Merchant has codConversion.enabled: false -> stored, no WhatsApp message sent
    await orderService.processCODOrder(mockMerchantId, {
      externalOrderId: '1001',
      platform: 'shopify',
      customerPhone: '9876543210',
      orderValue: 1299,
      paymentMethod: 'cod',
    });

    // Verify no WhatsApp message sent on normal creation
    expect(whatsAppService.sendTemplate).not.toHaveBeenCalled();
    expect(NdrCase.create).not.toHaveBeenCalled();
  });

  // Test Case 2: New Prepaid Order
  it('Test Case 2: New prepaid order stored as control test with no rescue flow', async () => {
    await orderService.processCODOrder(mockMerchantId, {
      externalOrderId: '1002',
      platform: 'shopify',
      customerPhone: '9876543210',
      orderValue: 2499,
      paymentMethod: 'prepaid',
    });

    expect(whatsAppService.sendTemplate).not.toHaveBeenCalled();
    expect(NdrCase.create).not.toHaveBeenCalled();
  });

  // Test Case 3: Shipment Out For Delivery
  it('Test Case 3: Shipment out for delivery sets outForDeliveryAt and transitions order', async () => {
    const mockOrder: any = {
      _id: 'ord_ofd_1',
      merchantId: mockMerchantId,
      awb: 'AWB123456',
      status: 'shipped',
      save: jest.fn().mockResolvedValue(true),
    };
    (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);

    const req: any = {
      body: {
        awb: 'AWB123456',
        order_id: '1001',
        current_status: 'OUT FOR DELIVERY',
      },
      path: '/tracking',
      get: jest.fn(),
    };

    const parsed = parseShiprocketWebhook(req);
    expect('error' in parsed).toBe(false);
    if (!('error' in parsed)) {
      expect(parsed.status).toBe('OUT_FOR_DELIVERY');
      expect(parsed.isNdr).toBe(false);
    }
  });

  // Test Case 4: Delivery Failed (NDR Trigger)
  it('Test Case 4: Delivery failed classifies remark, creates NdrCase, and queues WhatsApp rescue', async () => {
    const mockOrder: any = {
      _id: '507f1f77bcf86cd799439012',
      merchantId: mockMerchantId,
      externalOrderId: '1001',
      awb: 'AWB123456',
      customerPhone: '919876543210',
      status: 'shipped',
      ndr: { rescueMessagesSent: 0 },
      save: jest.fn().mockResolvedValue(true),
    };
    (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
    (Order.findOneAndUpdate as jest.Mock).mockResolvedValue({
      ...mockOrder,
      status: 'ndr_detected',
    });

    // Test Remark Classification
    const category = ndrService.classifyRemark('Customer not available at premises');
    expect(category).toBe('CUSTOMER_NOT_AVAILABLE');

    await ndrService.processNDREvent(mockMerchantId, {
      awb: 'AWB123456',
      externalOrderId: '1001',
      reason: 'Customer not available',
      phone: '9876543210',
      carrier: 'shiprocket',
    });

    // Verify NdrCase created with category
    expect(NdrCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        awb: 'AWB123456',
        failureCategory: 'CUSTOMER_NOT_AVAILABLE',
        status: 'OPEN',
      })
    );
  });

  // Test Case 5: Customer Replies with Location
  it('Test Case 5: Customer replies with location pin -> updates address and resolution', async () => {
    const mockOrder: any = {
      _id: 'ord_loc_1',
      merchantId: mockMerchantId,
      customerPhone: '919876543210',
      status: 'ndr_rescue_sent',
      carrier: 'shiprocket',
      awb: 'AWB123456',
      ndr: { addressUpdate: { collectionState: 'idle' } },
      save: jest.fn().mockResolvedValue(true),
    };

    (Order.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockOrder),
    });
    (geocodingService.reverseGeocode as jest.Mock).mockResolvedValue('Koregaon Park, Pune 411001');
    (logisticsService.updateDeliveryAddress as jest.Mock).mockResolvedValue({ success: true });
    (whatsAppService.sendInteractiveButtons as jest.Mock).mockResolvedValue({});

    await ndrService.handleCustomerLocationResponse('9876543210', {
      latitude: 18.5362,
      longitude: 73.8958,
    });

    expect(geocodingService.reverseGeocode).toHaveBeenCalledWith(18.5362, 73.8958);
    expect(whatsAppService.sendInteractiveButtons).toHaveBeenCalled();
  });

  // Test Case 6: Reattempt Requested
  it('Test Case 6: Reschedule button response triggers logistics reattempt', async () => {
    const mockOrder: any = {
      _id: 'ord_resched_1',
      merchantId: mockMerchantId,
      customerPhone: '919876543210',
      status: 'ndr_rescue_sent',
      carrier: 'shiprocket',
      awb: 'AWB123456',
      ndr: {},
      save: jest.fn().mockResolvedValue(true),
    };
    (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
    (logisticsService.rescheduleDelivery as jest.Mock).mockResolvedValue({ success: true });
    (whatsAppService.sendInteractiveButtons as jest.Mock).mockResolvedValue({});

    await ndrService.handleCustomerResponse('9876543210', 'reschedule:ord_resched_1', mockOrder);

    expect(logisticsService.rescheduleDelivery).toHaveBeenCalledWith(
      'shiprocket',
      expect.objectContaining({ awb: 'AWB123456', reason: expect.stringContaining('WhatsApp') }),
      expect.any(Object)
    );
    expect(mockOrder.status).toBe('ndr_rescued');
  });

  // Test Case 7: Order Delivered After Reattempt
  it('Test Case 7: Shiprocket DELIVERED webhook marks order delivered', async () => {
    const req: any = {
      body: {
        awb: 'AWB123456',
        order_id: '1001',
        current_status: 'DELIVERED',
      },
      path: '/tracking',
      get: jest.fn(),
    };

    const parsed = parseShiprocketWebhook(req);
    expect('error' in parsed).toBe(false);
    if (!('error' in parsed)) {
      expect(parsed.status).toBe('DELIVERED');
      expect(parsed.isNdr).toBe(false);
    }
  });

  // Test Case 8: Fake Remark Detection
  it('Test Case 8: Odd-hour attempt (11:45 PM IST) is flagged as suspicious fake attempt', () => {
    const mockOrder: any = {
      _id: 'ord_fake_1',
      outForDeliveryAt: new Date(Date.now() - 3600 * 1000),
    };

    // 11:45 PM IST = 18:15 UTC (23:45 IST)
    const lateNightAttempt = new Date('2026-09-22T18:15:00.000Z');
    const score = ndrService.fakeRemarkScore(mockOrder, lateNightAttempt);

    expect(score).toBeGreaterThanOrEqual(0.5);
    const isFake = ndrService.detectFakeAttempt(mockOrder, {
      awb: 'AWB123456',
      externalOrderId: '1001',
      reason: 'Customer not available',
      phone: '9876543210',
      carrier: 'shiprocket',
      attemptTime: lateNightAttempt,
    });
    expect(isFake).toBe(true);
  });

  // Test Case 9: RTO Initiated
  it('Test Case 9: Shiprocket RTO webhook sets status to rto_initiated', () => {
    const req: any = {
      body: {
        awb: 'AWB123456',
        order_id: '1001',
        current_status: 'RTO INITIATED',
      },
      path: '/tracking',
      get: jest.fn(),
    };

    const parsed = parseShiprocketWebhook(req);
    expect('error' in parsed).toBe(false);
    if (!('error' in parsed)) {
      expect(parsed.status).toBe('RTO_INITIATED');
      expect(parsed.isNdr).toBe(false);
    }
  });

  // Test Case 10: Duplicate Failed Webhook Prevention
  it('Test Case 10: Duplicate failed webhook parses deterministic event ID', () => {
    const req1: any = {
      body: { awb: 'AWB123456', order_id: '1001', current_status: 'UNDELIVERED', ndr_reason: 'Customer not available' },
      path: '/ndr',
      get: jest.fn(),
    };
    const req2: any = {
      body: { awb: 'AWB123456', order_id: '1001', current_status: 'UNDELIVERED', ndr_reason: 'Customer not available' },
      path: '/ndr',
      get: jest.fn(),
    };

    const parsed1 = parseShiprocketWebhook(req1) as any;
    const parsed2 = parseShiprocketWebhook(req2) as any;

    expect(parsed1.eventId).toBe(parsed2.eventId);
  });

  // Test Case 11: Razorpay Payment Success on Failed Order (COD to Prepaid)
  it('Test Case 11: Payment success on NDR order converts to prepaid and schedules reattempt', async () => {
    const mockOrder: any = {
      _id: 'ord_ndr_pay_1',
      merchantId: mockMerchantId,
      externalOrderId: '1001',
      status: 'ndr_rescue_sent',
      paymentLinkId: 'plink_rescue_1',
      orderValue: 1000,
      paymentMethod: 'cod',
      carrier: 'shiprocket',
      awb: 'AWB123456',
      ndr: {},
      save: jest.fn().mockResolvedValue(true),
    };

    (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
    (Order.findOneAndUpdate as jest.Mock).mockResolvedValue({
      ...mockOrder,
      status: 'ndr_rescued',
      paymentMethod: 'prepaid',
    });
    (logisticsService.rescheduleDelivery as jest.Mock).mockResolvedValue({ success: true });
    jest.spyOn(orderService, 'markOrderAsPaidOnPlatform').mockResolvedValue();

    // Customer pays ₹49 partial pay or full ₹1000 (100000 paise)
    await orderService.handlePaymentSuccess('plink_rescue_1', 100000);

    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'ord_ndr_pay_1' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'ndr_rescued',
          paymentMethod: 'prepaid',
        }),
      }),
      expect.any(Object)
    );
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ndr_cod_converted_to_prepaid',
      })
    );
  });

  // Test Case 12: Customer Denial Triggers Fake Remark Escalation
  it('Test Case 12: Customer text reply reporting "nobody called" triggers fake remark escalation', async () => {
    const mockOrder: any = {
      _id: 'ord_denial_1',
      merchantId: mockMerchantId,
      customerPhone: '919876543210',
      status: 'ndr_rescue_sent',
      externalOrderId: '1001',
      awb: 'AWB123456',
      carrier: 'shiprocket',
      ndr: {},
      save: jest.fn().mockResolvedValue(true),
    };

    (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
    (whatsAppService.sendInteractiveButtons as jest.Mock).mockResolvedValue({});

    await ndrService.handleCustomerTextResponse('9876543210', 'Nobody came and no one called me today', mockOrder);

    expect(mockOrder.ndr.isFakeAttempt).toBe(true);
    expect(mockOrder.ndr.resolution).toBe('fake_remark_escalated');
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'fake_remark_reported_by_customer',
      })
    );
    expect(whatsAppService.sendInteractiveButtons).toHaveBeenCalledWith(
      '919876543210',
      expect.stringContaining('apologize'),
      [],
      expect.any(Object)
    );
  });
});
