import { ndrService } from '../services/ndr.service';
import { Order, Merchant, AuditLog } from '../models';
import { geocodingService } from '../services/geocoding.service';
import { whatsAppService } from '../services/whatsapp.service';
import { logisticsService } from '../services/logistics.service';

jest.mock('../models');
jest.mock('../services/geocoding.service');
jest.mock('../services/whatsapp.service');
jest.mock('../services/logistics.service');

describe('NDRService - 3-Mode Address Correction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCustomerLocationResponse', () => {
    it('should handle location response in awaiting_location mode ("Both" mode step 1)', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockOrder: any = {
        _id: 'order123',
        merchantId: 'merchant123',
        customerPhone: '919876543210',
        status: 'ndr_rescue_sent',
        ndr: {
          addressUpdate: {
            collectionState: 'awaiting_location',
          },
        },
        save: mockSave,
      };

      (Order.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrder),
      });

      (geocodingService.reverseGeocode as jest.Mock).mockResolvedValue('123 Main St, Mumbai 400001');
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: 'merchant123',
        whatsappConfig: { phoneNumberId: 'ph123' },
      });
      (whatsAppService.sendInteractiveButtons as jest.Mock).mockResolvedValue({});
      (AuditLog.create as jest.Mock).mockResolvedValue({});

      await ndrService.handleCustomerLocationResponse('9876543210', {
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(geocodingService.reverseGeocode).toHaveBeenCalledWith(19.076, 72.8777);
      expect(mockOrder.ndr.addressUpdate.collectionState).toBe('awaiting_text');
      expect(mockOrder.ndr.addressUpdate.geocodedAddress).toBe('123 Main St, Mumbai 400001');
      expect(mockSave).toHaveBeenCalled();
      expect(whatsAppService.sendInteractiveButtons).toHaveBeenCalledWith(
        '919876543210',
        expect.stringContaining('Location pin locked!'),
        [],
        expect.any(Object)
      );
    });

    it('should handle location response in location-only mode', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockOrder: any = {
        _id: 'order123',
        merchantId: 'merchant123',
        customerPhone: '919876543210',
        status: 'ndr_rescue_sent',
        carrier: 'shiprocket',
        awb: 'AWB12345',
        ndr: {
          addressUpdate: {
            collectionState: 'idle',
          },
        },
        save: mockSave,
      };

      (Order.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrder),
      });

      (geocodingService.reverseGeocode as jest.Mock).mockResolvedValue('456 Park Rd, Delhi 110001');
      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: 'merchant123',
        whatsappConfig: { phoneNumberId: 'ph123' },
        settings: { ndrRescue: { messageLanguage: 'en' } },
      });
      (Merchant.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (logisticsService.updateDeliveryAddress as jest.Mock).mockResolvedValue({ success: true });
      (logisticsService.updateAddress as jest.Mock).mockResolvedValue({ success: true });
      (whatsAppService.sendInteractiveButtons as jest.Mock).mockResolvedValue({});
      (AuditLog.create as jest.Mock).mockResolvedValue({});

      await ndrService.handleCustomerLocationResponse('+919876543210', {
        latitude: 28.6139,
        longitude: 77.209,
      });

      expect(mockOrder.ndr.addressUpdate.collectionState).toBe('complete');
      expect(mockOrder.status).toBe('ndr_rescued');
      expect(logisticsService.updateDeliveryAddress).toHaveBeenCalled();
      expect(whatsAppService.sendInteractiveButtons).toHaveBeenCalledWith(
        '919876543210',
        expect.stringContaining('Thank you! We have shared your location with the courier driver.'),
        [],
        expect.any(Object)
      );
    });
  });

  describe('handleCustomerTextResponse', () => {
    it('should combine geocoded address and text when collectionState is awaiting_text', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockOrder: any = {
        _id: 'order123',
        merchantId: 'merchant123',
        customerPhone: '919876543210',
        status: 'ndr_rescue_sent',
        carrier: 'shiprocket',
        awb: 'AWB12345',
        ndr: {
          addressUpdate: {
            collectionState: 'awaiting_text',
            geocodedAddress: '456 Park Rd, Delhi 110001',
          } as any,
        },
        save: mockSave,
      };

      (Order.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrder),
      });

      (Merchant.findById as jest.Mock).mockResolvedValue({
        _id: 'merchant123',
        whatsappConfig: { phoneNumberId: 'ph123' },
        settings: { ndrRescue: { messageLanguage: 'en' } },
      });
      (Merchant.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (logisticsService.updateDeliveryAddress as jest.Mock).mockResolvedValue({ success: true });
      (logisticsService.updateAddress as jest.Mock).mockResolvedValue({ success: true });
      (whatsAppService.sendInteractiveButtons as jest.Mock).mockResolvedValue({});

      await ndrService.handleCustomerTextResponse('9876543210', 'Flat 402, Building B 110001');

      expect(mockOrder.ndr.addressUpdate.collectionState).toBe('complete');
      expect(mockOrder.status).toBe('ndr_rescued');
      expect(logisticsService.updateDeliveryAddress).toHaveBeenCalledWith(
        'shiprocket',
        expect.objectContaining({
          address: expect.stringContaining('Flat 402, Building B'),
        }),
        expect.any(Object)
      );
    });
  });
});
