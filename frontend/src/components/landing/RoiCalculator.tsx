import { useState, useId } from 'react';
import { AVG_RESCUE_VALUE, tierForOrders } from '../../lib/plans';
import { Calculator } from 'lucide-react';

export interface RoiCalculatorProps {
  orders: number;
  onOrdersChange: (n: number) => void;
}

export function RoiCalculator({ orders, onOrdersChange }: RoiCalculatorProps) {
  const [codShare, setCodShare] = useState(60);
  const [rtoRate, setRtoRate] = useState(25);

  const ordersSliderId = useId();
  const codSliderId = useId();
  const rtoSliderId = useId();

  const failures = Math.round(orders * (codShare / 100) * (rtoRate / 100));
  const rescued = Math.round(failures * 0.6);
  const savings = rescued * AVG_RESCUE_VALUE;
  const plan = tierForOrders(orders);

  return (
    <section id="calculator" className="roi" aria-labelledby="roi-heading">
      <div className="roi__container">
        <div className="roi__header">
          <span className="roi__eyebrow">
            <Calculator size={14} aria-hidden="true" />
            ROI CALCULATOR
          </span>
          <h2 id="roi-heading" className="roi__heading">
            Calculate your RTO freight savings.
          </h2>
          <p className="roi__sub">
            Drag the sliders to match your monthly store metrics and see immediate recovery projections.
          </p>
        </div>

        <div className="roi__grid">
          {/* Sliders Column */}
          <div className="roi__sliders">
            <div className="roi__field">
              <div className="roi__field-head">
                <label htmlFor={ordersSliderId} className="roi__label">
                  Monthly orders
                </label>
                <span className="roi__val-badge" aria-live="polite">
                  {orders.toLocaleString('en-IN')} orders
                </span>
              </div>
              <input
                id={ordersSliderId}
                type="range"
                className="roi__range"
                aria-label="Monthly orders"
                min={100}
                max={25000}
                step={100}
                value={orders}
                onChange={(e) => onOrdersChange(Number(e.target.value))}
              />
            </div>

            <div className="roi__field">
              <div className="roi__field-head">
                <label htmlFor={codSliderId} className="roi__label">
                  COD share
                </label>
                <span className="roi__val-badge" aria-live="polite">
                  {codShare}%
                </span>
              </div>
              <input
                id={codSliderId}
                type="range"
                className="roi__range"
                aria-label="COD share"
                min={10}
                max={100}
                step={5}
                value={codShare}
                onChange={(e) => setCodShare(Number(e.target.value))}
              />
            </div>

            <div className="roi__field">
              <div className="roi__field-head">
                <label htmlFor={rtoSliderId} className="roi__label">
                  Current RTO rate
                </label>
                <span className="roi__val-badge" aria-live="polite">
                  {rtoRate}%
                </span>
              </div>
              <input
                id={rtoSliderId}
                type="range"
                className="roi__range"
                aria-label="Current RTO rate"
                min={5}
                max={50}
                step={1}
                value={rtoRate}
                onChange={(e) => setRtoRate(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Results Output Panel */}
          <div className="roi__out" aria-live="polite" role="region" aria-label="Projected recovery math">
            <div className="roi__out-stats">
              <div className="roi__out-row">
                <span className="roi__out-metric">~{failures}</span>
                <span className="roi__out-label">failed deliveries intercepted / month</span>
              </div>

              <div className="roi__out-row">
                <span className="roi__out-metric">~{rescued}</span>
                <span className="roi__out-label">rescued at a typical 60% rescue rate</span>
              </div>
            </div>

            <div className="roi__out-savings">
              <span className="roi__out-curr">₹</span>
              <span className="roi__out-amount">{savings.toLocaleString('en-IN')}</span>
              <span className="roi__out-subtext">freight saved / month</span>
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
