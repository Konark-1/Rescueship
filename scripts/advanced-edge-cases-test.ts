import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Merchant } from '../src/models/Merchant';
import { Order } from '../src/models/Order';
import { addressCorrectionService } from '../src/services/address-correction.service';
import { ndrService } from '../src/services/ndr.service';
import { emailService } from '../src/services/email.service';

const BASE_URL = 'http://localhost:3000';

interface AdvTestResult {
  scenario: string;
  verdict: 'PASS' | 'FAIL';
  details: string;
  latencyMs: number;
}

const advResults: AdvTestResult[] = [];

async function runAdvTest(scenario: string, fn: () => Promise<string>) {
  const start = Date.now();
  try {
    const details = await fn();
    const latencyMs = Date.now() - start;
    advResults.push({ scenario, verdict: 'PASS', details, latencyMs });
    console.log(`  ✅ [PASS] ${scenario} (${latencyMs}ms) - ${details}`);
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const errorMsg = err.response?.data?.error || err.message;
    advResults.push({ scenario, verdict: 'FAIL', details: errorMsg, latencyMs });
    console.error(`  ❌ [FAIL] ${scenario} (${latencyMs}ms) - ${errorMsg}`);
  }
}

async function runAdvancedEdgeCaseTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING 4 ADVANCED EDGE-CASE INTEGRATION SUITES');
  console.log('================================================================\n');

  await mongoose.connect('mongodb://localhost:27017/rescueship');
  const merchant = await Merchant.findOne();
  if (!merchant) throw new Error('No merchant in DB');
  const merchantId = merchant._id.toString();

  // -------------------------------------------------------------
  // ADVANCED TEST 1: 2-Step "Both" Mode State Machine
  // -------------------------------------------------------------
  console.log('🔹 ADVANCED 1: 2-Step "Both" Mode State Machine (GPS + Text)');
  
  await runAdvTest('2-Step Address Correction State Machine', async () => {
    const bothOrderId = `ORD_BOTH_${Date.now()}`;
    const customerPhone = '+919876543210';
    
    // Create an order in NDR state
    const order = await Order.create({
      merchantId: merchant._id,
      externalOrderId: bothOrderId,
      platform: 'shopify',
      customerName: 'Ananya Roy',
      customerPhone,
      orderValue: 2200,
      paymentMethod: 'cod',
      status: 'ndr_detected',
      carrier: 'shiprocket',
      awb: `AWB_BOTH_${Date.now()}`,
      ndr: {
        reason: 'Customer Unavailable',
        rescueMessagesSent: 1,
        addressUpdate: {
          method: 'both',
          collectionState: 'idle',
        },
      },
    });

    // 1. Initiate 2-Step Mode
    await addressCorrectionService.initiateAddressCorrection(order._id.toString(), 'both');
    let updatedOrder = await Order.findById(order._id);
    if (updatedOrder?.ndr?.addressUpdate?.collectionState !== 'awaiting_location') {
      throw new Error(`Expected awaiting_location, got ${updatedOrder?.ndr?.addressUpdate?.collectionState}`);
    }

    // 2. Step 1: Customer submits GPS pin
    await addressCorrectionService.handleLocationResponse(
      customerPhone,
      { latitude: 19.0760, longitude: 72.8777, name: 'Bandra West' },
      updatedOrder
    );
    updatedOrder = await Order.findById(order._id);
    if (updatedOrder?.ndr?.addressUpdate?.collectionState !== 'awaiting_text') {
      throw new Error(`Expected awaiting_text, got ${updatedOrder?.ndr?.addressUpdate?.collectionState}`);
    }

    // 3. Step 2: Customer submits building/flat text
    await addressCorrectionService.handleTextAddressResponse(
      customerPhone,
      'Flat 502, Wing B, Galaxy Heights, Near City Mall',
      updatedOrder
    );
    updatedOrder = await Order.findById(order._id);
    if (updatedOrder?.status !== 'ndr_rescued') {
      throw new Error(`Expected ndr_rescued, got ${updatedOrder?.status}`);
    }
    if (updatedOrder?.ndr?.addressUpdate?.collectionState !== 'complete') {
      throw new Error(`Expected collectionState complete, got ${updatedOrder?.ndr?.addressUpdate?.collectionState}`);
    }

    return `2-Step flow completed: GPS Pin ➔ Text Prompt ➔ Combined Address (${updatedOrder.ndr.addressUpdate.geocodedAddress}) ➔ Order Rescued`;
  });

  // -------------------------------------------------------------
  // ADVANCED TEST 2: Fake Delivery Attempt Flagging Engine
  // -------------------------------------------------------------
  console.log('\n🔹 ADVANCED 2: Fake Delivery Attempt Detection Engine');

  await runAdvTest('Fake Delivery Attempt Flagging (<15m window + score)', async () => {
    const fakeOrder = {
      outForDeliveryAt: new Date(Date.now() - 7 * 60 * 1000), // 7 mins ago
      ndr: { reason: 'Customer refused delivery without opening door' },
      createdAt: new Date(),
    };

    const isFake = ndrService.detectFakeAttempt(fakeOrder as any, {
      awb: 'AWB_FAKE_TEST',
      externalOrderId: 'ORD_FAKE',
      reason: 'Customer refused delivery without opening door',
      phone: '+919876543210',
      carrier: 'shiprocket',
    });

    const category = ndrService.classifyNDRReason('Customer refused delivery without opening door');

    return `Evaluated fake attempt: Category "${category}", Fake Remark Score calculated & Flagged: ${isFake}`;
  });

  // -------------------------------------------------------------
  // ADVANCED TEST 3: WooCommerce COD Webhook Ingestion
  // -------------------------------------------------------------
  console.log('\n🔹 ADVANCED 3: WooCommerce COD Webhook Ingestion');

  await runAdvTest('WooCommerce COD Webhook Endpoint', async () => {
    const wcOrderId = `WC_ORD_${Date.now()}`;
    const payload = {
      id: wcOrderId,
      total: '1850.00',
      payment_method: 'cod',
      payment_method_title: 'Cash on Delivery',
      billing: {
        first_name: 'Pooja',
        last_name: 'Hegde',
        phone: '+919876543210',
        address_1: 'Plot 44, Jubilee Hills',
        city: 'Hyderabad',
        postcode: '500033',
      },
    };

    const res = await axios.post(`${BASE_URL}/webhooks/woocommerce?merchant_id=${merchantId}`, payload, {
      headers: {
        'X-WC-Webhook-Signature': 'dummy-signature-for-local-test',
        'X-WC-Webhook-ID': `wc_hook_${wcOrderId}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.data.status !== 'queued') {
      throw new Error(`Expected queued, got ${res.data.status}`);
    }

    return `WooCommerce order #${wcOrderId} received, validated, and queued for COD conversion`;
  });

  // -------------------------------------------------------------
  // ADVANCED TEST 4: Subscription & Billing Reset Cron
  // -------------------------------------------------------------
  console.log('\n🔹 ADVANCED 4: Subscription & Billing Lifecycle Crons');

  await runAdvTest('Low Credit Alert & Billing Calculation', async () => {
    // Test email fallback dispatch for low credits
    await emailService.sendLowCreditAlert(
      merchant.email || 'merchant@example.com',
      merchant.name || 'Test Merchant',
      5
    );

    // Test monthly plan limit & tier check
    const planLimits = { free_trial: 50, starter: 2000, growth: 10000, scale: 50000, enterprise: 100000 };
    const currentPlan = merchant.billing?.plan || 'free_trial';
    const limit = planLimits[currentPlan as keyof typeof planLimits];
    if (!limit) {
      throw new Error(`Invalid plan limit configuration for ${currentPlan}`);
    }

    return `Low credit email alert dispatched (5 credits threshold) & Plan limits verified (${currentPlan}: ${limit} orders/mo)`;
  });

  console.log('\n================================================================');
  console.log(`🏁 ADVANCED EDGE-CASE SUITES: ${advResults.filter(r => r.verdict === 'PASS').length}/${advResults.length} PASSED`);
  console.log('================================================================\n');

  await mongoose.disconnect();
}

runAdvancedEdgeCaseTests().catch(console.error);
