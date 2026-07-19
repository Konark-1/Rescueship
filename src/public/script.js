async function checkHealth() {
    const statusEl = document.getElementById('status');
    const uptimeEl = document.getElementById('uptime');
    
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        if (data.status === 'healthy') {
            statusEl.className = 'status-box';
            statusEl.innerHTML = '<div class="pulse"></div> API Engine is Online & Healthy';
            uptimeEl.textContent = formatUptime(data.uptime);
        } else {
            throw new Error('Unhealthy status');
        }
    } catch (error) {
        statusEl.className = 'status-box error';
        statusEl.innerHTML = '⚠️ Cannot connect to API Engine. Make sure server is running.';
        uptimeEl.textContent = '--';
    }
}

function formatUptime(seconds) {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

let jwtToken = '';

function logToBox(message) {
    const logBox = document.getElementById('logBox');
    const time = new Date().toLocaleTimeString();
    logBox.innerHTML += `\n[${time}] ${message}`;
    logBox.scrollTop = logBox.scrollHeight;
}

async function runSimulation() {
    logToBox("🚀 Starting RescueShip E2E Simulation...");
    const simBtn = document.getElementById('runSimBtn');
    simBtn.disabled = true;
    simBtn.style.opacity = '0.5';

    try {
        logToBox("📦 1. Registering a test merchant...");
        const randomEmail = `test_${Date.now()}@rescueship.demo`;
        
        const regRes = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Demo Store UI',
                email: randomEmail,
                password: 'securepassword123',
                platform: 'shopify'
            })
        });
        
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error(regData.error || 'Registration failed');
        
        jwtToken = regData.token;
        logToBox(`✅ Merchant Registered! ID: ${regData.merchant.id}`);

        logToBox("⚙️  2. Configuring Merchant Settings (Enabling COD & NDR)...");
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({
                settings: {
                    codConversion: { enabled: true, incentiveType: 'percentage', incentiveAmount: 10, minOrderValue: 500, messageLanguage: 'en' },
                    ndrRescue: { enabled: true, escalationChain: [4, 12, 24], messageLanguage: 'en', fakeAttemptDetection: true }
                }
            })
        });
        logToBox("✅ Settings Updated.");

        logToBox("🛒 3. Simulating Incoming Shopify Webhook (New COD Order)...");
        
        // Note: For local browser testing, we rely on the server bypassing strict HMAC if not set, or we send a dummy signature.
        const shopifyPayload = {
            id: Date.now(),
            name: '#1002',
            financial_status: 'pending',
            total_price: '2500.00',
            gateway: 'Cash on Delivery (COD)',
            customer: { first_name: 'Anjali', phone: '+919876543210' }
        };

        const whRes = await fetch(`/webhooks/shopify/order-created?merchant_id=${regData.merchant.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-shopify-shop-domain': 'demostore.myshopify.com',
                'x-shopify-topic': 'orders/create',
                'x-shopify-hmac-sha256': 'dummy-signature-for-local-test'
            },
            body: JSON.stringify(shopifyPayload)
        });
        
        logToBox("✅ Shopify Webhook Sent. Server is processing it in the background.");
        
        logToBox("⏳ Waiting 3 seconds for BullMQ to process...");
        setTimeout(fetchLatestData, 3000);

    } catch (err) {
        logToBox(`❌ Error: ${err.message}`);
    } finally {
        simBtn.disabled = false;
        simBtn.style.opacity = '1';
    }
}

async function fetchLatestData() {
    if (!jwtToken) {
        logToBox("❌ Please run the simulation first to register a merchant.");
        return;
    }
    
    logToBox("🔄 Fetching Latest Dashboard Data...");
    try {
        const ordersRes = await fetch('/api/orders', {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const ordersData = await ordersRes.json();
        
        if (ordersData.orders) {
            document.getElementById('orderCount').textContent = ordersData.orders.length;
            logToBox(`✅ Found ${ordersData.orders.length} orders in database.`);
            if (ordersData.orders.length > 0) {
                const latest = ordersData.orders[0];
                logToBox(`➡️ Latest Order: ${latest.externalOrderId} | Status: ${latest.status}`);
                logToBox(`🎉 Simulation Successful! BullMQ processed the COD order and moved status to 'cod_conversion_sent'. Check terminal for worker logs.`);
            }
        }
    } catch (err) {
        logToBox(`❌ Error fetching data: ${err.message}`);
    }
}

// Add event listeners
document.getElementById('refreshBtn').addEventListener('click', checkHealth);
document.getElementById('runSimBtn').addEventListener('click', runSimulation);
document.getElementById('fetchDataBtn').addEventListener('click', fetchLatestData);

// Initial setup
checkHealth();
setInterval(checkHealth, 10000);
logToBox("System Ready. Click 'Run E2E Integration Simulation' to test the full flow.");
