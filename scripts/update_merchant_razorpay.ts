import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { encryptionService } from '../src/services/encryption.service';

async function updateMerchantRazorpay() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const Merchant = mongoose.model('Merchant', new mongoose.Schema({}, { strict: false }));

  const keyId = 'rzp_test_Tdtx44D4UKp7S1';
  const keySecret = '3h2COAHo9GbPDUhtu83Iyvn0';

  const encryptedKeyId = encryptionService.encrypt(keyId);
  const encryptedKeySecret = encryptionService.encrypt(keySecret);

  await Merchant.findByIdAndUpdate('6aa2874f2b6be7572c5c0289', {
    $set: {
      'paymentConfig.keyId': encryptedKeyId,
      'paymentConfig.keySecret': encryptedKeySecret,
      'paymentConfig.provider': 'razorpay',
      'paymentConfig.gateway': 'razorpay'
    }
  });

  console.log('Merchant Razorpay credentials updated successfully!');
  await mongoose.disconnect();
}

updateMerchantRazorpay().catch(console.error);
