import 'dotenv/config';
import mongoose from 'mongoose';
import { ndrService } from '../../src/../src/services/ndr.service';
import { Order } from '../../src/../src/models/Order';
import { Merchant } from '../../src/../src/models/Merchant';
import { DeliveryAttempt } from '../../src/../src/models/DeliveryAttempt';
import { MessageLog } from '../../src/../src/models/MessageLog';

async function runComparison() {
  console.log('\n================================================================');
  console.log('🔬 REALISTIC LOGISTICS SCENARIO: 2:00 PM vs 8:30 PM COMPARISON');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rescueship');
  const merchant = await Merchant.findOne({ email: 'konarkofficial@gmail.com' });
  if (!merchant) throw new Error('Merchant not found');

  // Scenario A: Daytime Skip at 2:00 PM (14:00 IST)
  // Rider went OFD at 10:00 AM, reached flat at 2:00 PM. Consignee at work/lunch.
  const ofd2PM = new Date('2026-10-05T04:30:00.000Z'); // 10:00 AM IST
  const attempt2PM = new Date('2026-10-05T08:30:00.000Z'); // 2:00 PM IST (14:00 IST)
  const orderA = {
    outForDeliveryAt: ofd2PM,
    externalOrderId: 'ORD-2PM-REALISTIC',
    customerName: 'Priya Verma',
    customerPhone: '+918800957178',
    status: 'out_for_delivery',
    orderValue: 1499,
  };

  // Scenario B1: Shift-End Batch Scan at 8:30 PM (20:30 IST) with normal morning OFD
  // Rider finishes route, still has 5 undelivered parcels, dumps them at 8:30 PM as 'Customer Unavailable'
  const ofdB = new Date('2026-10-05T05:30:00.000Z'); // 11:00 AM IST
  const attempt830PM = new Date('2026-10-05T15:00:00.000Z'); // 8:30 PM IST (20:30 IST)
  const orderB = {
    outForDeliveryAt: ofdB,
    externalOrderId: 'ORD-830PM-SHIFTEND',
    customerName: 'Rohit Kulkarni',
    customerPhone: '+918800957178',
    status: 'out_for_delivery',
    orderValue: 2199,
  };

  // Scenario B2: Shift-End Rapid Scan (Rider marks OFD late at 8:18 PM, marks failed at 8:30 PM - 12 min delta)
  const ofdB_Rapid = new Date('2026-10-05T14:48:00.000Z'); // 8:18 PM IST
  const orderB_Rapid = {
    outForDeliveryAt: ofdB_Rapid,
    externalOrderId: 'ORD-830PM-RAPID',
    customerName: 'Ankit Mehta',
    customerPhone: '+918800957178',
    status: 'out_for_delivery',
    orderValue: 1899,
  };

  // Calculate scores
  const score2PM = ndrService.fakeRemarkScore(orderA, attempt2PM);
  const isFake2PM = ndrService.detectFakeAttempt(orderA, { attemptTime: attempt2PM } as any);

  const score830PM = ndrService.fakeRemarkScore(orderB, attempt830PM);
  const isFake830PM = ndrService.detectFakeAttempt(orderB, { attemptTime: attempt830PM } as any);

  const score830PM_Rapid = ndrService.fakeRemarkScore(orderB_Rapid, attempt830PM);
  const isFake830PM_Rapid = ndrService.detectFakeAttempt(orderB_Rapid, { attemptTime: attempt830PM } as any);

  console.log('📌 SCENARIO A: 2:00 PM (14:00 IST) Delivery Skipped');
  console.log('   - Time of Scan:      2:00 PM IST (Broad Daylight / Business Hours)');
  console.log('   - Elapsed since OFD: 4 Hours (10:00 AM ➔ 2:00 PM)');
  console.log('   - Fake Remark Score: ' + score2PM.toFixed(2));
  console.log('   - Flagged as Fake:   ' + (isFake2PM ? '⚠️ YES' : '✅ NO (Genuine Daytime Miss)'));
  console.log('   - Root Cause:        Customer at office, in transit, or missed phone call.');
  console.log('   - Action:            Trigger standard Reschedule / Alternate Address WhatsApp nudge.');

  console.log('\n📌 SCENARIO B1: 8:30 PM (20:30 IST) Standard Shift-End Dump');
  console.log('   - Time of Scan:      8:30 PM IST (Evening / Courier Hub Return Cutoff Window)');
  console.log('   - Elapsed since OFD: 9.5 Hours (11:00 AM ➔ 8:30 PM)');
  console.log('   - Fake Remark Score: ' + score830PM.toFixed(2));
  console.log('   - Flagged as Fake:   ' + (isFake830PM ? '⚠️ YES' : 'ℹ️ Standard Telemetry (Customer Audit Triggered)'));
  console.log('   - Root Cause:        Rider fatigue / shift-end exhaustion / doorstep bypass.');
  console.log('   - Action:            Immediate WhatsApp prompt asking: "Did rider visit your doorstep?"');

  console.log('\n📌 SCENARIO B2: 8:30 PM (20:30 IST) Rapid Shift-End Anomaly (<15m Delta)');
  console.log('   - Time of Scan:      8:30 PM IST (Marked OFD at 8:18 PM ➔ Failed at 8:30 PM)');
  console.log('   - Elapsed since OFD: 12 Minutes (< 15 Min Warning Threshold!)');
  console.log('   - Fake Remark Score: ' + score830PM_Rapid.toFixed(2));
  console.log('   - Flagged as Fake:   ' + (isFake830PM_Rapid ? '🚨 YES (CAUGHT BY 15-MIN GATE)' : 'NO'));
  console.log('   - Root Cause:        Pure Shift-End Fake Scan (Driver never left hub or van).');
  console.log('   - Action:            Automatic courier penalty logged + Regional supervisor escalation.');

  console.log('\n================================================================\n');
  await mongoose.disconnect();
}

runComparison().catch(console.error);
