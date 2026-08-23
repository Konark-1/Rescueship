import 'dotenv/config';
import mongoose from 'mongoose';
import { Merchant } from '../src/models/Merchant';
import { carrierConnectService } from '../src/services/carrier-connect.service';

async function linkAll() {
  await mongoose.connect('mongodb://localhost:27017/rescueship');
  const merchants = await Merchant.find();
  for (const m of merchants) {
    await carrierConnectService.validateAndSave(m._id.toString(), {
      provider: 'shiprocket',
      email: 'konarkparihar@gmail.com',
      password: '004WdM6K88Vujrv@pB1RkX&klXCctbUg',
    });
    console.log('✅ Linked Shiprocket for:', m.name || m.email);
  }
  await mongoose.disconnect();
  process.exit(0);
}
linkAll().catch(console.error);
