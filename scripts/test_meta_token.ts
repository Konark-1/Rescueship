import axios from 'axios';

async function testMetaToken() {
  const token = 'EAAPUNG72fMABSludvR0mF8czGTsHTWujPlWXAc6QjRBCKvc59JJsma5sMqFq9Po4HJ824P7DUq5ZBEVYXAbnXzSvGKuEAK62Uua77qA2zZALuJ3L7ModFLVianKszZA2SX07sXeYRP9lD1ZBuElEKuV9baBV19W33msA2msnE4Lsn0HJ2zQC8ViJmicylKiSUQOY0z2exYRXzD0dcfE1r1WCyBtxCAiwN99WRVQaPMEDjl5DJl4DkuxstvrtSJbZCDSzXIatlbJAqzQIBnZCTAlFV5ywZDZD';
  try {
    const res = await axios.get('https://graph.facebook.com/v22.0/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Token is 100% VALID!', res.data);
  } catch (err: any) {
    console.error('Token ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

testMetaToken();
