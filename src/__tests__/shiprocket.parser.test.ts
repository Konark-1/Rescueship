import { parseShiprocketWebhook } from '../webhooks/shiprocket.webhook';
import shiprocketV2Fixture from './fixtures/shiprocket.ndr.mock.json';

describe('TASK 3.1: Shiprocket v2 API Mock Modernization', () => {
  it('3.1.1: loads the Shiprocket v2 fixture conforming to nested data schema', () => {
    expect(shiprocketV2Fixture.data).toBeDefined();
    expect(shiprocketV2Fixture.data.shipment_status).toBe('RTO INITIATED');
    expect(shiprocketV2Fixture.data.awb_code).toBe('12345');
    expect(shiprocketV2Fixture.data.order_id).toBe('999');
    expect(shiprocketV2Fixture.data.etd).toBe('2026-10-08 14:00:00');

    // Root level keys must NOT be present in v2 schema
    expect((shiprocketV2Fixture as any).current_status).toBeUndefined();
    expect((shiprocketV2Fixture as any).awb).toBeUndefined();
  });

  it('3.1.2: parser extracts data.shipment_status and data.awb_code from v2 schema', () => {
    const req: any = {
      body: shiprocketV2Fixture,
      path: '/tracking',
      get: jest.fn(),
    };

    const parsed = parseShiprocketWebhook(req);
    expect('error' in parsed).toBe(false);

    if (!('error' in parsed)) {
      expect(parsed.awb).toBe('12345');
      expect(parsed.externalOrderId).toBe('999');
      expect(parsed.status).toBe('RTO_INITIATED');
      expect(parsed.isNdr).toBe(false);
      expect(parsed.attemptTime).toEqual(new Date('2026-10-08 14:00:00'));
    }
  });

  it('3.1.3: parser fails if trying to read root-level fields when payload only contains root undefined', () => {
    // If a mock or carrier supplies empty root without data or v1 keys, parser returns error
    const reqEmpty: any = {
      body: { some_unrelated_field: 'unknown' },
      path: '/tracking',
      get: jest.fn(),
    };

    const parsed = parseShiprocketWebhook(reqEmpty);
    expect('error' in parsed).toBe(true);
    if ('error' in parsed) {
      expect(parsed.error).toBe('Missing awb or order_id in payload');
    }
  });

  it('3.1.4: parser parses v2 NDR payload with nested data correctly', () => {
    const v2NdrPayload = {
      data: {
        shipment_status: 'UNDELIVERED',
        awb_code: 'AWB_V2_NDR_789',
        order_id: 'ORD_V2_789',
        ndr_reason: 'Customer not reachable after 3 calls',
        customer_phone: '+919876543210',
        etd: '2026-10-08 18:30:00',
      },
    };

    const req: any = {
      body: v2NdrPayload,
      path: '/ndr',
      get: jest.fn(),
    };

    const parsed = parseShiprocketWebhook(req);
    expect('error' in parsed).toBe(false);
    if (!('error' in parsed)) {
      expect(parsed.awb).toBe('AWB_V2_NDR_789');
      expect(parsed.externalOrderId).toBe('ORD_V2_789');
      expect(parsed.status).toBe('UNDELIVERED');
      expect(parsed.isNdr).toBe(true);
      expect(parsed.reason).toBe('Customer not reachable after 3 calls');
      expect(parsed.phone).toBe('+919876543210');
    }
  });
});
