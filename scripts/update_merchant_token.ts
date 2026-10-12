import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { encryptionService } from '../src/services/encryption.service';

async function updateMerchantWaToken() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const Merchant = mongoose.model('Merchant', new mongoose.Schema({}, { strict: false }));

  const token = 'EAAPUNG72fMABSludvR0mF8czGTsHTWujPlWXAc6QjRBCKvc59JJsma5sMqFq9Po4HJ824P7DUq5ZBEVYXAbnXzSvGKuEAK62Uua77qA2zZALuJ3L7ModFLVianKszZA2SX07sXeYRP9lD1ZBuElEKuV9baBV19W33msA2msnE4Lsn0HJ2zQC8ViJmicylKiSUQOY0z2exYRXzD0dcfE1r1WCyBtxCAiwN99WRVQaPMEDjl5DJl4DkuxstvrtSJbZCDSzXIatlbJAqzQIBnZCTAlFV5ywZDZD';
  const encryptedToken = encryptionService.encrypt(token);

  await Merchant.findByIdAndUpdate('6aa2874f2b6be7572c5c0289', {
    $set: {
      'whatsappConfig.accessToken': encryptedToken,
      'whatsappConfig.status': 'connected',
      'whatsappConfig.isConfigured': true
    }
  });

  console.log('Merchant WhatsApp access token updated in DB successfully!');
  await mongoose.disconnect();
}

updateMerchantWaToken().catch(console.error);
