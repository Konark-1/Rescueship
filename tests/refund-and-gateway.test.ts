process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import axios from 'axios';
import { Types } from 'mongoose';
import { Order, Merchant, AuditLog } from '../src/models';
import { encryptionService } from '../src/services/encryption.service';
import { refundService } from '../src/services/refund.service';
import { canOfferOnlinePayment, paymentWebhookReady } from '../src/services/payment-guard';

jest.mock('axios');

describe('Payment gateway readiness gate', () => {
  const prev = process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK;
  beforeAll(() => { process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK = 'true'; });
  afterAll(() => { process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK = prev; });

  it('blocks pay links until a signed webhook has been seen', () => {
    const order = { orderValue: 999, paymentMethod: 'cod' };
    expect(paymentWebhookReady({ paymentConfig: {} })).toBe(false);
    expect(canOfferOnlinePayment(order, { paymentConfig: {} })).toEqual({ ok: false, reason: 'payment_webhook_unverified' });
    expect(canOfferOnlinePayment(order, { paymentConfig: { webhookVerifiedAt: new Date() } })).toEqual({ ok: true });
  });

  it('never offers post-dispatch conversion on a carrier without a verified COD amendment', () => {
    const merchant = { paymentConfig: { webhookVerifiedAt: new Date() }, settings: { codConversion: { allowPostDispatch: true } } };
    expect(canOfferOnlinePayment({ orderValue: 999, paymentMethod: 'cod', awb: 'A1', carrier: 'shiprocket' }, merchant).reason).toBe('carrier_cannot_amend_cod');
  });
});

describe('Refund queue', () => {
  const merchantId = new Types.ObjectId();
  const orderId = new Types.ObjectId();
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
  });

  it('flags a refund for approval when a paid order is cancelled (once)', async () => {
    jest.spyOn(Order, 'findById').mockResolvedValue({ _id: orderId, merchantId, externalOrderId: '1001', status: 'cancelled', codConversion: { amountPaid: 499, refundStatus: 'none' } } as any);
    const upd = jest.spyOn(Order, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
    expect(await refundService.flagIfPaid(orderId, 'order_cancelled')).toBe(true);
    expect(upd.mock.calls[0][1]).toEqual({ $set: expect.objectContaining({ 'codConversion.refundStatus': 'pending_approval', 'codConversion.refundAmount': 499 }) });
  });

  it('does not flag unpaid or still-deliverable orders', async () => {
    jest.spyOn(Order, 'findById').mockResolvedValue({ _id: orderId, merchantId, status: 'cancelled', codConversion: { amountPaid: 0 } } as any);
    expect(await refundService.flagIfPaid(orderId, 'order_cancelled')).toBe(false);
    jest.spyOn(Order, 'findById').mockResolvedValue({ _id: orderId, merchantId, status: 'shipped', codConversion: { amountPaid: 499 } } as any);
    expect(await refundService.flagIfPaid(orderId, 'order_shipped')).toBe(false);
  });

  it('approved refund calls the merchant\'s Razorpay with the stored payment id (tenant-scoped)', async () => {
    const findOne = jest.spyOn(Order, 'findOne').mockResolvedValue({ _id: orderId, merchantId, externalOrderId: '1001', codConversion: { refundStatus: 'pending_approval', refundAmount: 499, paymentId: 'pay_123' } } as any);
    jest.spyOn(Merchant, 'findById').mockReturnValue({ select: () => Promise.resolve({ paymentConfig: { provider: 'razorpay', keyId: encryptionService.encrypt('rzp_k'), keySecret: encryptionService.encrypt('rzp_s') } }) } as any);
    jest.spyOn(Order, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
    (axios.post as jest.Mock).mockResolvedValue({ data: { id: 'rfnd_1' } });

    const r = await refundService.executeRefund(String(merchantId), String(orderId));
    expect(findOne).toHaveBeenCalledWith({ _id: String(orderId), merchantId: String(merchantId) });
    expect(r).toEqual({ status: 'refunded', refundId: 'rfnd_1' });
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.razorpay.com/v1/payments/pay_123/refund',
      expect.objectContaining({ amount: 49900 }),
      expect.objectContaining({ auth: { username: 'rzp_k', password: 'rzp_s' } })
    );
  });
});
