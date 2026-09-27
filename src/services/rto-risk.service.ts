import { Types } from 'mongoose';
import { Order } from '../models';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { logger } from '../utils/logger';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecommendedAction = 'auto_ship' | 'whatsapp_verify' | 'require_deposit' | 'manual_review';

export interface RiskAssessment {
  score: number; // 0 to 100
  level: RiskLevel;
  factors: string[];
  recommendedAction: RecommendedAction;
  scoredAt: Date;
}

export class RtoRiskService {
  private static instance: RtoRiskService;

  public static getInstance(): RtoRiskService {
    if (!RtoRiskService.instance) {
      RtoRiskService.instance = new RtoRiskService();
    }
    return RtoRiskService.instance;
  }

  async assessOrder(
    merchantId: string,
    input: { customerPhone: string; orderValue: number; pincode?: string; address?: string }
  ): Promise<RiskAssessment> {
    const mId = new Types.ObjectId(merchantId);
    const phone = normalizeIndianPhone(input.customerPhone);
    let score = 0;
    const factors: string[] = [];

    // 1. Address Incompleteness Factor (+10 to +30 pts)
    const addr = input.address || '';
    if (addr.length < 20) {
      score += 30;
      factors.push('incomplete_address_truncated');
    } else if (!/\b\d{6}\b/.test(addr) && !/flat|house|makan|floor|manzil/i.test(addr)) {
      score += 15;
      factors.push('incomplete_address_no_flat_pincode');
    }

    // 2. Pincode Risk Factor (+5 to +25 pts)
    if (input.pincode) {
      if (['111111', '123456', '999999', '000000'].includes(input.pincode)) {
        score += 25;
        factors.push('dummy_pincode');
      }
    }

    // 3. Contactability Factor (+10 to +25 pts)
    if (!phone || phone.length < 12) {
      score += 25;
      factors.push('invalid_phone_format');
    } else if (/^(\d)\1+$/.test(phone.slice(-10))) { // Repetitive digits like 9999999999
      score += 15;
      factors.push('repetitive_phone_sequence');
    }

    // 4. High-Ticket COD Factor (+10 to +20 pts)
    if (input.orderValue >= 2500) {
      score += 20;
      factors.push('high_cod_value');
    } else if (input.orderValue >= 1500) {
      score += 10;
      factors.push('medium_cod_value');
    }

    // 5. Historical Merchant Repetition (+25 pts)
    const phoneVariants = Array.from(
      new Set([phone, `+${phone}`, input.customerPhone, input.customerPhone?.replace(/^\+/, '')].filter(Boolean))
    );

    if (Order && typeof Order.aggregate === 'function') {
      try {
        const hist = await Order.aggregate([
          { $match: { merchantId: mId, customerPhone: { $in: phoneVariants } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              rto: { $sum: { $cond: [{ $in: ['$status', ['rto', 'returned', 'cancelled']] }, 1, 0] } },
            },
          },
        ]);
        const h = hist[0];
        if (h && h.total >= 2 && h.rto / h.total >= 0.4) {
          score += 25;
          factors.push('repeat_offender_rto');
        }
      } catch (err: any) {
        logger.warn('Failed to calculate historical RTO aggregation', { error: err?.message });
      }
    }

    // Cap score at 100
    score = Math.min(100, score);

    // Classify Risk Level
    let level: RiskLevel;
    let recommendedAction: RecommendedAction;

    if (score >= 65) {
      level = 'HIGH';
      recommendedAction = score >= 85 ? 'manual_review' : 'require_deposit';
    } else if (score >= 30) {
      level = 'MEDIUM';
      recommendedAction = 'whatsapp_verify';
    } else {
      level = 'LOW';
      recommendedAction = 'auto_ship';
    }

    logger.info('RTO Risk Assessment complete', { merchantId, phone, score, level, factors });

    return {
      score,
      level,
      factors,
      recommendedAction,
      scoredAt: new Date(),
    };
  }
}

export const rtoRiskService = RtoRiskService.getInstance();
