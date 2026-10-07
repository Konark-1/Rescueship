import { Schema, model, Document, Types, Model } from 'mongoose';

export interface IDeliveryAttempt extends Document {
  orderId?: Types.ObjectId | null;
  merchantId: Types.ObjectId;
  awb: string;
  status: string;
  remark: string;
  attemptTime: Date;
  courierCode: string;
  carrier?: string;
  carrierScanCode?: string;
  scanTimestamp?: Date;
  isFakeRemark: boolean;
  fakeRemarkScore?: number;
  rawWebhook?: Record<string, any>;
  piiAnonymized?: boolean;
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
    carrier: { type: String, default: 'shiprocket' },
    carrierScanCode: { type: String, default: '' },
    scanTimestamp: { type: Date, default: null },
    isFakeRemark: { type: Boolean, default: false },
    fakeRemarkScore: { type: Number, default: 0 },
    rawWebhook: { type: Schema.Types.Mixed, default: {} },
    piiAnonymized: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

DeliveryAttemptSchema.index({ merchantId: 1, awb: 1, attemptTime: -1 });
// TTL Index: Auto-expire delivery attempts after 90 days (90 * 24 * 60 * 60 seconds)
DeliveryAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000, name: 'idx_attempt_ttl' });
// Compound Unique Index: Prevent duplicate scan retries when carrier repeats delivery attempt event
DeliveryAttemptSchema.index(
  { awb: 1, carrier: 1, carrierScanCode: 1, scanTimestamp: 1 },
  { unique: true, sparse: true, name: 'idx_unique_carrier_scan' }
);

export const DeliveryAttempt: Model<IDeliveryAttempt> = model<IDeliveryAttempt>(
  'DeliveryAttempt',
  DeliveryAttemptSchema
);
