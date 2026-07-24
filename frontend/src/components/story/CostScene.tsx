/**
 * CostScene — "₹430. Gone."
 * Shows WHERE each rupee went, tied to the specific order.
 * The user sees: "I paid for ads, shipping, packing — and the rider threw it away."
 */
import { motion, MotionValue, useTransform } from 'motion/react';
import { usePhase } from './ScrollStory';
import AnimatedNumber from '../motion/AnimatedNumber';

const COSTS = [
  { label: 'Meta/Google ads to acquire Priya', amount: 230, pct: 53, color: '#f97316', note: '₹230 CPC × 1 conversion' },
  { label: 'Forward shipping (Mumbai warehouse → Andheri)', amount: 80, pct: 19, color: '#fb7185', note: 'Delhivery surface' },
  { label: 'Reverse shipping (RTO back to warehouse)', amount: 80, pct: 19, color: '#fbbf24', note: 'You pay again' },
  { label: 'Repackaging + quality check', amount: 40, pct: 9, color: '#a78bfa', note: 'Warehouse labor' },
];

export default function CostScene({ progress }: { progress: MotionValue<number> }) {
  const titleP = usePhase(progress, 0, 0.1);
  const titleY = useTransform(titleP, [0, 1], [40, 0]);

  const numP = usePhase(progress, 0.08, 0.2);
  const numScale = useTransform(numP, [0, 0.6, 1], [0.6, 1.08, 1]);

  const totalP = usePhase(progress, 0.55, 0.65);
  const totalOpacity = useTransform(totalP, [0, 1], [0, 1]);

  const compP = usePhase(progress, 0.65, 0.8);
  const compOpacity = useTransform(compP, [0, 1], [0, 1]);
  const compY = useTransform(compP, [0, 1], [30, 0]);

  const fadeOut = useTransform(progress, [0.88, 1], [1, 0]);

  return (
    <motion.div className="scene scene--cost" style={{ opacity: fadeOut }} id="cost">
      <motion.div className="cost-title" style={{ opacity: titleP, y: titleY }}>
        <p className="scene-label">The real cost of one fake remark</p>
        <h2>
          You spent ₹430 to get this order
          <br />
          <em className="serif">to Priya's door.</em>
        </h2>
        <p className="cost-title__sub">
          Here's exactly where every rupee went — and why you'll never see it back.
        </p>
      </motion.div>

      {/* Big number */}
      <motion.div className="cost-bignum" style={{ opacity: numP, scale: numScale }}>
        <span className="cost-bignum__currency">₹</span>
        <AnimatedNumber value={430} className="cost-bignum__value" duration={1.5} />
        <span className="cost-bignum__label">lost per RTO order</span>
      </motion.div>

      {/* Cost bars */}
      <div className="cost-bars">
        {COSTS.map((c, i) => {
          const start = 0.18 + i * 0.09;
          const end = start + 0.1;
          const p = usePhase(progress, start, end);
          const w = useTransform(p, [0, 1], ['0%', `${c.pct}%`]);
          const o = useTransform(p, [0, 0.3, 1], [0, 1, 1]);
          const ly = useTransform(p, [0, 1], [12, 0]);
          return (
            <motion.div key={c.label} className="cost-row" style={{ opacity: o }}>
              <motion.div className="cost-row__info" style={{ y: ly }}>
                <span className="cost-row__label">{c.label}</span>
                <span className="cost-row__note">{c.note}</span>
              </motion.div>
              <div className="cost-row__track">
                <motion.div className="cost-row__fill" style={{ width: w, background: c.color }} />
              </div>
              <motion.span className="cost-row__amount" style={{ y: ly }}>₹{c.amount}</motion.span>
            </motion.div>
          );
        })}
      </div>

      {/* Total line */}
      <motion.div className="cost-total" style={{ opacity: totalOpacity }}>
        <div className="cost-total__line" />
        <div className="cost-total__row">
          <span>Total loss on Order #89421</span>
          <strong>₹430</strong>
        </div>
        <p className="cost-total__note">
          The product cost you ₹380 to manufacture. You sold it for ₹1,424.
          <br />
          Your margin was ₹1,044. <strong>You lost ₹430 AND the ₹1,044 margin.</strong>
        </p>
      </motion.div>

      {/* Competitor */}
      <motion.div className="cost-competitor" style={{ opacity: compOpacity, y: compY }}>
        <span className="cost-competitor__emoji">📱</span>
        <p>
          And Priya? She got a "Delivery Failed" notification.
          <br />
          She's <strong>already browsing your competitor's store.</strong>
        </p>
      </motion.div>
    </motion.div>
  );
}
