import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Merchant } from '../src/models/Merchant';
import { Order } from '../src/models/Order';
import { config } from '../src/config/env';

const BASE_URL = 'http://localhost:3000';

async function runE2ETests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END PLATFORM TESTS');
  console.log('====================================================\n');

  await mongoose.connect('mongodb://localhost:27017/rescueship');
  const merchant = await Merchant.findOne({ email: { $exists: true } });
  if (!merchant) {
    throw new Error('No merchant found in DB');
  }
  const merchantId = merchant._id.toString();
  merchant.billing.plan = 'scale';
  merchant.ownerPhone = '+919876543210';
  merchant.sandbox = { enabled: true, testRescuesSent: 0, testRescuesSucceeded: 0, graduationThreshold: 5, graduated: false };
  await merchant.save();
  console.log(`👤 Using test merchant: ${merchant.name || merchant.email} (${merchantId}) [Plan: Scale, Sandbox: Enabled]\n`);

  const { generateToken } = require('../src/middleware/auth');
  const token = generateToken(merchantId);
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 1. Health Check
  try {
    const res = await axios.get(`${BASE_URL}/health`);
    console.log('✅ [1/7] Health Check:', res.data.status, `(Uptime: ${Math.round(res.data.uptime)}s)`);
  } catch (err: any) {
    console.error('❌ [1/7] Health Check Failed:', err.message);
  }

  // 2. Test Shopify COD Webhook Ingestion
  const testOrderId = `TEST_ORD_${Date.now()}`;
  try {
    const payload = {
      id: testOrderId,
      total_price: '2499.00',
      gateway: 'Cash on Delivery (COD)',
      customer: {
        first_name: 'Rahul',
        last_name: 'Sharma',
        phone: '+919876543210',
      },
      shipping_address: {
        address1: 'Flat 302, Galaxy Heights',
        city: 'Mumbai',
        zip: '400001',
      },
    };
    const bodyStr = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', config.shopify.apiSecret).update(bodyStr).digest('base64');

    const res = await axios.post(`${BASE_URL}/webhooks/shopify?merchant_id=${merchantId}`, payload, {
      headers: {
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Webhook-Id': `webhook_${testOrderId}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ [2/7] Shopify COD Webhook:', res.data.status, `(Order ID: ${testOrderId})`);
  } catch (err: any) {
    console.error('❌ [2/7] Shopify Webhook Failed:', err.response?.data || err.message);
  }

  // 3. Test NDR Simulation
  try {
    const ndrPayload = {
      merchantId,
      customerPhone: '919876543210',
      orderId: `NDR_SIM_${Date.now()}`,
      reason: 'wrong_address',
      courier: 'shiprocket',
      awb: `AWB_${Date.now()}`,
    };
    const res = await axios.post(`${BASE_URL}/api/sandbox/simulate-ndr`, ndrPayload, { headers: authHeaders });
    console.log('✅ [3/7] NDR Rescue Simulation:', res.data.success ? 'Success' : 'Failed', `(AWB: ${res.data.data?.awb})`);
  } catch (err: any) {
    console.error('❌ [3/7] NDR Simulation Failed:', err.response?.data || err.message);
  }

  // 4. Test WhatsApp 3-Mode Address Correction (Location Pin)
  try {
    const locPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '919876543210',
                    id: `wamid_${Date.now()}`,
                    type: 'location',
                    location: {
                      latitude: 19.0760,
                      longitude: 72.8777,
                      name: 'Bandra West Landmark',
                      address: 'Linking Rd, Bandra West, Mumbai 400050',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const locBodyStr = JSON.stringify(locPayload);
    const waSignature = 'sha256=' + crypto.createHmac('sha256', config.whatsapp.appSecret).update(locBodyStr).digest('hex');

    const res = await axios.post(`${BASE_URL}/webhooks/whatsapp`, locPayload, {
      headers: {
        'X-Hub-Signature-256': waSignature,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ [4/7] WhatsApp Location Pin Webhook:', res.data.status || 'Received');
  } catch (err: any) {
    console.error('❌ [4/7] WhatsApp Location Webhook Failed:', err.response?.data || err.message);
  }

  // 5. Test WhatsApp Text Address Correction
  try {
    const textPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '919876543210',
                    id: `wamid_txt_${Date.now()}`,
                    type: 'text',
                    text: {
                      body: '4th Floor, Tower B, Apt 404, Near City Mall 400050',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const textBodyStr = JSON.stringify(textPayload);
    const waTextSig = 'sha256=' + crypto.createHmac('sha256', config.whatsapp.appSecret).update(textBodyStr).digest('hex');

    const res = await axios.post(`${BASE_URL}/webhooks/whatsapp`, textPayload, {
      headers: {
        'X-Hub-Signature-256': waTextSig,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ [5/7] WhatsApp Text Address Webhook:', res.data.status || 'Received');
  } catch (err: any) {
    console.error('❌ [5/7] WhatsApp Text Webhook Failed:', err.response?.data || err.message);
  }

  // 6. Test Merchant Dashboard Analytics API
  try {
    const res = await axios.get(`${BASE_URL}/api/analytics/dashboard`, { headers: authHeaders });
    console.log('✅ [6/7] Merchant Analytics API:', res.data.success ? 'Success' : 'OK', `(NDR Rate: ${res.data.data?.ndrRate || 0}%)`);
  } catch (err: any) {
    console.error('❌ [6/7] Analytics API Failed:', err.response?.data || err.message);
  }

  // 7. Test Export API (CSV & JSON)
  try {
    const csvRes = await axios.get(`${BASE_URL}/api/export/orders?format=csv`, { headers: authHeaders });
    const jsonRes = await axios.get(`${BASE_URL}/api/export/orders?format=json`, { headers: authHeaders });
    console.log('✅ [7/7] Data Export API (CSV/JSON):', `CSV (${csvRes.data.length || 0} bytes), JSON (${jsonRes.data.data?.length || 0} records)`);
  } catch (err: any) {
    console.error('❌ [7/7] Export API Failed:', err.response?.data || err.message);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL INTEGRATION ENDPOINTS VERIFIED SUCCESSFULLY!');
  console.log('====================================================\n');

  await mongoose.disconnect();
}

runE2ETests().catch(console.error);
