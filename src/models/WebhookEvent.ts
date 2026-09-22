import { Schema, model, Document, Types, Model } from 'mongoose';

export interface IWebhookEvent extends Document {
  merchantId?: Types.ObjectId | null;
  source: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY' | 'WHATSAPP' | 'DELHIVERY' | 'CLICKPOST' | 'WOOCOMMERCE' | 'CUSTOM';
  topic?: string;
  eventId?: string;
  rawPayload: Record<string, any>;
  processed: boolean;
  duplicate: boolean;
  processedAt?: Date;
  error?: string | null;
  createdAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
    source: {
      type: String,
      enum: ['SHOPIFY', 'SHIPROCKET', 'RAZORPAY', 'WHATSAPP', 'DELHIVERY', 'CLICKPOST', 'WOOCOMMERCE', 'CUSTOM'],
      required: true,
      index: true,
    },
    topic: { type: String },
    eventId: { type: String, index: true },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    processed: { type: Boolean, default: false },
    duplicate: { type: Boolean, default: false },
    processedAt: { type: Date },
    error: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

WebhookEventSchema.index({ source: 1, eventId: 1, createdAt: -1 });

export const WebhookEvent: Model<IWebhookEvent> = model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
