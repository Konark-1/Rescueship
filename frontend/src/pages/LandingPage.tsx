import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  DeliveryTruckIcon,
  LockedDoorIcon,
  RescueRadarIcon,
  WhatsAppChatIcon,
  PackageDeliveredIcon,
  CheckmarkIcon,
} from '../components/icons';
import { CarrierMarquee } from '../components/CarrierMarquee';
import { SpotlightCard } from '../components/SpotlightCard';
import { BellRing, ShieldCheck, RotateCcw, Scissors } from 'lucide-react';
import { StickyNav } from '../components/landing/StickyNav';
import { AccountabilityScene } from '../components/landing/AccountabilityScene';
import { RescueScene } from '../components/story/RescueScene';
import { IntelligenceCard } from '../components/landing/IntelligenceCard';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { RoiCalculator } from '../components/landing/RoiCalculator';
import { PricingSection } from '../components/landing/PricingSection';
import { TrustStrip } from '../components/landing/TrustStrip';
import { FaqSection } from '../components/landing/FaqSection';
import type { PlanKey } from '../config/pricing.config';
import { springScroll } from '../lib/motion';
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
  // Order #89421 (₹1,240) — Customer home & re-delivery confirmed
  { t: '14:32:07', msg: 'NDR received · AWB 4023118876 · Shiprocket', cls: 'ndr' },
  { t: '14:32:07', msg: 'reason: customer unavailable · attempt 2/3' },
  { t: '14:32:08', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:32:09', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:34:51', msg: 'customer confirmed re-delivery: "I am home"' },
  { t: '14:34:51', msg: 'ORDER RESCUED · ₹1,240 recovered', cls: 'rescued', orderId: '#89421', outcome: 'rescued', amt: 1240 },

  // Order #89435 (₹890) — GPS pin shared & synced
  { t: '14:41:12', msg: 'NDR received · AWB 7719004523 · Delhivery', cls: 'ndr' },
  { t: '14:41:12', msg: 'reason: incomplete address / wrong landmark · attempt 1/3' },
  { t: '14:41:13', msg: 'multiple saved addresses detected · initiating GPS pin flow', cls: 'warn' },
  { t: '14:41:14', msg: 'dispatching rescue → ndr_address_en', cls: 'action' },
  { t: '14:41:15', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:43:02', msg: 'customer shared 1-tap GPS pin on WhatsApp ✓', cls: 'ok' },
  { t: '14:43:03', msg: 'verified GPS address synced → Delhivery API', cls: 'action' },
  { t: '14:43:03', msg: 'ORDER RESCUED · ₹890 recovered', cls: 'rescued', orderId: '#89435', outcome: 'rescued', amt: 890 },

  // Order #89448 (₹2,150) — Cancelled by customer on WhatsApp (Return transit aborted early)
  { t: '14:48:20', msg: 'NDR received · AWB 9921004182 · ClickPost', cls: 'ndr' },
  { t: '14:48:21', msg: 'reason: customer refused · attempt 1/3' },
  { t: '14:48:22', msg: 'dispatching rescue → ndr_retention_en', cls: 'action' },
  { t: '14:48:23', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:49:10', msg: 'customer reply: "Ordered by mistake, please cancel"' },
  { t: '14:49:11', msg: 'ORDER CANCELLED · return transit aborted · ₹160 freight saved', cls: 'cancelled', orderId: '#89448', outcome: 'cancelled' },

  // Order #89452 (₹1,560) — Rescheduled for next morning
  { t: '14:52:30', msg: 'NDR received · AWB 3301998871 · Delhivery', cls: 'ndr' },
  { t: '14:52:31', msg: 'reason: out of station · attempt 1/3' },
  { t: '14:52:32', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:52:33', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:55:18', msg: 'customer rescheduled → Tomorrow, 9 AM–12 PM', cls: 'ok' },
  { t: '14:55:18', msg: 'ORDER RESCUED · ₹1,560 recovered', cls: 'rescued', orderId: '#89452', outcome: 'rescued', amt: 1560 },

  // Order #89467 (₹740) — Cancelled by customer on WhatsApp (Stock returned to store)
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
  { id: '#89460', awb: '5512093844', amount: '₹3,400', status: 'pending' },
  { id: '#89467', awb: '8812903112', amount: '₹740', status: 'pending' },
];

const LOSS_PARTS = [
  { label: 'Ad spend to acquire', amount: 230 },
  { label: 'Forward shipping', amount: 80 },
  { label: 'Reverse shipping (RTO)', amount: 80 },
  { label: 'Repackaging + QC', amount: 40 },
];

const SPINE_STEPS = [
  { n: '01', t: 'NDR intercepted', d: 'A courier logs a failed remark. We catch it in real-time via webhook — before the package starts its return journey.' },
  { n: '02', t: 'WhatsApp rescue dispatched', d: 'Your customer gets a branded message: confirm they’re home, reschedule, drop a GPS pin, or cancel. Their choice, your brand.' },
  { n: '03', t: 'Multiple addresses & GPS resolved', d: 'Shoppers often order with old or multiple saved addresses. RescueShip prompts for a 1-tap live GPS pin, parses with AI, and pushes verified coordinates straight to the courier driver.' },
  { n: '04', t: 'Revenue recovered', d: 'Order delivered on reattempt. COD optionally converted to prepaid via payment link. You keep the money.' },
];

/* ═══ Scroll reel — 8-step timeline told in motion (desktop only) ═══ */
const REEL_BEATS = [
  { tag: '11:20', role: 'engine', t: 'Risk gate runs.', d: 'Pincode history + order value + customer score decide: does this order get a pre-delivery ping?' },
  { tag: '11:43', role: 'move', t: 'Out for delivery.', d: 'The parcel leaves the hub. So far, so normal.' },
  { tag: '11:47', role: 'wound', t: '“Door locked.” No knock.', d: 'Logged four minutes after the scan. No call, no doorbell.' },
  { tag: '11:47', role: 'engine', t: 'RescueShip intercepts.', d: 'The NDR is caught before the return journey begins.' },
  { tag: '11:48', role: 'engine', t: 'WhatsApp: “are you home?”', d: 'Verification, never accusation. The customer taps Yes.' },
  { tag: '11:49', role: 'engine', t: 'Fake attempt escalated. Re-delivery locked.', d: 'Escalation raised · attempt flagged · next-day slot committed to carrier' },
  { tag: '15:20', role: 'rescue', t: 'Delivered. ₹1,240 kept.', d: 'No reverse freight. No repack. No wasted ad spend.' },
  { tag: '15:21', role: 'engine', t: 'The loop learns.', d: 'Outcome + failure source feed your pincode risk index. Tomorrow routes smarter.' },
];

const REEL_ICONS = [
  <BellRing key="risk" size={20} />,
  <DeliveryTruckIcon key="truck" />,
  <LockedDoorIcon key="door" />,
  <RescueRadarIcon key="radar" />,
  <WhatsAppChatIcon key="wa" />,
  <ShieldCheck key="shield" size={20} />,
  <PackageDeliveredIcon key="package" />,
  <RotateCcw key="loop" size={20} />,
];

/* ═══ Helpers ═══ */
function SpawnWords({ text, booted, baseDelay = 0, className = '' }: {
  text: string; booted: boolean; baseDelay?: number; className?: string;
}) {
  return (
    <span className={className}>
      {text.split(' ').map((w, i, arr) => (
        <span key={i}>
          <motion.span
            className="lp-word"
            initial={{ opacity: 0, y: 18 }}
            animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
            transition={{ duration: 0.45, delay: baseDelay + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
          </motion.span>
          {i < arr.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

function CountUp({ target, booted, prefix = '', suffix = '', duration = 1.4, delay = 0, className = '' }: {
  target: number; booted: boolean; prefix?: string; suffix?: string; duration?: number; delay?: number; className?: string;
}) {
  const [val, setVal] = useState(target);
  const prevTargetRef = useRef(target);
  const [slotKey, setSlotKey] = useState(0);

  useEffect(() => {
    if (!booted) return;
    const startVal = prevTargetRef.current;
    const diff = target - startVal;
    prevTargetRef.current = target;
    setSlotKey((k) => k + 1);

    let raf = 0, start = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / (duration * 1000), 1);
        const easeP = 1 - Math.pow(1 - p, 3);
        setVal(Math.floor(startVal + easeP * diff));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay * 1000);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [booted, target, duration, delay]);

  return (
    <motion.span
      key={slotKey}
      className={`lp-slot-num ${className}`}
      initial={{ y: 8, opacity: 0.35 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
    >
      {prefix}{val.toLocaleString('en-IN')}{suffix}
    </motion.span>
  );
}

/* ═══ MAIN LANDING PAGE ═══ */
export default function LandingPage() {
  const navigate = useNavigate();
  const [monthlyOrders, setMonthlyOrders] = useState(1500);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | undefined>(undefined);

  const [reduced, setReduced] = useState(false);
  const [booted, setBooted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const feedCounterRef = useRef(0);
  const [feedLines, setFeedLines] = useState<{ id: string; t: string; msg: string; cls?: string }[]>([]);
  const [feedIdx, setFeedIdx] = useState(0);
  const [recovered, setRecovered] = useState(4_83_750);
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

  /* ── Scroll reel: spring-damped parcel and timeline scrubbing ── */
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const smoothScroll = useSpring(scrollYProgress, springScroll);
  const activeProgress = reduced ? scrollYProgress : smoothScroll;
  const reelTop = useTransform(activeProgress, [0, 1], ['6.25%', '93.75%']);

  /* Beat reveal — 8 steps transforms */
  const bo0 = useTransform(activeProgress, [0, 1], [1, 1]);
  const bo1 = useTransform(activeProgress, [0, 0.05, 0.12, 1], [0, 0, 1, 1]);
  const bo2 = useTransform(activeProgress, [0, 0.19, 0.26, 1], [0, 0, 1, 1]);
  const bo3 = useTransform(activeProgress, [0, 0.33, 0.40, 1], [0, 0, 1, 1]);
  const bo4 = useTransform(activeProgress, [0, 0.47, 0.54, 1], [0, 0, 1, 1]);
  const bo5 = useTransform(activeProgress, [0, 0.61, 0.68, 1], [0, 0, 1, 1]);
  const bo6 = useTransform(activeProgress, [0, 0.75, 0.82, 1], [0, 0, 1, 1]);
  const bo7 = useTransform(activeProgress, [0, 0.89, 0.96, 1], [0, 0, 1, 1]);
  const beatO = [bo0, bo1, bo2, bo3, bo4, bo5, bo6, bo7];

  const by0 = useTransform(activeProgress, [0, 1], [0, 0]);
  const by1 = useTransform(activeProgress, [0, 0.05, 0.12, 1], [24, 24, 0, 0]);
  const by2 = useTransform(activeProgress, [0, 0.19, 0.26, 1], [24, 24, 0, 0]);
  const by3 = useTransform(activeProgress, [0, 0.33, 0.40, 1], [24, 24, 0, 0]);
  const by4 = useTransform(activeProgress, [0, 0.47, 0.54, 1], [24, 24, 0, 0]);
  const by5 = useTransform(activeProgress, [0, 0.61, 0.68, 1], [24, 24, 0, 0]);
  const by6 = useTransform(activeProgress, [0, 0.75, 0.82, 1], [24, 24, 0, 0]);
  const by7 = useTransform(activeProgress, [0, 0.89, 0.96, 1], [24, 24, 0, 0]);
  const beatY = [by0, by1, by2, by3, by4, by5, by6, by7];

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
      <StickyNav />

      {/* 2. BOOT OVERLAY & AMBIENT LAYERS */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div className={`lp-boot ${booted ? 'lp-boot--exit' : ''}`} onClick={skipBoot}
            initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <div className="lp-boot__grid" aria-hidden="true" />
            <div className="lp-boot__term">
              {BOOT_LINES.map((line, i) => (
                <div key={i} className={`lp-boot__line lp-boot__line--${line.cls}`}
                  style={{ animationDelay: `${0.2 + i * 0.32}s` }}>{line.text}</div>
              ))}
              <span className="lp-boot__cursor" />
            </div>
            <div className="lp-boot__bar"><div className="lp-boot__bar-fill" /></div>
            <span className="lp-boot__skip">click to skip</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lp-orb lp-orb--1" aria-hidden="true" />
      <div className="lp-orb lp-orb--2" aria-hidden="true" />
      <div className="lp-orb lp-orb--3" aria-hidden="true" />
      <div className="lp-grid-bg" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />
      <div className="lp-scan" aria-hidden="true" />

      {/* ═══ CHAPTER 01: HERO SECTION (Dark Obsidian Mission Control) ═══ */}
      <section id="product" className="lp-hero">
        <div className="lp-intent">
          <motion.p className="lp-intent__kicker"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            For D2C brands shipping on WhatsApp
          </motion.p>

          <h1 className="lp-intent__h1">
            <span className="lp-intent__line">
              <SpawnWords text="He never" booted={booted} baseDelay={0.35} />{' '}
              <SpawnWords text="knocked." booted={booted} baseDelay={0.58} className="lp-intent__accent" />
            </span>
            <span className="lp-intent__line">
              <SpawnWords text="You lost" booted={booted} baseDelay={0.78} />{' '}
              <SpawnWords text="the sale." booted={booted} baseDelay={1.0} className="lp-intent__accent" />
            </span>
          </h1>

          <motion.p className="lp-intent__sub"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
            transition={{ duration: 0.6, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}>
            Every failed delivery is a wound — forward freight, reverse freight,
            repackaging, wasted ad spend. RescueShip intercepts the NDR, rescues
            the order on WhatsApp, and syncs the fix back to the carrier.
            In 90 seconds. Without a human.
          </motion.p>

          {/* Neutomni Animated A → B Interception Path */}
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

          {submitted ? (
            <motion.div className="lp-pass lp-pass--done"
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}>
              <CheckmarkIcon className="lp-pass__check" />
              <p className="lp-pass__done-t">Integration request received!</p>
              <p className="lp-pass__done-s">Check your inbox — our team will contact you within 24–48 hours to set up your store.</p>
            </motion.div>
          ) : (
            <motion.form className="lp-pass" onSubmit={handleSignup}
              initial={reduced ? false : { opacity: 0, x: -30, y: 10 }}
              animate={booted ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: -30, y: 10 }}
              transition={{ duration: 0.65, delay: 1.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: 'transform, opacity' }}>
              <div className="lp-pass__waybill-bar">
                <span className="lp-pass__serial">RS/PASS.01 // SANDBOX MANIFEST</span>
                <span className="lp-pass__tear">
                  <Scissors size={11} className="waybill-scissors" aria-hidden="true" />
                  TEAR ALONG LINE
                </span>
              </div>
              <div className="lp-pass__grid-2">
                <div className="lp-pass__row">
                  <label className="lp-pass__label">Full name</label>
                  <input className="lp-pass__input" type="text" placeholder="John Doe"
                    autoComplete="name" spellCheck={false}
                    value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="lp-pass__row">
                  <label className="lp-pass__label">Work email</label>
                  <input className="lp-pass__input" type="email" placeholder="founder@yourbrand.com"
                    autoComplete="email" spellCheck={false}
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="lp-pass__row">
                <label className="lp-pass__label">Shopify / WooCommerce store domain</label>
                <input className="lp-pass__input" type="text" placeholder="yourbrand.myshopify.com (or yourstore.com)"
                  autoComplete="url" spellCheck={false}
                  value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} required />
              </div>
              <motion.button
                className="lp-pass__btn"
                type="submit"
                disabled={submitting}
                whileHover={reduced ? {} : { scale: 1.015 }}
                whileTap={reduced ? {} : { scale: 0.985 }}
                transition={{ duration: 0.15 }}
              >
                {submitting ? 'Boarding…' : 'Start rescuing →'}
              </motion.button>
              {error && <p className="lp-pass__err">⚠ {error}</p>}
              <p className="lp-pass__fine">3 free test rescues to your own phone · no card to start</p>
            </motion.form>
          )}
        </div>

        <motion.div className="lp-console"
          initial={reduced ? false : { opacity: 0, y: 50, scale: 0.95 }}
          animate={booted ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ willChange: 'transform, opacity' }}>
          <div className="lp-console__head">
            <span className="lp-console__dot lp-console__dot--r" />
            <span className="lp-console__dot lp-console__dot--a" />
            <span className="lp-console__dot lp-console__dot--g" />
            <span className="lp-console__title">rescue_feed — sample day</span>
            <motion.span className="lp-console__live" animate={reduced ? {} : { opacity: [1, 0.78, 1] }}
              transition={{ duration: 2, repeat: Infinity }}>● DEMO</motion.span>
          </div>

          <div className="lp-console__body">
            <div className="lp-console__channels">
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
                  <motion.div key={line.id}
                    className={`lp-feed__line ${line.cls ? `lp-feed__line--${line.cls}` : ''}`}
                    initial={reduced ? false : { x: -8 }} animate={{ x: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
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
          </div>

          <div className="lp-console__stats">
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={recovered} booted={booted} prefix="₹" delay={0.6} /></span>
              <span className="lp-stat__l">recovered · sample</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={rescuedCount} booted={booted} delay={0.7} /></span>
              <span className="lp-stat__l">orders rescued · sample</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={90} booted={booted} suffix="s" delay={0.8} duration={1} /></span>
              <span className="lp-stat__l">avg intercept</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 5. CARRIER & COMMERCE INTERCEPT MESH & ORDER BOARD */}
      <CarrierMarquee />

      <section className="lp-board">
        <motion.p className="lp-section__kicker" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>Order board · sample</motion.p>
        <div className="lp-board__cols">
          <div className="lp-board__col">
            <div className="lp-board__col-h lp-board__col-h--fail">
              <span>NDR In-Flight</span>
              <span className="lp-board__col-count">{failedOrders.length}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {failedOrders.map((o) => (
                <motion.div key={o.id} layout
                  exit={{ opacity: 0, x: 50, scale: 0.94 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                  <SpotlightCard className="lp-order lp-order--fail" spotlightColor="rgba(244, 63, 94, 0.12)">
                    <span className="lp-order__id">{o.id}</span>
                    <span className="lp-order__awb">AWB {o.awb}</span>
                    <span className="lp-order__amt">{o.amount}</span>
                  </SpotlightCard>
                </motion.div>
              ))}
            </AnimatePresence>
            {failedOrders.length === 0 && (
              <div className="lp-order lp-order--ghost">all NDRs resolved</div>
            )}
          </div>

          <div className="lp-board__arrow" aria-hidden="true">→</div>

          <div className="lp-board__col">
            <div className="lp-board__col-h lp-board__col-h--ok">
              <span>Rescued &amp; Accepted</span>
              <span className="lp-board__col-count">{rescuedOrders.length}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {rescuedOrders.map((o) => (
                <motion.div key={o.id} layout
                  initial={{ opacity: 0, x: -50, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}>
                  <SpotlightCard className="lp-order lp-order--ok" spotlightColor="rgba(16, 185, 129, 0.12)">
                    <span className="lp-order__id">{o.id}</span>
                    <span className="lp-order__awb">AWB {o.awb}</span>
                    <span className="lp-order__amt">{o.amount} ✓</span>
                  </SpotlightCard>
                </motion.div>
              ))}
            </AnimatePresence>
            {rescuedOrders.length === 0 && (
              <div className="lp-order lp-order--ghost">awaiting customer reply…</div>
            )}
          </div>

          <div className="lp-board__col">
            <div className="lp-board__col-h lp-board__col-h--cancel">
              <span>Cancelled by Shopper</span>
              <span className="lp-board__col-count">{cancelledOrders.length}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {cancelledOrders.map((o) => (
                <motion.div key={o.id} layout
                  initial={{ opacity: 0, x: -50, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}>
                  <SpotlightCard className="lp-order lp-order--cancel" spotlightColor="rgba(251, 191, 36, 0.12)">
                    <span className="lp-order__id">{o.id}</span>
                    <span className="lp-order__awb">AWB {o.awb}</span>
                    <span className="lp-order__amt lp-order__amt--cancel">{o.amount} ✕</span>
                  </SpotlightCard>
                </motion.div>
              ))}
            </AnimatePresence>
            {cancelledOrders.length === 0 && (
              <div className="lp-order lp-order--ghost">no cancellations yet</div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ CHAPTER 02: COST & ACCOUNTABILITY (Warm Editorial Paper) ═══ */}
      <div className="lp-chapter lp-chapter--paper">
        <div className="lp-chapter__header" aria-hidden="true">
          <span className="lp-chapter__mark lp-chapter__mark--tl">+</span>
          <span className="lp-chapter__meta">CHAPTER 02 // FINANCIAL BLEED AUDIT</span>
          <span className="lp-chapter__mark lp-chapter__mark--tr">+</span>
        </div>

        {/* 6. COST / LEDGER */}
        <section className="lp-cost">
          <p className="lp-section__kicker">The anatomy of a lost order</p>

          {/* Typographic Visual Equation */}
          <div className="lp-equation" aria-label="Equation: cost of RTO breakdown">
            <div className="lp-equation__item">
              <span className="lp-equation__term">CAC</span>
              <span className="lp-equation__val">₹230</span>
            </div>
            <span className="lp-equation__op">+</span>
            <div className="lp-equation__item">
              <span className="lp-equation__term">Forward</span>
              <span className="lp-equation__val">₹80</span>
            </div>
            <span className="lp-equation__op">+</span>
            <div className="lp-equation__item">
              <span className="lp-equation__term">Reverse</span>
              <span className="lp-equation__val">₹80</span>
            </div>
            <span className="lp-equation__op">+</span>
            <div className="lp-equation__item">
              <span className="lp-equation__term">Repack</span>
              <span className="lp-equation__val">₹40</span>
            </div>
            <span className="lp-equation__op">=</span>
            <div className="lp-equation__item lp-equation__item--total">
              <span className="lp-equation__term">Bleed / RTO</span>
              <span className="lp-equation__val">₹430</span>
            </div>
          </div>

          <div className="lp-cost__shell">
            <div className="lp-cost__total">
              <div className="lp-cost__val">
                <span className="lp-cost__cur">₹</span>
                <span className="lp-cost__n">430</span>
              </div>
              <span className="lp-cost__lbl">average cost per failed delivery — your currency, your math</span>
            </div>
            <div className="lp-cost__bars">
              {LOSS_PARTS.map((p) => (
                <div key={p.label} className="lp-cost__row">
                  <span className="lp-cost__row-l">{p.label}</span>
                  <div className="lp-cost__bar-track">
                    <motion.div
                      className="lp-cost__bar-fill"
                      initial={reduced ? false : { width: 0 }}
                      whileInView={{ width: `${(p.amount / 230) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="lp-cost__row-n">₹{p.amount}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="lp-cost__note">
            At 7,500 orders/mo with a 15% failure rate, that’s 1,125 lost orders.
            Multiply by <strong>your</strong> cost per failure.{' '}
            <em>Modelled projection — your numbers replace these when you connect.</em>
          </p>
          <p className="lp-cost__teaser">
            …and in 4 out of 10 of these &apos;failures&apos;, the courier never knocked.
          </p>
        </section>

        {/* 7. ACCOUNTABILITY SCENE */}
        <AccountabilityScene />
      </div>

      {/* ═══ CHAPTER 03: AUTONOMOUS RESCUE ENGINE (Dark Obsidian) ═══ */}
      <div className="lp-chapter lp-chapter--dark">
        <div className="lp-chapter__header" aria-hidden="true">
          <span className="lp-chapter__mark lp-chapter__mark--tl">+</span>
          <span className="lp-chapter__meta">CHAPTER 03 // AUTONOMOUS RESCUE MESH</span>
          <span className="lp-chapter__mark lp-chapter__mark--tr">+</span>
        </div>

        {/* 8. RESCUE LOOP — spine + interactive WhatsApp proof */}
        <section className="lp-how">
          <div className="lp-how__main">
            <p className="lp-section__kicker">The rescue loop</p>
            <h2 className="lp-how__h2">
              Four stations. <em>Zero humans.</em>
            </h2>
            <div className="lp-spine">
              {SPINE_STEPS.map((s, i) => (
                <div key={s.n} className="lp-spine__node">
                  <div className="lp-spine__rail">
                    <span className="lp-spine__dot">{s.n}</span>
                    {i < SPINE_STEPS.length - 1 && <span className="lp-spine__line" />}
                  </div>
                  <div className="lp-spine__content">
                    <h3>{s.t}</h3>
                    <p>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-how__aside">
            <p className="lp-section__kicker">
              <span className="lp-console__live">● LIVE DEMO</span>
              Autonomous WhatsApp rescue
            </p>
            <RescueScene active={booted} reduced={reduced} />
            <p className="lp-how__aside-note">The customer taps. The carrier syncs. No one on your team lifts a finger.</p>
          </div>
        </section>

        {/* 9. SCROLL REEL — 8-step timeline told in motion */}
        <section className={`lp-reel${reduced ? ' lp-reel--static' : ''}`} aria-label="How a single rescue plays out">
          <div className="lp-reel__track" ref={trackRef}>
            <div className="lp-reel__stage">
              <p className="lp-section__kicker lp-reel__kicker">The same order, in motion</p>
              <div className="lp-reel__grid">
                <div className="lp-reel__route" aria-hidden="true">
                  <span className="lp-reel__line" />
                  {REEL_BEATS.map((b, i) => (
                    <span key={i} className={`lp-reel__dot lp-reel__dot--${b.role}`} />
                  ))}
                  <motion.span
                    className="lp-reel__parcel"
                    style={reduced ? undefined : { top: reelTop }}
                    role="img"
                    aria-label="Delivery parcel"
                  >📦</motion.span>
                </div>
                <ol className="lp-reel__beats">
                  {REEL_BEATS.map((b, i) => (
                    <motion.li
                      key={i}
                      className={`lp-reel__beat lp-reel__beat--${b.role}`}
                      style={reduced ? { opacity: 1 } : { opacity: beatO[i], y: beatY[i] }}
                    >
                      <span className={`lp-reel__tile lp-reel__tile--${b.role}`}>
                        {REEL_ICONS[i]}
                      </span>
                      <span className="lp-reel__beat-txt">
                        <span className="lp-reel__beat-tag">{b.tag}</span>
                        <span className="lp-reel__beat-t">{b.t}</span>
                        <span className="lp-reel__beat-d">{b.d}</span>
                      </span>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ═══ CHAPTER 04: PINCODE INTELLIGENCE & FEATURES (Warm Editorial Paper) ═══ */}
      <div className="lp-chapter lp-chapter--paper">
        <div className="lp-chapter__header" aria-hidden="true">
          <span className="lp-chapter__mark lp-chapter__mark--tl">+</span>
          <span className="lp-chapter__meta">CHAPTER 04 // PINCODE INTELLIGENCE & PLATFORM SPECS</span>
          <span className="lp-chapter__mark lp-chapter__mark--tr">+</span>
        </div>

        {/* 10. INTELLIGENCE CARD */}
        <IntelligenceCard />

        {/* 11. FEATURES GRID */}
        <section id="features">
          <FeaturesGrid />
        </section>
      </div>

      {/* ═══ CHAPTER 05: ROI CALCULATOR & PRICING (Dark Obsidian) ═══ */}
      <div className="lp-chapter lp-chapter--dark">
        <div className="lp-chapter__header" aria-hidden="true">
          <span className="lp-chapter__mark lp-chapter__mark--tl">+</span>
          <span className="lp-chapter__meta">CHAPTER 05 // ECONOMIC RETURN & TARIFF SPECIFICATION</span>
          <span className="lp-chapter__mark lp-chapter__mark--tr">+</span>
        </div>

        {/* 12. ROI CALCULATOR */}
        <RoiCalculator
          orders={monthlyOrders}
          onOrdersChange={setMonthlyOrders}
          selectedPlan={selectedPlan}
        />

        {/* 13. PRICING SECTION */}
        <section id="pricing">
          <PricingSection
            orders={monthlyOrders}
            onOrdersChange={setMonthlyOrders}
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
          />
        </section>
      </div>

      {/* ═══ CHAPTER 06: TRUST & FAQ (Warm Editorial Paper) ═══ */}
      <div className="lp-chapter lp-chapter--paper">
        <div className="lp-chapter__header" aria-hidden="true">
          <span className="lp-chapter__mark lp-chapter__mark--tl">+</span>
          <span className="lp-chapter__meta">CHAPTER 06 // ENTERPRISE COMPLIANCE & PROTOCOL SPEC</span>
          <span className="lp-chapter__mark lp-chapter__mark--tr">+</span>
        </div>

        {/* 14. TRUST STRIP */}
        <TrustStrip />

        {/* 15. FAQ SECTION */}
        <section id="faq">
          <FaqSection />
        </section>
      </div>

      {/* ═══ CHAPTER 07: BOARDING GATE (Dark Obsidian) ═══ */}
      <section className="lp-final">
        <motion.div className="lp-final__panel"
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <div className="lp-final__glow" aria-hidden="true" />
          
          <div className="lp-final__ticket-bar">
            <span className="lp-final__ticket-code">RS/GATE.07 // BOARDING MANIFEST</span>
            <span className="lp-final__ticket-tag">&lt; DRAG TO INTERCEPT &gt;</span>
          </div>

          <span className="lp-final__kicker">ready when you are</span>
          <h2 className="lp-final__h2">Stop losing revenue<br /><em>every single time.</em></h2>
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
