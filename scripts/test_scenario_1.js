const axios = require('axios');

async function testScenario1() {
  const url = 'http://localhost:3000/api/webhooks/shiprocket?merchant_id=6aa2874f2b6be7572c5c0289';
  const apiKey = 'r-xK-AxScnKFRBJu6RnUv9aVi76jFfuXJEiV1_HZ2DI';

  try {
    const res = await axios.post(url, {
      awb: 'SR1001DELIV01',
      order_id: '1001',
      current_status: 'DELIVERED',
      current_timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
    });

    console.log('Webhook Response:', res.status, res.data);
  } catch (err) {
    console.error('Error posting webhook:', err.response?.status, err.response?.data || err.message);
  }
}

testScenario1();
