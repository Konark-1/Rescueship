import axios from 'axios';

async function testShopify() {
  const token = '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';
  const domain = 'konark-uuoyyw2i.myshopify.com';
  try {
    const res = await axios.get(`https://${domain}/admin/api/2024-01/orders.json?status=any`, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });
    console.log(`Found ${res.data.orders.length} orders on Shopify:`);
    res.data.orders.forEach((o: any) => {
      console.log(`- #${o.order_number} (ID: ${o.id}), Total: ₹${o.total_price}, Gateway: ${o.gateway || o.payment_gateway_names}, Phone: ${o.phone || o.customer?.phone || o.shipping_address?.phone}`);
    });
  } catch (err: any) {
    console.error('Shopify API Error:', err.response?.status, err.response?.data || err.message);
  }
}

testShopify();
