import { motion, MotionValue, useTransform } from 'motion/react';
import { usePhase } from './ScrollStory';
import AnimatedNumber from '../motion/AnimatedNumber';

export default function HeroScene({ progress }: { progress: MotionValue<number> }) {
  // Rider route — invisible at rest (progress 0 & 1), travels only while scrolling
  const riderP = usePhase(progress, 0.1, 0.42);
  const riderX = useTransform(riderP, [0, 1], ['0%', '108%']);
  const riderOpacity = useTransform(riderP, [0, 0.06, 0.82, 1], [0, 1, 1, 0]);
  const captionOpacity = useTransform(riderP, [0.2, 0.4, 0.7, 0.9], [0, 1, 1, 0]);

  const stampP = usePhase(progress, 0.18, 0.3);
  const stampScale = useTransform(stampP, [0, 0.5, 0.7, 1], [4, 1.1, 0.95, 1]);
  const stampOpacity = useTransform(stampP, [0, 0.25, 1], [0, 1, 1]);
  const stampRotate = useTransform(stampP, [0, 1], [-20, -8]);

  const evidenceP = usePhase(progress, 0.32, 0.45);
  const evidenceOpacity = useTransform(evidenceP, [0, 1], [0, 1]);
  const evidenceY = useTransform(evidenceP, [0, 1], [25, 0]);

  const rtoP = usePhase(progress, 0.42, 0.55);
  const fadeOut = useTransform(progress, [0.82, 1], [1, 0]);

  const mount = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] as const } }),
  };

  return (
    <motion.div className="scene scene--hero" style={{ opacity: fadeOut }}>
      <div className="hero-layout">
        <div className="hero-left">
          <motion.div className="hero-eyebrow" custom={0} variants={mount} initial="hidden" animate="visible">
            <span className="hero-eyebrow__dot" />Autonomous NDR Recovery for Indian D2C
          </motion.div>

          <motion.h1 className="hero-title" custom={1} variants={mount} initial="hidden" animate="visible">
            He never<br /><em className="serif">knocked.</em>
          </motion.h1>

          <motion.div className="hero-evidence" style={{ opacity: evidenceOpacity, y: evidenceY }}>
            <p className="hero-sub">Rider #4471 marked your order <strong>"Door Locked"</strong> at 11:47 AM.</p>
            <div className="hero-evidence__flags">
              <span className="evidence-flag evidence-flag--red">⚠️ Remark logged <strong>4 min</strong> after Out-for-Delivery scan</span>
              <span className="evidence-flag evidence-flag--red">⚠️ No doorbell attempt • No customer call logged</span>
              <span className="evidence-flag evidence-flag--amber">🕐 Outside verified delivery window (8 AM – 10 PM)</span>
            </div>
          </motion.div>

          <motion.div className="hero-stats" custom={3} variants={mount} initial="hidden" animate="visible">
            <div className="hero-stat"><AnimatedNumber value={854} className="hero-stat__num" /><span>rescues today</span></div>
            <div className="hero-stat__div" />
            <div className="hero-stat"><AnimatedNumber value={12.54} decimals={2} prefix="₹" suffix="L" className="hero-stat__num" /><span>revenue saved</span></div>
            <div className="hero-stat__div" />
            <div className="hero-stat"><AnimatedNumber value={94} suffix="s" className="hero-stat__num" /><span>avg. rescue time</span></div>
          </motion.div>

          <motion.div className="hero-cta" custom={4} variants={mount} initial="hidden" animate="visible">
            <a href="/register"><button className="lp-btn lp-btn--primary">Start Rescuing Revenue <span className="lp-btn__arrow">→</span></button></a>
            <a href="#cost"><button className="lp-btn lp-btn--ghost">See the ₹430 breakdown ↓</button></a>
          </motion.div>
        </div>

        <motion.div className="hero-right" custom={2} variants={mount} initial="hidden" animate="visible">
          <div className="order-card">
            <div className="order-card__top">
              <span className="order-card__id">Order #89421</span>
              <motion.span className="order-card__status" style={{
                background: useTransform(rtoP, [0, 0.5, 1], ['rgba(52,211,153,0.12)', 'rgba(52,211,153,0.12)', 'rgba(251,113,133,0.12)']),
                color: useTransform(rtoP, [0, 0.5, 1], ['#34d399', '#34d399', '#fb7185']),
              }}>{useTransform(rtoP, [0, 0.5, 1], ['Out for Delivery', 'Out for Delivery', 'RTO — Returned'])}</motion.span>
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
              {['Placed', 'Packed', 'Shipped', 'Out for Delivery'].map((s) => (
                <div key={s} className="tl-step tl-step--done"><span className="tl-dot" /><span className="tl-label">{s}</span></div>
              ))}
              <motion.div className="tl-step" style={{ opacity: useTransform(rtoP, [0, 0.5, 1], [0.4, 0.4, 1]) }}>
                <motion.span className="tl-dot" style={{
                  background: useTransform(rtoP, [0, 0.5, 1], ['var(--text-3)', 'var(--text-3)', 'var(--rose)']),
                  boxShadow: useTransform(rtoP, [0, 0.5, 1], ['none', 'none', '0 0 8px rgba(251,113,133,0.5)']),
                }} />
                <motion.span className="tl-label" style={{ color: useTransform(rtoP, [0, 0.5, 1], ['var(--text-3)', 'var(--text-3)', 'var(--rose)']) }}>
                  {useTransform(rtoP, [0, 0.5, 1], ['Delivering…', 'Delivering…', '❌ "Door Locked"'])}
                </motion.span>
              </motion.div>
            </div>
          </div>

          {/* Stamp now sits bottom-right so it never covers the status badge */}
          <motion.div className="stamp" style={{ opacity: stampOpacity, scale: stampScale, rotate: stampRotate }}>
            <span className="stamp__label">NDR REMARK</span>
            <span className="stamp__text">"DOOR LOCKED"</span>
            <span className="stamp__time">11:47 AM • 4 min after OFD scan</span>
          </motion.div>

          {/* Rider route — anchored under the card, travels on scroll */}
          <motion.div className="card-route" style={{ opacity: riderOpacity }} aria-hidden="true">
            <div className="card-route__line" />
            <span className="card-route__pin">📍</span>
            <motion.span className="card-route__rider" style={{ x: riderX }}>🛵</motion.span>
            <motion.span className="card-route__caption" style={{ opacity: captionOpacity }}>logged the remark & drove off — never stopped</motion.span>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
