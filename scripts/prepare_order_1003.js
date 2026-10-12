const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  
  const merchantId = '6aa2874f2b6be7572c5c0289';
  const orderNumber = '1003';
  const awb = 'SR1003RETRY01';
  
  const res = await Order.findOneAndUpdate(
    { merchantId: new mongoose.Types.ObjectId(merchantId), externalOrderId: orderNumber },
    {
      $set: {
        merchantId: new mongoose.Types.ObjectId(merchantId),
        externalOrderId: orderNumber,
        orderNumber: orderNumber,
        awb: awb,
        trackingNumber: awb,
        platform: 'shopify',
        status: 'shipped',
        customerPhone: '+918800957178',
        customerName: 'Konark Parihar',
        orderValue: 999,
        paymentMethod: 'cod',
        shippingPincode: '201301',
        shippingCity: 'Noida',
        shippingState: 'Uttar Pradesh',
        productName: 'Wireless Earbuds Pro',
        carrier: 'shiprocket',
        failureSource: 'NONE',
        attemptCount: 0,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('Upserted Order #1003:', res._id.toString(), 'status:', res.status, 'awb:', res.awb);
  await mongoose.disconnect();
}

run().catch(console.error);
