import { Schema, model, Document, Types } from 'mongoose';

export interface IBillingEvent extends Document {
  merchantId: Types.ObjectId;
  eventType: string;
  orderId?: Types.ObjectId;
  creditsCost: number;
  timestamp: Date;
}

const BillingEventSchema = new Schema<IBillingEvent>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    eventType: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    creditsCost: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
  }
);

export const BillingEvent = model<IBillingEvent>('BillingEvent', BillingEventSchema);
