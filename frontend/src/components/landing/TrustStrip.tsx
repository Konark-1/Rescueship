import { BadgeCheck, Lock, ShieldCheck, FileCheck, IndianRupee, Activity } from 'lucide-react';

const TRUST_BADGES = [
  { icon: BadgeCheck, text: 'Meta-approved Utility templates' },
  { icon: Lock, text: 'AES-256-GCM encryption' },
  { icon: ShieldCheck, text: 'HMAC-verified webhooks' },
  { icon: FileCheck, text: 'Privacy-first data handling' },
  { icon: IndianRupee, text: 'Razorpay & Cashfree native' },
  { icon: Activity, text: '24/7 uptime monitoring' },
];

export function TrustStrip() {
  return (
    <section className="trust" aria-label="Trust and compliance badges">
      <div className="trust__container">
        <div className="trust__strip">
          {TRUST_BADGES.map((badge) => {
            const Icon = badge.icon;
            return (
              <div key={badge.text} className="trust__item">
                <Icon size={16} className="trust__icon" aria-hidden="true" />
                <span className="trust__text">{badge.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
