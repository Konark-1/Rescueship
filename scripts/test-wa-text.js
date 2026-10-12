const crypto = require('crypto');
const mongoose = require('mongoose');

const key = 'rescueship_encryption_key_32chars_len';
const derivedKey = crypto.createHash('sha256').update(key).digest();

function decrypt(ciphertext) {
  const parts = ciphertext.split(':');
  const [ivHex, tagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function run() {
  await mongoose.connect('mongodb+srv://konarkofficial_db_user:CZlv3NerxMlLgl00@cluster0.jkbuwf6.mongodb.net/rescueship?retryWrites=true&w=majority');
  const merchant = await mongoose.connection.collection('merchants').findOne({ _id: new mongoose.Types.ObjectId('6aa2874f2b6be7572c5c0289') });
  const token = decrypt(merchant.whatsappConfig?.accessToken);
  const phoneNumberId = merchant.whatsappConfig?.phoneNumberId;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: '918800957178',
    type: 'text',
    text: { body: 'Order #1002 has been cancelled. No further delivery attempts will be made.' }
  };
  
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data, null, 2));
  process.exit(0);
}

run();
