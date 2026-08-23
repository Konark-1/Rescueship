import mongoose from 'mongoose';
import { Merchant } from '../src/models/Merchant';

async function listMerchants() {
  await mongoose.connect('mongodb://localhost:27017/rescueship');
  const merchants = await Merchant.find().lean();
  console.log('--- Merchants in Database ---');
  merchants.forEach((m: any, idx: number) => {
    console.log(`[${idx + 1}] ID: ${m._id} | Name: ${m.name || m.storeName || 'N/A'} | Email: ${m.email} | Plan: ${m.billing?.plan} | Credits: ${m.billing?.rescueCredits} | OwnerPhone: ${m.ownerPhone || 'N/A'}`);
  });
  await mongoose.disconnect();
  process.exit(0);
}
listMerchants().catch(console.error);
