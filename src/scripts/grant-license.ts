#!/usr/bin/env ts-node
/**
 * grant-license.ts
 * CLI Script to activate or extend 90-Day (or custom duration) License Keys for merchants
 * after receiving upfront payment via Razorpay Payment Link.
 *
 * Usage:
 *   npx ts-node src/scripts/grant-license.ts <merchantIdOrEmail> [days=90]
 *
 * Examples:
 *   npx ts-node src/scripts/grant-license.ts merchant@example.com
 *   npx ts-node src/scripts/grant-license.ts 6512bd349182ab0012345678 90
 */

import mongoose, { Types } from 'mongoose';
import { Merchant } from '../models/Merchant';
import { config } from '../config/env';
import { logger } from '../utils/logger';

async function grantLicense() {
  const target = process.argv[2];
  const days = parseInt(process.argv[3] || '90', 10);

  if (!target) {
    console.error('\n❌ Error: Missing merchant identifier.');
    console.log('Usage: npx ts-node src/scripts/grant-license.ts <merchantIdOrEmail> [days=90]');
    console.log('Example: npx ts-node src/scripts/grant-license.ts store@brand.com 90\n');
    process.exit(1);
  }

  if (isNaN(days) || days <= 0) {
    console.error('\n❌ Error: Days must be a positive integer.');
    process.exit(1);
  }

  const mongoUri = config.mongodb?.uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/rescueship';

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);

  try {
    const isObjectId = Types.ObjectId.isValid(target);
    const query = isObjectId ? { _id: target } : { email: target.trim().toLowerCase() };

    const merchant = await Merchant.findOne(query);
    if (!merchant) {
      console.error(`\n❌ Merchant not found matching "${target}"`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    merchant.accessGrantedAt = now;
    merchant.accessExpiresAt = expiresAt;
    merchant.licenseStatus = 'ACTIVE';
    merchant.licensePlan = days === 90 ? '90_day_license' : 'custom';

    if (!merchant.billing) {
      merchant.billing = {} as any;
    }
    merchant.billing.status = 'active';
    merchant.billing.plan = merchant.billing.plan || 'pro';
    merchant.billing.rescueCredits = Math.max(merchant.billing.rescueCredits || 0, 500);

    await merchant.save();

    console.log('\n======================================================');
    console.log('🎉 LICENSE GRANTED SUCCESSFULLY!');
    console.log('======================================================');
    console.log(`Merchant ID     : ${merchant._id}`);
    console.log(`Store / Name    : ${merchant.storeName || merchant.name || 'N/A'}`);
    console.log(`Email           : ${merchant.email}`);
    console.log(`Owner Phone     : ${merchant.ownerPhone || 'N/A'}`);
    console.log(`License Status  : ${merchant.licenseStatus}`);
    console.log(`License Plan    : ${merchant.licensePlan}`);
    console.log(`Granted At      : ${now.toISOString()}`);
    console.log(`Expires At      : ${expiresAt.toISOString()}`);
    console.log(`Days Active     : ${days} days`);
    console.log(`Estimated RTO/o : ₹${merchant.settings?.estimatedRtoLossPerOrder || 140}`);
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('Failed to grant license:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

if (require.main === module) {
  grantLicense();
}
