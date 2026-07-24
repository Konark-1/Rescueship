import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  merchantId: Types.ObjectId;
  orderId?: Types.ObjectId | null;
  action: string;
  source: string;
  payload: Record<string, any>;
  status: 'success' | 'failed' | 'retrying';
  error?: string | null;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    action: { type: String, required: true },
    source: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['success', 'failed', 'retrying'], default: 'success' },
    error: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

// Indexes
AuditLogSchema.index({ merchantId: 1, timestamp: -1 });

// TTL Index: Auto-expire documents after 90 days (90 * 24 * 60 * 60 seconds)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
