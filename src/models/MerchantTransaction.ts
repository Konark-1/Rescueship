import { Schema, model, Document, Types } from 'mongoose';

export interface IMerchantTransaction extends Document {
  merchantId: Types.ObjectId;
  orderId?: Types.ObjectId;
  orderNumber?: string;
  razorpayPaymentId: string;
  razorpayPaymentLinkId?: string;
  razorpayTransferId?: string;
  // Financial amounts in Paise
  amountCollectedPaise: number;
  platformFeePaise: number;
  amountSettledPaise: number;
  currency: string;
  // Customer details
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  // Status and mode
  status: 'collected' | 'transfer_pending' | 'settled' | 'refunded' | 'failed';
  settlementMode: 'direct_gateway' | 'managed_route';
  payoutDestination?: {
    type: 'upi' | 'bank_account';
    upiId?: string;
    accountNumberMasked?: string;
    ifscCode?: string;
  };
  // Timestamps
  collectedAt: Date;
  settledAt?: Date;
  refundedAt?: Date;
  notes?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const MerchantTransactionSchema = new Schema<IMerchantTransaction>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    orderNumber: { type: String, trim: true },
    razorpayPaymentId: { type: String, required: true, trim: true },
    razorpayPaymentLinkId: { type: String, trim: true },
    razorpayTransferId: { type: String, trim: true },
    amountCollectedPaise: { type: Number, required: true },
    platformFeePaise: { type: Number, default: 0 },
    amountSettledPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    customerEmail: { type: String, trim: true },
    status: {
      type: String,
      enum: ['collected', 'transfer_pending', 'settled', 'refunded', 'failed'],
      default: 'collected',
      index: true,
    },
    settlementMode: {
      type: String,
      enum: ['direct_gateway', 'managed_route'],
      required: true,
    },
    payoutDestination: {
      type: {
        type: String,
        enum: ['upi', 'bank_account'],
      },
      upiId: { type: String },
      accountNumberMasked: { type: String },
      ifscCode: { type: String },
    },
    collectedAt: { type: Date, default: Date.now },
    settledAt: { type: Date },
    refundedAt: { type: Date },
    notes: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

MerchantTransactionSchema.index({ merchantId: 1, collectedAt: -1 });
MerchantTransactionSchema.index({ razorpayPaymentId: 1 }, { unique: true });

export const MerchantTransaction = model<IMerchantTransaction>('MerchantTransaction', MerchantTransactionSchema);
