import { Schema, model, Document, Types, Model } from 'mongoose';

export type NdrCaseStatus =
  | 'OPEN'
  | 'WAITING_CUSTOMER'
  | 'CUSTOMER_RESPONDED'
  | 'ADDRESS_RECEIVED'
  | 'LOCATION_RECEIVED'
  | 'REATTEMPT_REQUESTED'
  | 'DELIVERED'
  | 'FAILED_AGAIN'
  | 'NO_RESPONSE'
  | 'EXPIRED'
  | 'ESCALATED'
  | 'MERCHANT_REVIEW'
  | 'RTO'
  | 'CLOSED';

export interface INdrCase extends Document {
  orderId: Types.ObjectId;
  merchantId: Types.ObjectId;
  awb: string;
  externalOrderId?: string;
  customerPhone?: string;
  failureReason: string;
  failureCategory: string;
  whatsappMessageSentAt?: Date | null;
  customerResponseType?: 'LOCATION_PIN' | 'TEXT_ADDRESS' | 'RESCHEDULE' | 'CANCEL' | 'PAYMENT' | 'DENIAL_FAKE' | 'OTHER' | null;
  customerResponseAt?: Date | null;
  customerResponseText?: string | null;
  resolutionType?: string | null;
  reattemptRequestedAt?: Date | null;
  courierInstruction?: string | null;
  carrierReattemptStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'MANUAL_REQUIRED' | null;
  carrierReattemptError?: string | null;
  outcome?: 'DELIVERED' | 'RTO' | 'CANCELLED' | 'PENDING' | null;
  rtoFeeSaved?: number;
  estimatedLossPrevented?: number;
  status: NdrCaseStatus;
  isFakeRemarkSuspicious?: boolean;
  failureSource?: 'COURIER_REPORTED' | 'CUSTOMER_PRE_ATTEMPT' | 'MERCHANT_CANCELLED' | 'PLATFORM_CANCELLED' | 'NONE' | null;
  attemptCount?: number;
  closedAt?: Date | null;
  lastWebhookAt?: Date | null;
  piiAnonymized?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NdrCaseSchema = new Schema<INdrCase>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    awb: { type: String, required: true, index: true },
    externalOrderId: { type: String, index: true },
    customerPhone: { type: String, index: true },
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
    carrierReattemptStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'MANUAL_REQUIRED', null],
      default: null,
    },
    carrierReattemptError: { type: String, default: null },
    outcome: { type: String, enum: ['DELIVERED', 'RTO', 'CANCELLED', 'PENDING', null], default: 'PENDING' },
    rtoFeeSaved: { type: Number, default: 0 },
    estimatedLossPrevented: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'OPEN',
        'WAITING_CUSTOMER',
        'CUSTOMER_RESPONDED',
        'ADDRESS_RECEIVED',
        'LOCATION_RECEIVED',
        'REATTEMPT_REQUESTED',
        'DELIVERED',
        'FAILED_AGAIN',
        'NO_RESPONSE',
        'EXPIRED',
        'ESCALATED',
        'MERCHANT_REVIEW',
        'RTO',
        'CLOSED',
      ],
      default: 'OPEN',
      index: true,
    },
    isFakeRemarkSuspicious: { type: Boolean, default: false },
    failureSource: {
      type: String,
      enum: ['COURIER_REPORTED', 'CUSTOMER_PRE_ATTEMPT', 'MERCHANT_CANCELLED', 'PLATFORM_CANCELLED', 'NONE', null],
      default: 'COURIER_REPORTED',
    },
    attemptCount: { type: Number, default: 1 },
    closedAt: { type: Date, default: null },
    lastWebhookAt: { type: Date, default: null },
    piiAnonymized: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

NdrCaseSchema.index({ merchantId: 1, awb: 1, status: 1 });
NdrCaseSchema.index({ merchantId: 1, customerPhone: 1, status: 1 });
NdrCaseSchema.index({ status: 1, createdAt: -1 });
NdrCaseSchema.index({ merchantId: 1, createdAt: -1 });

export const NdrCase: Model<INdrCase> = model<INdrCase>('NdrCase', NdrCaseSchema);
