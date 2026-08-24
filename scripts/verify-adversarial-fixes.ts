import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Merchant, Order } from '../src/models';
import { generateToken } from '../src/middleware/auth';
import { config } from '../src/config/env';

const BASE_URL = 'http://localhost:3000';

async function runSecurityAuditProbes() {
  console.log('🔒 ==========================================');
  console.log('🔒 RESCUESHIP ADVERSARIAL SECURITY VERIFICATION');
  console.log('🔒 ==========================================\n');

  await mongoose.connect(config.mongodb.uri);
  const testMerchant = (await Merchant.findOne({ 'billing.plan': 'scale' })) || (await Merchant.findOne());
  if (!testMerchant) {
    console.error('❌ No test merchant found in database');
    process.exit(1);
  }
  const merchantId = testMerchant._id.toString();
  const token = generateToken(merchantId, testMerchant.tokenVersion ?? 1);
  const authHeaders = { Authorization: `Bearer ${token}` };

  let passed = 0;
  let failed = 0;

  function assert(title: string, success: boolean, detail: string) {
    if (success) {
      console.log(`✅ [PASS] ${title}: ${detail}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${title}: ${detail}`);
      failed++;
    }
  }

  // Probe 1: CRIT-1 — Razorpay Unsigned Webhook Attack
  try {
    const res = await axios.post(
      `${BASE_URL}/webhooks/razorpay/payment`,
      {
        event: 'payment_link.paid',
        payload: { payment_link: { entity: { id: 'plink_forged_999', amount_paid: 100 } } }
      },
      { validateStatus: () => true }
    );
    assert(
      'CRIT-1: Razorpay Unsigned Webhook Attack',
      res.status === 401,
      `Expected 401 Unauthorized, got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('CRIT-1: Razorpay Unsigned Webhook Attack', false, e.message);
  }

  // Probe 2: CRIT-2 — WhatsApp Unsigned Webhook Attack
  try {
    const res = await axios.post(
      `${BASE_URL}/webhooks/whatsapp`,
      {
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { messages: [{ from: '919876543210', text: { body: 'cancel' } }] } }] }]
      },
      { validateStatus: () => true }
    );
    assert(
      'CRIT-2: WhatsApp Unsigned Webhook Attack',
      res.status === 401,
      `Expected 401 Unauthorized, got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('CRIT-2: WhatsApp Unsigned Webhook Attack', false, e.message);
  }

  // Probe 3: CRIT-3 — Cashfree Unsigned Webhook Attack
  try {
    const res = await axios.post(
      `${BASE_URL}/webhooks/cashfree/payment`,
      { type: 'LINK_PAID', data: { link_id: 'cf_forged_999' } },
      { validateStatus: () => true }
    );
    assert(
      'CRIT-3: Cashfree Unsigned Webhook Attack',
      res.status === 401,
      `Expected 401 Unauthorized, got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('CRIT-3: Cashfree Unsigned Webhook Attack', false, e.message);
  }

  // Probe 4: CRIT-4 — Razorpay Dummy Test Signature Bypass Attack
  try {
    const res = await axios.post(
      `${BASE_URL}/webhooks/razorpay/payment`,
      {
        event: 'payment_link.paid',
        payload: { payment_link: { entity: { id: 'plink_dummy_sig', amount_paid: 100 } } }
      },
      {
        headers: { 'X-Razorpay-Signature': 'dummy-signature-for-local-test' },
        validateStatus: () => true
      }
    );
    assert(
      'CRIT-4: Razorpay Dummy Signature Bypass Attack',
      res.status === 401,
      `Expected 401 Unauthorized (signature mismatch), got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('CRIT-4: Razorpay Dummy Signature Bypass Attack', false, e.message);
  }

  // Probe 5: HIGH-2 — Shopify Missing merchant_id Parameter Attack
  try {
    const res = await axios.post(
      `${BASE_URL}/webhooks/shopify/order-created`,
      { id: 99999, total_price: '500.00', gateway: 'Cash on Delivery (COD)' },
      { validateStatus: () => true }
    );
    assert(
      'HIGH-2: Shopify Missing merchant_id Attack',
      res.status === 400 || res.status === 401,
      `Expected 400 Bad Request or 401 HMAC required, got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('HIGH-2: Shopify Missing merchant_id Attack', false, e.message);
  }

  // Probe 6: HIGH-5 — Delhivery Magic String Bypass Attack
  try {
    const res = await axios.post(
      `${BASE_URL}/webhooks/delhivery/ndr`,
      { waybill: 'DEL_FORGED_123', status: 'undelivered', remarks: 'Customer not available' },
      {
        headers: { 'x-api-key': 'test-key' },
        validateStatus: () => true
      }
    );
    assert(
      'HIGH-5: Delhivery Magic String Bypass Attack',
      res.status === 401,
      `Expected 401 Unauthorized, got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('HIGH-5: Delhivery Magic String Bypass Attack', false, e.message);
  }

  // Probe 7: MED-1 — Owner Phone Format Validation Attack
  try {
    const res = await axios.post(
      `${BASE_URL}/api/connect/owner-phone`,
      { ownerPhone: 'invalid_malformed_phone' },
      { headers: authHeaders, validateStatus: () => true }
    );
    assert(
      'MED-1: Owner Phone Malformed Injection Attack',
      res.status === 400,
      `Expected 400 Bad Request, got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('MED-1: Owner Phone Malformed Injection Attack', false, e.message);
  }

  // Probe 8: MED-4 — Orders Pagination OOM Attack (limit=999999)
  try {
    const res = await axios.get(
      `${BASE_URL}/api/orders?limit=999999`,
      { headers: authHeaders, validateStatus: () => true }
    );
    const limit = res.data?.pagination?.limit;
    assert(
      'MED-4: Orders Pagination DoS Cap (limit=999999)',
      res.status === 200 && limit === 200,
      `Expected pagination.limit capped at 200, got ${limit}`
    );
  } catch (e: any) {
    assert('MED-4: Orders Pagination DoS Cap', false, e.message);
  }

  // Probe 9: Valid HMAC Razorpay Webhook Verification
  try {
    if (config.razorpay.webhookSecret) {
      const payloadStr = JSON.stringify({
        event: 'payment_link.paid',
        created_at: Date.now(),
        payload: { payment_link: { entity: { id: 'plink_valid_sec_test', amount_paid: 100 } } }
      });
      const validSig = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(payloadStr).digest('hex');
      const res = await axios.post(
        `${BASE_URL}/webhooks/razorpay/payment`,
        JSON.parse(payloadStr),
        {
          headers: { 'X-Razorpay-Signature': validSig, 'Content-Type': 'application/json' },
          validateStatus: () => true
        }
      );
      assert(
        'SEC-VERIFY: Valid HMAC Signature Accepted',
        res.status === 200,
        `Expected HTTP 200 for authentic HMAC, got HTTP ${res.status}`
      );
    } else {
      console.log('ℹ️  [SKIP] SEC-VERIFY: RAZORPAY_WEBHOOK_SECRET not set in env');
    }
  } catch (e: any) {
    assert('SEC-VERIFY: Valid HMAC Signature Accepted', false, e.message);
  }

  // Probe 10: Billing Privilege Escalation (confirm-subscription without signature)
  try {
    const res = await axios.post(
      `${BASE_URL}/api/billing/confirm-subscription`,
      { plan: 'scale', cycle: 'annual', paymentId: 'fake_pay_123', subscriptionId: 'fake_sub_123' },
      { headers: authHeaders, validateStatus: () => true }
    );
    assert(
      'CRIT-BILLING: Billing Privilege Escalation Bypass Attack',
      res.status === 400 || res.status === 401,
      `Expected 400 Bad Request for unverified subscription confirmation, got HTTP ${res.status}`
    );
  } catch (e: any) {
    assert('CRIT-BILLING: Billing Privilege Escalation Bypass Attack', false, e.message);
  }

  // Probe 11: Template Mass Assignment Attack (status: 'approved')
  try {
    const tName = `template_sec_${Date.now()}`;
    const res = await axios.post(
      `${BASE_URL}/api/templates`,
      {
        templateName: tName,
        language: 'en',
        category: 'utility',
        status: 'approved', // injected field
        merchantId: '607f1f77bcf86cd799439099' // injected foreign merchant
      },
      { headers: authHeaders, validateStatus: () => true }
    );
    const createdTemplate = res.data;
    const isStatusPending = createdTemplate?.status === 'pending';
    const isMerchantSafe = createdTemplate?.merchantId?.toString() === merchantId;
    assert(
      'HIGH-TEMPLATE: Template Mass Assignment Protection',
      res.status === 201 && isStatusPending && isMerchantSafe,
      `Expected status 'pending' and owner merchantId. Got status: ${createdTemplate?.status}, merchantId: ${createdTemplate?.merchantId}`
    );
  } catch (e: any) {
    assert('HIGH-TEMPLATE: Template Mass Assignment Protection', false, e.message);
  }

  // Probe 12: Cohort Metrics Competitor Data Leakage Protection
  try {
    const res = await axios.get(
      `${BASE_URL}/api/metrics/cohort`,
      { headers: authHeaders, validateStatus: () => true }
    );
    const performers = res.data?.cohort?.topPerformers || [];
    const hasUnmaskedStore = performers.some((p: any) => !p.storeName.startsWith('Store ') && !p.merchantId.startsWith('anon_'));
    assert(
      'MED-COHORT: Cohort Metrics Competitor Anonymization',
      res.status === 200 && !hasUnmaskedStore,
      `Expected anonymized competitor names/IDs for non-admin merchant. Got ${performers.length} performers.`
    );
  } catch (e: any) {
    assert('MED-COHORT: Cohort Metrics Competitor Anonymization', false, e.message);
  }

  console.log('\n🔒 ==========================================');
  console.log(`🔒 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('🔒 ==========================================\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runSecurityAuditProbes().catch(e => {
  console.error('Fatal probe error:', e);
  process.exit(1);
});
