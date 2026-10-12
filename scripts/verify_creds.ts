import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { encryptionService } from '../src/services/encryption.service';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const Merchant = mongoose.model('Merchant', new mongoose.Schema({}, { strict: false }));
  const m = await Merchant.findById('6aa2874f2b6be7572c5c0289').lean() as any;
  console.log('Shopify Domain:', m.shopify?.shopDomain);
  console.log('Shopify Access Token Decrypted:', encryptionService.decrypt(m.shopify?.accessToken));
  console.log('Razorpay KeyId Decrypted:', encryptionService.decrypt(m.paymentConfig?.keyId));
  console.log('Razorpay KeySecret Decrypted:', encryptionService.decrypt(m.paymentConfig?.keySecret));
  console.log('Shiprocket Email Decrypted:', encryptionService.decrypt(m.carrierConfig?.email));
  console.log('Shiprocket Webhook Secret Decrypted:', encryptionService.decrypt(m.carrierConfig?.webhookSecret));
  await mongoose.disconnect();
}
run().catch(console.error);
