import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import { useLenis } from '../hooks/useLenis';
import { useMagnetic } from '../hooks/useMagnetic';
import TextReveal from '../components/motion/TextReveal';
import SectionReveal from '../components/motion/SectionReveal';
import TiltCard from '../components/motion/TiltCard';
import MarqueeLogos from '../components/motion/MarqueeLogos';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import PricingComparisonModal from '../components/PricingComparisonModal';
import './landing.css';

/* ═══════════════════════════════════════════════════════════
   RescueShip Landing Page — 2026 Premium Edition
   Story: Problem → Agitation → Solution → Proof → Action
   ═══════════════════════════════════════════════════════════ */

export default function LandingPage() {
  useLenis();

  // ── Hero parallax ──
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  // ── Magnetic CTA ──
  const ctaMagnetic = useMagnetic(0.25);

  // ── Playground state ──
  const [chatStep, setChatStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'ndr' | 'cod'>('ndr');

  // ── Calculator ──
  const [volume, setVolume] = useState(5000);
  const rtoLoss = Math.round(volume * 0.15 * 430);
  const saved = Math.round(rtoLoss * 0.6);

  // ── Pricing ──
  const [annual, setAnnual] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const PLANS = [
    { name: 'Starter', orders: '2,000', monthly: 1599, annual: 1119, tag: '' },
    { name: 'Growth', orders: '10,000', monthly: 3999, annual: 2799, tag: 'Most Popular' },
    { name: 'Scale', orders: '50,000', monthly: 9999, annual: 6999, tag: '' },
  ];

  return (
    <div className="lp">
      {/* ── Ambient Background ── */}
      <div className="lp-ambient" aria-hidden="true">
        <div className="lp-orb lp-orb--1" />
        <div className="lp-orb lp-orb--2" />
        <div className="lp-orb lp-orb--3" />
        <div className="lp-grain" />
      </div>

      {/* ═══ NAV ═══ */}
      <motion.header
        className="lp-nav"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <a href="#" className="lp-nav__logo">
          <span className="lp-nav__logo-icon">⚓</span>
          RescueShip
        </a>
        <nav className="lp-nav__links">
          <a href="#problem">Problem</a>
          <a href="#solution">Solution</a>
          <a href="#playground">Demo</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="lp-nav__actions">
          <Link to="/login" className="lp-nav__login">Log in</Link>
          <Link to="/register" className="lp-nav__cta">Start Free</Link>
        </div>
      </motion.header>

      {/* ═══ HERO ═══ */}
      <section className="lp-hero" ref={heroRef}>
        <motion.div
          className="lp-hero__inner"
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
        >
          <motion.div
            className="lp-hero__eyebrow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <span className="lp-hero__eyebrow-dot" />
            Autonomous NDR Recovery for Indian D2C
          </motion.div>

          <motion.h1
            className="lp-hero__title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            Every failed delivery
            <br />
            costs you{' '}
            <em className="lp-hero__title-accent">₹430.</em>
            <br />
            <span className="lp-hero__title-serif">We make sure it doesn't.</span>
          </motion.h1>

          <motion.p
            className="lp-hero__sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            RescueShip intercepts fake courier remarks, converts COD to prepaid
            via WhatsApp, and syncs GPS pins to driver apps — all in under 90 seconds.
          </motion.p>

          <motion.div
            className="lp-hero__actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9 }}
          >
            <Link to="/register">
              <button
                className="lp-btn lp-btn--primary"
                ref={ctaMagnetic.ref as any}
                onMouseMove={ctaMagnetic.onMouseMove}
                onMouseLeave={ctaMagnetic.onMouseLeave}
              >
                Start Rescuing Revenue
                <span className="lp-btn__arrow">→</span>
              </button>
            </Link>
            <a href="#playground">
              <button className="lp-btn lp-btn--ghost">
                See it in action
              </button>
            </a>
          </motion.div>

          {/* Hero Stats Row */}
          <motion.div
            className="lp-hero__stats"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
          >
            <div className="lp-hero__stat">
              <AnimatedNumber value={854} className="lp-hero__stat-num" />
              <span className="lp-hero__stat-label">rescues today</span>
            </div>
            <div className="lp-hero__stat-divider" />
            <div className="lp-hero__stat">
              <AnimatedNumber value={42.3} decimals={1} suffix="%" className="lp-hero__stat-num" />
              <span className="lp-hero__stat-label">recovery rate</span>
            </div>
            <div className="lp-hero__stat-divider" />
            <div className="lp-hero__stat">
              <AnimatedNumber value={12.54} decimals={2} prefix="₹" suffix="L" className="lp-hero__stat-num" />
              <span className="lp-hero__stat-label">revenue retained</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="lp-hero__scroll"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="lp-hero__scroll-line"
            animate={{ scaleY: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </section>

      {/* ═══ LOGO MARQUEE ═══ */}
      <section className="lp-logos">
        <p className="lp-logos__label">Integrated with your stack</p>
        <MarqueeLogos />
      </section>

      {/* ═══ THE PROBLEM ═══ */}
      <section className="lp-problem" id="problem">
        <div className="container">
          <SectionReveal>
            <p className="lp-section-label">The Problem</p>
          </SectionReveal>

          <TextReveal
            as="h2"
            className="lp-problem__headline"
          >
            60% of Indian D2C orders are Cash-on-Delivery. Most of them never reach your customer. And you pay for every single failure.
          </TextReveal>

          <div className="lp-problem__grid">
            {[
              {
                num: '60%',
                title: 'Fake Remarks',
                desc: 'Riders mark "Door Locked" without visiting. Your system believes them.',
                color: 'var(--rose)',
              },
              {
                num: '₹430',
                title: 'Per RTO Loss',
                desc: 'Forward + reverse shipping + repackaging + CAC. Gone.',
                color: 'var(--amber)',
              },
              {
                num: '<15%',
                title: 'Call Center Pickup',
                desc: '48 hours after RTO, nobody answers. The window is already closed.',
                color: 'var(--violet)',
              },
            ].map((item, i) => (
              <SectionReveal key={i} delay={i * 0.12}>
                <TiltCard className="lp-problem__card">
                  <span className="lp-problem__card-num" style={{ color: item.color }}>
                    {item.num}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </TiltCard>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE SOLUTION — Sticky Scroll ═══ */}
      <section className="lp-solution" id="solution">
        <div className="container">
          <SectionReveal>
            <p className="lp-section-label">The Solution</p>
            <h2 className="lp-solution__title">
              Three moves.{' '}
              <em className="lp-serif">Ninety seconds.</em>{' '}
              Zero human effort.
            </h2>
          </SectionReveal>

          <div className="lp-solution__steps">
            {[
              {
                step: '01',
                icon: '🔍',
                title: 'Detect',
                desc: 'Webhook fires the instant a courier logs an NDR. Our engine checks: Was the remark logged within 15 minutes of out-for-delivery? Outside operating hours? Flagged as fake.',
                accent: 'var(--rose)',
              },
              {
                step: '02',
                icon: '💬',
                title: 'Engage',
                desc: 'WhatsApp message hits the customer while the rider is still in the neighborhood. "Were you home?" Three buttons. One tap. GPS pin shared. Address corrected.',
                accent: 'var(--indigo-soft)',
              },
              {
                step: '03',
                icon: '🚀',
                title: 'Rescue',
                desc: 'GPS coordinates pushed to the driver app. COD converted to UPI with a ₹50 discount. Seller notified. Order rescued. Revenue saved. All before the next delivery attempt.',
                accent: 'var(--emerald)',
              },
            ].map((item, i) => (
              <SectionReveal key={i} delay={i * 0.1}>
                <div className="lp-solution__step">
                  <div className="lp-solution__step-marker">
                    <span className="lp-solution__step-num" style={{ color: item.accent }}>
                      {item.step}
                    </span>
                    <span className="lp-solution__step-icon">{item.icon}</span>
                  </div>
                  <div className="lp-solution__step-content">
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                  <div
                    className="lp-solution__step-line"
                    style={{ background: `linear-gradient(to bottom, ${item.accent}, transparent)` }}
                  />
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LIVE PLAYGROUND ═══ */}
      <section className="lp-playground" id="playground">
        <div className="container">
          <div className="lp-playground__layout">
            <div className="lp-playground__info">
              <SectionReveal>
                <p className="lp-section-label">Live Demo</p>
                <h2 className="lp-playground__title">
                  Watch the bot work.
                  <br />
                  <em className="lp-serif">Then try it yourself.</em>
                </h2>
                <p className="lp-playground__desc">
                  This is the exact WhatsApp flow your customer sees when a delivery
                  fails. Tap the buttons. Watch the rescue happen in real-time.
                </p>
              </SectionReveal>

              <SectionReveal delay={0.15}>
                <div className="lp-playground__tabs">
                  <button
                    className={`lp-playground__tab ${activeTab === 'ndr' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('ndr'); setChatStep(0); }}
                  >
                    Fake Remark Rescue
                  </button>
                  <button
                    className={`lp-playground__tab ${activeTab === 'cod' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('cod'); setChatStep(0); }}
                  >
                    COD → Prepaid
                  </button>
                </div>
              </SectionReveal>
            </div>

            {/* Phone Mockup */}
            <SectionReveal delay={0.2}>
              <div className="lp-phone">
                <div className="lp-phone__notch" />
                <div className="lp-phone__screen">
                  <div className="lp-phone__header">
                    <div className="lp-phone__avatar">RS</div>
                    <div>
                      <strong>RescueBot</strong>
                      <span className="lp-phone__status">online</span>
                    </div>
                  </div>
                  <div className="lp-phone__chat">
                    <AnimatePresence mode="wait">
                      {activeTab === 'ndr' && (
                        <motion.div
                          key="ndr"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="lp-phone__messages"
                        >
                          <div className="lp-phone__sys">
                            🚨 NDR: "Door Locked" — Order #89421
                          </div>
                          <motion.div
                            className="lp-phone__msg lp-phone__msg--bot"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                          >
                            Hi! Our system flagged a suspicious delivery remark on
                            your order #89421. Were you available at home?
                          </motion.div>

                          {chatStep === 0 && (
                            <motion.div
                              className="lp-phone__actions"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.6 }}
                            >
                              <button onClick={() => setChatStep(1)}>✅ Yes, I'm home</button>
                              <button onClick={() => setChatStep(2)}>📅 Reschedule</button>
                              <button onClick={() => setChatStep(3)}>📍 Share Location</button>
                            </motion.div>
                          )}

                          {chatStep >= 1 && (
                            <>
                              <motion.div className="lp-phone__msg lp-phone__msg--user"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                Yes, I'm home. Nobody came!
                              </motion.div>
                              <motion.div className="lp-phone__sys lp-phone__sys--success"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                                ⚡ Fake remark escalated to hub supervisor
                              </motion.div>
                              <motion.div className="lp-phone__msg lp-phone__msg--bot"
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                                Confirmed! We've flagged this to Delhivery. Priority
                                re-attempt scheduled for tomorrow 9AM–12PM with
                                supervisor GPS tracking. 🚚
                              </motion.div>
                            </>
                          )}

                          {chatStep === 2 && (
                            <>
                              <motion.div className="lp-phone__msg lp-phone__msg--user"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                Reschedule for tomorrow please
                              </motion.div>
                              <motion.div className="lp-phone__sys lp-phone__sys--success"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                                ⚡ Carrier synced: Re-attempt tomorrow 10AM–2PM
                              </motion.div>
                            </>
                          )}

                          {chatStep === 3 && (
                            <>
                              <motion.div className="lp-phone__msg lp-phone__msg--user"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                📍 Location: 19.0760° N, 72.8777° E
                              </motion.div>
                              <motion.div className="lp-phone__sys lp-phone__sys--success"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                                📍 GPS pin synced to driver app
                              </motion.div>
                              <motion.div className="lp-phone__msg lp-phone__msg--bot"
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                                Got your location! Pushed to the driver's navigation.
                                They'll find you this time. 🎯
                              </motion.div>
                            </>
                          )}
                        </motion.div>
                      )}

                      {activeTab === 'cod' && (
                        <motion.div
                          key="cod"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="lp-phone__messages"
                        >
                          <div className="lp-phone__sys">
                            💳 COD Order #89422 — ₹1,424
                          </div>
                          <motion.div className="lp-phone__msg lp-phone__msg--bot"
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                            Hey! Pay online now and get ₹50 OFF your order.
                            Scan the UPI QR or tap the link below 👇
                          </motion.div>

                          {chatStep === 0 && (
                            <motion.div className="lp-phone__actions"
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                              <button className="primary" onClick={() => setChatStep(1)}>
                                💳 Pay ₹1,374 Now
                              </button>
                              <button onClick={() => setChatStep(2)}>
                                Keep COD
                              </button>
                            </motion.div>
                          )}

                          {chatStep === 1 && (
                            <>
                              <motion.div className="lp-phone__sys lp-phone__sys--success"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                                ✅ Payment received: ₹1,374 via UPI
                              </motion.div>
                              <motion.div className="lp-phone__msg lp-phone__msg--bot"
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                                Done! Your order is confirmed as prepaid. No cash
                                needed at delivery. Enjoy your ₹50 savings! 🎉
                              </motion.div>
                            </>
                          )}

                          {chatStep === 2 && (
                            <motion.div className="lp-phone__msg lp-phone__msg--bot"
                              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                              No problem! We'll keep it as COD. Just have ₹1,424
                              ready at delivery. 🚚
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ═══ CALCULATOR ═══ */}
      <section className="lp-calc" id="calculator">
        <div className="container">
          <SectionReveal>
            <p className="lp-section-label">ROI Calculator</p>
            <h2 className="lp-calc__title">
              How much are you{' '}
              <em className="lp-serif">actually losing?</em>
            </h2>
          </SectionReveal>

          <SectionReveal delay={0.15}>
            <div className="lp-calc__box">
              <div className="lp-calc__slider-row">
                <label>Monthly Orders</label>
                <span className="lp-calc__slider-val">{volume.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="lp-calc__slider"
              />

              <div className="lp-calc__results">
                <div className="lp-calc__result lp-calc__result--loss">
                  <AnimatedNumber value={rtoLoss} prefix="₹" className="lp-calc__result-num" />
                  <span>monthly RTO loss</span>
                </div>
                <div className="lp-calc__result lp-calc__result--saved">
                  <AnimatedNumber value={saved} prefix="₹" className="lp-calc__result-num" />
                  <span>rescued with RescueShip</span>
                </div>
                <div className="lp-calc__result lp-calc__result--roi">
                  <AnimatedNumber value={Math.round(saved / (annual ? 33588 : 3999))} suffix="x" className="lp-calc__result-num" />
                  <span>return on investment</span>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="lp-pricing" id="pricing">
        <div className="container">
          <SectionReveal>
            <p className="lp-section-label">Pricing</p>
            <h2 className="lp-pricing__title">
              Simple. Transparent.{' '}
              <em className="lp-serif">No per-rescue fees.</em>
            </h2>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <div className="lp-pricing__toggle">
              <span className={!annual ? 'active' : ''}>Monthly</span>
              <button
                className={`lp-pricing__switch ${annual ? 'on' : ''}`}
                onClick={() => setAnnual(!annual)}
                aria-label="Toggle billing cycle"
              >
                <span className="lp-pricing__switch-knob" />
              </button>
              <span className={annual ? 'active' : ''}>
                Annual <em className="lp-pricing__save">−30%</em>
              </span>
            </div>
          </SectionReveal>

          <div className="lp-pricing__grid">
            {PLANS.map((plan, i) => (
              <SectionReveal key={plan.name} delay={i * 0.1}>
                <TiltCard
                  className={`lp-pricing__card ${plan.tag ? 'lp-pricing__card--featured' : ''}`}
                  intensity={5}
                >
                  {plan.tag && (
                    <span className="lp-pricing__badge">{plan.tag}</span>
                  )}
                  <h3>{plan.name}</h3>
                  <p className="lp-pricing__orders">up to {plan.orders} orders/mo</p>
                  <div className="lp-pricing__price">
                    ₹{(annual ? plan.annual : plan.monthly).toLocaleString('en-IN')}
                    <span>/mo</span>
                  </div>
                  <ul className="lp-pricing__features">
                    <li>Autonomous NDR rescue</li>
                    <li>WhatsApp COD conversion</li>
                    <li>3-mode address correction</li>
                    <li>UPI QR payment links</li>
                    {plan.name !== 'Starter' && <li>Real-time SSE dashboard</li>}
                    {plan.name === 'Scale' && <li>CSV data exports</li>}
                    {plan.name === 'Scale' && <li>Priority support SLA</li>}
                  </ul>
                  <Link to="/register">
                    <button className={`lp-btn ${plan.tag ? 'lp-btn--primary' : 'lp-btn--ghost'} lp-btn--full`}>
                      Get Started
                    </button>
                  </Link>
                </TiltCard>
              </SectionReveal>
            ))}
          </div>

          <SectionReveal delay={0.3}>
            <div className="lp-pricing__compare">
              <button className="lp-pricing__compare-btn" onClick={() => setModalOpen(true)}>
                Compare all features →
              </button>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="lp-cta">
        <div className="container">
          <SectionReveal>
            <h2 className="lp-cta__title">
              Stop paying for deliveries
              <br />
              <em className="lp-serif">that never happened.</em>
            </h2>
            <p className="lp-cta__sub">
              Set up in 10 minutes. First rescue in 24 hours. No credit card required.
            </p>
            <Link to="/register">
              <button
                className="lp-btn lp-btn--primary lp-btn--lg"
                ref={ctaMagnetic.ref as any}
                onMouseMove={ctaMagnetic.onMouseMove}
                onMouseLeave={ctaMagnetic.onMouseLeave}
              >
                Start Rescuing Revenue
                <span className="lp-btn__arrow">→</span>
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
              <span className="lp-nav__logo-icon">⚓</span> RescueShip
              <p>Autonomous NDR recovery for Indian D2C brands.</p>
            </div>
            <div className="lp-footer__links">
              <div>
                <h4>Product</h4>
                <a href="#solution">How it works</a>
                <a href="#playground">Live demo</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div>
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Blog</a>
                <a href="#">Careers</a>
              </div>
              <div>
                <h4>Legal</h4>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Security</a>
              </div>
            </div>
          </div>
          <div className="lp-footer__bottom">
            <span>© 2026 RescueShip. Built in India 🇮🇳</span>
            <span>Made with obsession for D2C merchants.</span>
          </div>
        </div>
      </footer>

      {/* Pricing Modal */}
      <AnimatePresence>
        {modalOpen && (
          <PricingComparisonModal onClose={() => setModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
