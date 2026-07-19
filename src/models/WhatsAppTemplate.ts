import { Schema, model, Document, Types } from 'mongoose';

export interface IWhatsAppTemplate extends Document {
  merchantId: Types.ObjectId;
  templateName: string;
  language: string;
  category: string;
  status: string;
  buttons: any[];
  components: any[];
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppTemplateSchema = new Schema<IWhatsAppTemplate>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    templateName: { type: String, required: true },
    language: { type: String, required: true },
    category: { type: String, required: true },
    status: { type: String, default: 'pending' },
    buttons: { type: Schema.Types.Mixed, default: [] },
    components: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export const WhatsAppTemplate = model<IWhatsAppTemplate>('WhatsAppTemplate', WhatsAppTemplateSchema);
