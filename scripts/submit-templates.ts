/**
 * Submit RescueShip's WhatsApp template library to one WABA, skipping templates that
 * already exist (any status). No database access.
 *
 *   META_TOKEN=<token with whatsapp_business_management> WABA_ID=<waba id> \
 *     npx ts-node scripts/submit-templates.ts [--dry-run]
 *
 * The token is read from the environment only and never printed.
 */
import axios from 'axios';
import { TEMPLATE_DEFS, buildComponents } from '../src/services/whatsapp/template-registry';

const G = 'https://graph.facebook.com/v22.0';

async function main() {
  const token = process.env.META_TOKEN;
  const wabaId = process.env.WABA_ID;
  const dryRun = process.argv.includes('--dry-run');
  if (!token || !wabaId || !/^\d{5,32}$/.test(wabaId)) {
    console.error('Set META_TOKEN and WABA_ID (numeric).');
    process.exit(2);
  }
  const auth = { Authorization: `Bearer ${token}` };
  const existing = await axios.get(`${G}/${wabaId}/message_templates`, { params: { fields: 'name,status', limit: 200 }, headers: auth, timeout: 15000 });
  const have = new Map<string, string>((existing.data?.data || []).map((t: any) => [t.name, t.status]));

  let failed = 0;
  for (const d of TEMPLATE_DEFS) {
    if (have.has(d.name)) { console.log(`= ${d.name}: already ${have.get(d.name)}`); continue; }
    if (dryRun) { console.log(`~ ${d.name}: would submit (${d.category}, ${d.language})`); continue; }
    try {
      const r = await axios.post(`${G}/${wabaId}/message_templates`, { name: d.name, category: d.category, language: d.language, components: buildComponents(d) }, { headers: auth, timeout: 15000 });
      console.log(`+ ${d.name}: submitted → ${r.data?.status || 'PENDING'} (category ${r.data?.category || d.category})`);
    } catch (e: any) {
      failed++;
      const err = e.response?.data?.error;
      console.log(`! ${d.name}: ${err?.error_user_msg || err?.message || e.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e.response?.data?.error?.message || e.message); process.exit(1); });
