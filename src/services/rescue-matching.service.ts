/**
 * rescue-matching.service.ts  (revised — WABA-scoped)
 * ─────────────────────────────────────────────────────────────
 * Resolves "which order is this inbound reply about?" SAFELY.
 *
 * Cross-tenant safety comes from the WEBHOOK, not from here: the
 * webhook maps metadata.phone_number_id → merchantId (unique index),
 * so we only ever look within ONE merchant. Here we then:
 *   1. list that merchant's active rescue orders for the phone,
 *   2. tie-break by the order we most recently messaged (recency),
 *   3. if >1 still tie → DO NOT GUESS → return ambiguous + candidates,
 *      so the caller asks the customer to pick by reference.
 *
 * This supersedes the earlier cross-merchant recency heuristic.
 */
import { Order } from '../models';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { logger } from '../utils/logger';

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES: ('new' | 'cod_conversion_sent' | 'converted_to_prepaid' | 'shipped' | 'ndr_detected' | 'ndr_rescue_sent' | 'ndr_rescued' | 'delivered' | 'rto')[] = ['ndr_rescue_sent', 'cod_conversion_sent'];

export interface MatchCandidate { orderId: string; externalOrderId: string; productHint: string; }
export interface MatchResult { matched: boolean; ambiguous: boolean; order?: any; candidates?: MatchCandidate[]; }

class RescueMatchingService {
  private static i: RescueMatchingService;
  static getInstance() { return (this.i ||= new RescueMatchingService()); }

  async resolveInbound(merchantId: string, rawPhone: string): Promise<MatchResult> {
    const phone = normalizeIndianPhone(rawPhone);
    const rows = await Order.find({ merchantId: merchantId as any, customerPhone: phone, status: { $in: ACTIVE_STATUSES } as any })
      .sort({ 'ndr.lastOutboundAt': -1 }).limit(10).lean();
    if (rows.length === 0) return { matched: false, ambiguous: false };

    const now = Date.now();
    const recent = rows.filter((o: any) => o.ndr?.lastOutboundAt && now - new Date(o.ndr.lastOutboundAt).getTime() <= SESSION_WINDOW_MS);

    if (recent.length === 1) return { matched: true, ambiguous: false, order: await Order.findById(recent[0]._id) };
    if (recent.length > 1) {
      logger.warn('Ambiguous inbound — multiple active orders in session window (same merchant)', { merchantId, phone, n: recent.length });
      return { matched: false, ambiguous: true, candidates: recent.map(this.hint) };
    }
    if (rows.length === 1) return { matched: true, ambiguous: false, order: await Order.findById(rows[0]._id) };
    return { matched: false, ambiguous: true, candidates: rows.map(this.hint) };
  }

  disambiguationMessage(cands: MatchCandidate[]): string {
    const list = cands.map((c, i) => `${i + 1}. Order ending ${c.externalOrderId.slice(-4)} (${c.productHint})`).join('\n');
    return `You have more than one active order. Please reply with the number:\n${list}`;
  }

  async resolveByReference(merchantId: string, rawPhone: string, ref: string): Promise<MatchResult> {
    const idx = parseInt(ref, 10) - 1;
    const cands = (await this.resolveInbound(merchantId, rawPhone)).candidates || [];
    const pick = cands[idx];
    if (!pick) return { matched: false, ambiguous: false };
    const order = await Order.findOne({ _id: pick.orderId, merchantId, customerPhone: normalizeIndianPhone(rawPhone) });
    return order ? { matched: true, ambiguous: false, order } : { matched: false, ambiguous: false };
  }

  private hint(o: any): MatchCandidate {
    return { orderId: o._id.toString(), externalOrderId: o.externalOrderId || o._id.toString(), productHint: (o.productName || o.customerName || 'item').slice(0, 24) };
  }
}
export const rescueMatchingService = RescueMatchingService.getInstance();
