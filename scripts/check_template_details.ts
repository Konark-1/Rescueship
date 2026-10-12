import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function getTemplateDetail() {
  const wabaId = '3227359494130764';
  const token = 'EAAPUNG72fMABSiqrjzJWjxjCwMxvwjbUMQ5XPk5eXqiFl1hjtKVTZCTPAZBbegan7nxaPrDsswdQqRuFtg15eIeSRgbchjqhZAZAqyNdzMtCkn9NtfNdz2RGJbQc4ScGKGlbfSs9tpdeq2SZBN5nzN2WeOgEmoDJ4JG59b1LPTE3suV0T9fV3EzIIgL8Lwf7KwHb7lVZA3ZChZAbWste5uI9aHTIwyhXrShSiopK';

  const res = await axios.get(`https://graph.facebook.com/v22.0/${wabaId}/message_templates?name=ndr_reschedule_en`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('ndr_reschedule_en:', JSON.stringify(res.data.data, null, 2));

  const res2 = await axios.get(`https://graph.facebook.com/v22.0/${wabaId}/message_templates?name=ndr_rescue_v2_en`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('ndr_rescue_v2_en:', JSON.stringify(res2.data.data, null, 2));
}

getTemplateDetail();
