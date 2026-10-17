import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { CarrierMarquee } from '../components/CarrierMarquee';
import { StickyNav } from '../components/landing/StickyNav';
import { SlotCounter } from '../components/landing/SlotCounter';
import { ScrollRevealText } from '../components/landing/ScrollRevealText';
import { HorizontalScrollytelling } from '../components/landing/HorizontalScrollytelling';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { StudioOsWorkspace } from '../components/landing/StudioOsWorkspace';
import { Scissors } from 'lucide-react';
import type { PlanKey } from '../config/pricing.config';
import './landing.css';

/* ═══ BOOT SEQUENCE ═══ */
const BOOT_LINES = [
  { text: 'RescueShip NDR Recovery System', cls: 'brand' },
  { text: '› connecting courier webhooks ………… ✓', cls: 'ok' },
  { text: '› syncing carrier APIs ………… ✓', cls: 'ok' },
  { text: '› loading WhatsApp templates ………… ✓', cls: 'ok' },
  { text: '› automated recovery pipeline ready ………… ✓', cls: 'ok' },
  { text: '✓ system active — monitoring deliveries', cls: 'ready' },
];

/* ═══ SIMULATED RESCUE FEED — Indian couriers & webhooks ═══ */
interface FeedEvent {
  t: string;
  msg: string;
  cls?: 'ndr' | 'action' | 'ok' | 'warn' | 'rescued' | 'cancelled';
  orderId?: string;
  outcome?: 'rescued' | 'cancelled';
  amt?: number;
}

const FEED_SCRIPT: FeedEvent[] = [
  { t: '14:32:07', msg: 'NDR received · AWB 4023118876 · Shiprocket', cls: 'ndr' },
  { t: '14:32:07', msg: 'reason: customer unavailable · attempt 2/3' },
  { t: '14:32:08', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:32:09', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:34:51', msg: 'customer confirmed re-delivery: "I am home"' },
  { t: '14:34:51', msg: 'ORDER RESCUED · ₹1,240 recovered', cls: 'rescued', orderId: '#89421', outcome: 'rescued', amt: 1240 },

  { t: '14:41:12', msg: 'NDR received · AWB 7719004523 · Delhivery', cls: 'ndr' },
  { t: '14:41:12', msg: 'reason: incomplete address / wrong landmark · attempt 1/3' },
  { t: '14:41:13', msg: 'multiple saved addresses detected · initiating GPS pin flow', cls: 'warn' },
  { t: '14:41:14', msg: 'dispatching rescue → ndr_address_en', cls: 'action' },
  { t: '14:41:15', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:43:02', msg: 'customer shared 1-tap GPS pin on WhatsApp ✓', cls: 'ok' },
  { t: '14:43:03', msg: 'verified GPS address synced → Delhivery API', cls: 'action' },
  { t: '14:43:03', msg: 'ORDER RESCUED · ₹890 recovered', cls: 'rescued', orderId: '#89435', outcome: 'rescued', amt: 890 },

  { t: '14:48:20', msg: 'NDR received · AWB 9921004182 · ClickPost', cls: 'ndr' },
  { t: '14:48:21', msg: 'reason: customer refused · attempt 1/3' },
  { t: '14:48:22', msg: 'dispatching rescue → ndr_retention_en', cls: 'action' },
  { t: '14:48:23', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:49:10', msg: 'customer reply: "Ordered by mistake, please cancel"' },
  { t: '14:49:11', msg: 'ORDER CANCELLED · return transit aborted · ₹160 freight saved', cls: 'cancelled', orderId: '#89448', outcome: 'cancelled' },

  { t: '14:52:30', msg: 'NDR received · AWB 3301998871 · Delhivery', cls: 'ndr' },
  { t: '14:52:31', msg: 'reason: out of station · attempt 1/3' },
  { t: '14:52:32', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:52:33', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:55:18', msg: 'customer rescheduled → Tomorrow, 9 AM–12 PM', cls: 'ok' },
  { t: '14:55:18', msg: 'ORDER RESCUED · ₹1,560 recovered', cls: 'rescued', orderId: '#89452', outcome: 'rescued', amt: 1560 },

  { t: '14:57:04', msg: 'NDR received · AWB 8812903112 · Shiprocket', cls: 'ndr' },
  { t: '14:57:05', msg: 'reason: COD cash not ready · attempt 2/3' },
  { t: '14:57:06', msg: 'dispatching 1-click UPI conversion link', cls: 'action' },
  { t: '14:58:12', msg: 'customer opted to cancel on WhatsApp' },
  { t: '14:58:13', msg: 'ORDER CANCELLED · return to hub · stock released in Shopify', cls: 'cancelled', orderId: '#89467', outcome: 'cancelled' },
];

const WATCHED = ['Shiprocket', 'Delhivery', 'ClickPost', 'webhook'];

type OrderStatus = 'failed' | 'pending' | 'rescued' | 'cancelled';
interface OrderCard { id: string; awb: string; amount: string; status: OrderStatus; }
const ORDER_BOARD: OrderCard[] = [
  { id: '#89421', awb: '4023118876', amount: '₹1,240', status: 'failed' },
  { id: '#89435', awb: '7719004523', amount: '₹890', status: 'failed' },
  { id: '#89448', awb: '9921004182', amount: '₹2,150', status: 'failed' },
  { id: '#89452', awb: '3301998871', amount: '₹1,560', status: 'pending' },
  { id: '#89467', awb: '8812903112', amount: '₹740', status: 'pending' },
];

/* ═══ MAIN LANDING PAGE ═══ */
export default function LandingPage() {
  const navigate = useNavigate();
  const [monthlyOrders, setMonthlyOrders] = useState(1500);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | undefined>(undefined);
  const [osTab, setOsTab] = useState<'pricing' | 'watchtower' | 'faq'>('pricing');

  const [reduced, setReduced] = useState(false);
  const [booted, setBooted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const feedCounterRef = useRef(0);
  const [feedLines, setFeedLines] = useState<{ id: string; t: string; msg: string; cls?: string }[]>([]);
  const [feedIdx, setFeedIdx] = useState(0);
  const [recovered, setRecovered] = useState(483750);
  const [rescuedCount, setRescuedCount] = useState(387);
  const [orders, setOrders] = useState<OrderCard[]>(ORDER_BOARD);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.catch(() => {});
    }
  }, []);

  useEffect(() => {
    let r = false;
    try {
      r = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    setReduced(r);

    let seen = false;
    try {
      seen = typeof window !== 'undefined' && !!sessionStorage.getItem('rs_booted');
    } catch {}

    if (r || seen) {
      setShowOverlay(false);
      setBooted(true);
      return;
    }

    setShowOverlay(true);
    const t1 = setTimeout(() => setBooted(true), 1200);
    const t2 = setTimeout(() => {
      setShowOverlay(false);
      try { sessionStorage.setItem('rs_booted', '1'); } catch {}
    }, 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Listen to hash and custom navigation events for OS workspace tab syncing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#faq') setOsTab('faq');
      else if (hash === '#pricing' || hash === '#calculator') setOsTab('pricing');
    };
    handleHash();

    const handleCustomNav = (e: any) => {
      const id = e.detail;
      if (id === 'faq') setOsTab('faq');
      else if (id === 'pricing' || id === 'calculator') setOsTab('pricing');
    };

    window.addEventListener('hashchange', handleHash);
    window.addEventListener('rs:navigate', handleCustomNav);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('rs:navigate', handleCustomNav);
    };
  }, []);

  const skipBoot = () => {
    setBooted(true);
    setShowOverlay(false);
    try { sessionStorage.setItem('rs_booted', '1'); } catch {}
  };

  useEffect(() => {
    if (!booted) return;
    if (feedIdx >= FEED_SCRIPT.length) {
      const reset = setTimeout(() => { setFeedLines([]); setOrders(ORDER_BOARD); setFeedIdx(0); }, 1500);
      return () => clearTimeout(reset);
    }
    const currentEvt = FEED_SCRIPT[feedIdx];
    const delay = currentEvt.cls === 'rescued' || currentEvt.cls === 'cancelled' ? 800 : 350;
    const timer = setTimeout(() => {
      const lineObj = { ...currentEvt, id: `feed-${++feedCounterRef.current}` };
      setFeedLines((prev) => [...prev.slice(-8), lineObj]);
      setFeedIdx((i) => i + 1);
      if (currentEvt.outcome === 'rescued') {
        const amt = currentEvt.amt || 1000;
        setRecovered((r) => r + amt);
        setRescuedCount((c) => c + 1);
        setOrders((prev) => {
          const idx = currentEvt.orderId ? prev.findIndex((o) => o.id === currentEvt.orderId) : prev.findIndex((o) => o.status === 'failed' || o.status === 'pending');
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'rescued' };
          return next;
        });
      } else if (currentEvt.outcome === 'cancelled') {
        setOrders((prev) => {
          const idx = currentEvt.orderId ? prev.findIndex((o) => o.id === currentEvt.orderId) : prev.findIndex((o) => o.status === 'failed' || o.status === 'pending');
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'cancelled' };
          return next;
        });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [booted, feedIdx]);

  useEffect(() => {
    if (!booted) return;
    const iv = setInterval(() => setRecovered((r) => r + Math.floor(Math.random() * 80 + 20)), 5000);
    return () => clearInterval(iv);
  }, [booted]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !storeUrl) return;
    setSubmitting(true); setError(null);
    try {
      await api.post('/api/plg/signup', { name, email, storeUrl });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Signup failed. Try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const failedOrders = orders.filter((o) => o.status === 'failed' || o.status === 'pending');
  const rescuedOrders = orders.filter((o) => o.status === 'rescued');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

  return (
    <div className="lp">
      {/* 1. STICKY NAV */}
      <StickyNav
        onNavigate={(targetId) => {
          if (targetId === 'pricing' || targetId === 'calculator') setOsTab('pricing');
          else if (targetId === 'faq') setOsTab('faq');
        }}
      />

      {/* 2. BOOT SEQUENCE OVERLAY */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="lp-boot"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={skipBoot}
            role="status"
            aria-live="polite"
          >
            <div className="lp-boot__grid" />
            <div className="lp-boot__term">
              {BOOT_LINES.map((line, i) => (
                <div
                  key={line.text}
                  className={`lp-boot__line lp-boot__line--${line.cls}`}
                  style={{ animationDelay: `${i * 0.18}s` }}
                >
                  {line.text}
                </div>
              ))}
              <span className="lp-boot__cursor" />
            </div>
            <div className="lp-boot__bar">
              <div className="lp-boot__bar-fill" />
            </div>
            <button className="lp-boot__skip" onClick={skipBoot}>
              [space / click to skip]
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Grid & Scan */}
      <div className="lp-grid-bg" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />
      <div className="lp-scan" aria-hidden="true" />

      {/* ═══════════════════════════════════════════════════════════════
          CHAPTER 01: HERO & COMMAND CENTER (Matte Carbon Surface)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lp-chapter lp-chapter--dark">
        <section className="lp-hero" aria-label="RescueShip overview">
          <div className="lp-hero__content">
            <motion.div
              className="lp-hero__kicker"
              initial={reduced ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="lp-hero__kicker-dot" />
              <span>RESCUESHIP // AUTONOMOUS NDR RECOVERY // 90-SECOND SLA</span>
            </motion.div>

            <motion.div
              className="lp-hero__lead"
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <h1 className="lp-intent__h1 nt-display">
                He never knocked.{' '}
                <em className="nt-serif">Intercept the lie.</em>
              </h1>
              <p className="lp-hero__sub">
                When a delivery partner logs fake &apos;Customer Unavailable&apos;, RescueShip verifies buyer presence on WhatsApp, collects 1-tap re-delivery time, and overrides the carrier scan in 90 seconds.
              </p>
            </motion.div>

            {/* Sleek 1-Line Command Bar */}
            <div className="nt-hero-cmd">
              <div className="nt-hero-cmd__input-wrap">
                <span className="nt-hero-cmd__icon">shopify://</span>
                <input
                  type="text"
                  className="nt-hero-cmd__input"
                  placeholder="yourbrand.myshopify.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="nt-hero-cmd__btn"
                onClick={() => {
                  const passEl = document.querySelector('.lp-pass');
                  passEl?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Start Rescuing →
              </button>
            </div>

            {/* Neutomni Directional A → B Path */}
            <div className="lp-ab-path" aria-label="Autonomous interception path">
              <div className="lp-ab-node lp-ab-node--a">
                <span className="lp-ab-node__tag">NODE A</span>
                <span className="lp-ab-node__title">Fake NDR Scan</span>
                <span className="lp-ab-node__time">11:47:02</span>
              </div>
              <div className="lp-ab-path__mid">
                <svg className="lp-ab-path__svg" viewBox="0 0 160 20" fill="none" preserveAspectRatio="none">
                  <line x1="0" y1="10" x2="160" y2="10" stroke="var(--border-hover)" strokeWidth="2" strokeDasharray="5 5" />
                  <motion.g
                    animate={reduced ? { x: 160 } : { x: [0, 160] }}
                    transition={reduced ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <circle cx="0" cy="10" r="4" fill="var(--emerald)" />
                  </motion.g>
                </svg>
                <span className="lp-ab-path__label">90s WhatsApp Intercept</span>
              </div>
              <div className="lp-ab-node lp-ab-node--b">
                <span className="lp-ab-node__tag">NODE B</span>
                <span className="lp-ab-node__title">Re-Delivery Locked</span>
                <span className="lp-ab-node__time">11:48:32</span>
              </div>
            </div>

            {/* Perforated Waybill Boarding Ticket / Lead Capture Form */}
            {submitted ? (
              <motion.div
                className="lp-pass lp-pass--done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="lp-pass__done-h">
                  <span className="lp-pass__done-i">✓</span>
                  <div className="lp-pass__done-t">Integration request received · Added to manifest</div>
                </div>
                <p className="lp-pass__done-d">
                  Our integrations desk will provision your WhatsApp Cloud API webhook credentials within 24-48 hours. A verification dispatch was delivered to <strong>{email}</strong>.
                </p>
                <div className="lp-pass__done-steps">
                  <div className="lp-pass__done-s">
                    <span className="lp-pass__done-s-n">1</span>
                    <span>Meta Business WhatsApp Number verified</span>
                  </div>
                  <div className="lp-pass__done-s">
                    <span className="lp-pass__done-s-n">2</span>
                    <span>Carrier webhook listener armed (90s SLA)</span>
                  </div>
                  <div className="lp-pass__done-s">
                    <span className="lp-pass__done-s-n">3</span>
                    <span>Autonomous RTO shield active</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="lp-pass__btn lp-pass__btn--ghost"
                  onClick={() => { setSubmitted(false); setName(''); setEmail(''); setStoreUrl(''); }}
                >
                  Register another store
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSignup} className="lp-pass" aria-label="Lead capture boarding pass">
                <div className="lp-pass__waybill-bar">
                  <span className="lp-pass__serial">RS/PASS.01 // BOARDING SPEC</span>
                  <span className="lp-pass__tear">
                    <Scissors size={12} aria-hidden="true" /> TEAR ALONG LINE
                  </span>
                </div>

                <div className="lp-pass__grid">
                  <div className="lp-pass__f">
                    <label className="lp-pass__l" htmlFor="hero-name">Full name</label>
                    <input
                      id="hero-name"
                      type="text"
                      className="lp-pass__input"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className="lp-pass__f">
                    <label className="lp-pass__l" htmlFor="hero-email">Work email</label>
                    <input
                      id="hero-email"
                      type="email"
                      className="lp-pass__input"
                      placeholder="growth@testbrand.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="lp-pass__f">
                    <label className="lp-pass__l" htmlFor="hero-store">Shopify / WooCommerce store</label>
                    <input
                      id="hero-store"
                      type="text"
                      className="lp-pass__input"
                      placeholder="yourbrand.myshopify.com"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && <div className="lp-pass__err" role="alert">{error}</div>}

                <button
                  type="submit"
                  className="lp-pass__btn"
                  disabled={submitting}
                >
                  {submitting ? 'Generating Boarding Pass…' : 'Generate Boarding Pass →'}
                </button>

                <div className="lp-pass__foot">
                  <span>3 free test rescues to your phone</span>
                  <span className="lp-pass__foot-dot">·</span>
                  <span>Zero developer setup required</span>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: Live Terminal Telemetry Feed & Stats */}
          <motion.div
            className="lp-console"
            initial={reduced ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="lp-console__header">
              <span className="lp-console__dot" />
              <span className="lp-console__title">rescueship://telemetry/live-feed</span>
              <span className="lp-console__tag">AUTONOMOUS SYS.v3</span>
            </div>

            <div className="lp-console__mesh">
              <span className="lp-console__watch">watching</span>
              {WATCHED.map((c, i) => (
                <span key={c} className="lp-console__chip">
                  <i style={{ animationDelay: `${i * 0.4}s` }} /> {c}
                </span>
              ))}
            </div>

            <div className="lp-console__scroll">
              <AnimatePresence mode="popLayout">
                {feedLines.map((line) => (
                  <motion.div
                    key={line.id}
                    className={`lp-feed__line ${line.cls ? `lp-feed__line--${line.cls}` : ''}`}
                    initial={reduced ? false : { x: -8 }}
                    animate={{ x: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <span className="lp-feed__t">{line.t}</span>
                    <span className="lp-feed__prefix">›</span>
                    <span className="lp-feed__msg">{line.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {feedLines.length === 0 && (
                <div className="lp-feed__line lp-feed__line--idle">
                  <span className="lp-feed__prefix">›</span>
                  <span className="lp-feed__msg">awaiting next NDR event…</span>
                </div>
              )}
            </div>

            <div className="lp-console__stats">
              <div className="lp-stat">
                <span className="lp-stat__n">
                  ₹<SlotCounter value={recovered} />
                </span>
                <span className="lp-stat__l">recovered · sample</span>
              </div>
              <div className="lp-stat">
                <span className="lp-stat__n">
                  <SlotCounter value={rescuedCount} />
                </span>
                <span className="lp-stat__l">orders rescued · sample</span>
              </div>
              <div className="lp-stat">
                <span className="lp-stat__n">
                  <SlotCounter value="90s" />
                </span>
                <span className="lp-stat__l">avg intercept</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Carrier Intercept Mesh Marquee */}
        <CarrierMarquee />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CHAPTER 02: THE FAKE ATTEMPT MANIFESTO (Warm Alabaster Paper)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lp-chapter lp-chapter--paper">
        <div className="lp-chapter__header" aria-hidden="true">
          <span className="lp-chapter__mark lp-chapter__mark--tl">+</span>
          <span className="lp-chapter__meta">CHAPTER 02 // THE FAKE ATTEMPT MANIFESTO</span>
          <span className="lp-chapter__mark lp-chapter__mark--tr">+</span>
        </div>

        <ScrollRevealText />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CHAPTER 03: HORIZONTAL SCROLLYTELLING (Matte Carbon Surface)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lp-chapter lp-chapter--dark">
        <HorizontalScrollytelling
          booted={booted}
          failedOrders={failedOrders}
          rescuedOrders={rescuedOrders}
          cancelledOrders={cancelledOrders}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CHAPTER 04: AUTONOMOUS SYSTEMS BENTO (Matte Carbon Surface)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lp-chapter lp-chapter--dark">
        <FeaturesGrid />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CHAPTER 05: STUDIO OS WORKSPACE (Warm Alabaster Paper Surface)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lp-chapter lp-chapter--paper">
        <div className="lp-chapter__header" aria-hidden="true">
          <span className="lp-chapter__mark lp-chapter__mark--tl">+</span>
          <span className="lp-chapter__meta">CHAPTER 05 // STUDIO OS WORKSPACE</span>
          <span className="lp-chapter__mark lp-chapter__mark--tr">+</span>
        </div>

        <StudioOsWorkspace
          orders={monthlyOrders}
          onOrdersChange={setMonthlyOrders}
          selectedPlan={selectedPlan || 'prevent'}
          onSelectPlan={setSelectedPlan}
          activeTab={osTab}
          onTabChange={setOsTab}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CHAPTER 06: BOARDING GATE & WAYBILL FOOTER (Matte Carbon)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="lp-final">
        <motion.div
          className="lp-final__panel"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lp-final__ticket-bar">
            <span className="lp-final__ticket-code">RS/GATE.07 // BOARDING MANIFEST</span>
            <span className="lp-final__ticket-tag">&lt; DRAG TO INTERCEPT &gt;</span>
          </div>

          <span className="lp-final__kicker">ready when you are</span>
          <h2 className="lp-final__h2 nt-display">
            Stop losing revenue<br />
            <em className="nt-serif">every single time.</em>
          </h2>
          <p className="lp-final__sub">
            Connect your store, verify WhatsApp, link your carrier.
            Live in four minutes — no sales call, no demo.
          </p>

          {/* Interactive Drag to Intercept Slider */}
          {!reduced && (
            <div className="lp-drag-gate" aria-label="Slide to board RescueShip">
              <div className="lp-drag-gate__track">
                <motion.div
                  className="lp-drag-gate__handle"
                  drag="x"
                  dragConstraints={{ left: 0, right: 180 }}
                  dragElastic={0.08}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 120) {
                      navigate('/register');
                    }
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="lp-drag-gate__icon">⚓</span>
                  <span className="lp-drag-gate__text">DRAG TO INTERCEPT →</span>
                </motion.div>
                <span className="lp-drag-gate__hint">SLIDE TO REGISTER MANIFEST</span>
              </div>
            </div>
          )}

          <div className="lp-final__actions">
            <Link to="/register" className="lp-final__btn">Board the ship →</Link>
            <Link to="/register" className="lp-final__btn lp-final__btn--secondary">or send yourself a test rescue →</Link>
          </div>
          <div className="lp-final__chips">
            <span>no credit card</span><span>no sales call</span><span>live in 4 min</span>
          </div>
        </motion.div>
      </section>

      {/* 17. FOOTER */}
      <footer className="lp-foot">
        <span className="lp-foot__brand">
          <span className="lp-brand__mark" aria-hidden="true">⚓</span>
          <strong>RescueShip</strong>
          <span className="lp-foot__tag">autonomous ndr rescue · whatsapp</span>
        </span>
        <span className="lp-foot__links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/dpa">DPDP Addendum</Link>
          <Link to="/login">Log in</Link>
          <Link to="/register" className="lp-foot__cta">Get started →</Link>
        </span>
      </footer>
    </div>
  );
}
