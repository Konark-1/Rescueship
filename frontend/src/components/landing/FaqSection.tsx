import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    q: 'Will this spam my customers?',
    a: 'No. Max 3 messages per failed-delivery episode, a 60-second cooldown between messages, and only Meta-approved Utility templates — no marketing blasts, no quiet-hour violations. If a customer ever asks to stop, that number is permanently suppressed.',
  },
  {
    id: 'faq-2',
    q: 'How long does setup take?',
    a: 'About 3 minutes. Connect your Shopify or WooCommerce store and your courier account — Shiprocket, Delhivery, or ClickPost. You start in Sandbox mode, where test rescues go to your own phone, and go live only when you\'re ready.',
  },
  {
    id: 'faq-3',
    q: "What if the customer doesn't respond?",
    a: "Reminders go out at 4, 12, and 24 hours. If there's still silence before the return window closes, the order follows your courier's normal return process — and the full cost of that silence appears in your ROI ledger.",
  },
  {
    id: 'faq-4',
    q: 'What if a re-attempt fails again?',
    a: "Reschedule dates are written straight into your courier's system via API. If the re-attempt still fails, the case re-opens automatically and moves to the next rescue path — address fix, UPI conversion, or RTO arrest. Nothing is left hanging.",
  },
  {
    id: 'faq-5',
    q: 'What data do you store?',
    a: 'Only what a rescue needs: order ID, phone number, pincode, delivery outcome, and the WhatsApp conversation for that order. Courier and payment credentials are encrypted with AES-256-GCM; audit logs and delivery attempts auto-delete after 90 days. Full details in our Privacy Policy and Data Processor Addendum.',
  },
  {
    id: 'faq-6',
    q: "What if it doesn't pay for itself?",
    a: "Every rescue is logged with its rupee value in your ROI ledger. If, by the end of your 90-day license, the ledger doesn't show savings above what you paid — we refund the difference. No arguments, no fine print.",
  },
];

export function FaqSection() {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    'faq-1': true, // first question expanded by default
  });

  const toggle = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="faq" aria-labelledby="faq-heading">
      <div className="faq__container">
        <div className="faq__header">
          <span className="faq__eyebrow">FAQ</span>
          <h2 id="faq-heading" className="faq__heading">
            Frequently answered questions.
          </h2>
          <p className="faq__sub">
            Everything you need to know about autonomous WhatsApp NDR rescue, Meta compliance, and our guarantee.
          </p>
        </div>

        <div className="faq__list" role="region" aria-label="Frequently Asked Questions">
          {FAQS.map((item) => {
            const isOpen = !!openIds[item.id];
            const contentId = `${item.id}-answer`;

            return (
              <div key={item.id} className={`faq__item ${isOpen ? 'is-open' : ''}`}>
                <h3>
                  <button
                    type="button"
                    className="faq__q"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    id={item.id}
                    onClick={() => toggle(item.id)}
                  >
                    <span className="faq__q-text">{item.q}</span>
                    <ChevronDown
                      size={18}
                      className={`faq__chevron ${isOpen ? 'is-rotated' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={item.id}
                  className="faq__a"
                  hidden={!isOpen}
                >
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
