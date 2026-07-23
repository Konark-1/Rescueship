import mongoose from 'mongoose';
import { config } from '../config/env';
import { Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';

async function run() {
  await mongoose.connect(config.mongodb.uri);
  const keyId = 'rzp_test_TGSw8WOkT9X5sI';
  const keySecret = 'Ik45Yj3GyM0iUVj0CGRQONJO';

  const encKeyId = encryptionService.encrypt(keyId);
  const encKeySecret = encryptionService.encrypt(keySecret);

  const result = await Merchant.updateMany({}, {
    $set: {
      'paymentConfig.provider': 'razorpay',
      'paymentConfig.keyId': encKeyId,
      'paymentConfig.keySecret': encKeySecret
    }
  });

  console.log(`Updated ${result.modifiedCount} merchants with Razorpay test keys.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
