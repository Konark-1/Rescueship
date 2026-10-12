import axios from 'axios';

async function testShiprocket() {
  try {
    const res = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email: 'konarkparihar@gmail.com',
      password: '004WdM6K88Vujrv@pB1RkX&klXCctbUg'
    });
    console.log('Shiprocket Login SUCCESS!');
    console.log('Token:', res.data.token ? res.data.token.slice(0, 20) + '...' : 'none');
    
    // Now let's list orders in Shiprocket
    const ordersRes = await axios.get('https://apiv2.shiprocket.in/v1/external/orders', {
      headers: {
        'Authorization': `Bearer ${res.data.token}`
      }
    });
    console.log('Shiprocket Orders count:', ordersRes.data.data?.length || 0);
    if (ordersRes.data.data?.length > 0) {
      console.log('First order:', ordersRes.data.data[0]);
    }
  } catch (err: any) {
    console.error('Shiprocket Error:', err.response?.status, err.response?.data || err.message);
  }
}

testShiprocket();
