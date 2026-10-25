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
    title: 'Sub-90s NDR Webhook Intercept',
    description:
      'Ingests Shiprocket, Delhivery, Blue Dart, and ClickPost NDR webhooks in real time—firing a WhatsApp verification before the hub locks the parcel for RTO.',
    pillText: '< 90s SLA · REALTIME WEBHOOK',
    pillTone: 'vermilion',
    Icon: Zap,
  },
  {
    num: '02',
    title: 'Sub-90s Buyer Denial Audit Engine',
    description:
      'Triggers an instant WhatsApp verification within 90s of an "Unreachable" or "Door Locked" scan. When the customer confirms "Nobody came", RescueShip auto-flags the attempt as fake.',
    pillText: 'SUB-90s BUYER VERIFICATION',
    pillTone: 'emerald',
    Icon: Radar,
  },
  {
    num: '03',
    title: 'Free Priority Re-Attempt Lock',
    description:
      'When a rider fakes an attempt, RescueShip never wastes margin on discounts—it captures buyer confirmation and locks a free priority next-day re-delivery.',
    pillText: 'ZERO MARGIN DILUTION',
    pillTone: 'emerald',
    Icon: MessageSquareCheck,
  },
  {
    num: '04',
    title: '1-Shot Payment-Gated Cancellation Save',
    description:
      'Only when a buyer explicitly taps Cancel Order, sends one polite ₹100 instant UPI discount offer with a strict 2-hour payment hold so WABA quality stays pristine.',
    pillText: '2-HR UPI PAYMENT GATE',
    pillTone: 'vermilion',
    Icon: IndianRupee,
  },
  {
    num: '05',
    title: 'WhatsApp GPS Pin → Rider SMS Dispatch',
    description:
      'Captures native WhatsApp lat/lng pins, injects the reverse-geocoded gate landmark into the courier NDR API, and texts a Google Maps link to the field agent.',
    pillText: 'NATIVE LOCATION PIN + SMS',
    pillTone: 'emerald',
    Icon: MapPinCheckInside,
  },
  {
    num: '06',
    title: 'Pre-Delivery COD Risk & Pincode Shield',
    description:
      'Evaluates high-risk COD orders against historical failure clusters and pincode rules prior to dispatch—prompting instant UPI conversion or address verification before freight is burned.',
    pillText: 'METRO RISK RULES + ADVANCE COD',
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
        {/* Mondragon Architectural Header */}
        <header className="rs-mondragon-header">
          <div className="rs-mondragon-header__left">
            <span className="rs-mondragon-kicker">[ CHAPTER 04 · ARCHITECTURAL ENGINES ]</span>
            <h2 id="features-heading" className="rs-mondragon-title">
              Six autonomous engines. <em>Zero manual NDR calling.</em>
            </h2>
          </div>
          <p className="rs-mondragon-sub">
            Built for Indian D2C operations teams handling 500 to 50,000+ monthly COD shipments
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
