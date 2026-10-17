import { useState, useId } from 'react';
import { motion } from 'motion/react';
import { PLANS, BANDS, bandFor, priceFor, estimate, recommendedPlan, inr, type PlanKey } from '../../config/pricing.config';
import { SlidersHorizontal, Scissors } from 'lucide-react';
import { springSnappy } from '../../lib/motion';

export interface PlanPickerProps {
  value?: number;
  onChange?: (orders: number) => void;
  selectedTierKey?: string;
  onSelectTier?: (planKey: string) => void;
  cycleLabel?: string;
  hideSlider?: boolean;
}

const PLAN_WAYBILL_CODES: Record<string, string> = {
  rescue: 'RS/PKG.01-RES',
  convert: 'RS/PKG.02-CNV',
  prevent: 'RS/PKG.03-PRV',
};

/**
 * Landing plan picker: the plan sets the features, the monthly order volume sets the price.
 */
export function PlanPicker({
  value,
  onChange,
  selectedTierKey,
  onSelectTier,
  cycleLabel,
  hideSlider = false,
}: PlanPickerProps) {
  const [internalVolume, setInternalVolume] = useState(1000);
  const sliderId = useId();

  const volume = value !== undefined ? value : internalVolume;
  const band = bandFor(volume);
  const recommended = recommendedPlan(volume);
  const activePlanId = (selectedTierKey as PlanKey) || recommended;

  const setVolume = (n: number) => (onChange ? onChange(n) : setInternalVolume(n));

  return (
    <div className="plan-picker">
      {!hideSlider && (
        <div className="bl-vol-box plan-picker__slider-box">
          <div className="bl-vol-label plan-picker__slider-header">
            <span className="plan-picker__slider-title">
              <SlidersHorizontal size={15} aria-hidden="true" />
              Monthly Order Volume
            </span>
            <span className="bl-vol-number plan-picker__volume-val" aria-live="polite">
              {volume.toLocaleString('en-IN')} orders
            </span>
          </div>

          <label htmlFor={sliderId} className="sr-only">
            Monthly order volume slider
          </label>
          <input
            type="range"
            id={sliderId}
            aria-label="Monthly order volume"
            className="bl-vol-slider plan-picker__slider"
            min={100}
            max={15000}
            step={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />

          <div className="bl-vol-chips plan-picker__chips" role="group" aria-label="Order volume presets">
            {[...BANDS, 15000].map((b) => {
              const isActive = b === 15000 ? band === null : band === b;
              const label = b === 15000 ? '10k+' : `≤ ${b >= 1000 ? `${b / 1000}k` : b}`;
              return (
                <button
                  key={b}
                  type="button"
                  className={`bl-chip plan-picker__chip ${isActive ? 'is-active' : ''}`}
                  onClick={() => setVolume(b)}
                >
                  {isActive && (
                    <motion.span
                      layoutId="vol-preset-pill"
                      className="plan-picker__chip-pill"
                      transition={springSnappy}
                    />
                  )}
                  <span className="plan-picker__chip-label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bl-tiers-list plan-picker__tiers" role="radiogroup" aria-label="Plans">
        {PLANS.map((plan) => {
          const isSelected = plan.key === activePlanId;
          const isRec = plan.key === recommended;
          const e = estimate(volume, {}, plan.key);
          const p = band ? priceFor(plan.key, band, 'quarterly') : null;
          const waybillCode = PLAN_WAYBILL_CODES[plan.key] || 'RS/PKG.00';

          return (
            <div
              key={plan.key}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              className={`bl-tier-card plan-picker__card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectTier?.(plan.key)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onSelectTier?.(plan.key);
                }
              }}
            >
              <div className="bl-tier-card__waybill-bar">
                <span className="bl-tier-card__serial">{waybillCode} // WAYBILL SPEC</span>
                <span className="bl-tier-card__tear">
                  <Scissors size={10} className="waybill-scissors" aria-hidden="true" />
                  TEAR ALONG LINE
                </span>
              </div>

              <div className="bl-tier-card__body">
                <div className="bl-tier-card__left">
                  <div className="bl-tier-card__radio" aria-hidden="true">
                    {isSelected ? <div className="bl-tier-card__radio-dot" /> : null}
                  </div>
                  <div className="bl-tier-card__info">
                    <div className="bl-tier-card__title-row">
                      <span className="bl-tier-card__name">{plan.name}</span>
                      {isRec && <span className="bl-tier-card__badge">Recommended for you</span>}
                    </div>
                    <p className="bl-tier-card__volume">{plan.tagline}</p>
                    <p className="bl-tier-card__volume">
                      Covers {plan.coverage} · ≈{Math.round(plan.reduction * 100)}% fewer RTOs · saves ~{inr(e.saved)}/mo
                    </p>
                  </div>
                </div>

                <div className="bl-tier-card__right">
                  <span className="bl-tier-card__price">
                    {p ? <>{inr(p.monthly)}<small>/mo</small></> : 'Custom'}
                  </span>
                  <span className="bl-tier-card__subtext">{p ? cycleLabel || 'Billed quarterly' : 'Above 10k orders'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
