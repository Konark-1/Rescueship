import { Schema, model, Document, Types, Model } from 'mongoose';

export type NdrCaseStatus =
  | 'OPEN'
  | 'WAITING_CUSTOMER'
  | 'ADDRESS_RECEIVED'
  | 'LOCATION_RECEIVED'
  | 'REATTEMPT_REQUESTED'
  | 'DELIVERED'
  | 'FAILED_AGAIN'
  | 'RTO'
  | 'CLOSED';

export interface INdrCase extends Document {
  orderId: Types.ObjectId;
  merchantId: Types.ObjectId;
  awb: string;
  externalOrderId?: string;
  failureReason: string;
  failureCategory: string;
  whatsappMessageSentAt?: Date | null;
  customerResponseType?: 'LOCATION_PIN' | 'TEXT_ADDRESS' | 'RESCHEDULE' | 'CANCEL' | 'PAYMENT' | 'DENIAL_FAKE' | 'OTHER' | null;
  customerResponseAt?: Date | null;
  customerResponseText?: string | null;
  resolutionType?: string | null;
  reattemptRequestedAt?: Date | null;
  courierInstruction?: string | null;
  outcome?: 'DELIVERED' | 'RTO' | 'CANCELLED' | 'PENDING' | null;
  status: NdrCaseStatus;
  isFakeRemarkSuspicious?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NdrCaseSchema = new Schema<INdrCase>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    awb: { type: String, required: true, index: true },
    externalOrderId: { type: String, index: true },
    failureReason: { type: String, required: true },
    failureCategory: { type: String, default: 'UNKNOWN_FAILURE' },
    whatsappMessageSentAt: { type: Date, default: null },
    customerResponseType: {
      type: String,
      enum: ['LOCATION_PIN', 'TEXT_ADDRESS', 'RESCHEDULE', 'CANCEL', 'PAYMENT', 'DENIAL_FAKE', 'OTHER', null],
      default: null,
    },
    customerResponseAt: { type: Date, default: null },
    customerResponseText: { type: String, default: null },
    resolutionType: { type: String, default: null },
    reattemptRequestedAt: { type: Date, default: null },
    courierInstruction: { type: String, default: null },
    outcome: { type: String, enum: ['DELIVERED', 'RTO', 'CANCELLED', 'PENDING', null], default: 'PENDING' },
    status: {
      type: String,
      enum: [
        'OPEN',
        'WAITING_CUSTOMER',
        'ADDRESS_RECEIVED',
        'LOCATION_RECEIVED',
        'REATTEMPT_REQUESTED',
        'DELIVERED',
        'FAILED_AGAIN',
        'RTO',
        'CLOSED',
      ],
      default: 'OPEN',
      index: true,
    },
    isFakeRemarkSuspicious: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

NdrCaseSchema.index({ merchantId: 1, awb: 1, status: 1 });
NdrCaseSchema.index({ merchantId: 1, createdAt: -1 });

export const NdrCase: Model<INdrCase> = model<INdrCase>('NdrCase', NdrCaseSchema);
