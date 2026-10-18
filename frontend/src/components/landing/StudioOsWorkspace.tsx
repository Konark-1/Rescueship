import { motion, AnimatePresence } from 'motion/react';
import { RoiCalculator } from './RoiCalculator';
import { PlanPicker } from './PlanPicker';
import { IntelligenceCard } from './IntelligenceCard';
import { FaqSection } from './FaqSection';
import { estimate, recommendedPlan, planByKey, priceFor, bandFor, type PlanKey } from '../../config/pricing.config';
import { FileCode, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';

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
    <div className="nt-os-workspace" id="os-workspace">
      {/* Target anchor divs to ensure smooth scrolling and test discovery */}
      <div id="calculator" className="nt-anchor-target" />
      <div id="pricing" className="nt-anchor-target" />
      <div id="faq" className="nt-anchor-target" />

      {/* ── Studio OS Window Chrome Header ── */}
      <div className="nt-os-window__head">
        <div className="nt-os-window__dots" aria-hidden="true">
          <span className="nt-os-window__dot nt-os-window__dot--r" />
          <span className="nt-os-window__dot nt-os-window__dot--y" />
          <span className="nt-os-window__dot nt-os-window__dot--g" />
        </div>

        {/* ── 3 Interactive File Tabs ── */}
        <div className="nt-os-window__tabs" role="tablist" aria-label="Studio OS Workspace Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pricing'}
            data-testid="os-tab-pricing"
            className={`nt-os-tab ${activeTab === 'pricing' ? 'is-active' : ''}`}
            onClick={() => onTabChange('pricing')}
          >
            <FileCode size={13} className="nt-os-tab__icon" aria-hidden="true" />
            <span className="nt-os-tab__name">Pricing.html</span>
            {activeTab === 'pricing' && (
              <motion.div
                layoutId="os-active-tab"
                className="nt-os-tab__indicator"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'watchtower'}
            data-testid="os-tab-watchtower"
            className={`nt-os-tab ${activeTab === 'watchtower' ? 'is-active' : ''}`}
            onClick={() => onTabChange('watchtower')}
          >
            <FileSpreadsheet size={13} className="nt-os-tab__icon" aria-hidden="true" />
            <span className="nt-os-tab__name">Pincode_Watchtower.csv</span>
            {activeTab === 'watchtower' && (
              <motion.div
                layoutId="os-active-tab"
                className="nt-os-tab__indicator"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'faq'}
            data-testid="os-tab-faq"
            className={`nt-os-tab ${activeTab === 'faq' ? 'is-active' : ''}`}
            onClick={() => onTabChange('faq')}
          >
            <FileText size={13} className="nt-os-tab__icon" aria-hidden="true" />
            <span className="nt-os-tab__name">FAQ.md</span>
            {activeTab === 'faq' && (
              <motion.div
                layoutId="os-active-tab"
                className="nt-os-tab__indicator"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>
        </div>

        <div className="nt-os-window__status">
          <span className="nt-os-window__pulse" />
          <span className="nt-os-window__badge">STUDIO OS // v3.0</span>
        </div>
      </div>

      {/* ── Studio OS Window Body with AnimatePresence ── */}
      <div className="nt-os-window__body">
        <AnimatePresence mode="wait">
          {activeTab === 'pricing' && (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="nt-os-pane nt-os-pane--pricing"
            >
              <div className="pricing" aria-labelledby="pricing-heading">
                <div className="pricing__container">
                  <div className="nt-pricing-split">
                    {/* Left Column: Sliders, ROI Math, Break-Even & Guarantee */}
                    <div className="nt-pricing-split__left">
                      <RoiCalculator
                        orders={orders}
                        onOrdersChange={onOrdersChange}
                        selectedPlan={selectedPlan}
                      />

                      {/* Break-even line */}
                      <div className="pricing__breakeven" aria-live="polite">
                        <span className="pricing__breakeven-text">
                          {band ? (
                            <>
                              <strong>{plan.name}</strong> pays for itself at ~<strong>{breakEvenRescues}</strong> saved parcels a month. At your volume we expect ~<strong>{rescued}</strong> fewer RTOs — about <strong>{coverage.toFixed(1)}×</strong> its price.
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
                          <strong>90-day money-back guarantee:</strong> If verified RTO freight savings recorded in your dashboard don't exceed the fees you paid by the end of your license, we refund the difference in full.
                        </div>
                      </div>
                    </div>

                    {/* Right Column: 3 Perforated Waybill Pricing Cards */}
                    <div className="nt-pricing-split__right">
                      <div className="pricing__header">
                        <span className="pricing__eyebrow">TARIFF SCHEDULE</span>
                        <h2 id="pricing-heading" className="pricing__heading">
                          Pick your protection. Pay for your size.
                        </h2>
                        <p className="pricing__sub">
                          Same features for every brand size — smaller brands simply pay less. Drag your monthly orders on the left to see your price.
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
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'watchtower' && (
            <motion.div
              key="watchtower"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="nt-os-pane nt-os-pane--watchtower"
            >
              <IntelligenceCard />
            </motion.div>
          )}

          {activeTab === 'faq' && (
            <motion.div
              key="faq"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="nt-os-pane nt-os-pane--faq"
            >
              <FaqSection />

              <div className="nt-security-stubs">
                <div className="nt-security-stubs__header">
                  <span className="nt-security-stubs__tag">SECURITY SPECIFICATION // 01–06 AUDITED ENCLAVES</span>
                </div>
                <div className="nt-security-stubs__grid">
                  <div className="nt-sec-stub">
                    <span className="nt-sec-stub__code">SEC.01</span>
                    <span className="nt-sec-stub__title">Meta-approved Utility templates</span>
                  </div>
                  <div className="nt-sec-stub">
                    <span className="nt-sec-stub__code">SEC.02</span>
                    <span className="nt-sec-stub__title">AES-256-GCM encryption at rest</span>
                  </div>
                  <div className="nt-sec-stub">
                    <span className="nt-sec-stub__code">SEC.03</span>
                    <span className="nt-sec-stub__title">HMAC-SHA256 authenticated webhooks</span>
                  </div>
                  <div className="nt-sec-stub">
                    <span className="nt-sec-stub__code">SEC.04</span>
                    <span className="nt-sec-stub__title">Zero buyer PII retention policy</span>
                  </div>
                  <div className="nt-sec-stub">
                    <span className="nt-sec-stub__code">SEC.05</span>
                    <span className="nt-sec-stub__title">Shopify & WooCommerce native sync</span>
                  </div>
                  <div className="nt-sec-stub">
                    <span className="nt-sec-stub__code">SEC.06</span>
                    <span className="nt-sec-stub__title">DPDP Act 2023 compliant data vault</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default StudioOsWorkspace;
