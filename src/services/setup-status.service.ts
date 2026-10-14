/**
 * setup-status.service.ts
 * ─────────────────────────────────────────────────────────────
 * One answer to "what is left before RescueShip is fully live?" for the operator.
 * Reports only presence/booleans and timestamps — never a secret value.
 * Served at GET /api/liveops/setup-status (X-Ops-Key) and used by `npm run setup -- --check`.
 */
import { Merchant } from '../models';
import { lastWebhookSeen } from '../utils/webhook-heartbeat';

export type SetupState = 'ok' | 'missing' | 'waiting' | 'optional';

export interface SetupItem {
  area: 'Core' | 'Billing' | 'WhatsApp' | 'Shopify' | 'Couriers' | 'Ops';
  key: string;
  label: string;
  state: SetupState;
  detail?: string;
  /** One-line instruction for the operator when not ok. */
  fix?: string;
}

const has = (k: string) => Boolean((process.env[k] || '').trim()) && !/dummy|changeme|your-/i.test(process.env[k] || '');

function envItem(area: SetupItem['area'], key: string, label: string, fix: string, optional = false): SetupItem {
  const ok = has(key);
  return { area, key, label, state: ok ? 'ok' : optional ? 'optional' : 'missing', fix: ok ? undefined : fix };
}

async function lastWebhook(...sources: string[]): Promise<Date | null> {
  const seen = (await Promise.all(sources.map((src) => lastWebhookSeen(src)))).filter(Boolean) as Date[];
  return seen.length ? new Date(Math.max(...seen.map((d) => d.getTime()))) : null;
}

function webhookItem(area: SetupItem['area'], key: string, label: string, seen: Date | null, fix: string): SetupItem {
  return seen
    ? { area, key, label, state: 'ok', detail: `last event ${seen.toISOString()}` }
    : { area, key, label, state: 'waiting', detail: 'no event received in the last 30 days', fix };
}

export async function getSetupStatus() {
  const api = (process.env.API_PUBLIC_URL || process.env.API_BASE_URL || '').replace(/\/$/, '') || '<API_PUBLIC_URL>';
  const rzKey = process.env.RAZORPAY_KEY_ID || '';

  const [wa, rz, shop, sr, merchants, live] = await Promise.all([
    lastWebhook('WHATSAPP', 'WHATSAPP_VERIFY'),
    lastWebhook('RAZORPAY'),
    lastWebhook('SHOPIFY'),
    lastWebhook('SHIPROCKET'),
    Merchant.countDocuments({}).catch(() => 0),
    Merchant.countDocuments({ 'billing.status': 'active', 'billing.plan': { $ne: 'free_trial' } }).catch(() => 0),
  ]);

  const items: SetupItem[] = [
    // Core
    envItem('Core', 'MONGODB_URI', 'Database', 'Render → Environment → MONGODB_URI (MongoDB Atlas connection string).'),
    envItem('Core', 'REDIS_URL', 'Queue / cache', 'Render → Environment → REDIS_URL (Upstash, eviction policy noeviction).'),
    envItem('Core', 'JWT_SECRET', 'Login tokens', 'Use the value from .env.setup.local (npm run setup).'),
    envItem('Core', 'ENCRYPTION_KEY', 'Credential encryption', 'Use the value from .env.setup.local. Never change it once merchants have connected.'),
    envItem('Core', 'API_PUBLIC_URL', 'Public API address', `Set to ${api.startsWith('<') ? 'https://rescueship.onrender.com' : api}.`),
    envItem('Core', 'FRONTEND_URL', 'Website address', 'Set to https://rescueship.netlify.app (later your own domain).'),

    // Billing (RescueShip's own Razorpay account)
    envItem('Billing', 'RAZORPAY_KEY_ID', 'Razorpay key id', 'Razorpay → Account & Settings → API keys.'),
    envItem('Billing', 'RAZORPAY_KEY_SECRET', 'Razorpay key secret', 'Razorpay → API keys (shown once when generated).'),
    {
      area: 'Billing', key: 'RAZORPAY_MODE', label: 'Razorpay mode',
      state: rzKey.startsWith('rzp_live_') ? 'ok' : rzKey ? 'waiting' : 'missing',
      detail: rzKey.startsWith('rzp_live_') ? 'live' : rzKey ? 'test mode — real merchants cannot pay yet' : undefined,
      fix: rzKey.startsWith('rzp_live_') ? undefined : 'Finish Razorpay KYC, generate LIVE keys, replace both keys.',
    },
    envItem('Billing', 'RAZORPAY_WEBHOOK_SECRET', 'Razorpay webhook secret', 'Use the value from .env.setup.local and paste the SAME value in the Razorpay webhook form.'),
    webhookItem('Billing', 'RAZORPAY_WEBHOOK', 'Razorpay webhook reaching us', rz,
      `Razorpay → Webhooks → Add: URL ${api}/webhooks/razorpay/payment, events subscription.* + payment.captured + payment.failed, secret = RAZORPAY_WEBHOOK_SECRET.`),

    // WhatsApp / Meta
    envItem('WhatsApp', 'META_APP_ID', 'Meta app id', 'Set to 1077746595167424 (Render and Netlify VITE_META_APP_ID).'),
    { ...envItem('WhatsApp', 'META_APP_SECRET', 'Meta app secret', 'Meta app → App settings → Basic → App secret.'),
      state: has('META_APP_SECRET') || has('WHATSAPP_APP_SECRET') ? 'ok' : 'missing' },
    envItem('WhatsApp', 'META_CONFIG_ID', 'One-click WhatsApp signup', 'Meta app → Facebook Login for Business → Configurations → WhatsApp Embedded Signup → copy the id (Render META_CONFIG_ID + Netlify VITE_META_CONFIG_ID).'),
    envItem('WhatsApp', 'WHATSAPP_VERIFY_TOKEN', 'Webhook verify token', 'Use the value from .env.setup.local and paste the SAME value in Meta → WhatsApp → Configuration.'),
    webhookItem('WhatsApp', 'WHATSAPP_WEBHOOK', 'WhatsApp webhook reaching us', wa,
      `Meta → WhatsApp → Configuration → Webhook: Callback ${api}/webhooks/whatsapp, Verify token = WHATSAPP_VERIFY_TOKEN, then subscribe to "messages".`),

    // Shopify
    envItem('Shopify', 'SHOPIFY_API_KEY', 'Shopify app client id', 'Must equal client_id in shopify.app.toml (1a20e595…).'),
    envItem('Shopify', 'SHOPIFY_API_SECRET', 'Shopify app secret', 'Shopify Dev Dashboard → RescueShip → Settings → Client secret.'),
    webhookItem('Shopify', 'SHOPIFY_WEBHOOK', 'Shopify webhooks reaching us', shop,
      'Install the app on a store from onboarding (Connect Shopify); webhooks register automatically.'),

    // Couriers
    webhookItem('Couriers', 'SHIPROCKET_WEBHOOK', 'Shiprocket webhook reaching us', sr,
      `Each merchant: Shiprocket → Settings → API → Webhooks: URL ${api}/webhooks/carrier/ndr?merchant_id=<their id>, header x-api-key = their key (shown in RescueShip onboarding).`),

    // Ops
    envItem('Ops', 'OPS_API_KEY', 'Ops key (this report)', 'Use the value from .env.setup.local.'),
    envItem('Ops', 'OPS_ALERT_EMAIL', 'Where alerts go', 'Your email, e.g. konarkofficial@gmail.com.'),
    { area: 'Ops', key: 'EMAIL', label: 'Outgoing email',
      state: has('SMTP_HOST') || has('GMAIL_REFRESH_TOKEN') ? 'ok' : 'missing',
      fix: has('SMTP_HOST') || has('GMAIL_REFRESH_TOKEN') ? undefined : 'Set SMTP_* or GMAIL_* so verification and alert emails send.' },
    envItem('Ops', 'GEMINI_API_KEY', 'AI address parsing', 'Optional: Google AI Studio → API key (Convert/Prevent AI address correction).', true),
    envItem('Ops', 'SECURITY_ALERT_WEBHOOK', 'Security alerts to chat', 'Optional: a Slack/Discord webhook URL.', true),
  ];

  const missing = items.filter((i) => i.state === 'missing').length;
  const waiting = items.filter((i) => i.state === 'waiting').length;
  return {
    ready: missing === 0 && waiting === 0,
    summary: { ok: items.filter((i) => i.state === 'ok').length, missing, waiting, optional: items.filter((i) => i.state === 'optional').length },
    merchants: { total: merchants, paying: live },
    items,
  };
}
