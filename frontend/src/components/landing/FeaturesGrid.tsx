import React from 'react';
import {
  Zap,
  Radar,
  MessageSquareCheck,
  IndianRupee,
  MapPinCheckInside,
  ShieldAlert,
} from 'lucide-react';

interface FeatureEngine {
  num: string;
  title: string;
  description: string;
  pillText: string;
  pillTone: 'vermilion' | 'emerald' | 'neutral';
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ENGINES: FeatureEngine[] = [
  {
    num: '01',
    title: '“Customer Unavailable” Override',
    description:
      'Sub-90s WhatsApp prompt asks if the buyer is home. When they confirm, RescueShip locks a priority carrier re-attempt before evening hub sortation.',
    pillText: '< 90s SLA · REALTIME WEBHOOK',
    pillTone: 'vermilion',
    Icon: Zap,
  },
  {
    num: '02',
    title: '“Incomplete Address” Landmark Fix',
    description:
      'Acquires native WhatsApp GPS pin from buyer, reverse-geocodes the nearest gate or landmark, and injects coordinates directly into the courier dispatch API.',
    pillText: 'NATIVE GPS PIN + LANDMARK',
    pillTone: 'emerald',
    Icon: MapPinCheckInside,
  },
  {
    num: '03',
    title: '“Cash Not Ready” UPI Conversion',
    description:
      'Sends 1-click UPI conversion link (Razorpay/Cashfree) with 2-hour payment window to convert high-risk COD into prepaid before return transit commits.',
    pillText: 'COD → PREPAID UPI LINK',
    pillTone: 'emerald',
    Icon: IndianRupee,
  },
  {
    num: '04',
    title: 'Sub-90s Webhook Intercept SLA',
    description:
      'Ingests Shiprocket, Delhivery, Blue Dart, and ClickPost NDR webhooks in real time—firing customer verification before the hub bags the parcel for RTO.',
    pillText: 'CARRIER WEBHOOK LISTENERS',
    pillTone: 'vermilion',
    Icon: Radar,
  },
  {
    num: '05',
    title: 'Zero Margin Discount Dilution',
    description:
      'Fake delivery scans are challenged as carrier service failures—forcing free carrier re-attempts rather than subsidizing discounts from your margins.',
    pillText: 'ZERO MARGIN DILUTION',
    pillTone: 'emerald',
    Icon: MessageSquareCheck,
  },
  {
    num: '06',
    title: 'Pre-Dispatch COD Risk Shield',
    description:
      'Evaluates high-risk COD orders against historical failure clusters and pincode rules prior to dispatch to prevent dead freight before cartons leave the warehouse.',
    pillText: 'PINCODE RISK RULES + ADVANCE COD',
    pillTone: 'neutral',
    Icon: ShieldAlert,
  },
];

export const FeaturesGrid: React.FC = () => {
  return (
    <section
      id="features"
      className="nt-snap-section nt-snap-section--features rs-mondragon-section lp-chapter lp-chapter--dark"
      aria-labelledby="features-heading"
    >
      <div className="rs-mondragon-container">
        {/* Operational Section Header */}
        <header className="rs-mondragon-header">
          <div className="rs-mondragon-header__left">
            <h2 id="features-heading" className="rs-mondragon-title">
              Three delivery failures. <em>Three automated rescues.</em>
            </h2>
          </div>
          <p className="rs-mondragon-sub">
            Built for Indian D2C operations teams handling 500 to 10,000+ monthly COD shipments
            across Delhivery, Shiprocket, Blue Dart, and Shadowfax.
          </p>
        </header>

        {/* 3x2 Mondragon Hairline Bento Grid (Exactly 6 Cards for Playwright) */}
        <div className="rs-mondragon-grid">
          {ENGINES.map(({ num, title, description, pillText, pillTone, Icon }) => (
            <article key={num} className="rs-mondragon-card feature-card">
              {/* Top Row: Clean Icon Top-Left + Single Numeral Top-Right */}
              <div className="rs-mondragon-card__top">
                <div className="rs-mondragon-icon" aria-hidden="true">
                  <Icon size={20} />
                </div>
                <span className="rs-mondragon-num">[{num}]</span>
              </div>

              {/* Middle Row: Heading & Copy */}
              <div className="rs-mondragon-card__body">
                <h3 className="rs-mondragon-card__title">{title}</h3>
                <p className="rs-mondragon-card__desc">{description}</p>
              </div>

              {/* Bottom Row: Spaced Status Pill at Bottom-Left */}
              <div className="rs-mondragon-card__footer">
                <span className={`rs-mondragon-pill rs-mondragon-pill--${pillTone}`}>
                  <span className="rs-mondragon-pill__dot" />
                  {pillText}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
