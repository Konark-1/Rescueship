import { motion } from 'motion/react';
import AnimatedNumber from '../motion/AnimatedNumber';

export default function HeroScene() {
  return (
    <section className="lp-hero-section">
      <div className="container hero-layout">
        {/* LEFT: Title + Copy + Stats + CTA */}
        <motion.div
          className="hero-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hero-eyebrow">
            <span className="hero-eyebrow__dot" />
            Autonomous NDR Recovery for Indian D2C
          </div>

          <h1 className="hero-title">
            He never
            <br />
            <em className="serif">knocked.</em>
          </h1>

          <p className="hero-sub">
            Rider #4471 marked your order <strong className="hero-sub__alert">"Door Locked"</strong> at 11:47 AM.
            <br />
            He was <strong className="hero-sub__dist">2.3 km away.</strong>
          </p>

          {/* Live stats */}
          <div className="hero-stats">
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
          </div>

          {/* CTA Buttons */}
          <div className="hero-cta">
            <a href="/register">
              <button className="lp-btn lp-btn--primary">
                Start Rescuing Revenue <span className="lp-btn__arrow">→</span>
              </button>
            </a>
            <a href="#cost">
              <button className="lp-btn lp-btn--ghost">See the ₹430 breakdown ↓</button>
            </a>
          </div>
        </motion.div>

        {/* RIGHT: Order Card + Fake Remark Stamp */}
        <motion.div
          className="hero-right"
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="order-card">
            <div className="order-card__top">
              <span className="order-card__id">Order #89421</span>
              <span className="order-card__status badge-danger">
                RTO — Returned
              </span>
            </div>

            <div className="order-card__product">
              <div className="order-card__thumb">🧴</div>
              <div className="order-card__details">
                <strong>Vitamin C Face Serum</strong>
                <span>Qty: 1 • ₹1,424</span>
              </div>
              <span className="order-card__cod">COD</span>
            </div>

            <div className="order-card__meta">
              <div className="order-card__row">
                <span>Customer</span>
                <strong>Priya Sharma</strong>
              </div>
              <div className="order-card__row">
                <span>Address</span>
                <strong>Andheri West, Mumbai 400053</strong>
              </div>
              <div className="order-card__row">
                <span>Courier</span>
                <strong>Delhivery • AWB: DLV-8842917</strong>
              </div>
            </div>

            {/* Status timeline */}
            <div className="order-card__timeline">
              <div className="tl-step tl-step--done">
                <span className="tl-dot" />
                <span className="tl-label">Placed</span>
              </div>
              <div className="tl-step tl-step--done">
                <span className="tl-dot" />
                <span className="tl-label">Packed</span>
              </div>
              <div className="tl-step tl-step--done">
                <span className="tl-dot" />
                <span className="tl-label">Shipped</span>
              </div>
              <div className="tl-step tl-step--done">
                <span className="tl-dot" />
                <span className="tl-label">Out for Delivery</span>
              </div>
              <div className="tl-step tl-step--failed">
                <span className="tl-dot tl-dot--rose" />
                <span className="tl-label tl-label--rose">❌ "Door Locked"</span>
              </div>
            </div>
          </div>

          {/* FAKE REMARK stamp */}
          <motion.div
            className="stamp"
            initial={{ scale: 2, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            transition={{ duration: 0.5, delay: 0.4, type: 'spring', stiffness: 200 }}
          >
            <span className="stamp__label">NDR REMARK</span>
            <span className="stamp__text">"DOOR LOCKED"</span>
            <span className="stamp__time">11:47 AM • Rider GPS: 2.3km away</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
