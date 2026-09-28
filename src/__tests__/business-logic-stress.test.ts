import { Types } from 'mongoose';
import { Order, Merchant, NdrCase, AuditLog } from '../models';
import { orderService } from '../services/order.service';
import { logisticsService } from '../services/logistics.service';
import { whatsAppService } from '../services/whatsapp.service';
import { paymentService } from '../services/payment.service';
import { ndrService } from '../services/ndr.service';
import { whatsAppDispatcherService } from '../services/whatsapp/whatsapp-dispatcher.service';

// Mock dependencies
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
}));

// In-Memory Database Store for Deterministic Unit/Stress Testing
const ordersStore = new Map<string, any>();
const merchantsStore = new Map<string, any>();
const ndrCasesStore: any[] = [];
const auditLogsStore: any[] = [];

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

jest.mock('../models', () => {
  const original = jest.requireActual('../models');
  return {
    ...original,
    Order: {
      deleteMany: jest.fn().mockImplementation(async () => {
        ordersStore.clear();
        return { deletedCount: 0 };
      }),
      create: jest.fn().mockImplementation(async (data: any) => {
        const id = (data._id || new Types.ObjectId()).toString();
        const doc: any = {
          ...data,
          _id: id,
          save: jest.fn().mockImplementation(async function(this: any) {
            ordersStore.set(id, this);
            return this;
          }),
        };
        ordersStore.set(id, doc);
        return doc;
      }),
      findOne: jest.fn().mockImplementation(async (query: any) => {
        for (const order of ordersStore.values()) {
          let match = true;
          if (query._id && order._id?.toString() !== query._id?.toString()) match = false;
          if (query.paymentLinkId && order.paymentLinkId !== query.paymentLinkId) match = false;
          if (query.externalOrderId && order.externalOrderId !== query.externalOrderId) match = false;
          if (query.awb && order.awb !== query.awb) match = false;
          if (query.merchantId && order.merchantId?.toString() !== query.merchantId?.toString()) match = false;
          if (query.$or) {
            const orMatch = query.$or.some((sub: any) => {
              if (sub.awb && order.awb === sub.awb) return true;
              if (sub.externalOrderId && order.externalOrderId === sub.externalOrderId) return true;
              return false;
            });
            if (!orMatch) match = false;
          }
          if (match) return order;
        }
        return null;
      }),
      findById: jest.fn().mockImplementation(async (id: any) => {
        return ordersStore.get(id?.toString()) || null;
      }),
      findOneAndUpdate: jest.fn().mockImplementation(async (query: any, update: any, options: any) => {
        const targetId = query._id?.toString();
        const order = ordersStore.get(targetId);
        if (!order) return null;

        // Check status conditions
        if (query.status) {
          if (query.status.$in && !query.status.$in.includes(order.status)) {
            return null;
          }
          if (query.status.$nin && query.status.$nin.includes(order.status)) {
            return null;
          }
        }

        // Apply $set updates
        if (update.$set) {
          Object.assign(order, update.$set);
          if (update.$set['ndr.resolvedAt'] || update.$set.rtoFeeSaved) {
            order.ndr = order.ndr || {};
            if (update.$set.rtoFeeSaved) order.rtoFeeSaved = update.$set.rtoFeeSaved;
            if (update.$set['ndr.resolvedAt']) order.ndr.resolvedAt = update.$set['ndr.resolvedAt'];
            if (update.$set['ndr.resolution']) order.ndr.resolution = update.$set['ndr.resolution'];
            if (update.$set['ndr.customerResponse']) order.ndr.customerResponse = update.$set['ndr.customerResponse'];
          }
        }
        ordersStore.set(targetId, order);
        return options?.new ? order : order;
      }),
      findByIdAndUpdate: jest.fn().mockImplementation(async (id: any, update: any) => {
        const order = ordersStore.get(id?.toString());
        if (order && update.$set) {
          Object.assign(order, update.$set);
        }
        return order;
      }),
      updateOne: jest.fn().mockImplementation(async (query: any, update: any) => {
        const order = ordersStore.get(query._id?.toString());
        if (order && update.$set) {
          Object.assign(order, update.$set);
        }
        return { modifiedCount: 1 };
      }),
      deleteOne: jest.fn().mockImplementation(async (query: any) => {
        const targetId = query._id?.toString();
        ordersStore.delete(targetId);
        return { deletedCount: 1 };
      }),
    },
    Merchant: {
      deleteMany: jest.fn().mockImplementation(async () => {
        merchantsStore.clear();
        return { deletedCount: 0 };
      }),
      create: jest.fn().mockImplementation(async (data: any) => {
        const id = (data._id || new Types.ObjectId()).toString();
        const doc = { ...data, _id: id };
        merchantsStore.set(id, doc);
        return doc;
      }),
      findById: jest.fn().mockImplementation((id: any) => {
        const merchant = merchantsStore.get(id?.toString()) || null;
        // Support chained .select(...)
        const queryResult: any = Promise.resolve(merchant);
        queryResult.select = jest.fn().mockResolvedValue(merchant);
        return queryResult;
      }),
      findOneAndUpdate: jest.fn().mockImplementation(async (query: any, update: any) => {
        const merchant = merchantsStore.get(query._id?.toString());
        if (!merchant) return null;
        if (query['billing.rescueCredits']?.$gt !== undefined) {
          if (merchant.billing.rescueCredits <= query['billing.rescueCredits'].$gt) {
            return null;
          }
        }
        if (update.$inc) {
          for (const key of Object.keys(update.$inc)) {
            if (key === 'billing.rescueCredits') {
              merchant.billing.rescueCredits += update.$inc[key];
            }
          }
        }
        return merchant;
      }),
      updateOne: jest.fn().mockImplementation(async (query: any, update: any) => {
        const merchant = merchantsStore.get(query._id?.toString());
        if (merchant && update.$inc) {
          for (const key of Object.keys(update.$inc)) {
            if (key === 'billing.rescueCredits') {
              merchant.billing.rescueCredits = (merchant.billing.rescueCredits || 0) + update.$inc[key];
            }
          }
        }
        return { modifiedCount: 1 };
      }),
      findByIdAndUpdate: jest.fn().mockImplementation(async (id: any, update: any) => {
        const merchant = merchantsStore.get(id?.toString());
        if (merchant && update.$inc) {
          for (const key of Object.keys(update.$inc)) {
            if (key === 'billing.totalConversions') {
              merchant.billing.totalConversions = (merchant.billing.totalConversions || 0) + update.$inc[key];
            }
          }
        }
        return merchant;
      }),
    },
    NdrCase: {
      deleteMany: jest.fn().mockImplementation(async () => {
        ndrCasesStore.length = 0;
        return { deletedCount: 0 };
      }),
      create: jest.fn().mockImplementation(async (data: any) => {
        const existing = ndrCasesStore.find((c) => c.orderId?.toString() === data.orderId?.toString());
        if (existing) {
          const err: any = new Error('E11000 duplicate key error');
          err.code = 11000;
          throw err;
        }
        const doc = { ...data, _id: new Types.ObjectId().toString(), createdAt: new Date() };
        ndrCasesStore.push(doc);
        return doc;
      }),
      updateOne: jest.fn().mockImplementation(async (query: any, update: any) => {
        const existing = ndrCasesStore.find((c) => c.orderId?.toString() === query.orderId?.toString());
        if (existing && update.$set) {
          Object.assign(existing, update.$set);
        }
        return { modifiedCount: 1 };
      }),
      findOneAndUpdate: jest.fn().mockImplementation(async (query: any, update: any, options: any) => {
        const existing = ndrCasesStore.find((c) =>
          c.orderId?.toString() === query.orderId?.toString()
        );
        if (existing) {
          if (update.$set) Object.assign(existing, update.$set);
          return existing;
        }
        if (options?.upsert) {
          const doc: any = {
            orderId: query.orderId,
            merchantId: query.merchantId,
            ...(update.$setOnInsert || {}),
            ...(update.$set || {}),
            _id: new Types.ObjectId().toString(),
            createdAt: new Date(),
          };
          ndrCasesStore.push(doc);
          return doc;
        }
        return null;
      }),
      find: jest.fn().mockImplementation(async (query: any) => {
        return ndrCasesStore.filter((c) => {
          if (query.orderId && c.orderId?.toString() !== query.orderId?.toString()) return false;
          return true;
        });
      }),
      findOne: jest.fn().mockImplementation(async (query: any) => {
        return ndrCasesStore.find((c) => {
          if (query.orderId && c.orderId?.toString() !== query.orderId?.toString()) return false;
          return true;
        }) || null;
      }),
      updateMany: jest.fn().mockImplementation(async (query: any, update: any) => {
        const matches = ndrCasesStore.filter((c) => {
          if (query.orderId && c.orderId?.toString() !== query.orderId?.toString()) return false;
          return true;
        });
        matches.forEach((c) => {
          if (update.$set) Object.assign(c, update.$set);
        });
        return { modifiedCount: matches.length };
      }),
    },
    AuditLog: {
      create: jest.fn().mockImplementation(async (data: any) => {
        const log = { ...data, _id: new Types.ObjectId().toString(), createdAt: new Date() };
        auditLogsStore.push(log);
        return log;
      }),
      findOne: jest.fn().mockImplementation(async (query: any) => {
        return auditLogsStore.find((l) => {
          if (query.action && l.action !== query.action) return false;
          if (query.orderId && l.orderId?.toString() !== query.orderId?.toString()) return false;
          return true;
        }) || null;
      }),
      find: jest.fn().mockImplementation(async () => auditLogsStore),
    },
    BillingEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    RescueLedger: {
      recordDecision: jest.fn().mockResolvedValue({}),
      reconcileOutcomes: jest.fn().mockResolvedValue(0),
    },
    Shipment: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({}),
    },
  };
});

describe('Phase 3: Business Logic & Edge Case Stress Tests', () => {
  const merchantId = new Types.ObjectId();
  const orderId = new Types.ObjectId();
  const awb = 'SR123456789';

  beforeEach(async () => {
    jest.clearAllMocks();
    ordersStore.clear();
    merchantsStore.clear();
    ndrCasesStore.length = 0;
    auditLogsStore.length = 0;
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Split-Second RTO vs. Payment Collision
  // ─────────────────────────────────────────────────────────────
  it('Test 1: Aborts RTO and rescues order when payment arrives after RTO initiation', async () => {
    await Merchant.create({
      _id: merchantId,
      billing: { rescueCredits: 10 },
      carrierConfig: { provider: 'shiprocket', apiKey: 'plain_key' },
    });

    await Order.create({
      _id: orderId,
      merchantId,
      externalOrderId: 'ORD-1',
      customerPhone: '+919999999999',
      orderValue: 1000,
      paymentMethod: 'cod',
      status: 'rto',
      awb,
      carrier: 'shiprocket',
      paymentLinkId: 'plink_123',
    });

    const mockReschedule = jest.spyOn(logisticsService, 'rescheduleDelivery').mockResolvedValue({ success: true, message: 'Reattempt scheduled' });

    // Simulate payment captured webhook arriving while in RTO state
    await orderService.handlePaymentSuccess('plink_123', 100000);

    const updated = await Order.findById(orderId);
    expect(updated?.status).toBe('ndr_rescued');
    expect(updated?.paymentMethod).toBe('prepaid');
    expect(mockReschedule).toHaveBeenCalledWith(
      'shiprocket',
      expect.objectContaining({ awb, reason: expect.stringContaining('RTO aborted') }),
      expect.any(Object)
    );

    const abortLog = await AuditLog.findOne({ action: 'rto_aborted_via_payment' });
    expect(abortLog).not.toBeNull();
    expect(abortLog?.payload?.previousStatus).toBe('rto');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Negative Paise Trap
  // ─────────────────────────────────────────────────────────────
  it('Test 2: Aborts COD conversion and refunds credit if discount >= order value', async () => {
    await Merchant.create({
      _id: merchantId,
      billing: { rescueCredits: 5 },
      settings: { codConversion: { enabled: true, incentiveType: 'flat', incentiveAmount: 100 } },
      paymentConfig: { provider: 'razorpay', keyId: 'plain_key', keySecret: 'plain_sec' },
    });

    const createPaymentLinkSpy = jest.spyOn(paymentService, 'createPaymentLink').mockResolvedValue({
      linkId: 'plink_test',
      shortUrl: 'https://pay.rs/1',
      provider: 'razorpay',
    });

    // Process an ₹80 order with a ₹100 flat discount
    await orderService.processCODOrder(merchantId.toString(), {
      externalOrderId: 'ORD-2',
      platform: 'shopify',
      customerPhone: '+918888888888',
      orderValue: 80,
      paymentMethod: 'cod',
    });

    // Assert payment gateway was NEVER called
    expect(createPaymentLinkSpy).not.toHaveBeenCalled();

    // Assert credit was refunded (started at 5, deducted 1, refunded 1 = 5)
    const merchant = await Merchant.findById(merchantId);
    expect(merchant?.billing.rescueCredits).toBe(5);

    // Assert provisional order was deleted
    const order = await Order.findOne({ externalOrderId: 'ORD-2' });
    expect(order).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Zombie Credit Rollback Resilience
  // ─────────────────────────────────────────────────────────────
  it('Test 3: Logs orphaned credit when DB fails during refund rollback', async () => {
    await Merchant.create({
      _id: merchantId,
      billing: { rescueCredits: 5 },
      settings: { codConversion: { enabled: true, incentiveType: 'flat', incentiveAmount: 20 } },
      paymentConfig: { provider: 'razorpay', keyId: 'plain_key', keySecret: 'plain_sec' },
      whatsappConfig: { accessToken: 'plain_wa_token' },
    });

    jest.spyOn(paymentService, 'createPaymentLink').mockResolvedValue({
      linkId: 'plink_test_3',
      shortUrl: 'https://pay.rs/3',
      provider: 'razorpay',
    });

    // Mock WhatsApp send to fail (triggers error catch block)
    jest.spyOn(whatsAppService, 'sendTemplate').mockRejectedValue(new Error('Meta 500 Error'));

    // Mock Merchant.updateOne to fail during rollback attempts
    const updateSpy = jest.spyOn(Merchant, 'updateOne').mockRejectedValue(new Error('Mongo Timeout'));

    await expect(
      orderService.processCODOrder(merchantId.toString(), {
        externalOrderId: 'ORD-3',
        platform: 'shopify',
        customerPhone: '+917777777777',
        orderValue: 500,
        paymentMethod: 'cod',
      })
    ).rejects.toThrow();

    // Assert fallback AuditLog was created for reconciliation
    const orphanLog = await AuditLog.findOne({ action: 'orphaned_credit_refund_required' });
    expect(orphanLog).not.toBeNull();
    expect(orphanLog?.payload?.creditsLost).toBe(1);

    updateSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Carrier NDR Idempotency Guard
  // ─────────────────────────────────────────────────────────────
  it('Test 4: Prevents duplicate NdrCase creation on simultaneous webhooks', async () => {
    await Merchant.create({
      _id: merchantId,
      billing: { rescueCredits: 10 },
      platform: 'shopify',
      settings: { ndrRescue: { enabled: true } },
    });

    await Order.create({
      _id: orderId,
      merchantId,
      externalOrderId: 'ORD-4',
      customerPhone: '+916666666666',
      orderValue: 1000,
      paymentMethod: 'cod',
      status: 'shipped',
      awb,
    });

    jest.spyOn(whatsAppDispatcherService, 'dispatchNdrRescue').mockResolvedValue({
      success: true,
      messageId: 'wa_dispatch_123',
    });

    const ndrData = {
      awb,
      externalOrderId: 'ORD-4',
      reason: 'Customer not available',
      phone: '+916666666666',
      carrier: 'shiprocket' as const,
    };

    // Fire 5 concurrent webhooks
    await Promise.all([
      ndrService.processNDREvent(merchantId.toString(), ndrData),
      ndrService.processNDREvent(merchantId.toString(), ndrData),
      ndrService.processNDREvent(merchantId.toString(), ndrData),
      ndrService.processNDREvent(merchantId.toString(), ndrData),
      ndrService.processNDREvent(merchantId.toString(), ndrData),
    ]);

    // Assert exactly 1 NdrCase was created
    const cases = await NdrCase.find({ orderId });
    expect(cases.length).toBe(1);

    // Assert order only transitioned once
    const order = await Order.findById(orderId);
    expect(order?.ndr?.rescueMessagesSent).toBe(1);
    expect(order?.status).toBe('ndr_rescue_sent');
  });
});
