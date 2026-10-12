const Razorpay = require('razorpay');

async function testRazorpay() {
  const rzp = new Razorpay({
    key_id: 'rzp_test_Tdtx44D4UKp7S1',
    key_secret: '3h2COAHo9GbPDUhtu83Iyvn0'
  });

  try {
    const link = await rzp.paymentLink.create({
      amount: 119900, // in paise = ₹1,199
      currency: 'INR',
      description: 'Order #1002 - RescueShip Retention Offer',
      customer: {
        name: 'Konark Parihar',
        contact: '+918800957178',
        email: 'konarkofficial@gmail.com'
      },
      notify: { sms: false, email: false }
    });
    console.log('Razorpay Link SUCCESS! ID:', link.id, 'URL:', link.short_url);
  } catch (err) {
    console.error('Razorpay Error:', err);
  }
}

testRazorpay();
