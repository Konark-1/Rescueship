/**
 * Post-deploy smoke test — no secrets needed. Confirms the deployed API is healthy and
 * that every public webhook route exists AND refuses unsigned traffic.
 *
 *   npx ts-node scripts/smoke-deploy.ts https://rescueship.onrender.com
 *
 * Exit code 0 = all checks passed.
 */
import axios from 'axios';

type Check = { name: string; method: 'get' | 'post'; path: string; expect: number[]; headers?: Record<string, string>; body?: unknown };

const CHECKS: Check[] = [
  { name: 'health', method: 'get', path: '/health', expect: [200] },
  { name: 'Shiprocket webhook alias (no merchant/key)', method: 'post', path: '/webhooks/carrier/ndr', expect: [401], body: { awb: 'SMOKE1', current_status: 'UNDELIVERED' } },
  { name: 'Shiprocket webhook legacy path', method: 'post', path: '/webhooks/shiprocket/ndr', expect: [401], body: { awb: 'SMOKE1', current_status: 'UNDELIVERED' } },
  { name: 'Shopify webhook (no HMAC)', method: 'post', path: '/webhooks/shopify', expect: [401], body: {} },
  { name: 'Merchant payment webhook (unsigned)', method: 'post', path: '/webhooks/payment', expect: [400, 401], body: { event: 'payment_link.paid' } },
  { name: 'Platform billing webhook (unsigned)', method: 'post', path: '/webhooks/razorpay/payment', expect: [401], body: { event: 'subscription.charged' } },
  { name: 'WhatsApp verify (wrong token)', method: 'get', path: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=smoke-wrong&hub.challenge=1', expect: [403] },
  { name: 'Authenticated API without JWT', method: 'get', path: '/api/connect/state', expect: [401] },
];

async function main() {
  const base = (process.argv[2] || process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (!/^https?:\/\//.test(base)) { console.error('Usage: smoke-deploy.ts <api base url>'); process.exit(2); }
  let failed = 0;
  for (const c of CHECKS) {
    let status = 0;
    try {
      const r = await axios.request({ method: c.method, url: base + c.path, data: c.body, headers: { 'content-type': 'application/json', ...(c.headers || {}) }, timeout: 70000, validateStatus: () => true });
      status = r.status;
    } catch (e: any) {
      status = -1;
    }
    const ok = c.expect.includes(status);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(48)} ${status} (expected ${c.expect.join('/')})`);
  }
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll smoke checks passed');
  process.exit(failed ? 1 : 0);
}
main();
