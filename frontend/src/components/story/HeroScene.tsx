import { motion } from 'motion/react';
import AnimatedNumber from '../motion/AnimatedNumber';

export default function HeroScene() {
  const mountAnim = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] as const },
    }),
  };

  return (
    <motion.div className="scene scene--hero">
      <motion.div className="hero-rider" style={{ x: '10vw', opacity: 0.8 }} aria-hidden="true">
        <span className="hero-rider__emoji">🛵</span>
        <div className="hero-rider__trail" />
      </motion.div>

      <div className="hero-layout">
        <div className="hero-left">
          <motion.div className="hero-eyebrow" custom={0} variants={mountAnim} initial="hidden" animate="visible">
            <span className="hero-eyebrow__dot" />
            Autonomous NDR Recovery for Indian D2C
          </motion.div>

          <motion.h1 className="hero-title" custom={1} variants={mountAnim} initial="hidden" animate="visible">
            He never<br /><em className="serif">knocked.</em>
          </motion.h1>

          {/* FIXED: No fake GPS claim. Uses what we ACTUALLY detect. */}
          <motion.div className="hero-evidence">
            <p className="hero-sub">
              Rider #4471 marked your order <strong>"Door Locked"</strong> at 11:47 AM.
            </p>
            <div className="hero-evidence__flags">
              <span className="evidence-flag evidence-flag--red">
                ⚠️ Remark logged <strong>4 min</strong> after Out-for-Delivery scan
              </span>
              <span className="evidence-flag evidence-flag--red">
                ⚠️ No doorbell attempt • No customer call logged
              </span>
              <span className="evidence-flag evidence-flag--amber">
                🕐 Outside verified delivery window (8 AM – 10 PM)
              </span>
            </div>
          </motion.div>

          <motion.div className="hero-stats" custom={3} variants={mountAnim} initial="hidden" animate="visible">
            <div className="hero-stat">
              <AnimatedNumber value={854} className="hero-stat__num" />
              <span>rescues today</span>
            </div>
            <div className="hero-stat__div" />
            <div className="hero-stat">
              <AnimatedNumber value={12.54} decimals={2} prefix="₹" suffix="L" className="hero-stat__num" />
              <span>revenue saved</span>
            </div>
            <div className="hero-stat__div" />
            <div className="hero-stat">
              <AnimatedNumber value={94} suffix="s" className="hero-stat__num" />
              <span>avg. rescue time</span>
            </div>
          </motion.div>

          <motion.div className="hero-cta" custom={4} variants={mountAnim} initial="hidden" animate="visible">
            <a href="/register"><button className="lp-btn lp-btn--primary">Start Rescuing Revenue <span className="lp-btn__arrow">→</span></button></a>
            <a href="#cost"><button className="lp-btn lp-btn--ghost">See the ₹430 breakdown ↓</button></a>
          </motion.div>
        </div>

        <motion.div className="hero-right" custom={2} variants={mountAnim} initial="hidden" animate="visible">
          <div className="order-card">
            <div className="order-card__top">
              <span className="order-card__id">Order #89421</span>
              <span className="order-card__status" style={{ background: 'rgba(251,113,133,0.12)', color: '#fb7185' }}>
                RTO — Returned
              </span>
            </div>
            <div className="order-card__product">
              <div className="order-card__thumb">🧴</div>
              <div><strong>Vitamin C Face Serum</strong><span>Qty: 1 • ₹1,424</span></div>
              <span className="order-card__cod">COD</span>
            </div>
            <div className="order-card__meta">
              <div className="order-card__row"><span>Customer</span><span>Priya Sharma</span></div>
              <div className="order-card__row"><span>Address</span><span>Andheri West, Mumbai 400053</span></div>
              <div className="order-card__row"><span>Courier</span><span>Delhivery • DLV-8842917</span></div>
            </div>
            <div className="order-card__timeline">
              {['Placed','Packed','Shipped','Out for Delivery'].map(s => (
                <div key={s} className="tl-step tl-step--done"><span className="tl-dot" /><span className="tl-label">{s}</span></div>
              ))}
              <div className="tl-step">
                <span className="tl-dot" style={{ background: 'var(--rose)', boxShadow: '0 0 8px rgba(251,113,133,0.5)' }} />
                <span className="tl-label" style={{ color: 'var(--rose)' }}>❌ "Door Locked"</span>
              </div>
            </div>
          </div>
          <motion.div className="stamp" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <span className="stamp__label">NDR REMARK</span>
            <span className="stamp__text">"DOOR LOCKED"</span>
            <span className="stamp__time">11:47 AM • 4 min after OFD scan</span>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
