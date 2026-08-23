import 'dotenv/config';
import axios from 'axios';
import mongoose from 'mongoose';
import { logisticsService } from '../src/services/logistics.service';
import { carrierConnectService } from '../src/services/carrier-connect.service';
import { Merchant } from '../src/models/Merchant';
import { redisConnection } from '../src/config/redis';

async function testShiprocketAuth() {
  const email = process.env.SHIPROCKET_EMAIL || 'konarksesto@gmail.com';
  const password = process.env.SHIPROCKET_PASSWORD || '004WdM6K88Vujrv@pB1RkX&klXCctbUg';

  console.log('Testing Shiprocket API authentication for:', email);
  try {
    const res = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email,
      password,
    });
    console.log('✅ Shiprocket Login Response Status:', res.status);
    console.log('✅ Token obtained:', res.data.token ? res.data.token.slice(0, 25) + '...' : 'No token');
    
    // Connect in MongoDB for Konark's merchant
    await mongoose.connect('mongodb://localhost:27017/rescueship');
    let merchant = await Merchant.findOne({ email });
    if (!merchant) {
      merchant = await Merchant.findOne();
    }
    if (!merchant) {
      console.log('❌ No merchant found in DB');
      process.exit(1);
    }

    const merchantId = merchant._id.toString();
    console.log('Connecting carrier for merchant:', merchant.name || merchant.email, `(${merchantId})`);

    // Save and validate carrier
    const result = await carrierConnectService.validateAndSave(merchantId, {
      provider: 'shiprocket',
      email,
      password,
    });
    console.log('✅ Carrier successfully connected & encrypted in DB:', result);

    // Update merchant settings & sandbox
    merchant.billing.plan = 'scale';
    merchant.billing.rescueCredits = 9999;
    merchant.ownerPhone = '+919876543210';
    merchant.settings.codConversion.enabled = true;
    merchant.settings.codConversion.incentiveType = 'flat';
    merchant.settings.codConversion.incentiveAmount = 100;
    merchant.settings.ndrRescue.enabled = true;
    merchant.sandbox = {
      enabled: true,
      testRescuesSent: 0,
      testRescuesSucceeded: 0,
      graduationThreshold: 5,
      graduated: false,
    };
    await merchant.save();
    console.log('✅ Merchant account updated with Scale Plan, 9999 Credits & Sandbox Mode');

    await mongoose.disconnect();
    await redisConnection.quit();
    console.log('\n🎉 SHIPROCKET INTEGRATION VERIFIED AND LINKED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Shiprocket Auth Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testShiprocketAuth();
