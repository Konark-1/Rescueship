import { Schema, model, Document, Types } from 'mongoose';

/**
 * Durable, unique record of every provider payment/event we have already
 * consumed for billing. Guarantees one-shot provisioning even if the Redis
 * idempotency TTL lapses or the same payment is presented from another
 * merchant session (cross-merchant replay).
 */
export interface IProcessedPayment extends Document {
  provider: 'razorpay' | 'cashfree';
  /** Provider payment id (pay_xxx) or event id (evt_xxx). */
  externalId: string;
  merchantId: Types.ObjectId;
  kind: 'subscription_intro' | 'subscription_renewal' | 'webhook_event';
  amountPaise?: number;
  createdAt: Date;
}

const ProcessedPaymentSchema = new Schema<IProcessedPayment>(
  {
    provider: { type: String, enum: ['razorpay', 'cashfree'], required: true },
    externalId: { type: String, required: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    kind: { type: String, enum: ['subscription_intro', 'subscription_renewal', 'webhook_event'], required: true },
    amountPaise: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProcessedPaymentSchema.index({ provider: 1, externalId: 1 }, { unique: true, name: 'idx_processed_payment_unique' });

export const ProcessedPayment = model<IProcessedPayment>('ProcessedPayment', ProcessedPaymentSchema);
