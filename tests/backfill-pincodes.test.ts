/**
 * backfill-pincodes.test.ts
 *
 * Unit tests for idempotent pincode and location backfill script.
 */

import { backfillPincodes } from '../scripts/backfill-pincodes';
import { Order, WebhookEvent } from '../src/models';

jest.mock('../src/models', () => ({
  Order: {
    find: jest.fn(),
    updateOne: jest.fn(),
  },
  WebhookEvent: {
    findOne: jest.fn(),
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('backfillPincodes', () => {
  const merchantId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('backfills pincode, city, and state from embedded shippingAddress', async () => {
    const mockOrder = {
      _id: 'order1',
      merchantId,
      externalOrderId: '1001',
      shippingAddress: {
        zip: '110001',
        city: 'New Delhi',
        province: 'Delhi',
      },
    };

    const mockCursor = {
      batchSize: jest.fn().mockReturnThis(),
      [Symbol.asyncIterator]: async function* () {
        yield mockOrder;
      },
    };

    (Order.find as jest.Mock).mockReturnValue({
      cursor: jest.fn().mockReturnValue(mockCursor),
    });

    const result = await backfillPincodes({ merchantId, dryRun: false });

    expect(result.totalScanned).toBe(1);
    expect(result.backfilledCount).toBe(1);
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: 'order1' },
      {
        $set: {
          shippingPincode: '110001',
          shippingCity: 'New Delhi',
          shippingState: 'Delhi',
        },
      }
    );
  });

  it('falls back to matching WebhookEvent rawPayload when shippingAddress is empty', async () => {
    const mockOrder = {
      _id: 'order2',
      merchantId,
      externalOrderId: '1002',
      shippingAddress: null,
    };

    const mockWebhook = {
      rawPayload: {
        shipping_address: {
          zip: '560001',
          city: 'Bengaluru',
          province: 'Karnataka',
        },
      },
    };

    const mockCursor = {
      batchSize: jest.fn().mockReturnThis(),
      [Symbol.asyncIterator]: async function* () {
        yield mockOrder;
      },
    };

    (Order.find as jest.Mock).mockReturnValue({
      cursor: jest.fn().mockReturnValue(mockCursor),
    });

    (WebhookEvent.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockWebhook),
    });

    const result = await backfillPincodes({ merchantId, dryRun: false });

    expect(result.totalScanned).toBe(1);
    expect(result.backfilledCount).toBe(1);
    expect(WebhookEvent.findOne).toHaveBeenCalled();
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: 'order2' },
      {
        $set: {
          shippingPincode: '560001',
          shippingCity: 'Bengaluru',
          shippingState: 'Karnataka',
        },
      }
    );
  });

  it('respects dryRun option and skips Order.updateOne', async () => {
    const mockOrder = {
      _id: 'order3',
      merchantId,
      externalOrderId: '1003',
      shippingAddress: {
        zip: '400001',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
    };

    const mockCursor = {
      batchSize: jest.fn().mockReturnThis(),
      [Symbol.asyncIterator]: async function* () {
        yield mockOrder;
      },
    };

    (Order.find as jest.Mock).mockReturnValue({
      cursor: jest.fn().mockReturnValue(mockCursor),
    });

    const result = await backfillPincodes({ merchantId, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.backfilledCount).toBe(1);
    expect(Order.updateOne).not.toHaveBeenCalled();
  });
});
