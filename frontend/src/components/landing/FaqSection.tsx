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
    a: 'No. Max 3 messages per failed-delivery episode, Utility templates only, 60-second cooldown, and permanent opt-out is honored.',
  },
  {
    id: 'faq-2',
    q: 'Are the WhatsApp templates approved?',
    a: 'Yes — four Meta-approved UTILITY templates. No marketing quiet-hours, prioritized delivery.',
  },
  {
    id: 'faq-3',
    q: 'What if the courier ignores the reschedule?',
    a: 'Dates are committed through carrier APIs (Shiprocket, Delhivery, ClickPost) and re-escalated at 4h / 12h / 24h until confirmed.',
  },
  {
    id: 'faq-4',
    q: 'What data do you store?',
    a: 'Order ID, phone, pincode, and delivery outcome. Encrypted at rest; audit logs auto-delete after 90 days; DPDP-ready processor terms.',
  },
  {
    id: 'faq-5',
    q: "What if it doesn't pay for itself?",
    a: "30-day guarantee: if rescues don't cover your fee, full refund.",
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
