import { emailService } from '../services/email.service';

describe('EmailService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send merchant welcome email', async () => {
    const result = await emailService.sendMerchantWelcome('test@merchant.com', 'Test Merchant');
    expect(result).toBe(true);
  });

  it('should send low credit alert email', async () => {
    const result = await emailService.sendLowCreditsAlert('test@merchant.com', 'Test Merchant', 5);
    expect(result).toBe(true);
  });

  it('should send monthly summary report email', async () => {
    const reportData = {
      totalOrders: 100,
      rescuedOrders: 40,
      rescueRate: 40,
      totalRevenueSaved: 50000,
    };
    const result = await emailService.sendMonthlySummaryReport('test@merchant.com', 'Test Merchant', reportData);
    expect(result).toBe(true);
  });
});
