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
        title: 'How the app model works (why this is one click)',
        body: 'RescueShip runs ONE approved Shopify app for all merchants. You do not create a Partner account, copy keys, or install anything in advance — you just authorize your store with us. Every store gets its own encrypted token and its own data. Merchants are fully isolated from each other.',
      },
      {
        title: 'Type your store, click "Connect Shopify"',
        body: 'We redirect you to Shopify\'s own consent screen (your-store.myshopify.com). Log in as the store owner/admin and approve.',
      },
      {
        title: 'Approve read-only permissions',
        body: 'We request read access to Orders + Fulfillments so we can see new COD orders and delivery failures. We never modify products or customers.',
      },
      {
        title: 'Automatic webhook registration',
        body: 'After approval we register order + fulfillment webhooks for YOUR store only, tagged with your merchant ID. No manual setup.',
        commonErrors: [
          '"Application cannot be found" → a RescueShip-side config issue; use "Set it up for me" and we\'ll enable it',
          'Logged into the wrong Shopify account → log out of Shopify admin first, then retry',
          'WooCommerce / custom store → skip this station; finish from Settings → Platform in your dashboard',
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
