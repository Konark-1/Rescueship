import { motion, MotionValue } from 'motion/react';
import AnimatedNumber from '../motion/AnimatedNumber';

const COSTS = [
  { label: 'Meta/Google ads to acquire Priya', amount: 230, pct: 53, color: '#f97316', note: '₹230 CPC × 1 conversion' },
  { label: 'Forward shipping (Mumbai warehouse → Andheri)', amount: 80, pct: 19, color: '#fb7185', note: 'Delhivery surface' },
  { label: 'Reverse shipping (RTO back to warehouse)', amount: 80, pct: 19, color: '#fbbf24', note: 'You pay again' },
  { label: 'Repackaging + quality check', amount: 40, pct: 9, color: '#a78bfa', note: 'Warehouse labor' },
];

export default function CostScene(_props?: { progress?: MotionValue<number> }) {
  return (
    <motion.div className="scene scene--cost" id="cost">
      <div className="cost-layout">
        {/* Header */}
        <motion.div
          className="cost-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
        >
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
        <motion.div
          className="cost-bignum"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="cost-bignum__wrap">
            <span className="cost-bignum__currency">₹</span>
            <AnimatedNumber value={430} className="cost-bignum__value" duration={1.5} />
          </div>
          <span className="cost-bignum__label">lost per RTO order</span>
        </motion.div>

        {/* Cost bars */}
        <div className="cost-bars">
          {COSTS.map((c, i) => (
            <motion.div
              key={c.label}
              className="cost-row"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="cost-row__info">
                <span className="cost-row__label">{c.label}</span>
                <span className="cost-row__note">{c.note}</span>
              </div>
              <div className="cost-row__track">
                <motion.div
                  className="cost-row__fill"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${c.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                  style={{ background: c.color }}
                />
              </div>
              <span className="cost-row__amount">₹{c.amount}</span>
            </motion.div>
          ))}
        </div>

        {/* Total summary */}
        <motion.div
          className="cost-total"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="cost-total__line" />
          <div className="cost-total__row">
            <span>Total loss on Order #89421</span>
            <strong>₹430 GONE</strong>
          </div>
          <p className="cost-total__note">
            The product cost you ₹380 to manufacture. You sold it for ₹1,424.
            <br />
            Your margin was ₹1,044. <strong>You lost ₹430 AND the ₹1,044 margin.</strong>
          </p>
        </motion.div>

        {/* Competitor Alert */}
        <motion.div
          className="cost-competitor"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <span className="cost-competitor__emoji">📱</span>
          <p>
            And Priya? She got a "Delivery Failed" notification.
            <br />
            She's <strong>already browsing your competitor's store.</strong>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
