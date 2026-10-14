import { Schema, model, Document } from 'mongoose';

/**
 * Counters that cap free test rescues (messages a not-yet-paying merchant sends to their
 * own phone). Keys are identities that survive a fresh sign-up — the WhatsApp phone number
 * id, the WABA, the owner's phone, the store domain — so a new account on the same number
 * or store cannot reset the allowance. Daily keys carry `expiresAt` and are TTL-deleted.
 */
export interface ITrialUsage extends Document {
  key: string;
  count: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrialUsageSchema = new Schema<ITrialUsage>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

TrialUsageSchema.index({ expiresAt: 1 }, { name: 'idx_trial_usage_ttl', expireAfterSeconds: 0 });

export const TrialUsage = model<ITrialUsage>('TrialUsage', TrialUsageSchema);
