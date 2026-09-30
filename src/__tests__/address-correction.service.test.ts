process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import { addressCorrectionService } from '../services/address-correction.service';
import { Order, Merchant, AuditLog } from '../models';
import { whatsAppService } from '../services/whatsapp.service';
import { logisticsService } from '../services/logistics.service';
import { geocodingService } from '../services/geocoding.service';
import { geminiService } from '../services/gemini.service';
import { redisConnection } from '../config/redis';

jest.mock('../models', () => ({
  Order: {
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
  },
  Merchant: {
    findById: jest.fn(),
  },
  AuditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../services/whatsapp.service', () => ({
  whatsAppService: {
    sendInteractiveButtons: jest.fn().mockResolvedValue({ messaging_product: 'whatsapp' }),
  },
}));

jest.mock('../services/logistics.service', () => ({
  logisticsService: {
    updateDeliveryAddress: jest.fn().mockResolvedValue({ success: true, message: 'Address updated' }),
  },
}));

jest.mock('../services/geocoding.service', () => ({
  geocodingService: {
    reverseGeocode: jest.fn().mockResolvedValue('12th Main Road, Indiranagar, Bengaluru 560038'),
  },
}));

jest.mock('../services/gemini.service', () => ({
  geminiService: {
    isConfigured: jest.fn().mockReturnValue(false),
    parseAddress: jest.fn().mockResolvedValue(null),
    ask: jest.fn(),
  },
}));

jest.mock('../config/redis', () => ({
  redisConnection: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

describe('AddressCorrectionService', () => {
  const mockMerchantId = '507f1f77bcf86cd799439011';
  const mockMerchant = {
    _id: mockMerchantId,
    name: 'Test Store',
    settings: {
      ndrRescue: {
        messageLanguage: 'en',
        escalationChain: [4, 12, 24],
      },
    },
    carrierConfig: {
      provider: 'shiprocket',
    },
    whatsappConfig: {
      phoneNumberId: 'phone_123',
    },
  };

  const createMockOrder = (overrides = {}): any => ({
    _id: 'order_123',
    merchantId: mockMerchantId,
    externalOrderId: 'ORD-999',
    customerPhone: '9876543210',
    customerName: 'Rahul Verma',
    carrier: 'shiprocket',
    awb: 'AWB123456',
    status: 'ndr_rescue_sent',
    ndr: {
      rescueMessagesSent: 1,
      addressUpdate: {
        collectionState: 'idle',
      },
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateAddressCorrection', () => {
    it('initiates both mode (GPS pin first, step 1)', async () => {
      const order = createMockOrder();
      (Order.findById as jest.Mock).mockResolvedValue(order);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);

      await addressCorrectionService.initiateAddressCorrection('order_123', 'both');

      expect(whatsAppService.sendInteractiveButtons).toHaveBeenCalledWith(
        '9876543210',
        expect.stringContaining('Step 1/2'),
        [],
        expect.any(Object)
      );
      expect(order.ndr.addressMode).toBe('both');
      expect(order.ndr.addressCorrectionStep).toBe(1);
      expect(order.ndr.addressUpdate.collectionState).toBe('awaiting_location');
      expect(order.save).toHaveBeenCalled();
    });

    it('initiates location_pin mode', async () => {
      const order = createMockOrder();
      (Order.findById as jest.Mock).mockResolvedValue(order);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);

      await addressCorrectionService.initiateAddressCorrection('order_123', 'location_pin');

      expect(order.ndr.addressMode).toBe('location_pin');
      expect(order.ndr.addressCorrectionStep).toBe('awaiting_location');
      expect(order.ndr.addressUpdate.collectionState).toBe('awaiting_location');
      expect(order.save).toHaveBeenCalled();
    });

    it('initiates text_address mode', async () => {
      const order = createMockOrder();
      (Order.findById as jest.Mock).mockResolvedValue(order);
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);

      await addressCorrectionService.initiateAddressCorrection('order_123', 'text_address');

      expect(order.ndr.addressMode).toBe('text_address');
      expect(order.ndr.addressCorrectionStep).toBe('awaiting_text');
      expect(order.ndr.addressUpdate.collectionState).toBe('awaiting_text');
      expect(order.save).toHaveBeenCalled();
    });

    it('throws error if order not found', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        addressCorrectionService.initiateAddressCorrection('nonexistent', 'both')
      ).rejects.toThrow('Order not found');
    });

    it('throws error if merchant not found', async () => {
      const order = createMockOrder();
      (Order.findById as jest.Mock).mockResolvedValue(order);
      (Merchant.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        addressCorrectionService.initiateAddressCorrection('order_123', 'both')
      ).rejects.toThrow('Merchant not found');
    });
  });

  describe('handleLocationResponse', () => {
    it('handles GPS location in both mode by prompting step 2 (text details)', async () => {
      const order = createMockOrder({
        ndr: {
          addressMode: 'both',
          addressUpdate: { collectionState: 'awaiting_location' },
        },
      });
      (Order.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(order),
      });
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);

      const handled = await addressCorrectionService.handleLocationResponse(
        '9876543210',
        { latitude: 12.9716, longitude: 77.5946 }
      );

      expect(handled).toBe(true);
      expect(geocodingService.reverseGeocode).toHaveBeenCalledWith(12.9716, 77.5946);
      expect(order.ndr.addressUpdate.collectionState).toBe('awaiting_text');
      expect(whatsAppService.sendInteractiveButtons).toHaveBeenCalledWith(
        '9876543210',
        expect.stringContaining('Location pin locked'),
        [],
        expect.any(Object)
      );
    });

    it('handles GPS location in location_pin mode and pushes to carrier', async () => {
      const order = createMockOrder({
        ndr: {
          addressMode: 'location_pin',
          addressUpdate: { collectionState: 'awaiting_location' },
        },
      });
      (Order.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(order),
      });
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);

      const handled = await addressCorrectionService.handleLocationResponse(
        '9876543210',
        { latitude: 12.9716, longitude: 77.5946 }
      );

      expect(handled).toBe(true);
      expect(logisticsService.updateDeliveryAddress).toHaveBeenCalledWith(
        'shiprocket',
        expect.objectContaining({
          awb: 'AWB123456',
          address: expect.stringContaining('Indiranagar'),
          pincode: '560038',
        }),
        expect.any(Object)
      );
      expect(order.status).toBe('ndr_rescued');
      expect(order.ndr.addressUpdate.collectionState).toBe('complete');
    });

    it('rejects location if phone number does not match resolved order', async () => {
      const order = createMockOrder({ customerPhone: '9876543210' });
      const handled = await addressCorrectionService.handleLocationResponse(
        '9111111111',
        { latitude: 12.97, longitude: 77.59 },
        order
      );
      expect(handled).toBe(false);
      expect(geocodingService.reverseGeocode).not.toHaveBeenCalled();
    });

    it('returns false when no order is awaiting location', async () => {
      (Order.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const handled = await addressCorrectionService.handleLocationResponse('9876543210', {
        latitude: 12.97,
        longitude: 77.59,
      });
      expect(handled).toBe(false);
    });
  });

  describe('handleTextAddressResponse', () => {
    it('parses address text, pushes to carrier, and completes rescue', async () => {
      const order = createMockOrder({
        ndr: {
          addressMode: 'both',
          addressCorrectionStep: 2,
          addressUpdate: {
            collectionState: 'awaiting_text',
            geocodedAddress: '12th Main, Indiranagar',
          },
        },
      });
      (Merchant.findById as jest.Mock).mockResolvedValue(mockMerchant);

      const handled = await addressCorrectionService.handleTextAddressResponse(
        '9876543210',
        'Flat 402, Green Glen Apartments, near Apollo Hospital, pincode 560038. Please call at gate.',
        order
      );

      expect(handled).toBe(true);
      expect(logisticsService.updateDeliveryAddress).toHaveBeenCalled();
      expect(order.status).toBe('ndr_rescued');
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'address_extracted_and_synced',
          status: 'success',
        })
      );
    });

    it('rejects text response if order is not awaiting text', async () => {
      const order = createMockOrder({
        ndr: {
          addressUpdate: { collectionState: 'idle' },
        },
      });

      const handled = await addressCorrectionService.handleTextAddressResponse(
        '9876543210',
        'Some address',
        order
      );

      expect(handled).toBe(false);
      expect(logisticsService.updateDeliveryAddress).not.toHaveBeenCalled();
    });
  });

  describe('extractAddressDetails (parser & fallback)', () => {
    it('extracts landmark, driver note, and pincode via fallback heuristic', async () => {
      (geminiService.isConfigured as jest.Mock).mockReturnValue(false);

      const raw = 'Opposite metro station, 560001. Doorbell kharab hai please call karna.';
      const res = await addressCorrectionService.extractAddressDetails(raw);

      expect(res.pincode).toBe('560001');
      expect(res.landmark?.toLowerCase()).toContain('opposite metro');
      expect(res.driverNote?.toLowerCase()).toContain('doorbell kharab');
    });

    it('returns cached address extraction from Redis if available', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          cleanAddress: 'Cached Street 123',
          landmark: 'Near Metro',
          driverNote: 'Call on gate',
          pincode: '110001',
        })
      );

      const res = await addressCorrectionService.extractAddressDetails('Any repeated text message');
      expect(res.cleanAddress).toBe('Cached Street 123');
      expect(res.pincode).toBe('110001');
      expect(res.landmark).toBe('Near Metro');
    });

    it('uses Gemini AI extraction when configured', async () => {
      (geminiService.isConfigured as jest.Mock).mockReturnValue(true);
      (geminiService.ask as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          landmark: 'Behind Shiva Temple, 3rd Floor',
          driverNote: 'Leave with security guard',
          cleanAddress: 'Building 14, Sector 5, Dwarka',
        })
      );

      const raw = 'Dwarka sector 5 bld 14 behind shiva temple 3rd floor 110075 guard ko de dena';
      const res = await addressCorrectionService.extractAddressDetails(raw);

      expect(res.landmark).toBe('Behind Shiva Temple, 3rd Floor');
      expect(res.driverNote).toBe('Leave with security guard');
      expect(res.cleanAddress).toBe('Building 14, Sector 5, Dwarka');
      expect(res.pincode).toBe('110075');
    });
  });
});
