process.env.ENCRYPTION_KEY = 'this_is_a_very_secret_encryption_key_32';
process.env.NODE_ENV = 'test';

let mockMerchantStore: any = {
  _id: '6aa2874f2b6be7572c5c0289',
  name: 'Multi Carrier Test Store',
  carrierConfig: {},
  connections: {},
};

jest.mock('../models', () => {
  const original = jest.requireActual('../models');
  return {
    ...original,
    Merchant: {
      findById: jest.fn().mockImplementation(() => ({
        ...mockMerchantStore,
        markModified: jest.fn(),
        save: jest.fn().mockImplementation(function (this: any) {
          mockMerchantStore.carrierConfig = this.carrierConfig;
          mockMerchantStore.connections = this.connections;
          return Promise.resolve(this);
        }),
        select: jest.fn().mockImplementation(() => ({
          lean: jest.fn().mockResolvedValue(mockMerchantStore),
          ...mockMerchantStore,
        })),
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    },
  };
});

import { carrierConnectService } from '../services/carrier-connect.service';
import { logisticsService } from '../services/logistics.service';
import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';
import { parseBluedartWebhook } from '../webhooks/bluedart.webhook';
import { parseXpressbeesWebhook } from '../webhooks/xpressbees.webhook';
import { parseShadowfaxWebhook } from '../webhooks/shadowfax.webhook';

describe('Multi-Carrier Hub & Top Logistics Providers Suite', () => {
  const testMerchantId = '6aa2874f2b6be7572c5c0289';

  describe('1. Multi-Carrier Status Normalization Map', () => {
    it('normalizes Blue Dart status codes properly', () => {
      expect(normalizeCarrierStatus('bluedart', 'UD', 'Consignee not available')).toEqual({
        normalizedStatus: 'ndr_detected',
        isNdr: true,
        isTerminal: false,
      });

      expect(normalizeCarrierStatus('bluedart', 'DELIVERED')).toEqual({
        normalizedStatus: 'delivered',
        isNdr: false,
        isTerminal: true,
      });

      expect(normalizeCarrierStatus('bluedart', 'RTO')).toEqual({
        normalizedStatus: 'rto_initiated',
        isNdr: false,
        isTerminal: false,
      });
    });

    it('normalizes Xpressbees status codes properly', () => {
      expect(normalizeCarrierStatus('xpressbees', 'UNDELIVERED')).toEqual({
        normalizedStatus: 'ndr_detected',
        isNdr: true,
        isTerminal: false,
      });

      expect(normalizeCarrierStatus('xpressbees', 'FAILED')).toEqual({
        normalizedStatus: 'ndr_detected',
        isNdr: true,
        isTerminal: false,
      });

      expect(normalizeCarrierStatus('xpressbees', 'DELIVERED')).toEqual({
        normalizedStatus: 'delivered',
        isNdr: false,
        isTerminal: true,
      });
    });

    it('normalizes Shadowfax status codes properly', () => {
      expect(normalizeCarrierStatus('shadowfax', 'DELIVERY_FAILED')).toEqual({
        normalizedStatus: 'ndr_detected',
        isNdr: true,
        isTerminal: false,
      });

      expect(normalizeCarrierStatus('shadowfax', 'OUT_FOR_DELIVERY')).toEqual({
        normalizedStatus: 'out_for_delivery',
        isNdr: false,
        isTerminal: false,
      });
    });
  });

  describe('2. Multi-Carrier Webhook Parsers', () => {
    it('parses Blue Dart webhook payload correctly', () => {
      const mockReq: any = {
        body: {
          WaybillNo: 'BD987654321',
          Status: 'UNDELIVERED',
          ExceptionRemarks: 'Premises Closed',
          ReferenceNo: 'ORD-101',
          MobileNo: '9876543210',
        },
        path: '/ndr',
        get: () => null,
      };

      const result: any = parseBluedartWebhook(mockReq);
      expect(result.awb).toBe('BD987654321');
      expect(result.isNdr).toBe(true);
      expect(result.phone).toBe('9876543210');
      expect(result.externalOrderId).toBe('ORD-101');
      expect(result.reason).toBe('Premises Closed');
    });

    it('parses Xpressbees webhook payload correctly', () => {
      const mockReq: any = {
        body: {
          awb: 'XB123456789',
          status: 'UNDELIVERED',
          remarks: 'Customer asked to deliver tomorrow',
          order_id: 'ORD-202',
          phone: '9888877777',
        },
        path: '/ndr',
        get: () => null,
      };

      const result: any = parseXpressbeesWebhook(mockReq);
      expect(result.awb).toBe('XB123456789');
      expect(result.isNdr).toBe(true);
      expect(result.externalOrderId).toBe('ORD-202');
      expect(result.reason).toBe('Customer asked to deliver tomorrow');
    });

    it('parses Shadowfax webhook payload correctly', () => {
      const mockReq: any = {
        body: {
          awb_number: 'SF555666777',
          status: 'delivery_failed',
          failure_reason: 'Address incomplete',
          client_order_id: 'ORD-303',
          contact_number: '9111122222',
        },
        path: '/ndr',
        get: () => null,
      };

      const result: any = parseShadowfaxWebhook(mockReq);
      expect(result.awb).toBe('SF555666777');
      expect(result.isNdr).toBe(true);
      expect(result.externalOrderId).toBe('ORD-303');
      expect(result.reason).toBe('Address incomplete');
    });
  });

  describe('3. Multi-Carrier Credential Saving & Disconnect', () => {
    it('allows connecting multiple couriers simultaneously without overwriting', async () => {
      // Connect Blue Dart
      const bdRes = await carrierConnectService.validateAndSave(testMerchantId, {
        provider: 'bluedart',
        loginId: 'TEST_BD_LOGIN',
        licenseKey: 'TEST_BD_KEY',
        customerCode: 'CUST_123',
      });
      expect(bdRes.status).toBe('connected');
      expect(bdRes.provider).toBe('bluedart');

      // Connect Xpressbees
      const xbRes = await carrierConnectService.validateAndSave(testMerchantId, {
        provider: 'xpressbees',
        apiKey: 'XB_TEST_API_KEY_999',
      });
      expect(xbRes.status).toBe('connected');
      expect(xbRes.provider).toBe('xpressbees');

      // Verify both exist simultaneously in mockMerchantStore
      const carriers = mockMerchantStore.carrierConfig?.carriers;
      expect(carriers).toBeDefined();
      expect(carriers.bluedart).toBeDefined();
      expect(carriers.xpressbees).toBeDefined();
      expect(mockMerchantStore.connections?.carriers?.bluedart?.status).toBe('connected');
      expect(mockMerchantStore.connections?.carriers?.xpressbees?.status).toBe('connected');
    });

    it('generates webhook credentials list for all 6 top providers', async () => {
      const creds = await carrierConnectService.webhookCredentials(testMerchantId);
      expect(creds.carriers).toBeDefined();
      expect(creds.carriers.length).toBe(6);

      const bdInfo = creds.carriers.find((c) => c.provider === 'bluedart');
      const xbInfo = creds.carriers.find((c) => c.provider === 'xpressbees');
      const srInfo = creds.carriers.find((c) => c.provider === 'shiprocket');

      expect(bdInfo?.status).toBe('connected');
      expect(bdInfo?.webhookUrl).toContain('/webhooks/bluedart/ndr');
      expect(bdInfo?.webhookSecret).toBeTruthy();

      expect(xbInfo?.status).toBe('connected');
      expect(xbInfo?.webhookUrl).toContain('/webhooks/xpressbees/ndr');
      expect(xbInfo?.webhookSecret).toBeTruthy();

      expect(srInfo?.status).toBe('disconnected');
    });

    it('allows disconnecting an individual courier while retaining others', async () => {
      // Disconnect Blue Dart only
      await carrierConnectService.disconnectCarrier(testMerchantId, 'bluedart');

      const carriers = mockMerchantStore.carrierConfig?.carriers;
      expect(carriers.bluedart).toBeUndefined();
      expect(carriers.xpressbees).toBeDefined();
      expect(mockMerchantStore.connections?.carriers?.bluedart).toBeUndefined();
      expect(mockMerchantStore.connections?.carriers?.xpressbees?.status).toBe('connected');
    });
  });

  describe('4. Logistics Service Dynamic Multi-Carrier Action Dispatching', () => {
    it('dispatches reschedule action to Blue Dart in test mode', async () => {
      const res = await logisticsService.rescheduleDelivery('bluedart', {
        awb: 'BD_AWB_001',
        newDate: '2026-10-10',
        reason: 'Customer requested weekend delivery',
      }, {
        loginId: 'TEST_LOGIN',
        licenseKey: 'TEST_KEY',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Blue Dart');
    });

    it('dispatches address update action to Xpressbees in test mode', async () => {
      const res = await logisticsService.updateDeliveryAddress('xpressbees', {
        awb: 'XB_AWB_002',
        address: 'Flat 402, Sunshine Towers, Sector 62',
        city: 'Noida',
        pincode: '201301',
        phone: '9888877777',
      }, {
        apiKey: 'XB_KEY_123',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Xpressbees');
    });

    it('dispatches RTO / cancellation action to Shadowfax in test mode', async () => {
      const res = await logisticsService.cancelDelivery('shadowfax', {
        awb: 'SF_AWB_003',
        reason: 'Customer cancelled COD order',
      }, {
        apiToken: 'SF_TOKEN_456',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Shadowfax');
    });
  });
});
