import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { SuppressedPhone, Order, AuditLog, MessageLog, WebhookEvent, Merchant, NdrCase } from '../src/models';
import { whatsAppService } from '../src/services/whatsapp.service';
import dashboardRouter from '../src/api/dashboard.api';
import ordersRouter from '../src/api/orders.api';
import paymentRouter from '../src/webhooks/payment.webhook';
import whatsappRouter from '../src/webhooks/whatsapp.webhook';
import { SecurityAlertService } from '../src/services/security-alert.service';
import { checkDeadLetterQueue, checkWabaQuality, checkWebhookFailureRate } from '../src/services/liveops-watchtower.service';
import { generateToken } from '../src/middleware/auth';
import { config } from '../src/config/env';

describe('Suppression & LiveOps Watchtower Unit & Integration Tests', () => {
  const merchantId = new Types.ObjectId().toString();
  const testPhone = '919876543210';
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
    authToken = generateToken(merchantId);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Merchant, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: merchantId, tokenVersion: 1 }),
    } as any);
    jest.spyOn(NdrCase, 'findOne').mockResolvedValue(null as any);
  });

  describe('1. SuppressedPhone Model Schema & Normalization', () => {
    it('should have required schema paths with normalization setter and defaults', () => {
      const paths = (SuppressedPhone.schema as any).paths;

      expect(paths.phone).toBeDefined();
      expect(paths.phone.isRequired).toBe(true);

      // Verify phone normalization setter
      const setter = paths.phone.options.set;
      expect(typeof setter).toBe('function');
      expect(setter('+91-98765-43210')).toBe('919876543210');
      expect(setter('09876543210')).toBe('919876543210');

      // Verify reason default
      expect(paths.reason.defaultValue).toBe('customer_opt_out');

      // Verify suppressedAt default
      expect(paths.suppressedAt.defaultValue).toBeDefined();
    });
  });

  describe('2. WhatsApp Service Message Suppression Checks', () => {
    it('should abort sendText when phone is suppressed', async () => {
      jest.spyOn(SuppressedPhone, 'exists').mockResolvedValueOnce({ _id: new Types.ObjectId() } as any);

      const result = await whatsAppService.sendText(testPhone, 'Hello test');
      expect(result.suppressed).toBe(true);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('customer_opted_out');
    });

    it('should abort sendTextMessage when phone is suppressed', async () => {
      jest.spyOn(SuppressedPhone, 'exists').mockResolvedValueOnce({ _id: new Types.ObjectId() } as any);

      const result = await whatsAppService.sendTextMessage(testPhone, 'Hello test');
      expect(result.suppressed).toBe(true);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('customer_opted_out');
    });

    it('should abort sendInteractiveButtons when phone is suppressed', async () => {
      jest.spyOn(SuppressedPhone, 'exists').mockResolvedValueOnce({ _id: new Types.ObjectId() } as any);

      const result = await whatsAppService.sendInteractiveButtons(testPhone, 'Choose option', [
        { id: 'btn_1', title: 'Yes' },
      ]);
      expect(result.suppressed).toBe(true);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('customer_opted_out');
    });

    it('should abort sendTemplate / sendTemplateMessage when phone is suppressed', async () => {
      jest.spyOn(SuppressedPhone, 'exists').mockResolvedValueOnce({ _id: new Types.ObjectId() } as any);

      const result = await whatsAppService.sendTemplateMessage(testPhone, 'order_update', 'en', []);
      expect(result.suppressed).toBe(true);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('customer_opted_out');
    });
  });

  describe('3. WhatsApp Inbound Webhook Customer Opt-Out', () => {
    it('should upsert customer phone into SuppressedPhone on opt-out keyword', async () => {
      const optOutPhone = '919876543210';
      const appSecret = 'test_wa_secret_optout';
      (config.whatsapp as any).appSecret = appSecret;

      const mockMerchant = {
        _id: new Types.ObjectId(merchantId),
        whatsappConfig: { phoneNumberId: 'phone_num_123' },
      };

      jest.spyOn(Merchant, 'findOne').mockResolvedValueOnce(mockMerchant as any);
      jest.spyOn(MessageLog, 'findOne').mockResolvedValueOnce(null);
      const findOneAndUpdateSpy = jest
        .spyOn(SuppressedPhone, 'findOneAndUpdate')
        .mockResolvedValueOnce({ phone: optOutPhone, reason: 'customer_opt_out' } as any);
      jest.spyOn(MessageLog, 'create').mockResolvedValueOnce({} as any);

      const app = express();
      app.use((req, res, next) => {
        express.json({
          verify: (req: any, _res, buf) => {
            req.rawBody = buf;
          },
        })(req, res, next);
      });
      app.use('/webhooks/whatsapp', whatsappRouter);

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone_num_123',
                  },
                  messages: [
                    {
                      from: optOutPhone,
                      id: `wamid_opt_${Date.now()}`,
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Please STOP messaging me!' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const bodyStr = JSON.stringify(payload);
      const hash = crypto.createHmac('sha256', appSecret).update(bodyStr).digest('hex');

      const res = await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', `sha256=${hash}`)
        .send(payload);

      expect(res.status).toBe(200);

      // Verify opt-out was captured
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { phone: optOutPhone },
        expect.objectContaining({
          phone: optOutPhone,
          merchantId: mockMerchant._id,
          reason: 'customer_opt_out',
        }),
        { upsert: true, new: true }
      );
    });
  });

  describe('4. Orders API GET /:id returns order, auditLogs, and messages', () => {
    it('should return { order, auditLogs, messages }', async () => {
      const orderObjectId = new Types.ObjectId();
      const mockOrder = {
        _id: orderObjectId,
        merchantId,
        externalOrderId: 'ORD-101',
        customerPhone: testPhone,
        status: 'ndr_detected',
        orderValue: 999,
      };

      const mockAuditLogs = [
        { _id: new Types.ObjectId(), action: 'ndr_detected', timestamp: new Date() },
      ];

      const mockMessages = [
        { _id: new Types.ObjectId(), body: 'Outbound alert', direction: 'OUTBOUND', createdAt: new Date() },
      ];

      jest.spyOn(Order, 'findOne').mockResolvedValueOnce(mockOrder as any);
      jest.spyOn(AuditLog, 'find').mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(mockAuditLogs),
      } as any);
      jest.spyOn(MessageLog, 'find').mockReturnValueOnce({
        sort: jest.fn().mockResolvedValueOnce(mockMessages),
      } as any);

      const app = express();
      app.use('/api/orders', ordersRouter);

      const res = await request(app)
        .get(`/api/orders/${orderObjectId.toString()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order).toBeDefined();
      expect(res.body.auditLogs).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'ndr_detected' })]));
      expect(res.body.messages).toEqual(expect.arrayContaining([expect.objectContaining({ body: 'Outbound alert' })]));
    });
  });

  describe('5. Dashboard API GET /summary', () => {
    it('should compute and return totalSaved, rescuedCount, conversionCount, rtoArrestCount, and ordersNeedingAttention', async () => {
      jest
        .spyOn(Order, 'countDocuments')
        .mockResolvedValueOnce(4) // rescuedCount
        .mockResolvedValueOnce(2) // conversionCount
        .mockResolvedValueOnce(3); // rtoArrestCount

      jest.spyOn(Order, 'aggregate').mockResolvedValueOnce([{ total: 1000 }]); // sum of rtoFeeSaved
      jest.spyOn(Order, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockResolvedValueOnce([
            { _id: new Types.ObjectId(), status: 'ndr_detected', externalOrderId: 'ORD-ATTN-1' },
          ]),
        }),
      } as any);

      const app = express();
      app.use('/api/dashboard', dashboardRouter);

      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rescuedCount).toBe(4);
      expect(res.body.conversionCount).toBe(2);
      expect(res.body.rtoArrestCount).toBe(3);
      expect(res.body.totalSaved).toBe(1000);
      expect(res.body.ordersNeedingAttention).toHaveLength(1);
    });

    it('should compute formula fallback for totalSaved when rtoFeeSaved sum is 0', async () => {
      jest
        .spyOn(Order, 'countDocuments')
        .mockResolvedValueOnce(2) // rescuedCount
        .mockResolvedValueOnce(3) // conversionCount
        .mockResolvedValueOnce(1); // rtoArrestCount

      jest.spyOn(Order, 'aggregate').mockResolvedValueOnce([]); // no rtoFeeSaved sum for month
      jest.spyOn(Order, 'aggregate').mockResolvedValueOnce([]); // no rtoFeeSaved all-time
      jest.spyOn(Order, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockResolvedValueOnce([]),
        }),
      } as any);

      const app = express();
      app.use('/api/dashboard', dashboardRouter);

      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // formula: rescuedCount * 250 + rtoArrestCount * 250 + conversionCount * 50
      // 2 * 250 + 1 * 250 + 3 * 50 = 500 + 250 + 150 = 900
      expect(res.body.totalSaved).toBe(900);
    });
  });

  describe('6. Payment Webhook HMAC Signature Failure Alert', () => {
    it('should trigger SecurityAlertService.sendCriticalAlert on invalid HMAC signature', async () => {
      const alertSpy = jest.spyOn(SecurityAlertService, 'sendCriticalAlert').mockResolvedValue();

      const app = express();
      app.use(express.json());
      app.use('/webhooks/payment', paymentRouter);

      const res = await request(app)
        .post('/webhooks/payment')
        .set('X-Razorpay-Signature', 'invalid_signature_hex')
        .send({ event: 'payment.captured' });

      expect(res.status).toBe(401);
      expect(alertSpy).toHaveBeenCalledWith(
        'INVALID_PAYMENT_HMAC_SIGNATURE',
        expect.objectContaining({ hasRazorpaySig: true })
      );

      alertSpy.mockRestore();
    });
  });

  describe('7. LiveOps Watchtower Functions', () => {
    it('checkDeadLetterQueue should return diagnostics structure', async () => {
      const result = await checkDeadLetterQueue();
      expect(result).toBeDefined();
      expect(result.deadLetterQueue).toBeDefined();
      expect(typeof result.deadLetterQueue.total).toBe('number');
      expect(['healthy', 'degraded', 'critical']).toContain(result.status);
    });

    it('checkWabaQuality should handle simulated or unknown tokens gracefully', async () => {
      const result = await checkWabaQuality('waba_test_123');
      expect(result.wabaId).toBe('waba_test_123');
      expect(result.qualityRating).toBeDefined();
      expect(['GREEN', 'YELLOW', 'RED', 'UNKNOWN']).toContain(result.qualityRating);
    });

    it('checkWebhookFailureRate should query WebhookEvent and compute rate', async () => {
      jest.spyOn(WebhookEvent, 'countDocuments')
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(1); // failed

      jest.spyOn(WebhookEvent, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          sort: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockReturnValueOnce({
              lean: jest.fn().mockResolvedValueOnce([
                { source: 'SHOPIFY', error: 'Shopify 500' },
              ]),
            }),
          }),
        }),
      } as any);

      const result = await checkWebhookFailureRate(60);
      expect(result.totalEvents).toBe(10);
      expect(result.failedEvents).toBe(1);
      expect(result.failureRatePercentage).toBe(10);
      expect(result.status).toBe('warning');
    });
  });
});
