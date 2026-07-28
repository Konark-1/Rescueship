/**
 * RescueLedger.ts  (append-only, NO TTL — billing/attribution grade)
 * ─────────────────────────────────────────────────────────────
 * Separated from AuditLog (which keeps its 90-day TTL) so that
 * rescue outcomes, holdout results and attribution decisions survive
 * for dispute/performance-pricing settlement (L-1, L-5).
 */
import { Schema, model, Model, Types } from 'mongoose';
import { terminalOutcome, NaturalOutcome } from '../config/order-status';

export type DecisionMode = 'engaged' | 'holdout' | 'review' | 'manual_skip';

export interface IRescueLedger {
  merchantId: Types.ObjectId;
  orderId: Types.ObjectId;
  externalOrderId: string;
  pilotId?: string;
  flaggedAt: Date;
  decisionMode: DecisionMode;
  fakeRemarkScore: number;          // internal signal, recorded regardless of mode
  rescued: boolean | null;          // null until outcome known
  naturalOutcome: NaturalOutcome;
  metaCategory?: string;
  metaCostInr?: number;
  attributedLiftInr?: number;       // filled from holdout comparison
}

const schema = new Schema<IRescueLedger>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    externalOrderId: { type: String, required: true },
    pilotId: { type: String, index: true },
    flaggedAt: { type: Date, required: true, default: Date.now },
    decisionMode: { type: String, enum: ['engaged', 'holdout', 'review', 'manual_skip'], required: true },
    fakeRemarkScore: { type: Number, default: 0 },
    rescued: { type: Boolean, default: null },
    naturalOutcome: { type: String, enum: ['delivered', 'rto', 'cancelled', 'converted_prepaid', null], default: null },
    metaCategory: String,
    metaCostInr: Number,
    attributedLiftInr: Number,
  },
  { timestamps: true }
);
schema.index({ merchantId: 1, pilotId: 1, flaggedAt: -1 });

schema.statics.recordDecision = function (d: Partial<IRescueLedger>) { return this.create(d); };

/** Fill natural outcomes using batched query and terminalOutcome map (R2 & R11 fixes). */
schema.statics.reconcileOutcomes = async function (merchantId?: string) {
  const Order = require('./Order').Order;
  const q: any = { naturalOutcome: null };
  if (merchantId) q.merchantId = merchantId;
  const rows = await this.find(q).limit(5000).lean();
  if (rows.length === 0) return 0;

  const orderIds = rows.map((r: any) => r.orderId);
  const orders = await Order.find({ _id: { $in: orderIds } }).select('_id status').lean();
  const orderMap = new Map<string, string>();
  for (const o of orders) {
    orderMap.set(o._id.toString(), o.status);
  }

  for (const r of rows as any[]) {
    const currentStatus = orderMap.get(r.orderId.toString());
    if (!currentStatus) continue;
    const outcome = terminalOutcome(currentStatus);
    const rescued = r.decisionMode === 'engaged' && (outcome === 'delivered' || outcome === 'converted_prepaid');
    await this.updateOne({ _id: r._id }, { $set: { naturalOutcome: outcome, rescued } });
  }
  return rows.length;
};

/** Causal lift by segment: RTO_rate(holdout) − RTO_rate(engaged). Minimum n confidence gate included (R6 fix). */
schema.statics.liftReport = async function (merchantId: string, pilotId?: string) {
  const match: any = { merchantId: new Types.ObjectId(merchantId), naturalOutcome: { $ne: null } };
  if (pilotId) match.pilotId = pilotId;
  const rows = await this.aggregate([
    { $match: match },
    { $group: { _id: { mode: '$decisionMode' }, n: { $sum: 1 }, rto: { $sum: { $cond: [{ $eq: ['$naturalOutcome', 'rto'] }, 1, 0] } } } },
  ]);
  const by = (m: string) => rows.find((r: any) => r._id.mode === m) || { n: 0, rto: 0 };
  const eng = by('engaged'), hol = by('holdout');
  const rtoRate = (g: any) => (g.n ? g.rto / g.n : 0);
  const MIN_N = 30;

  return {
    engaged: { n: eng.n, rtoRate: +rtoRate(eng).toFixed(3) },
    holdout: { n: hol.n, rtoRate: +rtoRate(hol).toFixed(3) },
    lift: +(rtoRate(hol) - rtoRate(eng)).toFixed(3),
    confident: eng.n >= MIN_N && hol.n >= MIN_N,
    minN: MIN_N,
  };
};

export const RescueLedger: Model<IRescueLedger> & {
  recordDecision: (d: Partial<IRescueLedger>) => Promise<any>;
  reconcileOutcomes: (merchantId?: string) => Promise<number>;
  liftReport: (merchantId: string, pilotId?: string) => Promise<any>;
} = model('RescueLedger', schema) as any;
