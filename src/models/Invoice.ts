import { Schema, model, Document, Types } from 'mongoose';

/**
 * Issued invoice for every successful platform charge (intro plan purchase,
 * monthly renewal charge, rescue-credit top-up). Serves the merchant-facing
 * payment history (GET /api/billing/invoices). One invoice per Razorpay
 * payment id — the unique index makes recording idempotent.
 */
export interface IInvoice extends Document {
  merchantId: Types.ObjectId;
  /** Human-readable invoice number, e.g. RS-2026-8F3A21BC. */
  number: string;
  kind: 'intro' | 'renewal' | 'credits';
  status: 'paid' | 'failed';
  amountPaise: number;
  currency: string;
  description: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  paidAt: Date;
  createdAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    number: { type: String, required: true },
    kind: { type: String, enum: ['intro', 'renewal', 'credits'], required: true },
    status: { type: String, enum: ['paid', 'failed'], required: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    description: { type: String, required: true },
    razorpayPaymentId: { type: String, required: true },
    razorpayOrderId: String,
    razorpaySubscriptionId: String,
    periodStart: Date,
    periodEnd: Date,
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InvoiceSchema.index({ merchantId: 1, paidAt: -1 }, { name: 'idx_invoice_merchant_paid' });
InvoiceSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, name: 'idx_invoice_payment_unique', partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

export const Invoice = model<IInvoice>('Invoice', InvoiceSchema);
