process.env.ENCRYPTION_KEY = 'this_is_a_very_secret_encryption_key_32';
process.env.NODE_ENV = 'test';

let mockMerchantStore: any = {
  _id: '6aa2874f2b6be7572c5c0289',
  name: 'Multi Carrier Test Store',
  carrierConfig: {},
  connections: {},
};

jest.mock('../src/models', () => {
  const original = jest.requireActual('../src/models');
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

import { carrierConnectService } from '../src/services/carrier-connect.service';
import { logisticsService } from '../src/services/logistics.service';
import { normalizeCarrierStatus } from '../src/services/courier/shipment-status.map';
import { parseBluedartWebhook } from '../src/webhooks/bluedart.webhook';
import { parseXpressbeesWebhook } from '../src/webhooks/xpressbees.webhook';
import { parseShadowfaxWebhook } from '../src/webhooks/shadowfax.webhook';
import { parseEcomexpressWebhook } from '../src/webhooks/ecomexpress.webhook';
import { parseDtdcWebhook } from '../src/webhooks/dtdc.webhook';
import { parseCustomWebhook } from '../src/webhooks/custom.webhook';

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

    it('normalizes Ecom Express status codes properly', () => {
      expect(normalizeCarrierStatus('ecomexpress', 'UD', 'Customer not reachable')).toEqual({
        normalizedStatus: 'ndr_detected',
        isNdr: true,
        isTerminal: false,
      });

      expect(normalizeCarrierStatus('ecomexpress', 'DL')).toEqual({
        normalizedStatus: 'delivered',
        isNdr: false,
        isTerminal: true,
      });

      expect(normalizeCarrierStatus('ecomexpress', 'RTO')).toEqual({
        normalizedStatus: 'rto_initiated',
        isNdr: false,
        isTerminal: false,
      });
    });

    it('normalizes DTDC status codes properly', () => {
      expect(normalizeCarrierStatus('dtdc', 'NOT_DELIVERED', 'Door locked')).toEqual({
        normalizedStatus: 'ndr_detected',
        isNdr: true,
        isTerminal: false,
      });

      expect(normalizeCarrierStatus('dtdc', 'DELIVERED')).toEqual({
        normalizedStatus: 'delivered',
        isNdr: false,
        isTerminal: true,
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

    it('parses Ecom Express webhook payload correctly', () => {
      const mockReq: any = {
        body: {
          airwaybill_number: 'EE444555666',
          reason_code: 'UD',
          reason: 'Customer not reachable on phone',
          order_number: 'ORD-404',
          mobile: '9777788888',
        },
        path: '/ndr',
        get: () => null,
      };

      const result: any = parseEcomexpressWebhook(mockReq);
      expect(result.awb).toBe('EE444555666');
      expect(result.isNdr).toBe(true);
      expect(result.externalOrderId).toBe('ORD-404');
      expect(result.reason).toBe('Customer not reachable on phone');
      expect(result.phone).toBe('9777788888');
    });

    it('parses DTDC webhook payload correctly', () => {
      const mockReq: any = {
        body: {
          consignment_number: 'DTDC111222333',
          status: 'NOT_DELIVERED',
          remarks: 'Premises locked on visit',
          reference_number: 'ORD-505',
          contact: '9666677777',
        },
        path: '/ndr',
        get: () => null,
      };

      const result: any = parseDtdcWebhook(mockReq);
      expect(result.awb).toBe('DTDC111222333');
      expect(result.isNdr).toBe(true);
      expect(result.reason).toBe('Premises locked on visit');
      expect(result.phone).toBe('9666677777');
    });

    it('parses Custom / Aggregator webhook payload correctly', () => {
      const mockReq: any = {
        body: {
          waybill: 'NIMBUS_998877',
          status: 'UNDELIVERED',
          reason: 'Customer requested evening delivery',
          order_id: 'ORD-NIM-01',
          recipient_phone: '9555544444',
        },
        path: '/ndr',
        get: () => null,
      };

      const result: any = parseCustomWebhook(mockReq);
      expect(result.awb).toBe('NIMBUS_998877');
      expect(result.isNdr).toBe(true);
      expect(result.reason).toBe('Customer requested evening delivery');
      expect(result.phone).toBe('9555544444');
      expect(result.externalOrderId).toBe('ORD-NIM-01');
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

    it('connects a carrier in Webhook-Only mode without requiring API keys', async () => {
      const hookRes = await carrierConnectService.validateAndSave(testMerchantId, {
        provider: 'dtdc',
        webhookOnly: true,
      });

      expect(hookRes.status).toBe('connected');
      expect(hookRes.provider).toBe('dtdc');
      expect(hookRes.webhookUrl).toContain('/webhooks/dtdc/ndr');

      const carriers = mockMerchantStore.carrierConfig?.carriers;
      expect(carriers.dtdc).toBeDefined();
      expect(carriers.dtdc.mode).toBe('webhook_only');
      expect(mockMerchantStore.connections?.carriers?.dtdc?.status).toBe('connected');
    });

    it('generates webhook credentials list for all 9 top and custom providers', async () => {
      const creds = await carrierConnectService.webhookCredentials(testMerchantId);
      expect(creds.carriers).toBeDefined();
      expect(creds.carriers.length).toBe(9);

      const bdInfo = creds.carriers.find((c) => c.provider === 'bluedart');
      const xbInfo = creds.carriers.find((c) => c.provider === 'xpressbees');
      const srInfo = creds.carriers.find((c) => c.provider === 'shiprocket');
      const eeInfo = creds.carriers.find((c) => c.provider === 'ecomexpress');
      const dtdcInfo = creds.carriers.find((c) => c.provider === 'dtdc');
      const customInfo = creds.carriers.find((c) => c.provider === 'custom');

      expect(customInfo).toBeDefined();
      expect(customInfo?.webhookUrl).toContain('/webhooks/custom/ndr');

      expect(bdInfo?.status).toBe('connected');
      expect(bdInfo?.webhookUrl).toContain('/webhooks/bluedart/ndr');
      expect(bdInfo?.webhookSecret).toBeTruthy();

      expect(xbInfo?.status).toBe('connected');
      expect(xbInfo?.webhookUrl).toContain('/webhooks/xpressbees/ndr');
      expect(xbInfo?.webhookSecret).toBeTruthy();

      expect(srInfo?.status).toBe('disconnected');
      expect(eeInfo?.status).toBe('disconnected');
      expect(eeInfo?.webhookUrl).toContain('/webhooks/ecomexpress/ndr');
      expect(dtdcInfo?.status).toBe('connected');
      expect(dtdcInfo?.mode).toBe('webhook_only');
      expect(dtdcInfo?.webhookUrl).toContain('/webhooks/dtdc/ndr');
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

    it('dispatches reschedule action to Ecom Express in test mode', async () => {
      const res = await logisticsService.rescheduleDelivery('ecomexpress', {
        awb: 'EE_AWB_004',
        newDate: '2026-10-12',
        reason: 'Customer requested reschedule',
      }, {
        username: 'TEST_EE_USER',
        password: 'TEST_EE_PASS',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Ecom Express');
    });

    it('dispatches address update action to DTDC in test mode', async () => {
      const res = await logisticsService.updateDeliveryAddress('dtdc', {
        awb: 'DTDC_AWB_005',
        address: 'Plot 15, Knowledge Park III',
        city: 'Greater Noida',
        pincode: '201308',
        phone: '9666677777',
      }, {
        apiKey: 'DTDC_TOKEN_789',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('DTDC');
    });

    it('dispatches action to custom / aggregator courier cleanly', async () => {
      const res = await logisticsService.rescheduleDelivery('custom', {
        awb: 'NIMBUS_998877',
        reason: 'Customer requested evening slot',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('custom courier');
    });

    it('gracefully records action for courier in webhook-only mode without throwing', async () => {
      const res = await logisticsService.rescheduleDelivery(
        'bluedart',
        {
          awb: 'BD_HOOK_ONLY_001',
          newDate: '2026-10-14',
          reason: 'Customer requested delay',
        },
        {
          mode: 'webhook_only',
        }
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('Webhook-Only mode');
      expect(res.carrierResponse?.webhookOnly).toBe(true);
    });
  });
});
