import { orderService } from '../services/order.service';
import { Order, Merchant, AuditLog, BillingEvent } from '../models';
import { whatsAppService } from '../services/whatsapp.service';
import { paymentService } from '../services/payment.service';

const mockOrderInstance: any = {
  _id: '507f1f77bcf86cd799439011',
  merchantId: '507f1f77bcf86cd799439011',
  externalOrderId: 'ORD1001',
  customerPhone: '919876543210',
  orderValue: 1000,
  status: 'cod_conversion_sent',
  save: jest.fn().mockResolvedValue(true),
};

jest.mock('../models', () => {
  return {
    Order: {
      create: jest.fn().mockImplementation(() => Promise.resolve(mockOrderInstance)),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn().mockImplementation((_query: any, update: any) => {
        if (update?.$set?.status) {
          mockOrderInstance.status = update.$set.status;
        }
        return Promise.resolve(mockOrderInstance);
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(mockOrderInstance),
      findById: jest.fn().mockResolvedValue(mockOrderInstance),
      deleteOne: jest.fn(),
    },
    Merchant: {
      findById: jest.fn(),
      updateOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    },
    AuditLog: {
      create: jest.fn(),
    },
    BillingEvent: {
      create: jest.fn(),
    },
  };
});
jest.mock('../services/whatsapp.service');
jest.mock('../services/payment.service');
jest.mock('bullmq');

describe('OrderService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processCODOrder', () => {
    const validMerchantId = '507f1f77bcf86cd799439011';

    it('should skip process if merchant COD conversion is disabled', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: { codConversion: { enabled: false } },
        billing: { rescueCredits: 100 },
      });

      await orderService.processCODOrder(validMerchantId, {
        externalOrderId: 'ORD1001',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 1000,
        paymentMethod: 'cod',
      });

      expect(Order.create).not.toHaveBeenCalled();
    });

    it('should skip process if merchant rescue credits are 0', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: { codConversion: { enabled: true } },
        billing: { rescueCredits: 0 },
      });

      await orderService.processCODOrder(validMerchantId, {
        externalOrderId: 'ORD1001',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 1000,
        paymentMethod: 'cod',
      });

      expect(Order.create).not.toHaveBeenCalled();
    });

    it('should skip process if order is prepaid', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: { codConversion: { enabled: true } },
        billing: { rescueCredits: 50 },
      });

      await orderService.processCODOrder(validMerchantId, {
        externalOrderId: 'ORD1001',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 1000,
        paymentMethod: 'prepaid',
      });

      expect(Order.create).not.toHaveBeenCalled();
    });

    it('should create order and payment link then send WhatsApp message', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: {
          codConversion: {
            enabled: true,
            incentiveType: 'flat',
            incentiveAmount: 100,
            messageLanguage: 'en',
          },
        },
        billing: { rescueCredits: 100 },
        paymentConfig: { provider: 'razorpay', keyId: 'key123', keySecret: 'sec123' },
        whatsappConfig: { phoneNumberId: 'ph123' },
      });

      (paymentService.createPaymentLink as jest.Mock).mockResolvedValue({
        linkId: 'plink_123',
        shortUrl: 'https://rzp.io/l/test1234',
      });
      (paymentService.generateQRCode as jest.Mock).mockResolvedValue('data:image/png;base64,mockqr');
      (Merchant.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      (whatsAppService.sendTemplate as jest.Mock).mockResolvedValue({ messaging_product: 'whatsapp' });

      await orderService.processCODOrder(validMerchantId, {
        externalOrderId: 'ORD1001',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 1000,
        paymentMethod: 'cod',
      });

      expect(Order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          externalOrderId: 'ORD1001',
          paymentMethod: 'cod',
          orderValue: 1000,
        })
      );
      expect(paymentService.createPaymentLink).toHaveBeenCalledWith(
        'razorpay',
        expect.objectContaining({ amount: 900 }),
        expect.any(Object)
      );
      expect(mockOrderInstance.save).toHaveBeenCalled();
      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        '919876543210',
        'cod_conversion_en',
        'en',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should calculate percentage discount correctly', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: {
          codConversion: {
            enabled: true,
            incentiveType: 'percentage',
            incentiveAmount: 10,
            messageLanguage: 'en',
          },
        },
        billing: { rescueCredits: 100 },
      });

      (paymentService.createPaymentLink as jest.Mock).mockResolvedValue({
        linkId: 'plink_123',
        shortUrl: 'https://rzp.io/l/test1234',
      });
      (Merchant.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      await orderService.processCODOrder(validMerchantId, {
        externalOrderId: 'ORD1002',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 2000,
        paymentMethod: 'cod',
      });

      expect(paymentService.createPaymentLink).toHaveBeenCalledWith(
        'razorpay',
        expect.objectContaining({ amount: 1800 }),
        expect.any(Object)
      );
    });
  });

  describe('handlePaymentSuccess', () => {
    it('should update order status to converted_to_prepaid and notify seller', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockOrder: any = {
        _id: 'order123',
        merchantId: '507f1f77bcf86cd799439011',
        externalOrderId: 'ORD1001',
        status: 'cod_conversion_sent',
        paymentLinkId: 'plink_123',
        orderValue: 1000,
        codConversion: { incentiveOffered: 100 },
        save: mockSave,
      };

      (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
      jest.spyOn(orderService, 'markOrderAsPaidOnPlatform').mockResolvedValue();
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        phone: '919876543210',
        whatsappConfig: {},
      });
      (Merchant.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
      });
      (paymentService.notifySellerPaymentReceived as jest.Mock).mockResolvedValue(undefined);
      (AuditLog.create as jest.Mock).mockResolvedValue({});

      await orderService.handlePaymentConfirmation('plink_123', 90000);

      expect(mockOrderInstance.status).toBe('converted_to_prepaid');
      expect(orderService.markOrderAsPaidOnPlatform).toHaveBeenCalled();
    });
  });

  describe('markOrderAsPaidOnPlatform', () => {
    it('should skip automated sync for unknown platform', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({ _id: 'merchant123' });
      const mockOrder = { merchantId: 'merchant123', platform: 'unknown', externalOrderId: 'ORD99' };

      await expect(orderService.markOrderAsPaidOnPlatform(mockOrder)).resolves.not.toThrow();
    });
  });
});
