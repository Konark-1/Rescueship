const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false }));
  const orders = await Order.find({ customerPhone: { $regex: "8800957178" } }).select("orderNumber externalOrderId status ndrStatus awb trackingNumber customerPhone createdAt");
  console.log("Found orders for 8800957178:", orders.length);
  orders.forEach(o => {
    console.log(`- ID: ${o._id}, Order: ${o.orderNumber || o.externalOrderId}, Status: ${o.status}, NDR: ${o.ndrStatus}, AWB: ${o.awb || o.trackingNumber}`);
  });
  await mongoose.disconnect();
}

run().catch(console.error);
