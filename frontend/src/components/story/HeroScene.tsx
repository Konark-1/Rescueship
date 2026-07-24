/**
 * HeroScene — "He Never Knocked."
 * The order, the fake remark, the rider who was 2.3km away.
 * ALL visible in one viewport. No scroll needed for the hook.
 */
import { motion, MotionValue, useTransform } from 'motion/react';
import { usePhase } from './ScrollStory';
import AnimatedNumber from '../motion/AnimatedNumber';

export default function HeroScene({ progress }: { progress: MotionValue<number> }) {
  /* Title reveal */
  const titleP = usePhase(progress, 0, 0.12);
  const titleY = useTransform(titleP, [0, 1], [50, 0]);

  /* Order card slides in from right */
  const cardP = usePhase(progress, 0.08, 0.22);
  const cardX = useTransform(cardP, [0, 1], [80, 0]);
  const cardOpacity = useTransform(cardP, [0, 0.4, 1], [0, 1, 1]);

  /* Stamp slams */
  const stampP = usePhase(progress, 0.2, 0.32);
  const stampScale = useTransform(stampP, [0, 0.5, 0.7, 1], [4, 1.1, 0.95, 1]);
  const stampOpacity = useTransform(stampP, [0, 0.25, 1], [0, 1, 1]);
  const stampRotate = useTransform(stampP, [0, 1], [-20, -8]);

  /* Rider crosses + fades */
  const riderP = usePhase(progress, 0.15, 0.4);
  const riderX = useTransform(riderP, [0, 1], ['-15vw', '115vw']);
  const riderOpacity = useTransform(riderP, [0, 0.08, 0.8, 1], [0, 1, 0.6, 0]);

  /* Distance text */
  const distP = usePhase(progress, 0.35, 0.48);
  const distOpacity = useTransform(distP, [0, 1], [0, 1]);
  const distY = useTransform(distP, [0, 1], [25, 0]);

  /* Status timeline flips to RTO */
  const rtoP = usePhase(progress, 0.45, 0.58);

  /* Live stats */
  const statsP = usePhase(progress, 0.55, 0.7);
  const statsOpacity = useTransform(statsP, [0, 1], [0, 1]);
  const statsY = useTransform(statsP, [0, 1], [30, 0]);

  /* CTA */
  const ctaP = usePhase(progress, 0.65, 0.8);
  const ctaOpacity = useTransform(ctaP, [0, 1], [0, 1]);
  const ctaY = useTransform(ctaP, [0, 1], [20, 0]);

  /* Fade out at end */
  const fadeOut = useTransform(progress, [0.85, 1], [1, 0]);

  return (
    <motion.div className="scene scene--hero" style={{ opacity: fadeOut }}>
      {/* Rider crossing */}
      <motion.div className="hero-rider" style={{ x: riderX, opacity: riderOpacity }} aria-hidden="true">
        <span className="hero-rider__emoji">🛵</span>
        <div className="hero-rider__trail" />
      </motion.div>

      <div className="hero-layout">
        {/* Left: Title + copy */}
        <div className="hero-left">
          <motion.div className="hero-eyebrow" style={{ opacity: titleY, y: useTransform(titleP, [0,1],[20,0]) }}>
            <span className="hero-eyebrow__dot" />
            Autonomous NDR Recovery for Indian D2C
          </motion.div>

          <motion.h1 className="hero-title" style={{ opacity: titleP, y: titleY }}>
            He never
            <br />
            <em className="serif">knocked.</em>
          </motion.h1>

          <motion.p className="hero-sub" style={{ opacity: distOpacity, y: distY }}>
            Rider #4471 marked your order <strong>"Door Locked"</strong> at 11:47 AM.
            <br />
            He was <strong className="hero-sub__dist">2.3 km away.</strong>
          </motion.p>

          {/* Live stats */}
          <motion.div className="hero-stats" style={{ opacity: statsOpacity, y: statsY }}>
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

          {/* CTA */}
          <motion.div className="hero-cta" style={{ opacity: ctaOpacity, y: ctaY }}>
            <a href="/register"><button className="lp-btn lp-btn--primary">Start Rescuing Revenue <span className="lp-btn__arrow">→</span></button></a>
            <a href="#cost"><button className="lp-btn lp-btn--ghost">See the ₹430 breakdown ↓</button></a>
          </motion.div>
        </div>

        {/* Right: Order card + stamp */}
        <motion.div className="hero-right" style={{ x: cardX, opacity: cardOpacity }}>
          <div className="order-card">
            <div className="order-card__top">
              <span className="order-card__id">Order #89421</span>
              <motion.span
                className="order-card__status"
                style={{
                  background: useTransform(rtoP, [0,0.5,1], ['rgba(52,211,153,0.12)','rgba(52,211,153,0.12)','rgba(251,113,133,0.12)']),
                  color: useTransform(rtoP, [0,0.5,1], ['#34d399','#34d399','#fb7185']),
                }}
              >
                {useTransform(rtoP, [0,0.5,1], ['Out for Delivery','Out for Delivery','RTO — Returned'])}
              </motion.span>
            </div>

            <div className="order-card__product">
              <div className="order-card__thumb">🧴</div>
              <div>
                <strong>Vitamin C Face Serum</strong>
                <span>Qty: 1 • ₹1,424</span>
              </div>
              <span className="order-card__cod">COD</span>
            </div>

            <div className="order-card__meta">
              <div className="order-card__row"><span>Customer</span><span>Priya Sharma</span></div>
              <div className="order-card__row"><span>Address</span><span>Andheri West, Mumbai 400053</span></div>
              <div className="order-card__row"><span>Courier</span><span>Delhivery • DLV-8842917</span></div>
            </div>

            {/* Status timeline */}
            <div className="order-card__timeline">
              {['Placed','Packed','Shipped','Out for Delivery'].map((s) => (
                <div key={s} className="tl-step tl-step--done">
                  <span className="tl-dot" />
                  <span className="tl-label">{s}</span>
                </div>
              ))}
              <motion.div
                className="tl-step"
                style={{
                  opacity: useTransform(rtoP, [0,0.5,1], [0.4, 0.4, 1]),
                }}
              >
                <motion.span
                  className="tl-dot"
                  style={{
                    background: useTransform(rtoP, [0,0.5,1], ['var(--text-3)','var(--text-3)','var(--rose)']),
                    boxShadow: useTransform(rtoP, [0,0.5,1], ['none','none','0 0 8px rgba(251,113,133,0.5)']),
                  }}
                />
                <motion.span
                  className="tl-label"
                  style={{ color: useTransform(rtoP, [0,0.5,1], ['var(--text-3)','var(--text-3)','var(--rose)']) }}
                >
                  {useTransform(rtoP, [0,0.5,1], ['Delivering...','Delivering...','❌ "Door Locked"'])}
                </motion.span>
              </motion.div>
            </div>
          </div>

          {/* FAKE REMARK stamp */}
          <motion.div
            className="stamp"
            style={{ opacity: stampOpacity, scale: stampScale, rotate: stampRotate }}
          >
            <span className="stamp__label">NDR REMARK</span>
            <span className="stamp__text">"DOOR LOCKED"</span>
            <span className="stamp__time">11:47 AM • Rider GPS: Warehouse</span>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
