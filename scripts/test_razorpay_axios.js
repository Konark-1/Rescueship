const axios = require('axios');

async function testRazorpayAxios() {
  const keyId = 'rzp_test_Tdtx44D4UKp7S1';
  const keySecret = '3h2COAHo9GbPDUhtu83Iyvn0';
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const res = await axios.post('https://api.razorpay.com/v1/payment_links', {
      amount: 119900,
      currency: 'INR',
      description: 'Order #1002 - RescueShip Retention Offer',
      customer: {
        name: 'Konark Parihar',
        contact: '+918800957178',
        email: 'konarkofficial@gmail.com'
      },
      notify: { sms: false, email: false }
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Razorpay SUCCESS! Link:', res.data.short_url, 'ID:', res.data.id);
  } catch (err) {
    console.error('Razorpay Error:', err.response?.status, err.response?.data || err.message);
  }
}

testRazorpayAxios();
