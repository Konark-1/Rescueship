/**
 * Read-only live check of a merchant's integrations (Shopify, WhatsApp, payment gateway,
 * courier) using the credentials stored for that merchant. Secrets are decrypted in memory
 * and never printed.
 *
 *   npx ts-node scripts/check-connections.ts merchant@example.com          # report only
 *   npx ts-node scripts/check-connections.ts merchant@example.com --save   # also store results
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Merchant } from '../src/models';
import { checkShopify, checkWhatsApp, checkPayment, checkCarrier, checkMerchantConnections } from '../src/services/connection-health.service';

async function main() {
  const email = process.argv[2];
  const save = process.argv.includes('--save');
  if (!email) {
    console.error('Usage: ts-node scripts/check-connections.ts <merchant email> [--save]');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI as string, { serverSelectionTimeoutMS: 15000 });
  const merchant: any = await Merchant.findOne({ email: email.toLowerCase().trim() });
  if (!merchant) {
    console.error('No merchant with that email');
    process.exit(1);
  }
  if (save) {
    const r = await checkMerchantConnections(String(merchant._id));
    for (const [k, v] of Object.entries(r)) console.log(k.padEnd(9), v.ok, '-', v.detail);
  } else {
    for (const [k, fn] of Object.entries({ shopify: checkShopify, whatsapp: checkWhatsApp, payment: checkPayment, carrier: checkCarrier })) {
      const v = await fn(merchant);
      console.log(k.padEnd(9), v.ok, '-', v.detail);
    }
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
