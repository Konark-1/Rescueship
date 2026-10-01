import { Schema, model, Document, Types, Model } from 'mongoose';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';

export interface ISuppressedPhone extends Document {
  phone: string;
  merchantId?: Types.ObjectId | null;
  suppressedAt: Date;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const SuppressedPhoneSchema = new Schema<ISuppressedPhone>(
  {
    phone: {
      type: String,
      required: true,
      index: true,
      set: (val: string) => (val ? normalizeIndianPhone(val) : val),
    },
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: false,
      default: null,
      index: true,
    },
    suppressedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reason: {
      type: String,
      default: 'customer_opt_out',
    },
  },
  {
    timestamps: true,
  }
);


SuppressedPhoneSchema.index({ phone: 1 }, { unique: true, name: 'idx_suppressed_phone_unique' });

export const SuppressedPhone: Model<ISuppressedPhone> = model<ISuppressedPhone>('SuppressedPhone', SuppressedPhoneSchema);
