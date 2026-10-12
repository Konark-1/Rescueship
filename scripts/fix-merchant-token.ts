import mongoose from 'mongoose';
import { Merchant } from '../src/models/Merchant';
import { EncryptionService } from '../src/services/encryption.service';

const token = 'EAAPUNG72fMABSlne44eomYfWglY7SL6OxiMrzsUttjcVfuHZCKnnuzitFKDZCWk4mRK6ojPLVGugqTHjQI5vt4INM1Sd30l5q5i009FYlr5UI0CgV6eyUI3D2aR5ul4Ml7ZAoeHsDVND4oGTErzfu8fnKvjsEwBbQlXGXnBv34WNiQ7YXpQw2Cf4JZBT021nj55mj8YE9KCx2tYx1cxJy1pkQXv2JLgMMbpilBRrBbjMXZCzSyowMYxy4nINAduElZCTgnFqZAE0o0MTM6jd8PqPZB3jJAZDZD';
const phoneNumberId = '1370233809508386';
const businessAccountId = '3227359494130764';

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const enc = EncryptionService.getInstance();
  const encrypted = enc.encrypt(token);
  console.log('Encrypted new token successfully.');

  // Test decrypting it back
  const decrypted = enc.decrypt(encrypted);
  console.log('Verification decrypt matches:', decrypted === token);

  const m = await Merchant.findById('6aa2874f2b6be7572c5c0289');
  if (!m) {
    console.error('Merchant 6aa2874f2b6be7572c5c0289 not found!');
    process.exit(1);
  }

  (m as any).whatsappConfig = {
    accessToken: encrypted,
    phoneNumberId,
    businessAccountId,
  };
  await m.save();
  console.log(`Successfully updated merchant 6aa2874f2b6be7572c5c0289 with new encrypted token!`);

  await mongoose.disconnect();
}

fix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
