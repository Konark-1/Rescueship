process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

import { fieldAgentNotifierService } from '../src/services/field-agent-notifier.service';
import { whatsAppService } from '../src/services/whatsapp.service';
import { Order, Merchant, NdrCase, Shipment, AuditLog } from '../src/models';
import { redisCache } from '../src/utils/redis-cache';

import { encryptionService } from '../src/services/encryption.service';

jest.mock('../src/models', () => ({
  Order: {
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  },
  Merchant: {
    findById: jest.fn(),
  },
  NdrCase: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
  },
  Shipment: {
    findOne: jest.fn(),
  },
  AuditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../src/services/whatsapp.service', () => ({
  whatsAppService: {
    sendText: jest.fn().mockResolvedValue({ success: true, messageId: 'wa_rider_msg_123' }),
  },
}));

jest.mock('../src/utils/redis-cache', () => ({
  redisCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

describe('FieldAgentNotifierService - Dual Sync Unit Tests', () => {
  const mockMerchant = {
    _id: 'merchant_123',
    name: 'Test Fashion Store',
    whatsappConfig: {
      phoneNumberId: 'waba_phone_123',
      accessToken: encryptionService.encrypt('token_123'),
      businessAccountId: 'waba_biz_123',
    },
  };

  const createMockOrder = (overrides = {}): any => ({
    _id: 'order_abc_123',
    merchantId: 'merchant_123',
    externalOrderId: 'ORD-5544',
    awb: 'DELHIVERY_88776655',
    customerName: 'Aarav Mehta',
    customerPhone: '9876543210',
    assignedRider: {
      phone: '919811223344',
      name: 'Ramesh Kumar',
      source: 'delhivery',
    },
    ndr: {
      addressUpdate: {
        latitude: 19.076,
        longitude: 72.8777,
        landmark: 'Opposite City Mall Gate 2',
        driverNote: 'Ring bell twice, flat on 4th floor',
        geocodedAddress: 'Flat 402, Sea Green Apt, Bandra West, Mumbai 400050',
      },
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Google Maps Deep-Link Generation', () => {
    it('generates standard https://maps.google.com/?q=lat,lng link', () => {
      const url = fieldAgentNotifierService.generateGoogleMapsUrl(19.076, 72.8777);
      expect(url).toBe('https://maps.google.com/?q=19.076,72.8777');
    });

    it('generates accurate link for high-precision GPS coordinates', () => {
      const url = fieldAgentNotifierService.generateGoogleMapsUrl(12.9715987, 77.5945627);
      expect(url).toBe('https://maps.google.com/?q=12.9715987,77.5945627');
    });
  });

  describe('2. Message Formatting for Courier Rider App / SMS', () => {
    it('formats comprehensive message with Maps deep-link, landmark, gate note, and address', () => {
      const message = fieldAgentNotifierService.formatFieldAgentMessage({
        externalOrderId: 'ORD-9988',
        awb: 'SR_AWB_12345',
        latitude: 19.076,
        longitude: 72.8777,
        landmark: 'Near D-Mart',
        driverNote: 'Leave with security guard if not available',
        address: 'B-201, Shanti Niketan, Andheri East, Mumbai 400069',
        customerName: 'Priya Sharma',
        customerPhone: '9876500000',
      });

      expect(message).toContain('📍 Delivery Location Update for Order #ORD-9988 (AWB: SR_AWB_12345):');
      expect(message).toContain('👉 https://maps.google.com/?q=19.076,72.8777');
      expect(message).toContain('🏛️ Landmark: Near D-Mart');
      expect(message).toContain('🚪 Gate/Entry Note: Leave with security guard if not available');
      expect(message).toContain('🏠 Address: B-201, Shanti Niketan, Andheri East, Mumbai 400069');
      expect(message).toContain('👤 Consignee: Priya Sharma (9876500000)');
      expect(message).toContain('Please tap the Google Maps link above for direct GPS doorstep navigation.');
    });

    it('gracefully omits optional fields when not provided', () => {
      const message = fieldAgentNotifierService.formatFieldAgentMessage({
        externalOrderId: 'ORD-001',
        latitude: 28.6139,
        longitude: 77.209,
      });

      expect(message).toContain('👉 https://maps.google.com/?q=28.6139,77.209');
      expect(message).not.toContain('🏛️ Landmark:');
      expect(message).not.toContain('🚪 Gate/Entry Note:');
      expect(message).not.toContain('🏠 Address:');
    });
  });

  describe('3. Notification Dispatch & Channel Execution', () => {
    it('dispatches Google Maps deep-link to assigned rider via WhatsApp and records audit log', async () => {
      const order = createMockOrder();
      const result = await fieldAgentNotifierService.notifyAssignedAgent(order, mockMerchant, {
        riderPhone: '9811223344',
        riderName: 'Ramesh Kumar',
        latitude: 19.076,
        longitude: 72.8777,
        landmark: 'Opposite City Mall Gate 2',
        driverNote: 'Ring bell twice',
      });

      expect(result.success).toBe(true);
      expect(result.mapsUrl).toBe('https://maps.google.com/?q=19.076,72.8777');
      expect(whatsAppService.sendText).toHaveBeenCalledWith(
        '919811223344',
        expect.stringContaining('https://maps.google.com/?q=19.076,72.8777'),
        expect.any(Object)
      );

      // Verify Order model updated with timestamp
      expect(Order.updateOne).toHaveBeenCalledWith(
        { _id: 'order_abc_123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            assignedRider: expect.objectContaining({
              phone: '919811223344',
              locationSharedAt: expect.any(Date),
            }),
          }),
        })
      );

      // Verify NdrCase updated
      expect(NdrCase.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: 'order_abc_123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            assignedRiderPhone: '919811223344',
            riderLocationSharedAt: expect.any(Date),
          }),
        })
      );

      // Verify AuditLog creation
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'field_agent_location_shared',
          source: 'field_agent_notifier',
          payload: expect.objectContaining({
            awb: 'DELHIVERY_88776655',
            mapsUrl: 'https://maps.google.com/?q=19.076,72.8777',
            landmark: 'Opposite City Mall Gate 2',
          }),
        })
      );
    });

    it('falls back to SMS when WhatsApp dispatch fails', async () => {
      (whatsAppService.sendText as jest.Mock).mockRejectedValueOnce(new Error('WABA rate limit or window expired'));

      const order = createMockOrder();
      const result = await fieldAgentNotifierService.notifyAssignedAgent(order, mockMerchant, {
        riderPhone: '9811223344',
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
      expect(Order.updateOne).toHaveBeenCalled();
    });

    it('rejects dispatch when coordinates are invalid or out of bounds', async () => {
      const order = createMockOrder();
      const result = await fieldAgentNotifierService.notifyAssignedAgent(order, mockMerchant, {
        riderPhone: '9811223344',
        latitude: 999.0, // Invalid latitude
        longitude: 72.8777,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid coordinates');
      expect(whatsAppService.sendText).not.toHaveBeenCalled();
    });

    it('rejects dispatch when field agent phone number is missing', async () => {
      const order = createMockOrder({ assignedRider: undefined });
      const result = await fieldAgentNotifierService.notifyAssignedAgent(order, mockMerchant, {
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No field agent phone number provided');
      expect(whatsAppService.sendText).not.toHaveBeenCalled();
    });

    it('deduplicates rapid re-sends to the same rider for the same location within 12 hours', async () => {
      (redisCache.get as jest.Mock).mockResolvedValueOnce('1'); // Already sent

      const order = createMockOrder();
      const result = await fieldAgentNotifierService.notifyAssignedAgent(order, mockMerchant, {
        riderPhone: '9811223344',
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Already notified (deduped)');
      expect(whatsAppService.sendText).not.toHaveBeenCalled();
    });
  });

  describe('4. Bidirectional Trigger (notifyAssignedAgentIfAvailable)', () => {
    it('notifies agent immediately when rider phone is on Order', async () => {
      const order = createMockOrder();
      const result = await fieldAgentNotifierService.notifyAssignedAgentIfAvailable(order, mockMerchant, {
        latitude: 19.076,
        longitude: 72.8777,
        landmark: 'Opposite Mall',
      });

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(whatsAppService.sendText).toHaveBeenCalled();
    });

    it('falls back to NdrCase.assignedRiderPhone when not present on Order', async () => {
      const order = createMockOrder({ assignedRider: undefined });
      (NdrCase.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          assignedRiderPhone: '919877001122',
          assignedRiderName: 'Suresh FE',
        }),
      });

      const result = await fieldAgentNotifierService.notifyAssignedAgentIfAvailable(order, mockMerchant, {
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(whatsAppService.sendText).toHaveBeenCalledWith(
        '919877001122',
        expect.stringContaining('https://maps.google.com/?q=19.076,72.8777'),
        expect.any(Object)
      );
    });

    it('falls back to Shipment.assignedRiderPhone when not present on Order or NdrCase', async () => {
      const order = createMockOrder({ assignedRider: undefined });
      (NdrCase.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });
      (Shipment.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          assignedRiderPhone: '919822334455',
          assignedRiderName: 'Vijay Rider',
        }),
      });

      const result = await fieldAgentNotifierService.notifyAssignedAgentIfAvailable(order, mockMerchant, {
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(whatsAppService.sendText).toHaveBeenCalledWith(
        '919822334455',
        expect.stringContaining('https://maps.google.com/?q=19.076,72.8777'),
        expect.any(Object)
      );
    });

    it('returns null and does not throw when rider is not yet assigned', async () => {
      const order = createMockOrder({ assignedRider: undefined });
      (NdrCase.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });
      (Shipment.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await fieldAgentNotifierService.notifyAssignedAgentIfAvailable(order, mockMerchant, {
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(result).toBeNull();
      expect(whatsAppService.sendText).not.toHaveBeenCalled();
    });
  });
});
