process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import { preDeliveryService } from '../src/services/pre-delivery.service';
import { pincodeRiskService } from '../src/services/analytics/pincode-risk.service';
import { whatsAppService } from '../src/services/whatsapp.service';
import { Merchant, Order, AuditLog, BillingEvent } from '../src/models';

jest.mock('../src/models', () => ({
  Order: {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
  Merchant: {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
  AuditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  BillingEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../src/services/whatsapp.service', () => ({
  whatsAppService: {
    sendInteractiveButtons: jest.fn().mockResolvedValue({ messaging_product: 'whatsapp' }),
    sendTemplate: jest.fn().mockResolvedValue({ messaging_product: 'whatsapp' }),
  },
}));

jest.mock('../src/services/whatsapp-cost.service', () => ({
  recordOutbound: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/realtime.service', () => ({
  realtimeService: {
    emitOrderUpdate: jest.fn(),
  },
}));

jest.mock('../src/config/redis', () => ({
  redisConnection: {
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

describe('PreDeliveryService', () => {
  const mockMerchant = {
    _id: '507f1f77bcf86cd799439011',
    name: 'StyleKart',
    storeName: 'StyleKart India',
    licenseStatus: 'ACTIVE',
    accessExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    billing: {
      rescueCredits: 50,
      plan: 'growth',
    },
    settings: {
      globalPause: false,
      preDeliveryConfirmation: {
        enabled: false,
        minOrderValue: 2000,
        pincodeRiskThreshold: 0.25,
        customerRtoScoreThreshold: 0.6,
      },
    },
    whatsappConfig: {
      phoneNumberId: 'waba_123',
    },
  };

  const createMockOrder = (overrides = {}): any => ({
    _id: 'order_test_1',
    merchantId: mockMerchant._id,
    externalOrderId: 'ORD-5501',
    customerPhone: '9876543210',
    customerName: 'Aarav Sharma',
    orderValue: 1200,
    paymentMethod: 'cod',
    status: 'out_for_delivery',
    shippingPincode: '110001',
    rtoRisk: { score: 0.2 },
    preDeliveryConfirmation: undefined as any,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldSendPreDelivery (4 Gating Heuristics)', () => {
    it('triggers when Pincode Risk exceeds threshold (Heuristic 1)', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.35);
      const order = createMockOrder({ orderValue: 1000, rtoRisk: { score: 0.1 } });

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, mockMerchant);
      expect(evaluation.shouldSend).toBe(true);
      expect(evaluation.reason).toContain('pincode_risk_exceeded');
    });

    it('triggers when COD order exceeds minOrderValue threshold (Heuristic 2)', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.10);
      const order = createMockOrder({ paymentMethod: 'cod', orderValue: 2500 });

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, mockMerchant);
      expect(evaluation.shouldSend).toBe(true);
      expect(evaluation.reason).toContain('high_value_cod');
    });

    it('does NOT trigger for high value prepaid orders under Heuristic 2', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.10);
      const order = createMockOrder({ paymentMethod: 'prepaid', orderValue: 5000 });

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, mockMerchant);
      expect(evaluation.shouldSend).toBe(false);
    });

    it('triggers when merchant has explicitly enabled pre-delivery confirmation (Heuristic 3)', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.10);
      const order = createMockOrder({ orderValue: 800, paymentMethod: 'prepaid' });
      const enabledMerchant = {
        ...mockMerchant,
        settings: {
          ...mockMerchant.settings,
          preDeliveryConfirmation: { ...mockMerchant.settings.preDeliveryConfirmation, enabled: true },
        },
      };

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, enabledMerchant);
      expect(evaluation.shouldSend).toBe(true);
      expect(evaluation.reason).toBe('merchant_explicitly_enabled');
    });

    it('triggers when Customer RTO risk score exceeds threshold (Heuristic 4)', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.10);
      const order = createMockOrder({
        orderValue: 500,
        paymentMethod: 'prepaid',
        rtoRisk: { score: 0.75 },
      });

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, mockMerchant);
      expect(evaluation.shouldSend).toBe(true);
      expect(evaluation.reason).toContain('customer_rto_risk_exceeded');
    });

    it('rejects when order is already in a terminal state', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.50);
      const order = createMockOrder({ status: 'delivered' });

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, mockMerchant);
      expect(evaluation.shouldSend).toBe(false);
      expect(evaluation.reason).toContain('order_already_terminal');
    });

    it('rejects when pre-delivery confirmation has already been sent (deduplication)', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.50);
      const order = createMockOrder({ preDeliveryConfirmation: { sentAt: new Date() } });

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, mockMerchant);
      expect(evaluation.shouldSend).toBe(false);
      expect(evaluation.reason).toBe('already_sent');
    });

    it('rejects when merchant is globally paused', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.50);
      const pausedMerchant = {
        ...mockMerchant,
        settings: { ...mockMerchant.settings, globalPause: true },
      };
      const order = createMockOrder();

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, pausedMerchant);
      expect(evaluation.shouldSend).toBe(false);
      expect(evaluation.reason).toBe('global_pause_active');
    });

    it('rejects when merchant has zero rescue credits', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.50);
      const noCreditsMerchant = {
        ...mockMerchant,
        billing: { ...mockMerchant.billing, rescueCredits: 0 },
      };
      const order = createMockOrder();

      const evaluation = await preDeliveryService.shouldSendPreDelivery(order, noCreditsMerchant);
      expect(evaluation.shouldSend).toBe(false);
      expect(evaluation.reason).toBe('insufficient_rescue_credits');
    });
  });

  describe('evaluateAndSendPreDelivery', () => {
    it('reserves credit, dispatches WhatsApp buttons, and saves preDeliveryConfirmation record', async () => {
      jest.spyOn(pincodeRiskService, 'getPincodeRiskScore').mockResolvedValue(0.30);
      (Merchant.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: mockMerchant._id });

      const order = createMockOrder({ paymentMethod: 'cod', orderValue: 2400 });

      const sent = await preDeliveryService.evaluateAndSendPreDelivery(order, mockMerchant, { carrier: 'Delhivery' });
      expect(sent).toBe(true);

      // Verify WhatsApp template message was sent
      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        order.customerPhone,
        'ndr_predelivery_en',
        'en',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'body',
            parameters: expect.arrayContaining([
              { type: 'text', text: order.customerName },
              { type: 'text', text: order.externalOrderId },
            ]),
          }),
        ]),
        expect.any(Object)
      );

      // Verify order model was updated
      expect(order.preDeliveryConfirmation).toBeDefined();
      expect(order.preDeliveryConfirmation.sentAt).toBeInstanceOf(Date);
      expect(order.save).toHaveBeenCalled();

      // Verify AuditLog and BillingEvent
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'predelivery_confirmation_sent',
        })
      );
      expect(BillingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'whatsapp_predelivery_sent',
          creditsCost: 1,
        })
      );
    });
  });

  describe('handleCustomerConfirmation', () => {
    it('records customer presence, saves timestamp, logs audit, and sends polite confirmation reply', async () => {
      const order = createMockOrder({
        preDeliveryConfirmation: { sentAt: new Date(Date.now() - 3600000) },
      });

      await preDeliveryService.handleCustomerConfirmation(order, mockMerchant);

      expect(order.preDeliveryConfirmation.response).toBe('confirmed');
      expect(order.preDeliveryConfirmation.respondedAt).toBeInstanceOf(Date);
      expect(order.save).toHaveBeenCalled();

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'predelivery_confirmed_by_customer',
        })
      );

      expect(whatsAppService.sendInteractiveButtons).toHaveBeenCalledWith(
        order.customerPhone,
        expect.stringContaining('notified that you are available'),
        [],
        expect.any(Object)
      );
    });
  });
});
