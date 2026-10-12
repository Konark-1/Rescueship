const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const NdrCase = mongoose.model('NdrCase', new mongoose.Schema({}, { strict: false }));
  const cases = await NdrCase.find({ customerPhone: { $regex: '8800957178' } }).lean();
  console.log('NdrCases count for 8800957178:', cases.length);
  cases.forEach(c => console.log(c._id, 'status:', c.status, 'orderId:', c.orderId));
  await mongoose.disconnect();
}

run().catch(console.error);
