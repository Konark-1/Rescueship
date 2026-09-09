import React, { useState } from 'react';
import './setup-guide.css';

interface GuideStep {
  title: string;
  body: string;
  commonErrors?: string[];
}

interface StationGuide {
  station: 'store' | 'whatsapp' | 'courier' | 'payments';
  icon: string;
  steps: GuideStep[];
}

const GUIDES: StationGuide[] = [
  {
    station: 'store',
    icon: '🛒',
    steps: [
      {
        title: 'Know your two options',
        body: 'One-click connect: type your store address and approve on Shopify\'s consent screen — done in 20 seconds, but only works if the RescueShip Partner app is live. API token: you create a small app inside your own Shopify admin and paste one token here. It always works, even on a fresh account. Takes about 2 minutes. Steps below are for API token.',
      },
      {
        title: 'Open Apps (not Sales channels)',
        body: 'In your Shopify admin, look at the left sidebar. Click "Apps". Ignore "Sales channels" — that is a separate option for marketplaces like Instagram and Google, and you do not need it. New Shopify accounts show these as two different items, so don\'t look for an "Apps and sales channels" page.',
      },
      {
        title: 'Create your app',
        body: 'On the Apps page, click the "Develop apps" button at the top right. Then click "Create an app", type the name "RescueShip", and press Create app.',
      },
      {
        title: 'Give it 4 permissions',
        body: 'Open the "Configuration" tab → under Admin API integration click "Configure". Tick exactly these 4 boxes: read_orders, write_orders, read_fulfillments, write_fulfillments. Click Save. (If you see "Enable development store access" or it asks where the app runs, accept the defaults.)',
      },
      {
        title: 'Install and copy the token',
        body: 'Open the "API credentials" tab → click "Install app" → confirm. Then under "Admin API access token" click reveal — copy the token (starts with shpat_…). Shopify shows it only once. Paste it on this page together with your store address (your-brand.myshopify.com). We test it against your store, register your webhooks automatically, and store it encrypted.',
        commonErrors: [
          'Token rejected (401) → you copied the "Client secret" instead — use the "Admin API access token" field from the API credentials tab',
          'Store not found → the address must look exactly like your-brand.myshopify.com (the one in your admin URL)',
          'Token only shown once → if you lost it, uninstall the app from the Apps page (red "Uninstall" button) and make a new one',
          '"Application cannot be found" on the one-click path → the Partner app isn\'t live here; use API token instead',
          'WooCommerce / custom store → skip this station; Settings → Platform in the dashboard handles those',
        ],
      },
    ],
  },
  {
    station: 'whatsapp',
    icon: '💬',
    steps: [
      {
        title: 'Click "Connect WhatsApp"',
        body: 'A Meta Embedded Signup popup will open. Log in with the Facebook account that manages your Business Portfolio.',
      },
      {
        title: 'Select or create a WABA',
        body: 'Choose an existing WhatsApp Business Account or create a new one. If creating new, you\'ll need a business phone number that isn\'t already on WhatsApp.',
      },
      {
        title: 'Wait for template approval',
        body: 'We auto-register 6 message templates (NDR rescue, COD confirm, etc.). Approval usually takes 1-30 minutes. You\'ll see status in the Sandbox page.',
        commonErrors: [
          'Popup blocked → allow popups for rescueship.io',
          '"Business verification required" → complete verification in Meta Business Manager first',
          'Phone number already on WhatsApp → use a different number or delete the existing WhatsApp account',
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
      },
      {
        title: 'Paste your API key',
        body: 'Shiprocket: Settings → API → Generate token. Delhivery: Account → API Key. ClickPost: Settings → Developer → API Key.',
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
      },
      {
        title: 'Enter API credentials',
        body: 'Razorpay: Dashboard → Settings → API Keys → Generate. You need Key ID and Key Secret.',
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
}

export const SetupGuide: React.FC<SetupGuideProps> = ({ station }) => {
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
            {guide.steps.map((step, i) => (
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
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default SetupGuide;
