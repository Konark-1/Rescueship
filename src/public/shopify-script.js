let merchantId = '';
        
async function initMerchant() {
    try {
        const regRes = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'DemoStore', email: `demo_${Date.now()}@test.com`, password: 'pwd', platform: 'shopify' })
        });
        const data = await regRes.json();
        merchantId = data.merchant.id;
    } catch (e) {
        console.error("Auto-registration failed", e);
    }
}
initMerchant();

function openCheckout() {
    document.getElementById('checkoutModal').style.display = 'flex';
}

function closeCheckout() {
    document.getElementById('checkoutModal').style.display = 'none';
}

async function placeOrder() {
    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    
    const payload = {
        id: Date.now(),
        name: '#100' + Math.floor(Math.random() * 100),
        financial_status: 'pending',
        total_price: '2499.00',
        gateway: 'Cash on Delivery (COD)',
        customer: { first_name: name, phone: phone }
    };

    // Fire the webhook
    await fetch(`/webhooks/shopify/order-created?merchant_id=${merchantId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-shopify-shop-domain': 'demostore.myshopify.com',
            'x-shopify-topic': 'orders/create',
            'x-shopify-hmac-sha256': 'dummy-signature-for-local-test'
        },
        body: JSON.stringify(payload)
    });

    closeCheckout();
    document.getElementById('successMsg').style.display = 'block';
}

document.getElementById('buyNowBtn').addEventListener('click', openCheckout);
document.getElementById('confirmOrderBtn').addEventListener('click', placeOrder);
document.getElementById('cancelBtn').addEventListener('click', closeCheckout);
