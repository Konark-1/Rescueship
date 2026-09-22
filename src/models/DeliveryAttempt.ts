import { Schema, model, Document, Types, Model } from 'mongoose';

export interface IDeliveryAttempt extends Document {
  orderId?: Types.ObjectId | null;
  merchantId: Types.ObjectId;
  awb: string;
  status: string;
  remark: string;
  attemptTime: Date;
  courierCode: string;
  isFakeRemark: boolean;
  fakeRemarkScore?: number;
  rawWebhook?: Record<string, any>;
  createdAt: Date;
}

const DeliveryAttemptSchema = new Schema<IDeliveryAttempt>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    awb: { type: String, required: true, index: true },
    status: { type: String, required: true },
    remark: { type: String, default: '' },
    attemptTime: { type: Date, default: Date.now },
    courierCode: { type: String, default: 'shiprocket' },
    isFakeRemark: { type: Boolean, default: false },
    fakeRemarkScore: { type: Number, default: 0 },
    rawWebhook: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

DeliveryAttemptSchema.index({ merchantId: 1, awb: 1, attemptTime: -1 });

export const DeliveryAttempt: Model<IDeliveryAttempt> = model<IDeliveryAttempt>(
  'DeliveryAttempt',
  DeliveryAttemptSchema
);
