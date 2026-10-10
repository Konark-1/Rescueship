process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import woocommerceRouter from '../src/webhooks/woocommerce.webhook';
import shopifyRouter from '../src/webhooks/shopify.webhook';
import { Merchant, Order, Shipment, NdrCase } from '../src/models';
import { encryptionService } from '../src/services/encryption.service';
import { ndrService } from '../src/services/ndr.service';
import { addressCorrectionService } from '../src/services/address-correction.service';
import { rtoArrestService } from '../src/services/rto-arrest.service';
import { logisticsService } from '../src/services/logistics.service';
import { whatsAppService } from '../src/services/whatsapp.service';
import { whatsAppDispatcherService } from '../src/services/whatsapp/whatsapp-dispatcher.service';

// Mock dependencies
jest.mock('../src/models', () => ({
  Merchant: {
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  },
  Order: {
    create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), save: jest.fn() }),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    updateOne: jest.fn().mockResolvedValue({}),
  },
  Shipment: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  NdrCase: {
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    updateOne: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({}),
  },
  BillingEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
  AuditLog: {
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
  },
  WebhookEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
  MessageLog: {
    create: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn().mockResolvedValue(0),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
  },
  RescueLedger: {
    recordDecision: jest.fn().mockResolvedValue({}),
    reconcileOutcomes: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('../src/services/gemini.service', () => ({
  geminiService: {
    isConfigured: jest.fn().mockReturnValue(false),
    parseAddress: jest.fn().mockResolvedValue({
      cleanAddress: 'Flat 502, Tower B, Sunshine Residency',
      landmark: 'Near D-Mart',
      driverNote: 'Call on arrival',
      pincode: '400001',
      confidence: 0.95,
    }),
    ask: jest.fn(),
  },
}));

jest.mock('../src/services/geocoding.service', () => ({
  geocodingService: {
    reverseGeocode: jest.fn().mockResolvedValue('Flat 402, Sea Green Apt, Bandra, Mumbai 400050'),
  },
}));

jest.mock('../src/config/redis', () => ({
  redisConnection: {
    status: 'ready',
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job_test_123' }),
    getJob: jest.fn().mockResolvedValue(null),
  })),
}));

jest.mock('../src/utils/idempotency', () => ({
  IdempotencyGuard: {
    key: jest.fn().mockReturnValue('mock_idem_key'),
    claim: jest.fn().mockResolvedValue('acquired'),
    release: jest.fn().mockResolvedValue(undefined),
    markProcessed: jest.fn().mockResolvedValue(undefined),
  },
  IdempotencyUnavailableError: class IdempotencyUnavailableError extends Error {},
}));

jest.mock('../src/services/logistics.service', () => ({
  logisticsService: {
    rescheduleDelivery: jest.fn().mockResolvedValue({ success: true, message: 'Reattempt confirmed' }),
    updateDeliveryAddress: jest.fn().mockResolvedValue({ success: true }),
    updateAddress: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../src/services/whatsapp.service', () => ({
  whatsAppService: {
    sendInteractiveButtons: jest.fn().mockResolvedValue({ success: true, messageId: 'wa_123' }),
    sendTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'wa_tmpl_123' }),
  },
}));

describe('Universal Order Ingestion & NDR Metrics Hardening', () => {
  let app: express.Application;
  const rawWcSecret = 'wc_webhook_secret_universal_123';
  const rawShopifySecret = 'sh_webhook_secret_universal_456';
  const mockMerchantId = new Types.ObjectId('507f1f77bcf86cd799439011');

  const mockMerchant = {
    _id: mockMerchantId,
    name: 'Universal Brand India',
    platformConfig: {
      woocommerceWebhookSecret: encryptionService.encrypt(rawWcSecret),
      shopifyDomain: 'universal-brand.myshopify.com',
    },
    shopify: {
      shopDomain: 'universal-brand.myshopify.com',
      apiSecret: encryptionService.encrypt(rawShopifySecret),
    },
    settings: {
      estimatedRtoLossPerOrder: 140,
      ndrRescue: {
        messageLanguage: 'en',
        rtoArrestEnabled: true,
      },
    },
    billing: {
      currentMonthOrders: 10,
    },
  };

  beforeAll(() => {
    app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.use('/webhooks/woocommerce', woocommerceRouter);
    app.use('/webhooks/shopify', shopifyRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WooCommerce Universal Ingestion', () => {
    it('ingests prepaid WooCommerce order, normalizes phone, and increments usage', async () => {
      (Merchant.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockMerchant),
      });

      const orderPayload = {
        id: 99101,
        total: '1499.00',
        payment_method: 'bacs',
        payment_method_title: 'Direct Bank Transfer',
        billing: {
          first_name: 'Priya',
          last_name: 'Sharma',
          phone: '+91 98765 43210',
          city: 'Mumbai',
          state: 'MH',
          postcode: '400001',
          address_1: 'Flat 402, Sea Green Apt',
        },
        shipping: {
          first_name: 'Priya',
          last_name: 'Sharma',
          city: 'Mumbai',
          state: 'MH',
          postcode: '400001',
        },
        meta_data: [
          { key: '_tracking_number', value: 'DEL99887766' },
        ],
      };

      const rawBody = JSON.stringify(orderPayload);
      const signature = crypto.createHmac('sha256', rawWcSecret).update(rawBody).digest('base64');

      const mockQuarantinedShipment = {
        merchantId: mockMerchantId,
        awbNumber: 'DEL99887766',
        isQuarantined: true,
        quarantineReason: 'UNKNOWN_AWB',
        orderId: null,
        save: jest.fn().mockResolvedValue({}),
      };
      (Shipment.findOne as jest.Mock).mockResolvedValue(mockQuarantinedShipment);
      (Order.findOne as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(), externalOrderId: '99101' });

      const res = await request(app)
        .post('/webhooks/woocommerce')
        .query({ merchant_id: mockMerchantId.toString() })
        .set('X-WC-Webhook-Signature', signature)
        .send(orderPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('stored');

      // Verify Order creation with prepaid payment method and normalized Indian phone
      expect(Order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: mockMerchantId,
          externalOrderId: '99101',
          platform: 'woocommerce',
          paymentMethod: 'prepaid',
          customerPhone: '919876543210',
          orderValue: 1499,
          status: 'new',
        })
      );

      // Verify monthly billing usage incremented
      expect(Merchant.updateOne).toHaveBeenCalledWith(
        { _id: mockMerchantId },
        { $inc: { 'billing.currentMonthOrders': 1 } }
      );

      // Verify quarantined shipment was reconciled
      expect(mockQuarantinedShipment.isQuarantined).toBe(false);
      expect(mockQuarantinedShipment.save).toHaveBeenCalled();
    });
  });

  describe('Shopify Universal Ingestion', () => {
    it('ingests prepaid Shopify order, normalizes phone, and reconciles quarantined shipments', async () => {
      (Merchant.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockMerchant),
      });

      const orderPayload = {
        id: 882001,
        total_price: '2499.00',
        gateway: 'razorpay',
        customer: {
          first_name: 'Rahul',
          last_name: 'Verma',
          phone: '+91-99887-76655',
        },
        shipping_address: {
          phone: '+91-99887-76655',
          zip: '560001',
          city: 'Bengaluru',
          province: 'Karnataka',
        },
        fulfillments: [
          { tracking_number: 'BLUEDART_554433' },
        ],
      };

      const rawBody = JSON.stringify(orderPayload);
      const signature = crypto.createHmac('sha256', rawShopifySecret).update(rawBody).digest('base64');

      const mockQuarantinedShipment = {
        merchantId: mockMerchantId,
        awbNumber: 'BLUEDART_554433',
        isQuarantined: true,
        quarantineReason: 'UNKNOWN_AWB',
        orderId: null,
        save: jest.fn().mockResolvedValue({}),
      };
      (Shipment.findOne as jest.Mock).mockResolvedValue(mockQuarantinedShipment);

      const res = await request(app)
        .post('/webhooks/shopify')
        .set('X-Shopify-Hmac-Sha256', signature)
        .set('X-Shopify-Shop-Domain', 'universal-brand.myshopify.com')
        .set('X-Shopify-Topic', 'orders/create')
        .send(orderPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('stored');

      // Verify Order creation with prepaid and normalized phone
      expect(Order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: mockMerchantId,
          externalOrderId: '882001',
          platform: 'shopify',
          paymentMethod: 'prepaid',
          customerPhone: '919988776655',
          orderValue: 2499,
          status: 'new',
        })
      );

      // Verify quarantined shipment was reconciled
      expect(mockQuarantinedShipment.isQuarantined).toBe(false);
      expect(mockQuarantinedShipment.save).toHaveBeenCalled();
    });
  });

  describe('NDR Remark Sanitization for Prepaid Orders', () => {
    it('sanitizes COD collection remark to CUSTOMER_NOT_AVAILABLE when order is prepaid', async () => {
      const prepaidOrder = {
        _id: new Types.ObjectId(),
        externalOrderId: 'PREPAID_101',
        paymentMethod: 'prepaid',
        customerPhone: '9876543210',
        orderValue: 1200,
        status: 'shipped',
        ndr: { reason: 'Customer does not have cash / COD amount not ready' },
      };

      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (Order.findById as jest.Mock).mockResolvedValue(prepaidOrder);

      // Dispatch NDR rescue
      const result = await whatsAppDispatcherService.dispatchNdrRescue({
        merchantId: mockMerchantId.toString(),
        orderId: prepaidOrder._id.toString(),
        phone: prepaidOrder.customerPhone,
        category: 'COD_COLLECTION_ISSUE', // Courier falsely reported COD issue
        variables: {
          customerName: 'Customer',
          externalOrderId: 'PREPAID_101',
          codAmount: '1200',
        },
        order: prepaidOrder,
      });

      expect(result.success).toBe(true);
      // The dispatcher must map to reschedule delivery template (ndr_reschedule_en), NOT cod conversion (ndr_cod_convert_en)
      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        '919876543210',
        'ndr_reschedule_en',
        'en',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('NDR Metrics & Financial Attribution', () => {
    it('rescheduleDelivery updates order.rtoFeeSaved and sets NdrCase metrics', async () => {
      const order = {
        _id: new Types.ObjectId(),
        merchantId: mockMerchantId,
        carrier: 'delhivery',
        awb: 'DEL123456',
        status: 'ndr_detected',
        ndr: { reason: 'Customer not at home' },
        save: jest.fn().mockResolvedValue({}),
      };

      const res = await ndrService.rescheduleDelivery(order, mockMerchant, 'tomorrow', { suppressMessage: true });

      expect(res.success).toBe(true);
      expect(order.status).toBe('ndr_rescued');
      expect((order as any).rtoFeeSaved).toBe(140);

      expect(NdrCase.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: order._id, merchantId: mockMerchantId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'REATTEMPT_REQUESTED',
            resolutionType: 'rescheduled',
            rtoFeeSaved: 140,
            estimatedLossPrevented: 140,
          }),
        })
      );
    });

    it('handleLocationResponse sets rtoFeeSaved and updates NdrCase metrics', async () => {
      const order = {
        _id: new Types.ObjectId(),
        merchantId: mockMerchantId,
        customerPhone: '9876543210',
        carrier: 'delhivery',
        awb: 'DEL123456',
        status: 'ndr_rescue_sent',
        ndr: { addressMode: 'location_pin' },
        save: jest.fn().mockResolvedValue({}),
      };

      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (Order.findOne as jest.Mock).mockResolvedValue(order);

      const handled = await addressCorrectionService.handleLocationResponse(
        '9876543210',
        { latitude: 19.076, longitude: 72.8777 },
        order
      );

      expect(handled).toBe(true);
      expect(order.status).toBe('ndr_rescued');
      expect((order as any).rtoFeeSaved).toBe(140);

      expect(NdrCase.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: order._id, merchantId: mockMerchantId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'LOCATION_RECEIVED',
            customerResponseType: 'LOCATION_PIN',
            resolutionType: 'address_updated',
            rtoFeeSaved: 140,
            estimatedLossPrevented: 140,
          }),
        })
      );
    });

    it('handleTextAddressResponse sets rtoFeeSaved and updates NdrCase metrics', async () => {
      const order = {
        _id: new Types.ObjectId(),
        merchantId: mockMerchantId,
        customerPhone: '9876543210',
        carrier: 'delhivery',
        awb: 'DEL123456',
        status: 'ndr_rescue_sent',
        ndr: {
          addressUpdate: { collectionState: 'awaiting_text' },
        },
        save: jest.fn().mockResolvedValue({}),
      };

      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (Order.findOne as jest.Mock).mockResolvedValue(order);

      const handled = await addressCorrectionService.handleTextAddressResponse(
        '9876543210',
        'Flat 502, Tower B, Sunshine Residency, Near D-Mart, 400001',
        order
      );

      expect(handled).toBe(true);
      expect(order.status).toBe('ndr_rescued');
      expect((order as any).rtoFeeSaved).toBe(140);

      expect(NdrCase.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: order._id, merchantId: mockMerchantId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'ADDRESS_RECEIVED',
            customerResponseType: 'TEXT_ADDRESS',
            resolutionType: 'address_updated',
            rtoFeeSaved: 140,
            estimatedLossPrevented: 140,
          }),
        })
      );
    });

    it('rtoArrestService sets rtoFeeSaved and updates NdrCase metrics', async () => {
      const order = {
        _id: new Types.ObjectId(),
        merchantId: mockMerchantId,
        carrier: 'delhivery',
        awb: 'DEL_RTO_999',
        status: 'rto_initiated',
        save: jest.fn().mockResolvedValue({}),
      };

      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);
      (Order.findById as jest.Mock).mockResolvedValue(order);

      const result = await rtoArrestService.abortRtoAndReattempt({
        orderId: order._id.toString(),
      });

      expect(result.success).toBe(true);
      expect((order as any).rtoFeeSaved).toBe(140);

      expect(NdrCase.updateMany).toHaveBeenCalledWith(
        { orderId: order._id, status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'CUSTOMER_RESPONDED'] } },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'REATTEMPT_REQUESTED',
            resolutionType: 'rescheduled',
            rtoFeeSaved: 140,
            estimatedLossPrevented: 140,
          }),
        })
      );
    });
  });
});
