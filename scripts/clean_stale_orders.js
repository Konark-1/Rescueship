const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false }));
  const res = await Order.updateMany(
    { customerPhone: { $regex: "8800957178" }, status: { $in: ["ndr_rescue_sent", "ndr_detected", "ndr_pending_review", "cod_conversion_sent"] } },
    { $set: { status: "rto", ndrStatus: "closed" } }
  );
  console.log("Updated stale active orders to rto/closed:", res.modifiedCount);
  await mongoose.disconnect();
}

run().catch(console.error);
