import { Zap, MapPin, CreditCard, ShieldCheck, SearchCheck, LineChart } from 'lucide-react';
import { SpotlightCard } from '../SpotlightCard';

const FEATURES = [
  {
    icon: Zap,
    title: 'Autonomous NDR Rescue',
    desc: 'Every failed attempt gets a WhatsApp response inside 90 seconds.',
    color: 'rgba(99, 102, 241, 0.15)',
  },
  {
    icon: MapPin,
    title: '2-Step AI Address Fix',
    desc: 'GPS pin + Hinglish landmark merged and pushed to the driver app.',
    color: 'rgba(56, 189, 248, 0.15)',
  },
  {
    icon: CreditCard,
    title: 'COD → UPI Conversion',
    desc: 'Doorstep & cancel-time UPI links with self-funding discounts.',
    color: 'rgba(16, 185, 129, 0.15)',
  },
  {
    icon: ShieldCheck,
    title: 'Payment-Gated RTO Arrest',
    desc: 'Return transit halts only when money is actually captured.',
    color: 'rgba(244, 63, 94, 0.15)',
  },
  {
    icon: SearchCheck,
    title: 'Fake Remark Detection',
    desc: 'Odd-hour scans and 4-minute attempts auto-escalate to carrier supervisors.',
    color: 'rgba(251, 191, 36, 0.15)',
  },
  {
    icon: LineChart,
    title: 'Pincode Intelligence',
    desc: 'Every pincode scored by real outcomes: courier vs customer vs address.',
    color: 'rgba(168, 85, 247, 0.15)',
  },
];

export function FeaturesGrid() {
  return (
    <div className="fgrid" aria-labelledby="features-heading">
      <div className="fgrid__container">
        <div className="fgrid__header">
          <span className="fgrid__eyebrow">FEATURES</span>
          <h2 id="features-heading" className="fgrid__heading">
            Built for conversion. Engineered for zero friction.
          </h2>
          <p className="fgrid__sub">
            Six automated systems working continuously so you never lose revenue to couriers or bad addresses.
          </p>
        </div>

        <div className="fgrid__list">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <SpotlightCard
                key={feat.title}
                className="fgrid__card"
                spotlightColor={feat.color}
              >
                <div className="fgrid__icon-wrap">
                  <Icon size={22} className="fgrid__icon" aria-hidden="true" />
                </div>
                <h3 className="fgrid__card-title">{feat.title}</h3>
                <p className="fgrid__card-desc">{feat.desc}</p>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
