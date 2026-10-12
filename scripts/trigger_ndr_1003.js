const axios = require('axios');

async function triggerNDR() {
  const url = 'http://localhost:3000/api/webhooks/shiprocket?merchant_id=6aa2874f2b6be7572c5c0289';
  const apiKey = 'r-xK-AxScnKFRBJu6RnUv9aVi76jFfuXJEiV1_HZ2DI';

  try {
    const res = await axios.post(url, {
      awb: 'SR1003RETRY01',
      order_id: '1003',
      current_status: 'UNDELIVERED',
      ndr_reason: 'Customer Not Available',
      customer_phone: '8800957178',
      current_timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
    });

    console.log('NDR Webhook Triggered for #1003:', res.status, res.data);
  } catch (err) {
    console.error('Error triggering NDR:', err.response?.status, err.response?.data || err.message);
  }
}

triggerNDR();
