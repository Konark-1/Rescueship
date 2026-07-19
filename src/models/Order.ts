import { Schema, model, Document, Types } from 'mongoose';

export interface IOrder extends Document {
  merchantId: Types.ObjectId;
  externalOrderId: string;
  platform: 'shopify' | 'woocommerce' | 'custom';
  customerPhone: string;
  customerName?: string;
  orderValue: number;
  paymentMethod: 'cod' | 'prepaid';
  status:
    | 'new'
    | 'cod_conversion_sent'
    | 'converted_to_prepaid'
    | 'shipped'
    | 'ndr_detected'
    | 'ndr_rescue_sent'
    | 'ndr_rescued'
    | 'delivered'
    | 'rto';
  outForDeliveryAt?: Date | null;
  awb?: string | null;
  carrier?: 'shiprocket' | 'clickpost' | 'delhivery' | null;
  paymentLinkId?: string | null;
  paymentLinkUrl?: string | null;
  codConversion?: {
    messageSentAt?: Date | null;
    incentiveOffered?: number;
    convertedAt?: Date | null;
  };
  ndr?: {
    reason?: string | null;
    detectedAt?: Date | null;
    rescueMessagesSent: number;
    lastMessageSentAt?: Date | null;
    customerResponse?: string | null;
    resolvedAt?: Date | null;
    resolution?: 'rescheduled' | 'address_updated' | 'cancelled' | 'unresolved' | null;
    isFakeAttempt?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    externalOrderId: { type: String, required: true },
    platform: { type: String, enum: ['shopify', 'woocommerce', 'custom'], required: true },
    customerPhone: { type: String, required: true },
    customerName: { type: String },
    orderValue: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cod', 'prepaid'], required: true },
    status: {
      type: String,
      enum: [
        'new',
        'cod_conversion_sent',
        'converted_to_prepaid',
        'shipped',
        'ndr_detected',
        'ndr_rescue_sent',
        'ndr_rescued',
        'delivered',
        'rto',
      ],
      default: 'new',
    },
    awb: { type: String, default: null, index: true },
    outForDeliveryAt: { type: Date, default: null },
    carrier: { type: String, enum: ['shiprocket', 'clickpost', 'delhivery', null], default: null },
    paymentLinkId: { type: String, default: null },
    paymentLinkUrl: { type: String, default: null },
    codConversion: {
      messageSentAt: { type: Date, default: null },
      incentiveOffered: { type: Number, default: 0 },
      convertedAt: { type: Date, default: null },
    },
    ndr: {
      reason: { type: String, default: null },
      detectedAt: { type: Date, default: null },
      rescueMessagesSent: { type: Number, default: 0 },
      lastMessageSentAt: { type: Date, default: null },
      customerResponse: { type: String, default: null },
      resolvedAt: { type: Date, default: null },
      resolution: {
        type: String,
        enum: ['rescheduled', 'address_updated', 'cancelled', 'unresolved', null],
        default: null,
      },
      isFakeAttempt: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrderSchema.index({ merchantId: 1, status: 1 });
OrderSchema.index({ merchantId: 1, createdAt: -1 });
OrderSchema.index({ merchantId: 1, externalOrderId: 1 }, { unique: true });

export const Order = model<IOrder>('Order', OrderSchema);
