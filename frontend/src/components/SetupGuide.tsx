import React, { useState } from 'react';
import './setup-guide.css';

interface GuideLink {
  label: string;
  url: string;
}

interface GuideStep {
  title: string;
  body: string;
  commonErrors?: string[];
  links?: GuideLink[];
  linksBuilder?: (storeUrl?: string) => GuideLink[];
}

interface StationGuide {
  station: 'store' | 'whatsapp' | 'courier' | 'payments';
  icon: string;
  steps: GuideStep[];
}

function normalizeStoreUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).origin; } catch { return ''; }
}

function shopAdmin(storeUrl: string, path: string): string {
  const base = normalizeStoreUrl(storeUrl);
  return base ? base + path : '#';
}

const GUIDES: StationGuide[] = [
  {
    station: 'store',
    icon: '🛒',
    steps: [
      {
        title: 'Know your setup',
        body: 'You connect Shopify with a key + secret you generate inside your own admin — no RescueShip Partner app is involved. Takes about 2 minutes. Steps below cover creating the app and copying both values.',
        links: [
          { label: 'Read the full Shopify guide', url: 'https://shopify.dev/docs/apps/build' },
        ],
      },
      {
        title: 'Open Apps (not Sales channels)',
        body: 'In your Shopify admin, look at the left sidebar. Click "Apps". Ignore "Sales channels" — that is a separate option for marketplaces like Instagram and Google, and you do not need it. New Shopify accounts show these as two different items, so don\'t look for an "Apps and sales channels" page.',
        linksBuilder: (storeUrl?: string) => [
          { label: '→ Open your Shopify Apps page', url: shopAdmin(storeUrl || '', '/admin/apps') },
        ],
      },
      {
        title: 'Create your app',
        body: 'On the Apps page, click the "Develop apps" button at the top right. Then click "Create an app", type the name "RescueShip", and press Create app.',
        linksBuilder: (storeUrl?: string) => [
          { label: '→ Open Shopify App Development', url: shopAdmin(storeUrl || '', '/admin/apps/development') },
          { label: 'Read: Create an app', url: 'https://shopify.dev/docs/apps/build' },
        ],
      },
      {
        title: 'Give it 4 permissions',
        body: 'Open the "Configuration" tab → under Admin API integration click "Configure". Tick exactly these 4 boxes: read_orders, write_orders, read_fulfillments, write_fulfillments. Click Save. (If you see "Enable development store access" or it asks where the app runs, accept the defaults.)',
        links: [
          { label: 'Read about Admin API scopes', url: 'https://shopify.dev/docs/api/usage/access-scopes' },
          { label: 'List of all Admin API scopes', url: 'https://shopify.dev/docs/api/admin-rest/2024-01/resources/order' },
        ],
      },
      {
        title: 'Install and copy your key + secret',
        body: 'Open the "API credentials" tab → click "Install app" → confirm. Copy the "Admin API access token" (starts with shpat_… — this is your consumer key) and the "API secret key" (starts with shpss_… — this is your consumer secret). Note: Shopify shows the token once. Paste both here together with your store address (your-brand.myshopify.com). Alternatively, use the "One-click connect" option to authorize automatically without copying keys.',
        links: [
          { label: 'Read: Access tokens explained', url: 'https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens' },
        ],
        commonErrors: [
          'Key rejected (401) → you entered the 32-character Client ID instead of the Admin API access token (must start with shpat_…)',
          'Secret rejected → use the "API secret key" (starts with shpss_…) from API credentials (not the Client ID)',
          'Store not found → the address must look exactly like your-brand.myshopify.com (the one in your admin URL)',
          'Token only shown once → if you lost it, uninstall the app and create/reinstall it to reveal a new shpat_ token',
          'WooCommerce / custom store → click the "WooCommerce" tab above and paste your REST API consumer key + secret',
          'WooCommerce REST API not found (404) → enable it in WooCommerce → Settings → Advanced → REST API',
          'WooCommerce 401 → generate a fresh consumer key/secret with Read/Write permission',
        ],
      },
      {
        title: 'WooCommerce instead?',
        body: 'Choose the "WooCommerce" tab on the store station. In WordPress go to WooCommerce → Settings → Advanced → REST API → Add key (Read/Write), copy the consumer key (ck_…) and consumer secret (cs_…), and paste them with your store URL (https://yourstore.com). We validate them live and register the order.created webhook automatically.',
        links: [
          { label: 'WooCommerce REST API docs', url: 'https://woocommerce.github.io/woocommerce-rest-api-docs/' },
          { label: 'WooCommerce REST API authentication', url: 'https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication' },
        ],
      },
    ],
  },
  {
    station: 'whatsapp',
    icon: '💬',
    steps: [
      {
        title: 'Choose manual (your keys)',
        body: 'On the WhatsApp station, pick "Manual (your keys)". You\'ll paste three values from your own Meta Business account — no RescueShip app config is required.',
        links: [
          { label: 'Open Meta Business Suite', url: 'https://business.facebook.com/latest/whatsapp_manager' },
          { label: 'Open Meta Developer Apps', url: 'https://developers.facebook.com/apps' },
        ],
      },
      {
        title: 'Find your Phone number ID + WABA ID',
        body: 'Open Meta Business Suite → WhatsApp Manager → Account tools. Your "Phone number ID" is the number customers will message; the "WABA ID" is your WhatsApp Business Account ID. Copy both numeric IDs.',
        links: [
          { label: '→ WhatsApp Manager phone numbers', url: 'https://business.facebook.com/latest/whatsapp_manager/phone-numbers/' },
          { label: '→ WhatsApp Manager account overview', url: 'https://business.facebook.com/latest/whatsapp_manager/overview/' },
        ],
      },
      {
        title: 'Create a system-user token',
        body: 'In Meta Business Settings → Users → System users, create (or reuse) a system user. Add the WhatsApp app and give it whatsapp_business_messaging + whatsapp_business_management permissions. Generate a permanent access token and copy it. Paste all three values, then "Validate & connect".',
        links: [
          { label: '→ Open Business Settings → System users', url: 'https://business.facebook.com/settings/system-users' },
          { label: 'Read: System user tokens guide', url: 'https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started' },
          { label: 'Read: WhatsApp permissions guide', url: 'https://developers.facebook.com/documentation/development/create-an-app/whatsapp-use-case#permissions-and-features' },
        ],
      },
      {
        title: 'Wait for template approval',
        body: 'We auto-register the rescue + COD templates under your number and poll Meta for approval (usually 1-30 minutes). You\'ll see the status right here.',
        links: [
          { label: '→ View your message templates', url: 'https://business.facebook.com/latest/whatsapp_manager/message-templates/' },
        ],
        commonErrors: [
          '"Could not verify these WhatsApp credentials" → the token lacks whatsapp_business_messaging / whatsapp_business_management permissions, or the IDs don\'t belong to the token',
          'Template rejected → open WhatsApp Manager → Message templates and read Meta\'s reason (usually a wording change)',
          'Phone number already on WhatsApp → that number can\'t be reused for the Business API; use a different number',
        ],
      },
    ],
  },
  {
    station: 'courier',
    icon: '📦',
    steps: [
      {
        title: 'Choose your carrier',
        body: 'Select Shiprocket, Delhivery, or ClickPost. You\'ll need your API credentials from their dashboard.',
        links: [
          { label: 'Shiprocket dashboard', url: 'https://app.shiprocket.in/' },
          { label: 'Delhivery dashboard', url: 'https://www.delhivery.com/' },
          { label: 'ClickPost dashboard', url: 'https://www.clickpost.ai/' },
        ],
      },
      {
        title: 'Paste your API key',
        body: 'Shiprocket: Settings → API → Generate token. Delhivery: Account → API Key. ClickPost: Settings → Developer → API Key.',
        links: [
          { label: 'Shiprocket API docs', url: 'https://apidocs.shiprocket.in/' },
          { label: 'Delhivery One portal', url: 'https://one.delhivery.com/' },
          { label: 'ClickPost API docs', url: 'https://docs.clickpost.ai/' },
        ],
      },
      {
        title: 'We validate live',
        body: 'We make a test API call to verify your credentials work before saving. If it fails, check for trailing spaces or expired tokens.',
        commonErrors: [
          'Shiprocket token expired → regenerate (tokens last 24h by default)',
          'Delhivery 401 → ensure you\'re using the production key, not sandbox',
          'Trailing whitespace → copy carefully, no spaces before/after',
        ],
      },
    ],
  },
  {
    station: 'payments',
    icon: '💳',
    steps: [
      {
        title: 'Choose payment gateway',
        body: 'Select Razorpay or Cashfree. This is for YOUR subscription payment to RescueShip, not customer payments.',
        links: [
          { label: 'Razorpay dashboard', url: 'https://dashboard.razorpay.com/' },
          { label: 'Cashfree merchant dashboard', url: 'https://merchant.cashfree.com/' },
        ],
      },
      {
        title: 'Enter API credentials',
        body: 'Razorpay: Dashboard → Settings → API Keys → Generate. You need Key ID and Key Secret.',
        links: [
          { label: 'Razorpay API key docs', url: 'https://razorpay.com/docs/payments/dashboard/account-settings/api-keys' },
          { label: 'Cashfree API key docs', url: 'https://docs.cashfree.com/docs/api-keys' },
        ],
      },
      {
        title: 'Live validation',
        body: 'We verify your credentials with a test API call. This does NOT charge anything.',
        commonErrors: [
          'Using test-mode keys → switch to Live mode in Razorpay dashboard',
          'Key Secret has special characters → paste exactly as shown',
        ],
      },
    ],
  },
];

interface SetupGuideProps {
  station: 'store' | 'whatsapp' | 'courier' | 'payments';
  storeUrl?: string;
}

export const SetupGuide: React.FC<SetupGuideProps> = ({ station, storeUrl }) => {
  const [open, setOpen] = useState(false);
  const guide = GUIDES.find(g => g.station === station);
  if (!guide) return null;

  return (
    <div className="setup-guide">
      <button className="guide-trigger" onClick={() => setOpen(!open)}>
        <span className="guide-icon">?</span>
        <span>Setup Guide</span>
      </button>

      {open && (
        <div className="guide-panel">
          <div className="guide-header">
            <span>{guide.icon} {station.charAt(0).toUpperCase() + station.slice(1)} Setup</span>
            <button className="guide-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <ol className="guide-steps">
            {guide.steps.map((step, i) => {
              const stepLinks = step.linksBuilder ? step.linksBuilder(storeUrl) : step.links;
              return (
                <li key={i} className="guide-step">
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                  {step.commonErrors && (
                    <details className="guide-errors">
                      <summary>Common errors</summary>
                      <ul>
                        {step.commonErrors.map((err, j) => (
                          <li key={j}>{err}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {stepLinks && stepLinks.length > 0 && (
                    <div className="guide-links">
                      {stepLinks.map((link, k) => (
                        <a key={k} href={link.url} target="_blank" rel="noopener noreferrer" className="guide-link">
                          {link.label}
                          <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l5-5M4 3.5h4.5V8" /></svg>
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};

export default SetupGuide;
