import { useState, useId } from 'react';
import { motion } from 'motion/react';
import { estimate, recommendedPlan, planByKey, type PlanKey } from '../../config/pricing.config';
import { Calculator, ShieldCheck, Flame, TrendingUp } from 'lucide-react';
import { springSnappy } from '../../lib/motion';

export interface RoiCalculatorProps {
  orders: number;
  onOrdersChange: (n: number) => void;
  selectedPlan?: PlanKey;
}

export function RoiCalculator({ orders, onOrdersChange, selectedPlan }: RoiCalculatorProps) {
  const [codShare, setCodShare] = useState(60);
  const [rtoRate, setRtoRate] = useState(25);

  const ordersSliderId = useId();
  const codSliderId = useId();
  const rtoSliderId = useId();

  const metrics = { codPct: codShare / 100, codRtoRate: rtoRate / 100 };
  const plan = planByKey(selectedPlan || recommendedPlan(orders, metrics));
  const e = estimate(orders, metrics, plan.key);
  const failures = e.rtos;
  const rescued = e.rtosAvoided;
  const savings = e.saved;

  return (
    <section className="roi rs-storm-calc-section" aria-labelledby="roi-heading">
      <div className="roi__container">
        <div className="roi__header">
          <span className="roi__eyebrow">
            <Calculator size={14} aria-hidden="true" />
            INDIAN D2C BLEED SIMULATOR · ₹430 / RTO
          </span>
          <h2 id="roi-heading" className="roi__heading">
            Quantify your monthly COD bleed.
          </h2>
          <p className="roi__sub">
            Drag the sliders to match your monthly store metrics and see immediate recovery projections.
          </p>
        </div>

        <div className="roi__deck-bar">
          <span className="roi__deck-tag">SIMULATOR // RS-ROI-V2</span>
          <span className="roi__deck-status">● LIVE RECOVERY ENGINE</span>
        </div>

        <div className="roi__grid">
          {/* Sliders Column */}
          <div className="roi__sliders">
            {/* Slider 1: Monthly Orders */}
            <div className="roi__field rs-slider-group">
              <div className="roi__field-head rs-slider-label-row">
                <label htmlFor={ordersSliderId} className="roi__label">
                  Monthly orders
                </label>
                <span className="roi__val-badge rs-nowrap-num" aria-live="polite">
                  {orders.toLocaleString('en-IN')} orders/mo
                </span>
              </div>
              <input
                id={ordersSliderId}
                type="range"
                className="roi__range rs-vermilion-slider"
                aria-label="Monthly orders"
                min={100}
                max={25000}
                step={100}
                value={orders}
                onChange={(e) => onOrdersChange(Number(e.target.value))}
              />
            </div>

            {/* Slider 2: COD Share */}
            <div className="roi__field rs-slider-group">
              <div className="roi__field-head rs-slider-label-row">
                <label htmlFor={codSliderId} className="roi__label">
                  COD share
                </label>
                <span className="roi__val-badge rs-nowrap-num" aria-live="polite">
                  {codShare}%
                </span>
              </div>
              <input
                id={codSliderId}
                type="range"
                className="roi__range rs-vermilion-slider"
                aria-label="COD share"
                min={10}
                max={100}
                step={5}
                value={codShare}
                onChange={(e) => setCodShare(Number(e.target.value))}
              />
            </div>

            {/* Slider 3: Current RTO Rate */}
            <div className="roi__field rs-slider-group">
              <div className="roi__field-head rs-slider-label-row">
                <label htmlFor={rtoSliderId} className="roi__label">
                  Current RTO rate
                </label>
                <span className="roi__val-badge rs-nowrap-num" aria-live="polite">
                  {rtoRate}%
                </span>
              </div>
              <input
                id={rtoSliderId}
                type="range"
                className="roi__range rs-vermilion-slider"
                aria-label="Current RTO rate"
                min={5}
                max={50}
                step={1}
                value={rtoRate}
                onChange={(e) => setRtoRate(Number(e.target.value))}
              />
            </div>

            {/* Mandatory Two-Part ₹430/RTO Breakdown Box */}
            <div className="rs-bleed-formula">
              <div className="rs-bleed-formula__row">
                <span>Direct Courier &amp; Packaging Burn (₹80 Fwd + ₹80 Rev + ₹40 QC)</span>
                <strong className="rs-nowrap-num">₹200 / RTO</strong>
              </div>
              <div className="rs-bleed-formula__row">
                <span>Plus Wasted Performance Ad Spend (Sunk Meta/Google CAC)</span>
                <strong className="rs-nowrap-num">+ ₹230 / RTO</strong>
              </div>
              <div className="rs-bleed-formula__total">
                <span>Verified Total Bleed per Returned COD Parcel</span>
                <strong className="rs-nowrap-num">₹430 / RTO</strong>
              </div>
            </div>
          </div>

          {/* Results Output Panel (Clean Storm Lab Readout - Zero Tear Stub, Zero Purple) */}
          <div className="roi__out" aria-live="polite" role="region" aria-label="Projected recovery math">
            <div className="roi__out-ticket-top">
              <span className="roi__out-serial">RS/SIM.01-OUT // WAYBILL LEDGER</span>
              <span className="roi__out-status-tag">
                <ShieldCheck size={13} aria-hidden="true" />
                VERIFIED RECOVERY MODEL
              </span>
            </div>

            <div className="roi__out-stats">
              <div className="roi__out-row">
                <div className="roi__out-metric-wrap">
                  <Flame size={14} className="rs-burn-icon" aria-hidden="true" />
                  <span className="roi__out-metric rs-nowrap-num">~{failures}</span>
                </div>
                <span className="roi__out-label">
                  COD parcels coming back / month (≈ <strong className="rs-nowrap-num">₹{e.burn.toLocaleString('en-IN')}</strong> burnt)
                </span>
              </div>

              <div className="roi__out-row">
                <div className="roi__out-metric-wrap">
                  <TrendingUp size={14} className="rs-rec-icon" aria-hidden="true" />
                  <span className="roi__out-metric rs-nowrap-num">~{rescued}</span>
                </div>
                <span className="roi__out-label">
                  fewer RTOs with <strong className="roi__out-plan-inline">{plan.name}</strong> (≈{Math.round(plan.reduction * 100)}%, conservative)
                </span>
              </div>
            </div>

            <div className="roi__out-savings">
              <span className="roi__out-curr">₹</span>
              <motion.span
                key={savings}
                className="roi__out-amount rs-nowrap-num"
                initial={{ scale: 0.96, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springSnappy}
              >
                {savings.toLocaleString('en-IN')}
              </motion.span>
              <span className="roi__out-subtext">saved / month (freight + packaging + ad spend)</span>
            </div>

            <div className="roi__out-plan">
              <span className="roi__out-plan-label">Recommended plan:</span>{' '}
              <strong className="roi__out-plan-name">{plan.name}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default RoiCalculator;
