import axios from 'axios';
import crypto from 'crypto';

const API_BASE = 'http://localhost:3000';
let jwtToken = '';
let merchantId = '';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulate() {
    console.log('🚀 Starting RescueShip E2E Simulation...\n');

    try {
        // 1. Register a fake merchant
        console.log('📦 1. Registering a test merchant...');
        const randomEmail = `test_${Date.now()}@rescueship.demo`;
        const registerRes = await axios.post(`${API_BASE}/api/auth/register`, {
            name: 'Demo Store',
            email: randomEmail,
            password: 'securepassword123',
            platform: 'shopify'
        });
        
        jwtToken = registerRes.data.token;
        merchantId = registerRes.data.merchant.id;
        console.log('✅ Merchant Registered! ID:', merchantId);
        console.log('🔑 JWT Token Received.\n');

        // 2. Configure Settings (Enable COD Conversion & NDR)
        console.log('⚙️  2. Configuring Merchant Settings (Enabling COD & NDR)...');
        await axios.put(`${API_BASE}/api/settings`, {
            settings: {
                codConversion: { enabled: true, incentiveType: 'percentage', incentiveAmount: 10, minOrderValue: 500, messageLanguage: 'en' },
                ndrRescue: { enabled: true, escalationChain: [4, 12, 24], messageLanguage: 'en', fakeAttemptDetection: true }
            }
        }, { headers: { Authorization: `Bearer ${jwtToken}` } });
        console.log('✅ Settings Updated.\n');

        // 3. Simulate an incoming Shopify Webhook (New COD Order)
        console.log('🛒 3. Simulating Incoming Shopify Webhook (New COD Order)...');
        const shopifyPayload = {
            id: Date.now(),
            name: '#1001',
            financial_status: 'pending', // COD
            total_price: '1500.00',
            gateway: 'Cash on Delivery (COD)',
            customer: {
                first_name: 'Rahul',
                phone: '+919876543210' // Real-world number format
            }
        };

        // Create HMAC signature (using dummy secret from .env if needed, but we'll bypass validation by sending the raw req or using the real test secret)
        // Note: For local simulation, we assume you might have disabled strict HMAC check or we just send it.
        // Actually, we'll send it and let the server process it. If it fails signature, we'll see it.
        // For this demo, let's just trigger it. We need the SHOPIFY_API_SECRET from env to sign it.
        const shopifySecret = process.env.SHOPIFY_API_SECRET || 'your-shopify-api-secret';
        const signature = crypto.createHmac('sha256', shopifySecret).update(JSON.stringify(shopifyPayload)).digest('base64');

        await axios.post(`${API_BASE}/webhooks/shopify`, shopifyPayload, {
            headers: {
                'x-shopify-shop-domain': 'demostore.myshopify.com',
                'x-shopify-topic': 'orders/create',
                'x-shopify-hmac-sha256': signature,
                'content-type': 'application/json'
            }
        });
        console.log('✅ Shopify Webhook Sent. Server is processing it in the background...\n');

        // Wait a few seconds for BullMQ to process the COD conversion queue
        console.log('⏳ Waiting 3 seconds for BullMQ to process the background jobs...');
        await delay(3000);

        // 4. Fetch the Dashboard Analytics/Orders to verify it was logged
        console.log('\n📊 4. Fetching Dashboard Analytics...');
        const analyticsRes = await axios.get(`${API_BASE}/api/analytics`, {
            headers: { Authorization: `Bearer ${jwtToken}` }
        });
        console.log('📈 Analytics Data:', JSON.stringify(analyticsRes.data, null, 2));

        console.log('\n📜 5. Fetching Order Logs...');
        const ordersRes = await axios.get(`${API_BASE}/api/orders`, {
            headers: { Authorization: `Bearer ${jwtToken}` }
        });
        
        const order = ordersRes.data.orders[0];
        if (order) {
            console.log(`✅ Order ${order.externalOrderId} found! Status: ${order.status}`);
            console.log('Status shows it was pushed to the queue! Check your terminal server logs for the WhatsApp delivery attempt.');
        } else {
            console.log('❌ Order not found in database. Check server logs.');
        }

        console.log('\n🎉 Simulation Complete!');

    } catch (error: any) {
        console.error('❌ Simulation Failed:', error.response?.data || error.message);
    }
}

simulate();
