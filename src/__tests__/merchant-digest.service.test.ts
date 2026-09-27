import { merchantDigestService } from '../services/merchant-digest.service';
import { emailService } from '../services/email.service';
import { Merchant } from '../models';

jest.mock('../services/email.service', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendOrderLimitWarning: jest.fn().mockResolvedValue(true),
    sendOrderLimitExhausted: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../models', () => ({
  Merchant: {
    findById: jest.fn(),
  },
}));

describe('MerchantDigestService - Unit Tests', () => {
  const mockMerchantId = '660f1b2c3d4e5f6a7b8c9d0e';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should ignore non-digest events like stats_refresh', async () => {
    await merchantDigestService.bufferEvent({
      merchantId: mockMerchantId,
      type: 'stats_refresh',
      payload: { message: 'hello' },
    });

    const sent = await merchantDigestService.flushMerchantDigest(mockMerchantId);
    expect(sent).toBe(false);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('should buffer operational events and send a formatted digest email upon flush', async () => {
    (Merchant.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: mockMerchantId,
        storeName: 'Acme Fashion',
        ownerEmail: 'owner@acmefashion.com',
      }),
    });

    // Buffer 3 events
    await merchantDigestService.bufferEvent({
      merchantId: mockMerchantId,
      type: 'ndr_detected',
      payload: { orderId: 'ORD-101', awb: 'AWB999', reason: 'Customer unavailable' },
    });

    await merchantDigestService.bufferEvent({
      merchantId: mockMerchantId,
      type: 'ndr_rescued',
      payload: { orderId: 'ORD-102', awb: 'AWB888', amount: 1500 },
    });

    await merchantDigestService.bufferEvent({
      merchantId: mockMerchantId,
      type: 'payment_received',
      payload: { orderId: 'ORD-103', amount: 2400 },
    });

    const sent = await merchantDigestService.flushMerchantDigest(mockMerchantId);
    expect(sent).toBe(true);

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const callArgs = (emailService.sendEmail as jest.Mock).mock.calls[0][0];

    expect(callArgs.to).toBe('owner@acmefashion.com');
    expect(callArgs.subject).toContain('RescueShip Hourly Digest');
    expect(callArgs.subject).toContain('Acme Fashion');
    expect(callArgs.html).toContain('Rescues Completed');
    expect(callArgs.html).toContain('ORD-101');
    expect(callArgs.html).toContain('ORD-102');
  });

  it('should return false on subsequent flush when buffer has been cleared', async () => {
    const sent = await merchantDigestService.flushMerchantDigest(mockMerchantId);
    expect(sent).toBe(false);
  });

  it('should trigger immediate warning when capacity reaches >= 80% and < 100%', async () => {
    (Merchant.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: mockMerchantId,
        storeName: 'Acme Fashion',
        ownerEmail: 'owner@acmefashion.com',
      }),
    });

    await merchantDigestService.bufferEvent({
      merchantId: mockMerchantId,
      type: 'capacity_warning',
      payload: { used: 4000, limit: 5000, percentage: 80 },
    });

    expect(emailService.sendOrderLimitWarning).toHaveBeenCalledWith(
      'owner@acmefashion.com',
      'Acme Fashion',
      4000,
      5000,
      80
    );
  });

  it('should trigger immediate exhausted alert when capacity reaches >= 100%', async () => {
    const exhaustedMerchantId = '660f1b2c3d4e5f6a7b8c9d0f';
    (Merchant.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: exhaustedMerchantId,
        storeName: 'Acme Fashion',
        ownerEmail: 'owner@acmefashion.com',
      }),
    });

    await merchantDigestService.bufferEvent({
      merchantId: exhaustedMerchantId,
      type: 'capacity_warning',
      payload: { used: 5000, limit: 5000, percentage: 100 },
    });

    expect(emailService.sendOrderLimitExhausted).toHaveBeenCalledWith(
      'owner@acmefashion.com',
      'Acme Fashion',
      5000,
      5000
    );
  });

  it('should deduplicate quota alert so repeated events do not spam', async () => {
    (Merchant.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: mockMerchantId,
        storeName: 'Acme Fashion',
        ownerEmail: 'owner@acmefashion.com',
      }),
    });

    (emailService.sendOrderLimitWarning as jest.Mock).mockClear();

    // Trigger 80% again for the same merchant
    await merchantDigestService.bufferEvent({
      merchantId: mockMerchantId,
      type: 'capacity_warning',
      payload: { used: 4100, limit: 5000, percentage: 82 },
    });

    // Should NOT have sent another email due to deduplication
    expect(emailService.sendOrderLimitWarning).not.toHaveBeenCalled();
  });
});
