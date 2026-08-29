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

// ───────────────────────────────────────────────
// 🔒 IMMUTABILITY ENFORCEMENT (SOC-2 Compliance)
// Audit logs are append-only. Any update or delete throws an error.
// ───────────────────────────────────────────────
AuditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are immutable and cannot be updated.');
});
AuditLogSchema.pre('updateMany', function () {
  throw new Error('Audit logs are immutable and cannot be updated.');
});
AuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit logs are immutable and cannot be updated.');
});
AuditLogSchema.pre('findOneAndReplace', function () {
  throw new Error('Audit logs are immutable and cannot be replaced.');
});
AuditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs are immutable and cannot be deleted.');
});
AuditLogSchema.pre('deleteMany', function () {
  throw new Error('Audit logs are immutable and cannot be deleted.');
});
AuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('Audit logs are immutable and cannot be deleted.');
});

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
