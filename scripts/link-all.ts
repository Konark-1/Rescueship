import 'dotenv/config';
import mongoose from 'mongoose';
import { Merchant } from '../src/models/Merchant';
import { carrierConnectService } from '../src/services/carrier-connect.service';

async function linkAll() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    throw new Error('Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD env vars before running this script.');
  }
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rescueship');
  const merchants = await Merchant.find();
  for (const m of merchants) {
    await carrierConnectService.validateAndSave(m._id.toString(), {
      provider: 'shiprocket',
      email,
      password,
    });
    console.log('✅ Linked Shiprocket for:', m.name || m.email);
  }
  await mongoose.disconnect();
  process.exit(0);
}
linkAll().catch(console.error);
