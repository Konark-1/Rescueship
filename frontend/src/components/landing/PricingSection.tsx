import { PlanPicker } from './PlanPicker';
import { AVG_RESCUE_VALUE, tierForOrders } from '../../config/pricing.config';

export interface PricingSectionProps {
  orders: number;
  onOrdersChange: (n: number) => void;
}

export function PricingSection({ orders, onOrdersChange }: PricingSectionProps) {
  const plan = tierForOrders(orders);

  // Standard calibrated math for break-even (60% COD share, 25% RTO rate, 60% rescue rate)
  const failures = Math.round(orders * 0.6 * 0.25);
  const rescued = Math.round(failures * 0.6);
  const savings = rescued * AVG_RESCUE_VALUE;
  const breakEvenRescues = Math.ceil(plan.priceMonthly / AVG_RESCUE_VALUE);
  const coverage = plan.priceMonthly > 0 ? savings / plan.priceMonthly : 0;

  return (
    <div className="pricing" aria-labelledby="pricing-heading">
      <div className="pricing__container">
        <div className="pricing__header">
          <span className="pricing__eyebrow">PRICING</span>
          <h2 id="pricing-heading" className="pricing__heading">
            Simple pricing that pays for itself.
          </h2>
          <p className="pricing__sub">
            Drag your order volume — your plan and your break-even update live.
          </p>
        </div>

        {/* Reused PlanPicker component controlled by shared monthlyOrders state */}
        <div className="pricing__picker-wrap">
          <PlanPicker value={orders} onChange={onOrdersChange} />
        </div>

        {/* 1. Break-even line */}
        <div className="pricing__breakeven" aria-live="polite">
          <span className="pricing__breakeven-text">
            <strong>{plan.name}</strong> pays for itself at ~<strong>{breakEvenRescues}</strong> rescues a month. At your volume you generate ~<strong>{rescued}</strong> — a <strong>{coverage.toFixed(1)}×</strong> return.
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
                Enterprise NDR Command Center Included
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Carrier Fraud Watchtower rider audits + Storefront Geo-Risk Sync to Shopify &amp; WooCommerce.
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
            Included in Scale &amp; Fleet
          </span>
        </div>

        {/* 2. Guarantee banner */}
        <div className="pricing__guarantee" role="region" aria-label="Money back guarantee">
          <span className="pricing__guarantee-icon" aria-hidden="true">🛡️</span>
          <span className="pricing__guarantee-text">
            <strong>90-day guarantee</strong> — if your ROI ledger doesn&apos;t cover the license fee, we refund the difference.
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
            Shipping 25,000+ orders/mo? Custom SLAs and a dedicated WhatsApp number —{' '}
            <a href="mailto:founders@rescueship.com" className="pricing__enterprise-link">
              talk to us.
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
