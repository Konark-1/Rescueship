import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function checkMetaTemplates() {
  const wabaId = '3227359494130764';
  const token = 'EAAPUNG72fMABSiqrjzJWjxjCwMxvwjbUMQ5XPk5eXqiFl1hjtKVTZCTPAZBbegan7nxaPrDsswdQqRuFtg15eIeSRgbchjqhZAZAqyNdzMtCkn9NtfNdz2RGJbQc4ScGKGlbfSs9tpdeq2SZBN5nzN2WeOgEmoDJ4JG59b1LPTE3suV0T9fV3EzIIgL8Lwf7KwHb7lVZA3ZChZAbWste5uI9aHTIwyhXrShSiopK';

  try {
    const res = await axios.get(`https://graph.facebook.com/v22.0/${wabaId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Found ${res.data.data.length} templates in Meta WABA:`);
    res.data.data.forEach((t: any) => {
      console.log(`- ${t.name} (${t.status}, ${t.language})`);
    });
  } catch (err: any) {
    console.error('Error fetching templates:', err.response?.status, err.response?.data || err.message);
  }
}

checkMetaTemplates();
