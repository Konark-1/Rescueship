import { useState, useId } from 'react';
import { PLANS, tierForOrders, type Plan } from '../../lib/plans';
import { SlidersHorizontal } from 'lucide-react';

export interface PlanPickerProps {
  value?: number;
  onChange?: (orders: number) => void;
  selectedTierKey?: string;
  onSelectTier?: (tierKey: string) => void;
  cycleLabel?: string;
  hideSlider?: boolean;
}

const CHIPS = [
  { label: 'Up to 1k', target: 1000 },
  { label: '1k – 5k', target: 5000 },
  { label: '5k – 12k', target: 12000 },
  { label: '12k – 25k', target: 25000 },
];

export function PlanPicker({
  value,
  onChange,
  selectedTierKey,
  onSelectTier,
  cycleLabel,
  hideSlider = false,
}: PlanPickerProps) {
  const [internalVolume, setInternalVolume] = useState(1500);
  const sliderId = useId();

  const volume = value !== undefined ? value : internalVolume;
  const recommended = tierForOrders(volume);
  const activePlanId = selectedTierKey || recommended.id;

  const handleVolumeChange = (newVal: number) => {
    if (onChange) {
      onChange(newVal);
    } else {
      setInternalVolume(newVal);
    }
    const newTier = tierForOrders(newVal);
    onSelectTier?.(newTier.id);
  };

  const handleSelectPlan = (plan: Plan) => {
    if (onChange) {
      onChange(plan.maxOrders);
    } else {
      setInternalVolume(plan.maxOrders);
    }
    onSelectTier?.(plan.id);
  };

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
            max={25000}
            step={100}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
          />

          <div className="bl-vol-chips plan-picker__chips" role="group" aria-label="Order volume presets">
            {CHIPS.map((chip) => {
              const isActive =
                (chip.target === 1000 && volume <= 1000) ||
                (chip.target === 5000 && volume > 1000 && volume <= 5000) ||
                (chip.target === 12000 && volume > 5000 && volume <= 12000) ||
                (chip.target === 25000 && volume > 12000);

              return (
                <button
                  key={chip.target}
                  type="button"
                  className={`bl-chip plan-picker__chip ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleVolumeChange(chip.target)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bl-tiers-list plan-picker__tiers" role="radiogroup" aria-label="Subscription plans">
        {PLANS.map((plan) => {
          const isSelected = plan.id === activePlanId;
          const isRec = plan.id === recommended.id;

          return (
            <div
              key={plan.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              className={`bl-tier-card plan-picker__card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleSelectPlan(plan)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectPlan(plan);
                }
              }}
            >
              <div className="bl-tier-card__left">
                <div className="bl-tier-card__radio" aria-hidden="true">
                  {isSelected ? <div className="bl-tier-card__radio-dot" /> : null}
                </div>
                <div className="bl-tier-card__info">
                  <div className="bl-tier-card__title-row">
                    <span className="bl-tier-card__name">{plan.name}</span>
                    {isRec && <span className="bl-tier-card__badge">Recommended for you</span>}
                  </div>
                  <p className="bl-tier-card__volume">
                    Up to {plan.maxOrders.toLocaleString('en-IN')} orders/mo · {plan.blurb}
                  </p>
                </div>
              </div>

              <div className="bl-tier-card__right">
                <span className="bl-tier-card__price">
                  ₹{plan.priceMonthly.toLocaleString('en-IN')}
                  <small>/mo</small>
                </span>
                <span className="bl-tier-card__subtext">
                  {cycleLabel || `Billed quarterly`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
