import { Schema, model, Document, Types, Model } from 'mongoose';

export type InternalShipmentStatus =
  | 'awb_generated'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'ndr_detected'
  | 'delivered'
  | 'rto_initiated'
  | 'returned'
  | 'cancelled'
  | 'lost';

export interface IShipment extends Document {
  merchantId: Types.ObjectId;
  orderId?: Types.ObjectId | null;
  awbNumber: string;
  shiprocketShipmentId?: string;
  shopifyOrderId?: string;
  orderNumber?: string;
  carrier?: string;
  normalizedStatus: InternalShipmentStatus;
  rawCarrierStatus?: string;
  originalCodAmount: number;
  currentCodAmount: number;
  codAmendmentStatus: 'NONE' | 'AMENDED' | 'MANUAL_REQUIRED';
  codAmendmentHistory: Array<{
    paymentId: string;
    previousAmount: number;
    newAmount: number;
    amendedAt: Date;
    responseDetails?: any;
  }>;
  attemptsCount: number;
  outForDeliveryAt?: Date | null;
  firstAttemptAt?: Date | null;
  lastAttemptAt?: Date | null;
  lastEventTimestamp?: Date | null;
  deliveryInstructions: string[];
  addressUpdateHistory: Array<{
    updatedBy: 'CUSTOMER' | 'MERCHANT' | 'SYSTEM';
    oldAddress?: string;
    newAddress: string;
    updatedAt: Date;
  }>;
  isQuarantined: boolean;
  quarantineReason?: string | null;
  quarantinedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentSchema = new Schema<IShipment>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    awbNumber: { type: String, required: true, index: true },
    shiprocketShipmentId: { type: String, sparse: true, index: true },
    shopifyOrderId: { type: String, sparse: true, index: true },
    orderNumber: { type: String },
    carrier: { type: String, default: 'shiprocket' },
    normalizedStatus: {
      type: String,
      enum: [
        'awb_generated',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'ndr_detected',
        'delivered',
        'rto_initiated',
        'returned',
        'cancelled',
        'lost',
      ],
      default: 'awb_generated',
      index: true,
    },
    rawCarrierStatus: { type: String },
    originalCodAmount: { type: Number, default: 0 },
    currentCodAmount: { type: Number, default: 0 },
    codAmendmentStatus: {
      type: String,
      enum: ['NONE', 'AMENDED', 'MANUAL_REQUIRED'],
      default: 'NONE',
    },
    codAmendmentHistory: [
      {
        paymentId: { type: String },
        previousAmount: { type: Number },
        newAmount: { type: Number },
        amendedAt: { type: Date, default: Date.now },
        responseDetails: { type: Schema.Types.Mixed },
      },
    ],
    attemptsCount: { type: Number, default: 0 },
    outForDeliveryAt: { type: Date, default: null },
    firstAttemptAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    lastEventTimestamp: { type: Date, default: null },
    deliveryInstructions: [{ type: String }],
    addressUpdateHistory: [
      {
        updatedBy: { type: String, enum: ['CUSTOMER', 'MERCHANT', 'SYSTEM'], default: 'CUSTOMER' },
        oldAddress: { type: String },
        newAddress: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    isQuarantined: { type: Boolean, default: false, index: true },
    quarantineReason: { type: String, default: null },
    quarantinedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

ShipmentSchema.index({ merchantId: 1, awbNumber: 1 }, { unique: true });
ShipmentSchema.index({ merchantId: 1, status: 1 });
ShipmentSchema.index({ isQuarantined: 1, createdAt: -1 });

export const Shipment: Model<IShipment> = model<IShipment>('Shipment', ShipmentSchema);
