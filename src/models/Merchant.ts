import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IMerchant extends Document {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  platform: 'shopify' | 'woocommerce' | 'custom';
  onboardingStatus: 'pending' | 'skipped' | 'completed';
  platformConfig?: {
    shopifyDomain?: string;
    shopifyAccessToken?: string;
    woocommerceUrl?: string;
    woocommerceKey?: string;
    woocommerceSecret?: string;
    customApiSecret?: string;
    customWebhookUrl?: string;
  };
  carrierConfig?: {
    provider?: 'shiprocket' | 'clickpost' | 'delhivery';
    apiToken?: string;
  };
  whatsappConfig?: {
    phoneNumberId?: string;
    accessToken?: string;
    businessAccountId?: string;
  };
  paymentConfig?: {
    provider?: 'razorpay' | 'cashfree';
    keyId?: string;
    keySecret?: string;
  };
  settings: {
    codConversion: {
      enabled: boolean;
      incentiveType: 'flat' | 'percentage';
      incentiveAmount: number;
      minOrderValue: number;
      messageLanguage: 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';
    };
    ndrRescue: {
      enabled: boolean;
      escalationChain: number[]; // e.g. [4, 12, 24] hours
      messageLanguage: 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';
      fakeAttemptDetection: boolean;
    };
  };
  billing: {
    plan: 'free_trial' | 'usage_based';
    rescueCredits: number;
    totalRescues: number;
    totalConversions: number;
  };
  comparePassword(candidate: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const MerchantSchema = new Schema<IMerchant>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    googleId: { type: String, required: false, unique: true, sparse: true },
    platform: { type: String, enum: ['shopify', 'woocommerce', 'custom'], required: true },
    onboardingStatus: { type: String, enum: ['pending', 'skipped', 'completed'], default: 'pending' },
    platformConfig: {
      shopifyDomain: { type: String },
      shopifyAccessToken: { type: String },
      woocommerceUrl: { type: String },
      woocommerceKey: { type: String },
      woocommerceSecret: { type: String },
      customApiSecret: { type: String },
      customWebhookUrl: { type: String },
    },
    carrierConfig: {
      provider: { type: String, enum: ['shiprocket', 'clickpost', 'delhivery'] },
      apiToken: { type: String },
    },
    whatsappConfig: {
      phoneNumberId: { type: String },
      accessToken: { type: String },
      businessAccountId: { type: String },
    },
    paymentConfig: {
      provider: { type: String, enum: ['razorpay', 'cashfree'] },
      keyId: { type: String },
      keySecret: { type: String },
    },
    settings: {
      codConversion: {
        enabled: { type: Boolean, default: false },
        incentiveType: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
        incentiveAmount: { type: Number, default: 0 },
        minOrderValue: { type: Number, default: 0 },
        messageLanguage: { type: String, enum: ['en', 'hi', 'ta', 'te', 'bn', 'mr'], default: 'en' },
      },
      ndrRescue: {
        enabled: { type: Boolean, default: false },
        escalationChain: { type: [Number], default: [4, 12, 24] },
        messageLanguage: { type: String, enum: ['en', 'hi', 'ta', 'te', 'bn', 'mr'], default: 'en' },
        fakeAttemptDetection: { type: Boolean, default: false },
      },
    },
    billing: {
      plan: { type: String, enum: ['free_trial', 'usage_based'], default: 'free_trial' },
      rescueCredits: { type: Number, default: 100 },
      totalRescues: { type: Number, default: 0 },
      totalConversions: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password
MerchantSchema.pre<IMerchant>('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
MerchantSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const Merchant = model<IMerchant>('Merchant', MerchantSchema);
