import { RoiCalculator } from './RoiCalculator';
import { PlanPicker } from './PlanPicker';
import { IntelligenceCard } from './IntelligenceCard';
import { FaqSection } from './FaqSection';
import { estimate, recommendedPlan, planByKey, priceFor, bandFor, type PlanKey } from '../../config/pricing.config';
import { Calculator, Map, HelpCircle, CheckCircle2 } from 'lucide-react';

export interface StudioOsWorkspaceProps {
  orders: number;
  onOrdersChange: (n: number) => void;
  selectedPlan: PlanKey;
  onSelectPlan: (plan: PlanKey) => void;
  activeTab: 'pricing' | 'watchtower' | 'faq';
  onTabChange: (tab: 'pricing' | 'watchtower' | 'faq') => void;
}

export function StudioOsWorkspace({
  orders,
  onOrdersChange,
  selectedPlan,
  onSelectPlan,
  activeTab,
  onTabChange,
}: StudioOsWorkspaceProps) {
  const plan = planByKey(selectedPlan || recommendedPlan(orders));
  const band = bandFor(orders);
  const e = estimate(orders, {}, plan.key);
  const monthly = band ? priceFor(plan.key, band, 'quarterly').monthly : 0;
  const rescued = e.rtosAvoided;
  const breakEvenRescues = monthly ? Math.ceil(monthly / e.costPerRto) : 0;
  const coverage = monthly > 0 ? e.saved / monthly : 0;

  return (
    <div className="nt-os-workspace rs-storm-workspace-root" id="os-workspace">
      {/* Target anchor divs for smooth scrolling & test discovery */}
      <div id="calculator" className="nt-anchor-target rs-anchor-hook" />
      <div id="pricing" className="nt-anchor-target rs-anchor-hook" />
      <div id="faq" className="nt-anchor-target rs-anchor-hook" />

      {/* ── Studio OS Window Chrome Header ── */}
      <div className="nt-os-window__head rs-storm-topbar">
        <div className="nt-os-window__dots rs-storm-topbar__brand" aria-hidden="true">
          <span className="nt-os-window__dot nt-os-window__dot--r rs-storm-dot" />
          <span className="rs-storm-title">RESCUESHIP // SPEC LAB WORKSPACE</span>
        </div>

        {/* ── Interactive File Tabs (Preserves data-testid for Playwright) ── */}
        <div className="nt-os-window__tabs rs-storm-tabs" role="tablist" aria-label="Studio OS Workspace Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pricing'}
            data-testid="os-tab-pricing"
            id="tab-pricing"
            aria-controls="panel-pricing"
            className={`nt-os-tab rs-storm-tab ${activeTab === 'pricing' ? 'is-active' : ''}`}
            onClick={() => onTabChange('pricing')}
          >
            <Calculator size={13} className="nt-os-tab__icon" aria-hidden="true" />
            <span className="nt-os-tab__name">Calculate_RTO.sh &amp; Pricing.html</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'watchtower'}
            data-testid="os-tab-watchtower"
            id="tab-watchtower"
            aria-controls="panel-watchtower"
            className={`nt-os-tab rs-storm-tab ${activeTab === 'watchtower' ? 'is-active' : ''}`}
            onClick={() => onTabChange('watchtower')}
          >
            <Map size={13} className="nt-os-tab__icon" aria-hidden="true" />
            <span className="nt-os-tab__name">Metro_Audit.json</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'faq'}
            data-testid="os-tab-faq"
            id="tab-faq"
            aria-controls="panel-faq"
            className={`nt-os-tab rs-storm-tab ${activeTab === 'faq' ? 'is-active' : ''}`}
            onClick={() => onTabChange('faq')}
          >
            <HelpCircle size={13} className="nt-os-tab__icon" aria-hidden="true" />
            <span className="nt-os-tab__name">FAQ.md</span>
          </button>
        </div>

        <div className="nt-os-window__status">
          <span className="nt-os-window__pulse" />
          <span className="nt-os-window__badge">STORM LAB // v3.0</span>
        </div>
      </div>

      {/* ── Studio OS Window Body: Panels stay mounted for Playwright E2E ── */}
      <div className="nt-os-window__body rs-storm-body">
        {/* TAB 1: CALCULATE RTO + PRICING SIDE-BY-SIDE SPLIT VIEW */}
        <div
          id="panel-pricing"
          role="tabpanel"
          aria-labelledby="tab-pricing"
          style={{ display: activeTab === 'pricing' ? 'block' : 'none' }}
          className="nt-os-pane nt-os-pane--pricing rs-storm-panel"
        >
          <div className="pricing nt-pricing-viewport" aria-labelledby="pricing-heading">
            <div className="nt-pricing-split">
              {/* Left Column: ROI Calculator */}
              <div className="nt-pricing-split__left">
                <RoiCalculator
                  orders={orders}
                  onOrdersChange={onOrdersChange}
                  selectedPlan={selectedPlan}
                />
              </div>

              {/* Right Column: Pricing & Plan Picker (No duplicate slider) */}
              <div className="nt-pricing-split__right">
                <div className="pricing__header">
                  <span className="pricing__eyebrow rs-storm-kicker">TARIFF SCHEDULE</span>
                  <h2 id="pricing-heading" className="pricing__heading rs-storm-heading">
                    Pick your protection. Pay for your size.
                  </h2>
                  <p className="pricing__sub">
                    Same features for every brand size — smaller brands simply pay less.
                  </p>
                </div>

                <div className="pricing__picker-wrap">
                  <PlanPicker
                    value={orders}
                    onChange={onOrdersChange}
                    selectedTierKey={selectedPlan}
                    onSelectTier={(key) => onSelectPlan?.(key as PlanKey)}
                    hideSlider={true}
                  />
                </div>

                {/* Break-even line */}
                <div className="pricing__breakeven" aria-live="polite">
                  <span className="pricing__breakeven-text">
                    {band ? (
                      <>
                        <strong>{plan.name}</strong> pays for itself at ~<strong>{breakEvenRescues}</strong> saved parcels a month. At your volume we expect ~<strong>{rescued}</strong> fewer RTOs — about <strong className="rs-nowrap-num">{coverage.toFixed(1)}×</strong> its price.
                      </>
                    ) : (
                      <>Custom volume pricing available for high-growth brands.</>
                    )}
                  </span>
                </div>

                {/* 90-Day Money-Back Guarantee Banner */}
                <div className="pricing__guarantee">
                  <div className="pricing__guarantee-icon" aria-hidden="true">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="pricing__guarantee-text">
                    <strong>90-day money-back guarantee:</strong> If verified RTO freight savings recorded in your dashboard don&apos;t exceed the fees you paid by the end of your license, we refund the difference in full.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 2: METRO NDR TELEMETRY */}
        <div
          id="panel-watchtower"
          role="tabpanel"
          aria-labelledby="tab-watchtower"
          style={{ display: activeTab === 'watchtower' ? 'block' : 'none' }}
          className="nt-os-pane nt-os-pane--watchtower rs-storm-panel"
        >
          <IntelligenceCard />
        </div>

        {/* TAB 3: FAQ SECTION */}
        <div
          id="panel-faq"
          role="tabpanel"
          aria-labelledby="tab-faq"
          style={{ display: activeTab === 'faq' ? 'block' : 'none' }}
          className="nt-os-pane nt-os-pane--faq rs-storm-panel"
        >
          <FaqSection />
        </div>
      </div>
    </div>
  );
}

export default StudioOsWorkspace;
