import { PlanPicker } from './PlanPicker';
import { estimate, recommendedPlan, planByKey, priceFor, bandFor, type PlanKey } from '../../config/pricing.config';

export interface PricingSectionProps {
  orders: number;
  onOrdersChange: (n: number) => void;
  selectedPlan?: PlanKey;
  onSelectPlan?: (plan: PlanKey) => void;
}

export function PricingSection({ orders, onOrdersChange, selectedPlan, onSelectPlan }: PricingSectionProps) {
  const plan = planByKey(selectedPlan || recommendedPlan(orders));
  const band = bandFor(orders);
  const e = estimate(orders, {}, plan.key);
  const monthly = band ? priceFor(plan.key, band, 'quarterly').monthly : 0;
  const rescued = e.rtosAvoided;
  const breakEvenRescues = monthly ? Math.ceil(monthly / e.costPerRto) : 0;
  const coverage = monthly > 0 ? e.saved / monthly : 0;

  return (
    <div className="pricing" aria-labelledby="pricing-heading">
      <div className="pricing__container">
        <div className="pricing__header">
          <span className="pricing__eyebrow">PRICING</span>
          <h2 id="pricing-heading" className="pricing__heading">
            Pick your protection. Pay for your size.
          </h2>
          <p className="pricing__sub">
            Same features for every brand size — smaller brands simply pay less. Drag your monthly orders to see your price.
          </p>
        </div>

        {/* Reused PlanPicker component controlled by shared monthlyOrders state */}
        <div className="pricing__picker-wrap">
          <PlanPicker
            value={orders}
            onChange={onOrdersChange}
            selectedTierKey={selectedPlan}
            onSelectTier={(key) => onSelectPlan?.(key as PlanKey)}
          />
        </div>

        {/* 1. Break-even line */}
        <div className="pricing__breakeven" aria-live="polite">
          <span className="pricing__breakeven-text">
            {band ? (<><strong>{plan.name}</strong> pays for itself at ~<strong>{breakEvenRescues}</strong> saved parcels a month. At your volume we expect ~<strong>{rescued}</strong> fewer RTOs — about <strong>{coverage.toFixed(1)}×</strong> its price.</>) : (<>Above 10,000 orders a month we build a custom plan.</>)}
          </span>
        </div>

        {/* Enterprise NDR Command Center feature callout */}
        <div
          style={{
            margin: '1rem 0',
            padding: '12px 18px',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f3f4f6' }}>
                Prevent plan: stop risky orders before they ship
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Pre-dispatch COD confirmation, pincode risk rules and courier fake-attempt watch.
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.15)',
              padding: '3px 10px',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            Included in Prevent
          </span>
        </div>

        {/* 2. Guarantee banner */}
        <div className="pricing__guarantee" role="region" aria-label="Money back guarantee">
          <span className="pricing__guarantee-icon" aria-hidden="true">🛡️</span>
          <span className="pricing__guarantee-text">
            <strong>90-day money-back guarantee</strong> — if the savings recorded in your dashboard don&apos;t exceed the fees you paid, we refund those fees in full.
          </span>
        </div>

        {/* 3. Footnote */}
        <div className="pricing__note">
          <span className="pricing__note-icon" aria-hidden="true">💡</span>
          <span className="pricing__note-text">
            Every customer discount is funded by COD cash-handling fee savings (₹80–140 per parcel). Never your margin.
          </span>
        </div>

        {/* 4. Enterprise row */}
        <div className="pricing__enterprise">
          <span className="pricing__enterprise-text">
            Shipping more than 10,000 orders/mo? We'll set up a custom plan —{' '}
            <a href="mailto:konarkofficial@gmail.com" className="pricing__enterprise-link">
              talk to us.
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
