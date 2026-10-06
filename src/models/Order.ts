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
    | 'ndr_pending_review'
    | 'ndr_rescued'
    | 'out_for_delivery'
    | 'delivered'
    | 'rto_initiated'
    | 'rto'
    | 'returned'
    | 'cancelled';
  outForDeliveryAt?: Date | null;
  lastEventTimestamp?: Date | null;
  awb?: string | null;
  carrier?: 'shiprocket' | 'clickpost' | 'delhivery' | 'bluedart' | 'xpressbees' | 'shadowfax' | 'ecomexpress' | 'dtdc' | 'custom' | null;
  paymentLinkId?: string | null;
  paymentLinkUrl?: string | null;
  rtoFeeSaved?: number;
  rtoArrestAttemptedAt?: Date | null;
  rtoArrestStatus?: 'TRIGGERED' | 'RESCUED' | 'RETURNED' | null;
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
    holdout?: boolean;
    holdoutReason?: string;
    fakeRemarkScore?: number;
    decisionMode?: 'engaged' | 'holdout' | 'review' | 'manual_skip' | 'deciding';
    decisionClaimedAt?: Date;
    lastOutboundAt?: Date;
    lastOutboundMerchantId?: Types.ObjectId;
    scheduledSlot?: string;
    retentionOffered?: boolean;
    retentionDiscount?: number;
    retentionFinalAmount?: number;
    addressCorrectionStep?: any;
    addressUpdate?: {
      method?: 'location' | 'text' | 'both';
      latitude?: number;
      longitude?: number;
      textAddress?: string;
      geocodedAddress?: string;
      landmark?: string;
      driverNote?: string;
      collectionState?: 'idle' | 'awaiting_location' | 'awaiting_text' | 'complete';
    };
  };
  rtoRisk?: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
    recommendedAction: 'auto_ship' | 'whatsapp_verify' | 'require_deposit' | 'manual_review';
    scoredAt: Date;
  };
  shippingPincode?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingAddress?: any;
  failureSource?: 'COURIER_REPORTED' | 'CUSTOMER_PRE_ATTEMPT' | 'MERCHANT_CANCELLED' | 'PLATFORM_CANCELLED' | 'NONE' | null;
  attemptCount?: number;
  lastAttemptAt?: Date | null;
  preDeliveryConfirmation?: {
    sentAt?: Date | null;
    response?: 'confirmed' | 'rescheduled' | 'address_updated' | 'cancelled' | string | null;
    respondedAt?: Date | null;
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
        'ndr_pending_review',
        'ndr_rescued',
        'out_for_delivery',
        'delivered',
        'rto_initiated',
        'rto',
        'returned',
        'cancelled',
      ],
      default: 'new',
    },
    awb: { type: String, default: null, index: true },
    outForDeliveryAt: { type: Date, default: null },
    lastEventTimestamp: { type: Date, default: null },
    carrier: { type: String, enum: ['shiprocket', 'clickpost', 'delhivery', 'bluedart', 'xpressbees', 'shadowfax', 'ecomexpress', 'dtdc', 'custom', null], default: null },
    paymentLinkId: { type: String, default: null },
    paymentLinkUrl: { type: String, default: null },
    rtoFeeSaved: { type: Number, default: 0 },
    rtoArrestAttemptedAt: { type: Date, default: null },
    rtoArrestStatus: { type: String, enum: ['TRIGGERED', 'RESCUED', 'RETURNED', null], default: null },
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
      holdout: { type: Boolean, default: false },
      holdoutReason: { type: String },
      fakeRemarkScore: { type: Number, default: 0 },
      decisionMode: { type: String, enum: ['engaged', 'holdout', 'review', 'manual_skip', 'deciding'] },
      decisionClaimedAt: { type: Date },
      lastOutboundAt: { type: Date },
      lastOutboundMerchantId: { type: Schema.Types.ObjectId, ref: 'Merchant' },
      scheduledSlot: { type: String, default: null },
      retentionOffered: { type: Boolean, default: false },
      retentionDiscount: { type: Number, default: null },
      retentionFinalAmount: { type: Number, default: null },
      addressCorrectionStep: { type: Schema.Types.Mixed },
      addressUpdate: {
        method: { type: String, enum: ['location', 'text', 'both', null], default: null },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        textAddress: { type: String, default: null },
        geocodedAddress: { type: String, default: null },
        landmark: { type: String, default: null },
        driverNote: { type: String, default: null },
        collectionState: {
          type: String,
          enum: ['idle', 'awaiting_location', 'awaiting_text', 'complete', null],
          default: 'idle',
        },
      },
    },
    rtoRisk: {
      score: { type: Number, default: 0 },
      level: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
      factors: [{ type: String }],
      recommendedAction: { type: String, enum: ['auto_ship', 'whatsapp_verify', 'require_deposit', 'manual_review'], default: 'auto_ship' },
      scoredAt: { type: Date, default: Date.now },
    },
    shippingPincode: { type: String, default: null },
    shippingCity: { type: String, default: null },
    shippingState: { type: String, default: null },
    shippingAddress: { type: Schema.Types.Mixed, default: null },
    failureSource: {
      type: String,
      enum: ['COURIER_REPORTED', 'CUSTOMER_PRE_ATTEMPT', 'MERCHANT_CANCELLED', 'PLATFORM_CANCELLED', 'NONE', null],
      default: 'NONE',
    },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    preDeliveryConfirmation: {
      sentAt: { type: Date, default: null },
      response: { type: String, default: null },
      respondedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// NOTE: names are explicit and shared with models/indexes.ts so the two never
// race to create the same key pattern under different names (code 85/86).
OrderSchema.index({ merchantId: 1, status: 1, createdAt: -1 }, { name: 'idx_merchant_status_created' });
// Per-tenant AWB uniqueness. `sparse` does NOT skip docs where only `awb` is null in a
// compound index (merchantId is always present), so a partial filter is required or the
// second `awb: null` order per merchant would be rejected.
OrderSchema.index(
  { merchantId: 1, awb: 1 },
  { name: 'idx_merchant_awb_unique', unique: true, partialFilterExpression: { awb: { $type: 'string' } } }
);
OrderSchema.index({ merchantId: 1, customerPhone: 1 }, { name: 'idx_merchant_phone' });
OrderSchema.index({ customerPhone: 1, status: 1 }, { name: 'idx_phone_status' });
OrderSchema.index({ merchantId: 1, createdAt: -1 }, { name: 'idx_merchant_created' });
OrderSchema.index({ merchantId: 1, externalOrderId: 1 }, { name: 'idx_merchant_external_order_unique', unique: true });
OrderSchema.index({ paymentLinkId: 1 }, { name: 'idx_payment_link', sparse: true });
OrderSchema.index(
  { merchantId: 1, 'ndr.reason': 1 },
  { name: 'idx_merchant_ndr_reason', partialFilterExpression: { 'ndr.reason': { $type: 'string' } } }
);
OrderSchema.index(
  { merchantId: 1, carrier: 1 },
  { name: 'idx_merchant_carrier', partialFilterExpression: { carrier: { $type: 'string' } } }
);
OrderSchema.index(
  { merchantId: 1, paymentMethod: 1 },
  { name: 'idx_merchant_payment_method' }
);
OrderSchema.index(
  { merchantId: 1, 'rtoRisk.level': 1, createdAt: -1 },
  { name: 'idx_merchant_risk_level' }
);
OrderSchema.index(
  { merchantId: 1, shippingPincode: 1, createdAt: -1 },
  { name: 'idx_merchant_shipping_pincode' }
);
OrderSchema.index(
  { merchantId: 1, shippingPincode: 1, status: 1 },
  { name: 'idx_merchant_pincode_status' }
);
OrderSchema.index(
  { merchantId: 1, failureSource: 1, createdAt: -1 },
  { name: 'idx_merchant_failure_source' }
);

export const Order = model<IOrder>('Order', OrderSchema);
