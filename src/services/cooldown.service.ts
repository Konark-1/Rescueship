import { Order, DeliveryAttempt } from '../models';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { logger } from '../utils/logger';

export class CooldownService {
  private static instance: CooldownService;

  private constructor() {}

  public static getInstance(): CooldownService {
    if (!CooldownService.instance) {
      CooldownService.instance = new CooldownService();
    }
    return CooldownService.instance;
  }

  /**
   * Check if a customer has exceeded the anti-farming serial cancellation threshold.
   *
   * Requirement:
   * Query Order (or DeliveryAttempt) collection:
   * Count records where:
   *   - customerPhone matches
   *   - merchantId matches
   *   - status is in ['rto', 'cancelled', 'returned']
   *   - createdAt >= (Date.now() - 30 days)
   * Return true if count >= 3, else false.
   */
  public async checkAntiFarmingCooldown(customerPhone: string, merchantId: string): Promise<boolean> {
    if (!customerPhone || !merchantId) {
      return false;
    }

    try {
      const normalizedPhone = normalizeIndianPhone(customerPhone);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Query Order collection for matching orders within the 30-day window
      const count = await Order.countDocuments({
        $or: [
          { customerPhone: normalizedPhone },
          { customerPhone: customerPhone },
          { 'customer.phone': normalizedPhone },
          { 'customer.phone': customerPhone },
        ],
        merchantId,
        status: { $in: ['rto', 'cancelled', 'returned'] },
        createdAt: { $gte: thirtyDaysAgo },
      });

      const isCooldown = count >= 3;

      if (isCooldown) {
        logger.warn(`[ANTI-FARMING] Cooldown triggered for phone ${customerPhone}`, {
          phone: customerPhone,
          merchantId,
          count,
        });
      }

      return isCooldown;
    } catch (err: any) {
      logger.error('Error in checkAntiFarmingCooldown', {
        error: err.message,
        phone: customerPhone,
        merchantId,
      });
      // Fail closed or default to false
      return false;
    }
  }
}

export const cooldownService = CooldownService.getInstance();
export const checkAntiFarmingCooldown = (phone: string, merchantId: string) =>
  cooldownService.checkAntiFarmingCooldown(phone, merchantId);
