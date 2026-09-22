import { Schema, model, Document, Types, Model } from 'mongoose';

export interface IMessageLog extends Document {
  orderId?: Types.ObjectId | null;
  merchantId: Types.ObjectId;
  customerPhone: string;
  direction: 'OUTBOUND' | 'INBOUND';
  templateName?: string;
  messageType: 'template' | 'interactive' | 'text' | 'location' | 'button';
  metaMessageId?: string;
  body?: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  error?: string | null;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

const MessageLogSchema = new Schema<IMessageLog>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    customerPhone: { type: String, required: true, index: true },
    direction: { type: String, enum: ['OUTBOUND', 'INBOUND'], required: true },
    templateName: { type: String },
    messageType: {
      type: String,
      enum: ['template', 'interactive', 'text', 'location', 'button'],
      default: 'template',
    },
    metaMessageId: { type: String, sparse: true, index: true },
    body: { type: String },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent',
    },
    error: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

MessageLogSchema.index({ merchantId: 1, customerPhone: 1, createdAt: -1 });

export const MessageLog: Model<IMessageLog> = model<IMessageLog>('MessageLog', MessageLogSchema);
