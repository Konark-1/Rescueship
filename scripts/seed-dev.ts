import mongoose from 'mongoose';
import { Merchant } from '../src/models/Merchant';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rescueship');
  const res = await Merchant.updateMany(
    {},
    {
      $set: {
        'billing.rescueCredits': 9999,
        'settings.codConversion.enabled': true,
        'settings.codConversion.incentiveType': 'flat',
        'settings.codConversion.incentiveAmount': 100,
        'settings.ndrRescue.enabled': true,
      },
    }
  );
  console.log('✅ Updated test merchants count:', res.modifiedCount);
  await mongoose.disconnect();
}

main().catch(console.error);
