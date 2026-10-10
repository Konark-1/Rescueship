import axios from 'axios';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { cashfreeService } from '../src/services/cashfree.service';
import cashfreeWebhookRouter, { verifyCashfreeSignature } from '../src/webhooks/cashfree.webhook';
import { cooldownService } from '../src/services/cooldown.service';
import { addressCorrectionService } from '../src/services/address-correction.service';
import { geminiService } from '../src/services/gemini.service';
import { rtoArrestService } from '../src/services/rto-arrest.service';
import { whatsAppService } from '../src/services/whatsapp.service';
import { anonymizePiiRecords } from '../src/jobs/pii-anonymization.job';
import { Order, DeliveryAttempt, NdrCase, AuditLog, Merchant } from '../src/models';
import { config } from '../src/config/env';

jest.mock('axios');
jest.mock('../src/config/redis', () => ({
  redisConnection: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    status: 'ready',
    on: jest.fn(),
  },
}));
jest.mock('../src/utils/idempotency', () => ({
  IdempotencyGuard: {
    key: jest.fn().mockReturnValue('mock_idem_key'),
    claim: jest.fn().mockResolvedValue('acquired'),
    markProcessed: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  },
  IdempotencyUnavailableError: class extends Error {},
}));
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      run: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
    })),
  };
});
jest.mock('../src/services/whatsapp.service', () => ({
  whatsAppService: {
    sendTemplate: jest.fn().mockResolvedValue({ success: true }),
    sendInteractiveButtons: jest.fn().mockResolvedValue({ success: true }),
    sendText: jest.fn().mockResolvedValue({ success: true }),
  },
}));
jest.mock('../src/services/rto-arrest.service', () => ({
  rtoArrestService: {
    abortRtoAndReattempt: jest.fn().mockResolvedValue({ success: true }),
  },
}));

describe('STEP 1: Core Logic Hardening & Regulatory Safeguards', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }));
    app.use('/webhooks/cashfree', cashfreeWebhookRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 1.1: Cashfree Financial Parity (P0)
  // ──────────────────────────────────────────────────────────────────────────
  describe('TASK 1.1: Cashfree Financial Parity', () => {
    it('1.1.1 - cashfreeService.generateUpiIntent sends v2023 headers and saves payment_session_id', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(),
        externalOrderId: 'ORD_CF_101',
        customerPhone: '9876543210',
        orderValue: 1250,
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          order_id: 'ORD_CF_101',
          cf_order_id: 'cf_order_998877',
          payment_session_id: 'session_sec_live_abcdef123456',
          order_status: 'ACTIVE',
          order_amount: 1250,
          order_currency: 'INR',
        },
      });

      const findOneAndUpdateSpy = jest.spyOn(Order, 'findOneAndUpdate').mockResolvedValueOnce({
        ...mockOrder,
        payment_session_id: 'session_sec_live_abcdef123456',
        paymentSessionId: 'session_sec_live_abcdef123456',
        cashfreeOrderId: 'ORD_CF_101',
        paymentGateway: 'cashfree',
      } as any);

      const result = await cashfreeService.generateUpiIntent('ORD_CF_101', 1250, '+919876543210', {
        customerName: 'Rahul Sharma',
      });

      // Verify request headers strictly contain x-api-version and Authorization: Bearer <token>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/orders'),
        expect.objectContaining({
          order_id: 'ORD_CF_101',
          order_amount: 1250,
          customer_details: expect.objectContaining({
            customer_phone: '9876543210',
            customer_name: 'Rahul Sharma',
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-version': '2023-08-01',
            Authorization: expect.stringMatching(/^Bearer .+/),
          }),
        })
      );

      // Verify returned session id
      expect(result.paymentSessionId).toBe('session_sec_live_abcdef123456');

      // Verify Order model persistence
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([{ externalOrderId: 'ORD_CF_101' }]),
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            payment_session_id: 'session_sec_live_abcdef123456',
            cashfreeOrderId: 'ORD_CF_101',
            paymentGateway: 'cashfree',
          }),
        }),
        expect.any(Object)
      );
    });

    it('1.1.2 - verifyCashfreeSignature enforces HMAC SHA-256 validation', () => {
      const secret = 'cf_webhook_secret_key_xyz_789';
      const rawBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', order_id: 'ORD_CF_101' });
      const timestamp = String(Math.floor(Date.now() / 1000));
      
      // Correct timestamped signature (base64)
      const validSig = crypto.createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');
      expect(verifyCashfreeSignature(rawBody, validSig, secret, timestamp)).toBe(true);

      // Tampered body must fail
      const tamperedBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', order_id: 'ORD_CF_101', hacker: true });
      expect(verifyCashfreeSignature(tamperedBody, validSig, secret, timestamp)).toBe(false);

      // Forged signature must fail
      expect(verifyCashfreeSignature(rawBody, 'forged_invalid_signature', secret, timestamp)).toBe(false);
    });

    it('1.1.3 - Webhook rejects invalid Cashfree HMAC with 401', async () => {
      config.cashfree.clientSecret = 'cf_secret_prod_123';

      jest.spyOn(Order, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      const res = await request(app)
        .post('/webhooks/cashfree/payment')
        .set('x-webhook-signature', 'forged_sig')
        .set('x-webhook-timestamp', '1690000000')
        .send({ type: 'PAYMENT_SUCCESS_WEBHOOK', order_id: 'ORD_CF_101' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid Cashfree signature');
      expect(rtoArrestService.abortRtoAndReattempt).not.toHaveBeenCalled();
    });

    it('1.1.4 - Webhook updates Order to paid: true and triggers RTO transit reversal ONLY after paid: true', async () => {
      const secret = 'cf_secret_prod_123';
      config.cashfree.clientSecret = secret;

      const payload = {
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        data: {
          order: {
            order_id: 'ORD_CF_101',
            order_amount: 1250,
          },
          payment: {
            payment_status: 'SUCCESS',
            payment_amount: 1250,
            cf_payment_id: 'cf_pay_888999',
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const validSig = crypto.createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');

      const mockOrder = {
        _id: new Types.ObjectId(),
        cashfreeOrderId: 'ORD_CF_101',
        paid: true,
        paymentGateway: 'cashfree',
        status: 'rto_initiated',
        rtoArrestStatus: 'TRIGGERED',
      };

      jest.spyOn(Order, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      } as any);
      const updateSpy = jest.spyOn(Order, 'findOneAndUpdate').mockResolvedValue(mockOrder as any);

      const res = await request(app)
        .post('/webhooks/cashfree/payment')
        .set('x-webhook-signature', validSig)
        .set('x-webhook-timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.paid).toBe(true);

      // Proof of Order.findOneAndUpdate({ cashfreeOrderId }, { paid: true, paymentGateway: 'cashfree' })
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([{ cashfreeOrderId: 'ORD_CF_101' }]),
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            paid: true,
            paymentGateway: 'cashfree',
          }),
        }),
        { new: true }
      );

      // Proof that RTO reversal logic was triggered ONLY after paid: true confirmed
      expect(rtoArrestService.abortRtoAndReattempt).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: mockOrder._id.toString(),
          reason: expect.stringContaining('Payment confirmed via Cashfree webhook'),
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 1.2: Anti-Farming Serial Cancellation Cooldown (P0)
  // ──────────────────────────────────────────────────────────────────────────
  describe('TASK 1.2: Anti-Farming Serial Cancellation Cooldown', () => {
    it('1.2.1 - checkAntiFarmingCooldown returns false if count < 3 and true if count >= 3 in last 30 days', async () => {
      const merchantId = new Types.ObjectId().toString();
      const phone = '+919988776655';

      // Case 1: Count is 2 -> false
      jest.spyOn(Order, 'countDocuments').mockResolvedValueOnce(2);
      const allowed = await cooldownService.checkAntiFarmingCooldown(phone, merchantId);
      expect(allowed).toBe(false);
      expect(Order.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId,
          status: { $in: ['rto', 'cancelled', 'returned'] },
          createdAt: { $gte: expect.any(Date) },
        })
      );

      // Case 2: Count is 3 -> true (Triggered)
      jest.spyOn(Order, 'countDocuments').mockResolvedValueOnce(3);
      const blocked = await cooldownService.checkAntiFarmingCooldown(phone, merchantId);
      expect(blocked).toBe(true);
    });

    it('1.2.2 - ndrService bypasses 5% discount template and switches to ndr_reschedule_en when cooldown triggered', async () => {
      const merchantId = new Types.ObjectId();
      const mockMerchant = {
        _id: merchantId,
        settings: {
          ndrRescue: { messageLanguage: 'en' },
        },
      };

      const mockOrder = {
        _id: new Types.ObjectId(),
        merchantId,
        customerPhone: '+919988776655',
        orderValue: 1000,
        paymentMethod: 'cod',
        status: 'ndr_rescue_sent',
        externalOrderId: 'ORD_NDR_123',
        ndr: { reason: 'Customer requested COD discount repeatedly' },
      };

      jest.spyOn(Merchant, 'findById').mockResolvedValue(mockMerchant as any);
      const { MessageLog, BillingEvent } = require('../src/models');
      jest.spyOn(MessageLog, 'countDocuments').mockResolvedValue(0 as any);
      jest.spyOn(MessageLog, 'create').mockResolvedValue({} as any);
      jest.spyOn(BillingEvent, 'create').mockResolvedValue({} as any);
      (whatsAppService.sendTemplate as jest.Mock).mockResolvedValue({
        messages: [{ id: 'wamid_test_12345' }],
      });

      // Mock cooldownService returning true (>= 3 cancellations)
      jest.spyOn(cooldownService, 'checkAntiFarmingCooldown').mockResolvedValue(true);

      const { whatsAppDispatcherService } = require('../src/services/whatsapp/whatsapp-dispatcher.service');
      const dispatchResult = await whatsAppDispatcherService.dispatchNdrRescue({
        merchantId: merchantId.toString(),
        orderId: mockOrder._id.toString(),
        phone: mockOrder.customerPhone,
        category: 'COD_COLLECTION_ISSUE', // Would normally map to ndr_cod_convert_en (5% discount)
        variables: {
          customerName: 'Serial Buyer',
          externalOrderId: 'ORD_NDR_123',
          codAmount: '1000',
        },
        order: mockOrder,
        creditPreDeducted: true,
      });

      expect(dispatchResult.success).toBe(true);

      // Verify that ndr_reschedule_en is dispatched INSTEAD of ndr_cod_convert_en!
      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        '919988776655',
        'ndr_reschedule_en',
        'en',
        expect.any(Array),
        expect.any(Object)
      );
      expect(whatsAppService.sendTemplate).not.toHaveBeenCalledWith(
        expect.any(String),
        'ndr_cod_convert_en',
        expect.any(String),
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 1.3: Nominatim IP Throttling & Gemini Fallback (P1)
  // ──────────────────────────────────────────────────────────────────────────
  describe('TASK 1.3: Nominatim IP Throttling & Gemini Fallback', () => {
    it('1.3.1 - Returns Nominatim address when reverse geocode resolves quickly', async () => {
      jest.spyOn(addressCorrectionService, 'fetchNominatim').mockResolvedValueOnce(
        'Flat 402, Sunshine Heights, Powai, Mumbai, 400076'
      );

      const address = await addressCorrectionService.reverseGeocodeWithFallback(
        19.1176,
        72.9060,
        'Near Hiranandani Hospital'
      );

      expect(address).toBe('Flat 402, Sunshine Heights, Powai, Mumbai, 400076');
    });

    it('1.3.2 - Catches Nominatim timeout (> 2000ms) or rate-limit error and falls back to Gemini NLP', async () => {
      // Simulate Nominatim hanging or being rate-limited past 2000ms
      jest.spyOn(addressCorrectionService, 'fetchNominatim').mockImplementationOnce(() => {
        return new Promise((resolve) => setTimeout(() => resolve('Delayed Nominatim response'), 3000));
      });

      const geminiSpy = jest.spyOn(geminiService, 'extractLandmarksFromText').mockResolvedValueOnce(
        'Tower B, Flat 301, Near Metro Pillar 124, Andheri West'
      );

      const address = await addressCorrectionService.reverseGeocodeWithFallback(
        19.1136,
        72.8697,
        'B-301 metro pillar 124 ke samne deliver karna'
      );

      // Verify Gemini fallback was triggered
      expect(geminiSpy).toHaveBeenCalledWith('B-301 metro pillar 124 ke samne deliver karna');
      expect(address).toBe('Tower B, Flat 301, Near Metro Pillar 124, Andheri West');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 1.4: DPDP Act 2023 Automated PII Anonymization (P1)
  // ──────────────────────────────────────────────────────────────────────────
  describe('TASK 1.4: DPDP Act 2023 Automated PII Anonymization', () => {
    it('1.4.1 - Executes bulkWrite to redact customer PII on orders older than 180 days and scrubs AuditLog metadata', async () => {
      const oldOrderId = new Types.ObjectId();
      const oldAttemptId = new Types.ObjectId();
      const oldNdrId = new Types.ObjectId();
      const oldAuditId = new Types.ObjectId();

      // Mock finding records older than 180 days
      jest.spyOn(Order, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ _id: oldOrderId }]),
          }),
        }),
      } as any);

      jest.spyOn(DeliveryAttempt, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ _id: oldAttemptId }]),
          }),
        }),
      } as any);

      jest.spyOn(NdrCase, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ _id: oldNdrId }]),
          }),
        }),
      } as any);

      jest.spyOn(AuditLog, 'find').mockReturnValueOnce({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: oldAuditId,
              metadata: { customerPhone: '9876543210', note: 'Customer called' },
              payload: { recipient: '9876543210' },
            },
          ]),
        }),
      } as any);

      const orderBulkWritespy = jest.spyOn(Order, 'bulkWrite').mockResolvedValueOnce({ modifiedCount: 1 } as any);
      const attemptBulkWritespy = jest.spyOn(DeliveryAttempt, 'bulkWrite').mockResolvedValueOnce({ modifiedCount: 1 } as any);
      const ndrBulkWritespy = jest.spyOn(NdrCase, 'bulkWrite').mockResolvedValueOnce({ modifiedCount: 1 } as any);
      const auditBulkWritespy = jest.spyOn(AuditLog.collection, 'bulkWrite').mockResolvedValueOnce({ modifiedCount: 1 } as any);

      const stats = await anonymizePiiRecords(180);

      // Verify bulkWrite operations for Order
      expect(orderBulkWritespy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              filter: { _id: oldOrderId },
              update: {
                $set: expect.objectContaining({
                  'customer.phone': 'REDACTED',
                  'customer.name': 'REDACTED',
                  'customer.address': 'REDACTED',
                  customerPhone: 'REDACTED',
                  customerName: 'REDACTED',
                  shippingAddress: 'REDACTED',
                  piiAnonymized: true,
                }),
              },
            }),
          }),
        ])
      );

      // Verify bulkWrite operations for DeliveryAttempt
      expect(attemptBulkWritespy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              filter: { _id: oldAttemptId },
              update: {
                $set: expect.objectContaining({
                  'customer.phone': 'REDACTED',
                  'customer.name': 'REDACTED',
                  'customer.address': 'REDACTED',
                  rawWebhook: {},
                  piiAnonymized: true,
                }),
              },
            }),
          }),
        ])
      );

      // Verify bulkWrite operations for NdrCase
      expect(ndrBulkWritespy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              filter: { _id: oldNdrId },
              update: {
                $set: expect.objectContaining({
                  'customer.phone': 'REDACTED',
                  customerPhone: 'REDACTED',
                  piiAnonymized: true,
                }),
              },
            }),
          }),
        ])
      );

      // Verify AuditLog metadata scrubbing
      expect(auditBulkWritespy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              filter: { _id: oldAuditId },
              update: {
                $set: expect.objectContaining({
                  metadata: expect.objectContaining({
                    customerPhone: 'REDACTED',
                  }),
                  payload: expect.objectContaining({
                    recipient: 'REDACTED',
                  }),
                  piiAnonymized: true,
                }),
              },
            }),
          }),
        ])
      );

      expect(stats.ordersAnonymized).toBe(1);
      expect(stats.attemptsAnonymized).toBe(1);
      expect(stats.ndrCasesAnonymized).toBe(1);
      expect(stats.auditLogsScrubbed).toBe(1);
    });
  });
});
