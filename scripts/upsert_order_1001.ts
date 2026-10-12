import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { Order } from '../src/models';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  
  const merchantId = '6aa2874f2b6be7572c5c0289';
  const orderNumber = '1001';
  const awb = 'SR1001DELIV01';
  
  const existing = await Order.findOne({ merchantId, externalOrderId: orderNumber });
  if (existing) {
    existing.awb = awb;
    existing.status = 'shipped';
    existing.customerPhone = '+918800957178';
    existing.customerName = 'Konark Parihar';
    existing.orderValue = 999;
    existing.paymentMethod = 'cod';
    existing.shippingPincode = '201301';
    existing.shippingCity = 'Noida';
    existing.shippingState = 'Uttar Pradesh';
    await existing.save();
    console.log('Updated existing Order #1001 in DB:', existing._id);
  } else {
    const o = await Order.create({
      merchantId,
      externalOrderId: orderNumber,
      orderNumber: orderNumber,
      awb,
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
      productName: 'Test Wireless Earbuds',
      carrier: 'shiprocket',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Created Order #1001 in DB:', o._id);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
