const axios = require('axios');

async function deliverCancelWebhook() {
  const url = 'http://localhost:3000/api/webhooks/whatsapp';

  const body = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '3227359494130764',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551672693',
                phone_number_id: '1370233809508386'
              },
              contacts: [
                {
                  profile: { name: 'Konark Parihar' },
                  wa_id: '918800957178'
                }
              ],
              messages: [
                {
                  from: '918800957178',
                  id: `wamid.CANCEL_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'button',
                  button: {
                    payload: 'Cancel Order',
                    text: 'Cancel Order'
                  }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Webhook dispatched, status:', res.status, res.data);
  } catch (err) {
    console.error('Webhook error:', err.response?.status, err.response?.data || err.message);
  }
}

deliverCancelWebhook();
