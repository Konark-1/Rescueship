import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useLenis } from '../hooks/useLenis';
import { useMagnetic } from '../hooks/useMagnetic';
import HeroScene from '../components/story/HeroScene';
import CostScene from '../components/story/CostScene';
import RescueScene from '../components/story/RescueScene';
import MarqueeLogos from '../components/motion/MarqueeLogos';
import SectionReveal from '../components/motion/SectionReveal';
import TiltCard from '../components/motion/TiltCard';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import PricingComparisonModal from '../components/PricingComparisonModal';
import './landing.css';

export default function LandingPage() {
  useLenis();
  const cta = useMagnetic(0.25);

  const [volume, setVolume] = useState(5000);
  const rtoLoss = Math.round(volume * 0.15 * 430);
  const saved = Math.round(rtoLoss * 0.6);
  const [annual, setAnnual] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const PLANS = [
    {
      name: 'Starter',
      orders: '2,000',
      monthly: 1599,
      annual: 1119,
      tag: '',
      features: [
        'Autonomous NDR rescue engine',
        'Fake remark detection (timing analysis)',
        'WhatsApp COD → Prepaid conversion',
        '3-mode address correction (GPS / Text / Both)',
        'UPI QR code payment via WhatsApp',
        'Escalation chain (4h → 12h → 24h)',
        'Shiprocket + Delhivery + ClickPost',
        'Shopify & WooCommerce integration',
        'AES-256 encrypted credentials',
        'Emergency "Pause All" kill switch',
        'Full audit log (90-day retention)',
      ],
    },
    {
      name: 'Growth',
      orders: '10,000',
      monthly: 3999,
      annual: 2799,
      tag: 'Most Popular',
      features: [
        'Everything in Starter, plus:',
        'Real-time SSE live dashboard',
        'Revenue Saved analytics (₹ tracking)',
        'Carrier performance reports',
        'Email notifications & daily summaries',
        'Seller payment alerts (WhatsApp)',
        'COD discount incentives (₹50 / 5% OFF)',
        'Platform status sync (Shopify / Woo)',
      ],
    },
    {
      name: 'Scale',
      orders: '50,000',
      monthly: 9999,
      annual: 6999,
      tag: '',
      features: [
        'Everything in Growth, plus:',
        'CSV / JSON data exports (4 report types)',
        'Custom carrier API integration',
        'Dedicated onboarding session',
        'Priority support (24h response)',
      ],
    },
  ];

  return (
    <div className="lp">
      {/* Background Orbs */}
      <div className="lp-ambient" aria-hidden="true">
        <div className="lp-orb lp-orb--1" />
        <div className="lp-orb lp-orb--2" />
        <div className="lp-orb lp-orb--3" />
        <div className="lp-grain" />
      </div>

      {/* Floating Navigation */}
      <motion.header
        className="lp-nav"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <a href="#" className="lp-nav__logo">
          <span>⚓</span> RescueShip
        </a>
        <nav className="lp-nav__links">
          <a href="#cost">Why ₹430?</a>
          <a href="#calculator">ROI Calculator</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="lp-nav__actions">
          <Link to="/login" className="lp-nav__login">Log in</Link>
          <Link to="/register" className="lp-nav__cta">Start Free</Link>
        </div>
      </motion.header>

      {/* ═══ SECTION 1: HERO SCENE ═══ */}
      <HeroScene />

      {/* ═══ SECTION 2: COST SCENE (₹430 BREAKDOWN) ═══ */}
      <CostScene />

      {/* ═══ SECTION 3: RESCUE SCENE (INTERACTIVE WHATSAPP ENGINE) ═══ */}
      <RescueScene />

      {/* ═══ SECTION 4: INTEGRATIONS MARQUEE ═══ */}
      <section className="lp-logos">
        <p className="lp-logos__label">Integrated with your stack</p>
        <MarqueeLogos />
      </section>

      {/* ═══ SECTION 5: ROI CALCULATOR ═══ */}
      <section className="lp-calc" id="calculator">
        <div className="container lp-calc-container">
          <SectionReveal className="lp-calc-header">
            <p className="scene-label">ROI Calculator</p>
            <h2 className="lp-calc__title">Now calculate <em className="serif">your</em> loss.</h2>
          </SectionReveal>

          <SectionReveal delay={0.12} className="lp-calc-box-wrap">
            <div className="lp-calc__box">
              <div className="lp-calc__row">
                <label>Monthly Orders</label>
                <span className="lp-calc__val">{volume.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                value={volume}
                onChange={e => setVolume(+e.target.value)}
                className="lp-calc__slider"
              />
              <div className="lp-calc__results">
                <div className="lp-calc__result lp-calc__result--loss">
                  <AnimatedNumber value={rtoLoss} prefix="₹" className="lp-calc__num" />
                  <span>monthly RTO loss</span>
                </div>
                <div className="lp-calc__result lp-calc__result--saved">
                  <AnimatedNumber value={saved} prefix="₹" className="lp-calc__num" />
                  <span>rescued by RescueShip</span>
                </div>
                <div className="lp-calc__result lp-calc__result--roi">
                  <AnimatedNumber value={Math.round(saved / (annual ? 33588 : 3999))} suffix="x" className="lp-calc__num" />
                  <span>return on investment</span>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══ SECTION 6: PRICING ═══ */}
      <section className="lp-pricing" id="pricing">
        <div className="container lp-pricing-container">
          <SectionReveal className="lp-pricing-header">
            <p className="scene-label">Pricing</p>
            <h2 className="lp-pricing__title">Cheaper than <em className="serif">one failed delivery.</em></h2>
          </SectionReveal>
          <SectionReveal delay={0.1}>
            <div className="lp-pricing__toggle">
              <span className={!annual ? 'active' : ''}>Monthly</span>
              <button
                className={`lp-pricing__switch ${annual ? 'on' : ''}`}
                onClick={() => setAnnual(!annual)}
                aria-label="Toggle billing"
              >
                <span className="lp-pricing__knob" />
              </button>
              <span className={annual ? 'active' : ''}>
                Annual <em className="lp-pricing__save">−30%</em>
              </span>
            </div>
          </SectionReveal>

          <div className="lp-pricing__grid">
            {PLANS.map((pl, i) => (
              <SectionReveal key={pl.name} delay={i * 0.1}>
                <TiltCard className={`lp-pricing__card ${pl.tag ? 'lp-pricing__card--feat' : ''}`} intensity={5}>
                  {pl.tag && <span className="lp-pricing__badge">{pl.tag}</span>}
                  <h3>{pl.name}</h3>
                  <p className="lp-pricing__orders">up to {pl.orders} orders/mo</p>
                  <div className="lp-pricing__price">
                    ₹{(annual ? pl.annual : pl.monthly).toLocaleString('en-IN')}
                    <span>/mo</span>
                  </div>
                  <ul className="lp-pricing__feats">
                    {pl.features.map((f, fi) => (
                      <li key={fi} className={f.startsWith('Everything') ? 'lp-pricing__feats--header' : ''}>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register">
                    <button className={`lp-btn ${pl.tag ? 'lp-btn--primary' : 'lp-btn--ghost'} lp-btn--full`}>
                      Get Started
                    </button>
                  </Link>
                </TiltCard>
              </SectionReveal>
            ))}
          </div>

          <SectionReveal delay={0.3}>
            <div className="lp-pricing__compare">
              <button onClick={() => setModalOpen(true)}>Compare all features →</button>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══ SECTION 7: CALL TO ACTION ═══ */}
      <section className="lp-cta">
        <div className="container lp-cta-container">
          <SectionReveal className="lp-cta-header">
            <h2 className="lp-cta__title">
              Stop paying for deliveries
              <br />
              <em className="serif">that never happened.</em>
            </h2>
            <p className="lp-cta__sub">Set up in 10 minutes. First rescue in 24 hours. No credit card.</p>
            <Link to="/register">
              <button
                className="lp-btn lp-btn--primary lp-btn--lg"
                ref={cta.ref as any}
                onMouseMove={cta.onMouseMove}
                onMouseLeave={cta.onMouseLeave}
              >
                Start Rescuing Revenue <span className="lp-btn__arrow">→</span>
              </button>
            </Link>
          </SectionReveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="lp-footer">
        <div className="container">
          <div className="lp-footer__top">
            <div className="lp-footer__brand">
              <span>⚓</span> RescueShip
              <p>Autonomous NDR recovery for Indian D2C brands.</p>
            </div>
            <div className="lp-footer__links">
              <div>
                <h4>Product</h4>
                <a href="#cost">The Problem</a>
                <a href="#calculator">ROI</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div>
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Blog</a>
              </div>
              <div>
                <h4>Legal</h4>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
              </div>
            </div>
          </div>
          <div className="lp-footer__bottom">
            <span>© 2026 RescueShip. Built in India 🇮🇳</span>
            <span>Made with obsession for D2C merchants.</span>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {modalOpen && <PricingComparisonModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
