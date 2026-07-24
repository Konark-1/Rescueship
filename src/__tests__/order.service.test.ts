import { orderService } from '../services/order.service';
import { Order, Merchant, AuditLog, BillingEvent } from '../models';
import { whatsAppService } from '../services/whatsapp.service';
import { paymentService } from '../services/payment.service';

jest.mock('../models', () => {
  const mockOrderInstance = {
    _id: '507f1f77bcf86cd799439011',
    merchantId: '507f1f77bcf86cd799439011',
    externalOrderId: 'ORD1001',
    customerPhone: '919876543210',
    orderValue: 1000,
    save: jest.fn().mockResolvedValue(true),
  };
  return {
    Order: {
      create: jest.fn().mockResolvedValue(mockOrderInstance),
      findOne: jest.fn(),
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
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockCreatedOrder: any = {
        _id: '507f1f77bcf86cd799439011',
        merchantId: '507f1f77bcf86cd799439011',
        externalOrderId: 'ORD1001',
        customerPhone: '919876543210',
        orderValue: 1000,
        save: mockSave,
      };

      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        settings: {
          codConversion: {
            enabled: true,
            minOrderValue: 500,
            incentiveType: 'flat',
            incentiveAmount: 100,
            messageLanguage: 'en',
          },
        },
        billing: { rescueCredits: 50 },
      });

      (Order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);
      (paymentService.createPaymentLink as jest.Mock).mockResolvedValue({
        linkId: 'plink_123',
        shortUrl: 'https://rzp.io/i/testlink',
        provider: 'razorpay',
      });
      (paymentService.generateQRCode as jest.Mock).mockResolvedValue('data:image/png;base64,mockqr');
      (whatsAppService.sendTemplate as jest.Mock).mockResolvedValue({});
      (Merchant.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      (BillingEvent.create as jest.Mock).mockResolvedValue({});
      (AuditLog.create as jest.Mock).mockResolvedValue({});

      await orderService.processCODOrder('507f1f77bcf86cd799439011', {
        externalOrderId: 'ORD1001',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 1000,
        paymentMethod: 'cod',
      });

      expect(Order.create).toHaveBeenCalled();
      expect(paymentService.createPaymentLink).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        '919876543210',
        'cod_conversion_en',
        'en',
        expect.any(Array),
        expect.any(Object)
      );
      expect(Merchant.updateOne).toHaveBeenCalled();
    });

    it('should skip process if order value is below minOrderValue', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: {
          codConversion: {
            enabled: true,
            minOrderValue: 500,
          },
        },
        billing: { rescueCredits: 50 },
      });

      await orderService.processCODOrder(validMerchantId, {
        externalOrderId: 'ORD1001',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 300,
        paymentMethod: 'cod',
      });

      expect(Order.create).not.toHaveBeenCalled();
    });

    it('should calculate percentage discount correctly', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockCreatedOrder: any = {
        _id: '507f1f77bcf86cd799439011',
        merchantId: validMerchantId,
        externalOrderId: 'ORD1002',
        customerPhone: '919876543210',
        orderValue: 2000,
        save: mockSave,
      };

      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: {
          codConversion: {
            enabled: true,
            minOrderValue: 100,
            incentiveType: 'percentage',
            incentiveAmount: 10, // 10% of 2000 = 200
            messageLanguage: 'en',
          },
        },
        billing: { rescueCredits: 50 },
      });

      (Order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);
      (paymentService.createPaymentLink as jest.Mock).mockResolvedValue({
        linkId: 'plink_456',
        shortUrl: 'https://rzp.io/i/testlink2',
        provider: 'razorpay',
      });

      await orderService.processCODOrder(validMerchantId, {
        externalOrderId: 'ORD1002',
        platform: 'shopify',
        customerPhone: '9876543210',
        orderValue: 2000,
        paymentMethod: 'cod',
      });

      expect(paymentService.createPaymentLink).toHaveBeenCalledWith(
        'razorpay',
        expect.objectContaining({
          amount: 1800, // 2000 - 200
        }),
        expect.any(Object)
      );
    });

    it('should handle duplicate order creation error (E11000) gracefully', async () => {
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: { codConversion: { enabled: true, minOrderValue: 100 } },
        billing: { rescueCredits: 50 },
      });

      const err: any = new Error('Duplicate key');
      err.code = 11000;
      (Order.create as jest.Mock).mockRejectedValue(err);

      await expect(
        orderService.processCODOrder(validMerchantId, {
          externalOrderId: 'ORD1001',
          platform: 'shopify',
          customerPhone: '9876543210',
          orderValue: 1000,
          paymentMethod: 'cod',
        })
      ).resolves.not.toThrow();

      expect(paymentService.createPaymentLink).not.toHaveBeenCalled();
    });

    it('should delete order if payment link creation fails', async () => {
      const mockCreatedOrder: any = {
        _id: '507f1f77bcf86cd799439011',
        merchantId: validMerchantId,
        externalOrderId: 'ORD1001',
      };

      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: validMerchantId,
        settings: { codConversion: { enabled: true, minOrderValue: 100 } },
        billing: { rescueCredits: 50 },
      });

      (Order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);
      (paymentService.createPaymentLink as jest.Mock).mockRejectedValue(new Error('Gateway error'));

      await expect(
        orderService.processCODOrder(validMerchantId, {
          externalOrderId: 'ORD1001',
          platform: 'shopify',
          customerPhone: '9876543210',
          orderValue: 1000,
          paymentMethod: 'cod',
        })
      ).rejects.toThrow('Gateway error');

      expect(Order.deleteOne).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011' });
    });
  });

  describe('handlePaymentConfirmation', () => {
    it('should update order status to converted_to_prepaid and notify seller', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockOrder: any = {
        _id: '507f1f77bcf86cd799439011',
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
      (Merchant.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        phone: '919876543210',
        whatsappConfig: {},
      });
      (paymentService.notifySellerPaymentReceived as jest.Mock).mockResolvedValue(undefined);
      (AuditLog.create as jest.Mock).mockResolvedValue({});

      await orderService.handlePaymentConfirmation('plink_123', 'razorpay');

      expect(mockOrder.status).toBe('converted_to_prepaid');
      expect(mockSave).toHaveBeenCalled();
      expect(orderService.markOrderAsPaidOnPlatform).toHaveBeenCalledWith(mockOrder);
      expect(paymentService.notifySellerPaymentReceived).toHaveBeenCalledWith(
        '919876543210',
        'ORD1001',
        900,
        {}
      );
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
