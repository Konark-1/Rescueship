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
    globalPause?: boolean;
    rescuePolicy?: any;
    codConversion: {
      enabled: boolean;
      incentiveType: 'flat' | 'percentage';
      incentiveAmount: number;
      minOrderValue: number;
      messageLanguage?: 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';
    };
    ndrRescue: {
      enabled: boolean;
      escalationChain: number[];
      messageLanguage?: 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';
      fakeAttemptDetection: boolean;
    };
  };
  billing: {
    plan: 'free_trial' | 'starter' | 'growth' | 'scale' | 'enterprise';
    billingCycle?: 'quarterly' | 'semi_annual' | 'annual';
    status?: 'active' | 'pre_signup' | 'pending_payment' | 'paused' | 'paused_quality' | 'past_due' | 'cancelled';
    lastPaymentError?: string;
    planOrderLimit: number;
    currentMonthOrders: number;
    cycleStartDate?: Date;
    rescueCredits: number;
    totalRescues: number;
    totalConversions: number;
    estimatedMetaSpendMonth?: number;
    pendingTier?: string;
    pendingCycle?: string;
    introOrderId?: string;
    razorpaySubscriptionId?: string;
    renewMonthly?: number;
    activatedAt?: Date;
    nextInvoiceDate?: Date;
  };
  connections?: {
    shopify?: { status: 'disconnected' | 'connecting' | 'connected' | 'error'; connectedAt?: Date; shopDomain?: string; lastError?: string };
    whatsapp?: { status: 'disconnected' | 'connecting' | 'connected' | 'templates_pending' | 'templates_rejected' | 'error'; connectedAt?: Date; lastError?: string };
    carrier?: { status: 'disconnected' | 'connecting' | 'connected' | 'error'; connectedAt?: Date; provider?: string; lastError?: string };
    payment?: { status: 'disconnected' | 'connecting' | 'connected' | 'error'; connectedAt?: Date; gateway?: string; lastError?: string };
  };
  shopify?: { shopDomain?: string; accessToken?: string; scope?: string; webhooksRegistered?: boolean };
  ownerPhone?: string;
  storeName?: string;
  onboarding?: {
    completedAt?: Date;
    currentStep?: string;
    testRescueSentAt?: Date;
    status?: 'invited' | 'in_progress' | 'completed';
    token?: string;
    tokenExpiresAt?: Date;
    invitedAt?: Date;
    startedAt?: Date;
    assistedSetupRequestedAt?: Date;
  };
  sandbox?: {
    enabled?: boolean;
    activatedAt?: Date;
    testRescuesSent?: number;
    testRescuesSucceeded?: number;
    graduationThreshold?: number;
    graduated?: boolean;
    graduatedAt?: Date;
  };
  quality?: {
    lastCheckedAt?: Date;
    rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
    messagingTier?: string;
    rejectedTemplates?: string[];
    pausedAt?: Date;
    pauseReason?: string;
  };
  alerts?: Array<{
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
    createdAt?: Date;
    read?: boolean;
    actionUrl?: string;
  }>;
  metrics?: {
    ndrReceived?: number;
    ndrReceived7d?: number;
    rescuesAttempted?: number;
    rescuesSucceeded?: number;
    rescuesFailed?: number;
    templatesSent?: number;
    templatesFailed?: number;
    revenueSaved?: number;
    rescueTimes?: number[];
    recentEvents?: Array<{
      type?: string;
      orderId?: string;
      template?: string;
      rescueTimeMin?: number;
      orderValue?: number;
      at?: Date;
    }>;
  };
  rescuePolicy?: any;
  tokenVersion?: number;
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
    tokenVersion: { type: Number, default: 1 },
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
      type: Schema.Types.Mixed,
    },
    whatsappConfig: {
      type: Schema.Types.Mixed,
    },
    paymentConfig: {
      type: Schema.Types.Mixed,
    },
    rescuePolicy: { type: Schema.Types.Mixed, default: () => require('../config/rescue-policy').defaultRescuePolicy() },
    settings: {
      globalPause: { type: Boolean, default: false },
      rescuePolicy: { type: Schema.Types.Mixed, default: () => require('../config/rescue-policy').defaultRescuePolicy() },
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
      type: {
        plan: {
          type: String,
          enum: ['free_trial', 'starter', 'growth', 'scale', 'enterprise'],
          default: 'free_trial',
        },
        billingCycle: {
          type: String,
          enum: ['quarterly', 'semi_annual', 'annual'],
          default: 'annual',
        },
        status: {
          type: String,
          enum: ['active', 'pre_signup', 'pending_payment', 'paused', 'paused_quality', 'past_due', 'cancelled'],
        },
        lastPaymentError: String,
        planOrderLimit: { type: Number, default: 500 },
        currentMonthOrders: { type: Number, default: 0 },
        cycleStartDate: { type: Date, default: Date.now },
        rescueCredits: { type: Number, default: 100 },
        totalRescues: { type: Number, default: 0 },
        totalConversions: { type: Number, default: 0 },
        estimatedMetaSpendMonth: { type: Number, default: 0 },
        pendingTier: String,
        pendingCycle: String,
        introOrderId: String,
        razorpaySubscriptionId: String,
        renewMonthly: Number,
        activatedAt: Date,
        nextInvoiceDate: Date,
      },
      default: () => ({
        plan: 'free_trial',
        billingCycle: 'annual',
        planOrderLimit: 500,
        currentMonthOrders: 0,
        cycleStartDate: new Date(),
        rescueCredits: 100,
        totalRescues: 0,
        totalConversions: 0,
        estimatedMetaSpendMonth: 0,
      }),
    },
    connections: {
      type: Schema.Types.Mixed,
      default: () => ({
        shopify: { status: 'disconnected' },
        whatsapp: { status: 'disconnected' },
        carrier: { status: 'disconnected' },
        payment: { status: 'disconnected' },
      }),
    },
    shopify: { shopDomain: String, accessToken: String, scope: String, webhooksRegistered: Boolean },
    ownerPhone: String,
    storeName: String,
    onboarding: {
      completedAt: Date,
      currentStep: String,
      testRescueSentAt: Date,
      status: { type: String, enum: ['invited', 'in_progress', 'completed'] },
      token: { type: String, index: { sparse: true } },
      tokenExpiresAt: Date,
      invitedAt: Date,
      startedAt: Date,
      assistedSetupRequestedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

MerchantSchema.index(
  { 'whatsappConfig.phoneNumberId': 1 },
  {
    name: 'idx_waba_phonenumber_unique',
    unique: true,
    partialFilterExpression: {
      'whatsappConfig.phoneNumberId': { $type: 'string', $ne: '' },
    },
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

const SandboxSchema = new Schema({
  enabled: { type: Boolean, default: false },
  activatedAt: { type: Date },
  testRescuesSent: { type: Number, default: 0 },
  testRescuesSucceeded: { type: Number, default: 0 },
  graduationThreshold: { type: Number, default: 3 },
  graduated: { type: Boolean, default: false },
  graduatedAt: { type: Date },
}, { _id: false });

const QualitySchema = new Schema({
  lastCheckedAt: { type: Date },
  rating: { type: String, enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'], default: 'UNKNOWN' },
  messagingTier: { type: String, default: 'UNKNOWN' },
  rejectedTemplates: { type: [String], default: [] },
  pausedAt: { type: Date },
  pauseReason: { type: String },
}, { _id: false });

const AlertSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  actionUrl: { type: String },
}, { _id: false });

const MetricsSchema = new Schema({
  ndrReceived: { type: Number, default: 0 },
  ndrReceived7d: { type: Number, default: 0 },
  rescuesAttempted: { type: Number, default: 0 },
  rescuesSucceeded: { type: Number, default: 0 },
  rescuesFailed: { type: Number, default: 0 },
  templatesSent: { type: Number, default: 0 },
  templatesFailed: { type: Number, default: 0 },
  revenueSaved: { type: Number, default: 0 },
  rescueTimes: { type: [Number], default: [] },
  recentEvents: {
    type: [{
      type: { type: String },
      orderId: String,
      template: String,
      rescueTimeMin: Number,
      orderValue: Number,
      at: Date,
    }],
    default: [],
  },
}, { _id: false });

MerchantSchema.add({
  sandbox: { type: SandboxSchema, default: () => ({}) },
  quality: { type: QualitySchema, default: () => ({}) },
  alerts: { type: [AlertSchema], default: [] },
  metrics: { type: MetricsSchema, default: () => ({}) },
});

export const Merchant = model<IMerchant>('Merchant', MerchantSchema);
