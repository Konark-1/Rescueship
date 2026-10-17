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
        <div className="pricing__window-bar">
          <span className="pricing__window-dots" aria-hidden="true">
            <span className="pricing__window-dot pricing__window-dot--r" />
            <span className="pricing__window-dot pricing__window-dot--y" />
            <span className="pricing__window-dot pricing__window-dot--g" />
          </span>
          <span className="pricing__window-title">Pricing.html — TARIFF SCHEDULE</span>
          <span className="pricing__window-tag">90-DAY GUARANTEE</span>
        </div>

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
            {band ? (
              <>
                <strong>{plan.name}</strong> pays for itself at ~<strong>{breakEvenRescues}</strong> saved parcels a month. At your volume we expect ~<strong>{rescued}</strong> fewer RTOs — about <strong>{coverage.toFixed(1)}×</strong> its price.
              </>
            ) : (
              <>Above 10,000 orders a month we build a custom plan.</>
            )}
          </span>
        </div>

        {/* Enterprise NDR Command Center feature callout with CSS class */}
        <div className="pricing__prevent-callout">
          <div className="pricing__prevent-left">
            <span className="pricing__prevent-icon" aria-hidden="true">🛡️</span>
            <div>
              <div className="pricing__prevent-title">
                Prevent plan: stop risky orders before they ship
              </div>
              <div className="pricing__prevent-sub">
                Pre-dispatch COD confirmation, pincode risk rules and courier fake-attempt watch.
              </div>
            </div>
          </div>
          <span className="pricing__prevent-badge">
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
          <p>
            * All plans include unlimited carrier connections, webhooks, and team seats. Pricing excludes WhatsApp Cloud API conversation fees billed directly by Meta (~₹0.40–₹0.80 per initiated conversation). Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
