import axios from 'axios';
import { paymentService } from '../services/payment.service';
import { whatsAppService } from '../services/whatsapp.service';

jest.mock('axios');
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockqrdata'),
}));
jest.mock('../services/whatsapp.service');

describe('PaymentService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentLink', () => {
    it('should create Razorpay payment link successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          id: 'plink_rzp_123',
          short_url: 'https://rzp.io/i/testlink',
        },
      });

      const result = await paymentService.createPaymentLink(
        'razorpay',
        {
          amount: 500,
          currency: 'INR',
          description: 'Test Order Upgrade',
          customerName: 'John Doe',
          customerPhone: '+919876543210',
          orderId: 'ORD500',
        },
        {
          keyId: 'rzp_key_test',
          keySecret: 'rzp_secret_test',
        }
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.razorpay.com/v1/payment_links',
        expect.objectContaining({
          amount: 50000,
          currency: 'INR',
          description: 'Test Order Upgrade',
        }),
        expect.any(Object)
      );

      expect(result).toEqual({
        linkId: 'plink_rzp_123',
        shortUrl: 'https://rzp.io/i/testlink',
        provider: 'razorpay',
      });
    });

    it('should create Cashfree payment link successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          link_id: 'link_ORD500_1234',
          link_url: 'https://cashfree.com/l/testlink',
        },
      });

      const result = await paymentService.createPaymentLink(
        'cashfree',
        {
          amount: 500,
          currency: 'INR',
          description: 'Test Order Upgrade',
          customerName: 'John Doe',
          customerPhone: '9876543210',
          orderId: 'ORD500',
        },
        {
          clientId: 'cf_client_test',
          clientSecret: 'cf_secret_test',
        }
      );

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/links'),
        expect.objectContaining({
          link_amount: 500,
          link_currency: 'INR',
        }),
        expect.any(Object)
      );

      expect(result).toEqual({
        linkId: 'link_ORD500_1234',
        shortUrl: 'https://cashfree.com/l/testlink',
        provider: 'cashfree',
      });
    });

    it('should enforce ₹1 floor for amounts less than or equal to 0', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          id: 'plink_rzp_123',
          short_url: 'https://rzp.io/i/testlink',
        },
      });

      await paymentService.createPaymentLink(
        'razorpay',
        {
          amount: 0,
          currency: 'INR',
          description: 'Zero amount order',
          customerName: 'Jane Doe',
          customerPhone: '+919876543210',
          orderId: 'ORD0',
        },
        { keyId: 'rzp_key_test', keySecret: 'rzp_secret_test' }
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.razorpay.com/v1/payment_links',
        expect.objectContaining({
          amount: 100, // ₹1 = 100 paise
        }),
        expect.any(Object)
      );
    });

    it('should cap expiration time to 7 days (10,080 minutes)', async () => {
      const nowMs = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);

      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          id: 'plink_rzp_123',
          short_url: 'https://rzp.io/i/testlink',
        },
      });

      await paymentService.createPaymentLink(
        'razorpay',
        {
          amount: 100,
          currency: 'INR',
          description: 'Long expiry order',
          customerName: 'Jane Doe',
          customerPhone: '+919876543210',
          orderId: 'ORD100',
          expiresInMinutes: 20000, // exceeds 7 days (10080 mins)
        },
        { keyId: 'rzp_key_test', keySecret: 'rzp_secret_test' }
      );

      const expectedExpireTimestamp = Math.floor(nowMs / 1000) + 10080 * 60;
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.razorpay.com/v1/payment_links',
        expect.objectContaining({
          expire_by: expectedExpireTimestamp,
        }),
        expect.any(Object)
      );

      jest.restoreAllMocks();
    });
  });

  describe('generateQRCode', () => {
    it('should return QR code Data URL for given payment URL', async () => {
      const qrDataUrl = await paymentService.generateQRCode('https://rzp.io/i/testlink');
      expect(qrDataUrl).toBe('data:image/png;base64,mockqrdata');
    });
  });

  describe('verifyRazorpayWebhook', () => {
    it('should verify correct Razorpay webhook signature', () => {
      const crypto = require('crypto');
      const secret = 'my_webhook_secret';
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      const isValid = paymentService.verifyRazorpayWebhook(rawBody, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid Razorpay webhook signature', () => {
      const isValid = paymentService.verifyRazorpayWebhook('{}', 'invalid_signature', 'my_webhook_secret');
      expect(isValid).toBe(false);
    });
  });
});
