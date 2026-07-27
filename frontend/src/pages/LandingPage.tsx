import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useLenis } from '../hooks/useLenis';
import { useMagnetic } from '../hooks/useMagnetic';
import { StoryChapter, StoryProgress, ChapterIndicator } from '../components/story/ScrollStory';
import HeroScene from '../components/story/HeroScene';
import CostScene from '../components/story/CostScene';
import RescueScene from '../components/story/RescueScene';
import MarqueeLogos from '../components/motion/MarqueeLogos';
import SectionReveal from '../components/motion/SectionReveal';
import TiltCard from '../components/motion/TiltCard';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import PricingComparisonModal from '../components/PricingComparisonModal';
import './landing.css';

const CYCLES = [
  { key: 'quarterly', label: 'Quarterly', discount: 0, save: '' },
  { key: 'semi', label: 'Semi-Annual', discount: 0.15, save: 'Save 15%' },
  { key: 'annual', label: 'Annual', discount: 0.3, save: 'Save 30%' },
] as const;
type CycleKey = (typeof CYCLES)[number]['key'];

const INTRO_DISCOUNT = 0.4; // first quarter only — the GoDaddy-style hook

const PLANS = [
  {
    name: 'Starter', orders: 2000, base: 2999, tag: '',
    features: [
      'NDR rescue + fake-remark detection',
      'WhatsApp COD → Prepaid + UPI QR',
      '3-mode smart address correction',
      'Escalation chain + cancel / reschedule',
      'Shopify, WooCommerce + 3 couriers',
      'AES-256 encryption + HMAC webhooks',
      'Pause-All kill switch + 90-day audit log',
    ],
  },
  {
    name: 'Growth', orders: 10000, base: 8999, tag: 'Most Popular',
    features: [
      'Everything in Starter, plus:',
      'Real-time live dashboard (SSE)',
      'Revenue-saved & carrier analytics',
      'Email alerts + daily summary',
      'Seller payment alerts on WhatsApp',
    ],
  },
  {
    name: 'Scale', orders: 50000, base: 19999, tag: '',
    features: [
      'Everything in Growth, plus:',
      'CSV / JSON data exports',
      'Dedicated onboarding session',
      'Priority support (24h response)',
    ],
  },
];

const RTO_RATE = 0.15, RTO_COST = 430, RESCUE_RATE = 0.6;

export default function LandingPage() {
  useLenis();
  const storyRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: storyRef, offset: ['start start', 'end end'] });
  const chapter = useTransform(scrollYProgress, [0, 1], [0, 3]);
  const cta = useMagnetic(0.25);

  const [volume, setVolume] = useState(7500);
  const [cycleKey, setCycleKey] = useState<CycleKey>('annual');
  const [modalOpen, setModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cycle = CYCLES.find((c) => c.key === cycleKey)!;
  const loss = Math.round(volume * RTO_RATE * RTO_COST);
  const saved = Math.round(loss * RESCUE_RATE);
  const rec = volume <= 2000 ? PLANS[0] : volume <= 10000 ? PLANS[1] : PLANS[2];
  const recRenew = Math.round(rec.base * (1 - cycle.discount));
  const roi = recRenew > 0 ? Math.round(saved / recRenew) : 0;

  return (
    <div className="lp">
      <div className="lp-ambient" aria-hidden="true">
        <div className="lp-orb lp-orb--1" /><div className="lp-orb lp-orb--2" /><div className="lp-orb lp-orb--3" /><div className="lp-grain" />
      </div>
      <StoryProgress progress={scrollYProgress} />
      <ChapterIndicator current={chapter} total={3} />

      <motion.header className="lp-nav" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}>
        <div className="lp-nav__bar">
          <a href="#" className="lp-nav__logo"><span>⚓</span> RescueShip</a>
          <nav className="lp-nav__links">
            <a href="#cost">Why ₹430?</a>
            <a href="#calculator">ROI Calculator</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="lp-nav__actions">
            <Link to="/login" className="lp-nav__login">Log in</Link>
            <Link to="/register" className="lp-nav__cta">Start Free</Link>
            <button className="lp-nav__menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle Navigation">
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              className="lp-nav__mobile-drawer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <a href="#cost" onClick={() => setMobileMenuOpen(false)}>Why ₹430?</a>
              <a href="#calculator" onClick={() => setMobileMenuOpen(false)}>ROI Calculator</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <div className="lp-nav__mobile-divider" />
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
              <Link to="/register" className="lp-nav__cta" onClick={() => setMobileMenuOpen(false)}>Start Free</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <div ref={storyRef}>
        <StoryChapter scrollHeight="350vh">{(p) => <HeroScene progress={p} />}</StoryChapter>
        <StoryChapter scrollHeight="350vh">{(p) => <CostScene progress={p} />}</StoryChapter>
        <StoryChapter scrollHeight="300vh">{(p) => <RescueScene progress={p} />}</StoryChapter>
      </div>

      <section className="lp-logos"><p className="lp-logos__label">Integrated with your stack</p><MarqueeLogos /></section>

      {/* ── ROI Calculator ── */}
      <section className="lp-calc" id="calculator">
        <div className="container">
          <SectionReveal>
            <p className="scene-label">ROI Calculator</p>
            <h2 className="lp-calc__title">Now calculate <em className="serif">your</em> loss.</h2>
          </SectionReveal>
          <SectionReveal delay={0.12}>
            <div className="lp-calc__box">
              <div className="lp-calc__row">
                <label>Monthly Orders</label>
                <span className="lp-calc__val">{volume.toLocaleString('en-IN')}</span>
              </div>
              <input type="range" min={500} max={50000} step={500} value={volume} onChange={(e) => setVolume(+e.target.value)} className="lp-calc__slider" />
              <p className="lp-calc__rec">Recommended plan for this volume: <strong>{rec.name}</strong></p>

              <div className="lp-calc__results">
                <div className="lp-calc__result lp-calc__result--loss"><AnimatedNumber value={loss} prefix="₹" className="lp-calc__num" /><span>monthly RTO loss</span></div>
                <div className="lp-calc__result lp-calc__result--saved"><AnimatedNumber value={saved} prefix="₹" className="lp-calc__num" /><span>rescued by RescueShip</span></div>
                <div className="lp-calc__result lp-calc__result--roi"><AnimatedNumber value={roi} suffix="x" className="lp-calc__num" /><span>ROI on {rec.name}</span></div>
              </div>
              <p className="lp-calc__assumptions">Assumes {RTO_RATE * 100}% RTO rate · ₹{RTO_COST} avg. loss per RTO · {RESCUE_RATE * 100}% rescue rate · {cycle.label} billing</p>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ── Pricing (3 cycles + intro offer) ── */}
      <section className="lp-pricing" id="pricing">
        <div className="container">
          <SectionReveal>
            <p className="scene-label">Pricing</p>
            <h2 className="lp-pricing__title">Cheaper than <em className="serif">one failed delivery.</em></h2>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <div className="lp-cycle" role="tablist" aria-label="Billing cycle">
              {CYCLES.map((c) => (
                <button key={c.key} className={`lp-cycle__btn ${cycleKey === c.key ? 'active' : ''}`} onClick={() => setCycleKey(c.key)}>
                  {c.label}{c.save && <em>{c.save}</em>}
                </button>
              ))}
            </div>
          </SectionReveal>

          <div className="lp-pricing__grid">
            {PLANS.map((pl, i) => {
              const intro = Math.round(pl.base * (1 - INTRO_DISCOUNT));
              const renew = Math.round(pl.base * (1 - cycle.discount));
              return (
                <SectionReveal key={pl.name} delay={i * 0.1}>
                  <TiltCard className={`lp-pricing__card ${pl.tag ? 'lp-pricing__card--feat' : ''}`} intensity={5}>
                    {pl.tag && <span className="lp-pricing__badge">{pl.tag}</span>}
                    <h3>{pl.name}</h3>
                    <p className="lp-pricing__orders">up to {pl.orders.toLocaleString('en-IN')} orders/mo</p>

                    <span className="lp-pricing__offer-badge">First-quarter offer</span>
                    <div className="lp-pricing__price">₹{intro.toLocaleString('en-IN')}<span>/mo</span></div>
                    <p className="lp-pricing__intro">for your first 3 months</p>
                    <p className="lp-pricing__renew">
                      then <strong>₹{renew.toLocaleString('en-IN')}/mo</strong> · {cycle.label}
                      {cycle.discount > 0 && <em className="lp-pricing__save"> · {cycle.save}</em>}
                    </p>

                    <ul className="lp-pricing__feats">
                      {pl.features.map((f, fi) => (
                        <li key={fi} className={f.startsWith('Everything') ? 'lp-pricing__feats--header' : ''}>{f}</li>
                      ))}
                    </ul>
                    <Link to="/register"><button className={`lp-btn ${pl.tag ? 'lp-btn--primary' : 'lp-btn--ghost'} lp-btn--full`}>Get Started</button></Link>
                  </TiltCard>
                </SectionReveal>
              );
            })}
          </div>

          <SectionReveal delay={0.25}>
            <div className="lp-pricing__compare">
              <button onClick={() => setModalOpen(true)}>Compare all features across plans →</button>
              <span className="lp-pricing__enterprise">Need unlimited volume or a custom SLA? <Link to="/register">Talk to sales</Link></span>
            </div>
          </SectionReveal>
        </div>
      </section>

      <section className="lp-cta">
        <div className="container">
          <SectionReveal>
            <h2 className="lp-cta__title">Stop paying for deliveries<br /><em className="serif">that never happened.</em></h2>
            <p className="lp-cta__sub">Set up in 10 minutes. First rescue in 24 hours. No credit card.</p>
            <Link to="/register">
              <button className="lp-btn lp-btn--primary lp-btn--lg" ref={cta.ref as any} onMouseMove={cta.onMouseMove} onMouseLeave={cta.onMouseLeave}>
                Start Rescuing Revenue <span className="lp-btn__arrow">→</span>
              </button>
            </Link>
          </SectionReveal>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="container">
          <div className="lp-footer__top">
            <div className="lp-footer__brand"><span>⚓</span> RescueShip<p>Autonomous NDR recovery for Indian D2C brands.</p></div>
            <div className="lp-footer__links">
              <div><h4>Product</h4><a href="#cost">The Problem</a><a href="#calculator">ROI</a><a href="#pricing">Pricing</a></div>
              <div><h4>Company</h4><a href="#">About</a><a href="#">Blog</a></div>
              <div><h4>Legal</h4><a href="#">Privacy</a><a href="#">Terms</a></div>
            </div>
          </div>
          <div className="lp-footer__bottom"><span>© 2026 RescueShip. Built in India 🇮🇳</span><span>Made with obsession for D2C merchants.</span></div>
        </div>
      </footer>

      <AnimatePresence>{modalOpen && <PricingComparisonModal cycle={cycle} onClose={() => setModalOpen(false)} />}</AnimatePresence>
    </div>
  );
}
