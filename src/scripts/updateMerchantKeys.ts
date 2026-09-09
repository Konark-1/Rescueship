/**
 * Local-development helper: set Razorpay TEST keys on ONE merchant.
 *
 * Usage:
 *   MERCHANT_ID=<id> RZP_TEST_KEY_ID=rzp_test_... RZP_TEST_KEY_SECRET=... ts-node src/scripts/updateMerchantKeys.ts
 *
 * Refuses to run in production, refuses live keys, and never touches more
 * than one merchant. Credentials come from the environment — never commit them.
 */
import mongoose from 'mongoose';
import { config } from '../config/env';
import { Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';

async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run in production');

  const merchantId = process.env.MERCHANT_ID;
  const keyId = process.env.RZP_TEST_KEY_ID;
  const keySecret = process.env.RZP_TEST_KEY_SECRET;
  if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) throw new Error('MERCHANT_ID (valid ObjectId) is required');
  if (!keyId || !keySecret) throw new Error('RZP_TEST_KEY_ID and RZP_TEST_KEY_SECRET are required');
  if (!keyId.startsWith('rzp_test_')) throw new Error('Only rzp_test_ keys are allowed in this script');

  await mongoose.connect(config.mongodb.uri);
  const result = await Merchant.updateOne(
    { _id: merchantId },
    {
      $set: {
        'paymentConfig.provider': 'razorpay',
        'paymentConfig.keyId': encryptionService.encrypt(keyId),
        'paymentConfig.keySecret': encryptionService.encrypt(keySecret),
      },
    }
  );
  console.log(`Updated ${result.modifiedCount} merchant with Razorpay test keys.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
