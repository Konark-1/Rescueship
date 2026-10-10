import { geminiService } from '../src/services/gemini.service';
import { rtoRiskService } from '../src/services/rto-risk.service';
import { redisConnection } from '../src/config/redis';
import { Order, Merchant } from '../src/models';
import { Types } from 'mongoose';

// Mock fetch for Gemini API
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock Redis
jest.mock('../src/config/redis', () => ({
  redisConnection: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

// In-Memory Database Store for Model Mocks
const ordersStore: any[] = [];
const merchantsStore: any[] = [];

jest.mock('../src/models', () => {
  const original = jest.requireActual('../src/models');
  return {
    ...original,
    Order: {
      create: jest.fn().mockImplementation(async (data: any) => {
        ordersStore.push(data);
        return data;
      }),
      aggregate: jest.fn().mockImplementation(async (pipeline: any[]) => {
        const matchStage = pipeline.find((s) => s.$match)?.$match;
        let matched = ordersStore;
        if (matchStage) {
          matched = ordersStore.filter((o) => {
            if (matchStage.merchantId && o.merchantId?.toString() !== matchStage.merchantId?.toString()) {
              return false;
            }
            if (matchStage.shippingPincode && o.shippingPincode !== matchStage.shippingPincode) {
              return false;
            }
            if (matchStage.customerPhone?.$in && !matchStage.customerPhone.$in.includes(o.customerPhone)) {
              return false;
            }
            if (matchStage.customerPhone && typeof matchStage.customerPhone === 'string' && o.customerPhone !== matchStage.customerPhone) {
              return false;
            }
            return true;
          });
        }
        if (matched.length === 0) return [];
        const total = matched.length;
        const rto = matched.filter((o) => ['rto', 'returned', 'cancelled'].includes(o.status)).length;
        return [{ _id: null, total, rto, totalOrders: total, failedOrders: rto }];
      }),
    },
    Merchant: {
      create: jest.fn().mockImplementation(async (data: any) => {
        merchantsStore.push(data);
        return data;
      }),
    },
  };
});

describe('Phase 5: AI & Predictive Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ordersStore.length = 0;
    merchantsStore.length = 0;
    process.env.GEMINI_API_KEY = 'test-key';
  });

  // Test 1: Gemini address parsing
  it('Test 1: Parses complex Hinglish address into structured JSON', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  flatOrHouseNo: '42',
                  landmark: 'Red Gate',
                  driverNote: 'Call on reaching',
                  cleanAddress: 'House 42, Near Red Gate, Sector 7',
                  pincode: '110092',
                  confidence: 0.95,
                }),
              },
            ],
          },
        },
      ],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockResponse });
    (redisConnection.get as jest.Mock).mockResolvedValueOnce(null);

    const result = await geminiService.parseAddress('makan no 42, red gate ke paas, call karna, 110092');

    expect(result).not.toBeNull();
    expect(result?.flatOrHouseNo).toBe('42');
    expect(result?.landmark).toBe('Red Gate');
    expect(result?.pincode).toBe('110092');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Test 2: Fallback heuristic parsing (Gemini disabled)
  it('Test 2: Returns null when Gemini API key is missing (triggers fallback)', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await geminiService.parseAddress('some address');
    expect(result).toBeNull();
  });

  // Test 3: RTO Risk Scoring (LOW)
  it('Test 3: Scores clean, low-value order as LOW risk', async () => {
    const merchantId = new Types.ObjectId().toString();
    const risk = await rtoRiskService.assessOrder(merchantId, {
      customerPhone: '+919876543210',
      orderValue: 500,
      pincode: '110001',
      address: 'House 12, Sector 5, New Delhi, 110001',
    });
    expect(risk.level).toBe('LOW');
    expect(risk.recommendedAction).toBe('auto_ship');
  });

  // Test 4: Repeat offender detection (HIGH risk)
  it('Test 4: Flags repeat offender phone as HIGH risk', async () => {
    const mId = new Types.ObjectId();
    await Merchant.create({ _id: mId, billing: { rescueCredits: 10 } });

    // Seed 3 prior RTO orders for this phone
    for (let i = 0; i < 3; i++) {
      await Order.create({
        merchantId: mId,
        externalOrderId: `RTO-${i}`,
        customerPhone: '+919999999999',
        orderValue: 1000,
        paymentMethod: 'cod',
        status: 'rto',
      });
    }

    const risk = await rtoRiskService.assessOrder(mId.toString(), {
      customerPhone: '+919999999999',
      orderValue: 1000,
    });
    expect(risk.factors).toContain('repeat_offender_rto');
    expect(risk.score).toBeGreaterThanOrEqual(25);
  });

  // Test 5: Redis cache hit verification
  it('Test 5: Returns cached result for identical address strings', async () => {
    const cachedData = { cleanAddress: 'Cached Addr', confidence: 0.9, landmark: 'X', driverNote: 'Y' };
    (redisConnection.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

    const result = await geminiService.parseAddress('duplicate address text');

    expect(result).toEqual(cachedData);
    expect(mockFetch).not.toHaveBeenCalled(); // Gemini API should NOT be called
  });

  // Test 6: Dynamic regional pincode risk factor
  it('Test 6: Elevates risk score for orders in remote/high-risk pincode clusters', async () => {
    const merchantId = new Types.ObjectId().toString();
    const risk = await rtoRiskService.assessOrder(merchantId, {
      customerPhone: '+919876543210',
      orderValue: 500,
      pincode: '781001', // Remote Northeast (0.32 heuristic risk score)
      address: 'Flat 4B, Sector 3, Guwahati, 781001',
    });

    expect(risk.factors).toContain('moderate_rto_pincode_risk');
    expect(risk.score).toBeGreaterThanOrEqual(10);
  });

  // Test 7: Historical failure hotspot triggers critical_rto_pincode_hotspot
  it('Test 7: Elevates risk and tags hotspot when postal code has >= 50% historical RTO rate', async () => {
    const mId = new Types.ObjectId();
    const testPin = '800001';

    // Seed 4 orders with 3 failures (75% failure rate)
    for (let i = 0; i < 4; i++) {
      ordersStore.push({
        merchantId: mId,
        shippingPincode: testPin,
        status: i < 3 ? 'rto' : 'delivered',
        createdAt: new Date(),
      });
    }

    const risk = await rtoRiskService.assessOrder(mId.toString(), {
      customerPhone: '+919876543210',
      orderValue: 500,
      pincode: testPin,
      address: 'House 14, Main Road, Patna, 800001',
    });

    expect(risk.factors).toContain('critical_rto_pincode_hotspot');
    expect(risk.score).toBeGreaterThanOrEqual(35);
  });
});
