import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Link } from 'react-router-dom';
import './landing.css';

/* ═══════════════════════════════════════════
   BOOT SEQUENCE — the engine starts before the page does
   ═══════════════════════════════════════════ */
const BOOT_LINES = [
  { text: '⚓ rescueship v2.4 — autonomous recovery engine', cls: 'brand' },
  { text: '› binding webhook listeners ………… ✓', cls: 'ok' },
  { text: '› connecting carrier APIs ………… ✓', cls: 'ok' },
  { text: '› loading rescue templates ………… ✓', cls: 'ok' },
  { text: '› arming intercept pipeline ………… ✓', cls: 'ok' },
  { text: '✓ system ready — watching for NDRs', cls: 'ready' },
];

/* ═══════════════════════════════════════════
   SIMULATED RESCUE FEED — universal carriers, not India-only
   ═══════════════════════════════════════════ */
const FEED_SCRIPT: { t: string; msg: string; cls?: string }[] = [
  { t: '14:32:07', msg: 'NDR received · AWB 4023118876 · Shiprocket', cls: 'ndr' },
  { t: '14:32:07', msg: 'reason: customer unavailable · attempt 2/3' },
  { t: '14:32:08', msg: 'dispatching rescue → ndr_rescue_en', cls: 'action' },
  { t: '14:32:09', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:34:51', msg: 'customer confirmed re-delivery' },
  { t: '14:34:51', msg: 'ORDER RESCUED · ₹1,240 recovered', cls: 'rescued' },
  { t: '14:41:12', msg: 'NDR received · AWB 7719004523 · Delhivery', cls: 'ndr' },
  { t: '14:41:12', msg: 'reason: door locked · attempt 1/3' },
  { t: '14:41:13', msg: 'fake-remark score: 0.87 · flagging', cls: 'warn' },
  { t: '14:41:14', msg: 'dispatching rescue → ndr_rescue_en', cls: 'action' },
  { t: '14:41:15', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:43:02', msg: 'customer shared GPS pin ✓', cls: 'ok' },
  { t: '14:43:03', msg: 'address synced → carrier API', cls: 'action' },
  { t: '14:43:03', msg: 'ORDER RESCUED · ₹890 recovered', cls: 'rescued' },
  { t: '14:52:30', msg: 'NDR received · AWB JNE-8823174 · carrier-webhook', cls: 'ndr' },
  { t: '14:52:31', msg: 'reason: out of station · attempt 1/3' },
  { t: '14:52:32', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:52:33', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:55:18', msg: 'customer rescheduled → Jul 30', cls: 'ok' },
  { t: '14:55:18', msg: 'ORDER RESCUED · $12.60 recovered', cls: 'rescued' },
];

/* ═══════════════════════════════════════════
   ORDER BOARD + LOSS PARTS
   ═══════════════════════════════════════════ */
type OrderStatus = 'failed' | 'pending' | 'rescued';
interface OrderCard { id: string; awb: string; amount: string; status: OrderStatus; }

const ORDER_BOARD: OrderCard[] = [
  { id: '#89421', awb: '4023118876', amount: '₹1,240', status: 'failed' },
  { id: '#89435', awb: '7719004523', amount: '₹890', status: 'failed' },
  { id: '#89448', awb: 'JNE-8823174', amount: '$12.60', status: 'failed' },
  { id: '#89452', awb: '3301998871', amount: '₹1,560', status: 'pending' },
  { id: '#89460', awb: '9917234456', amount: 'R$47', status: 'pending' },
];

const LOSS_PARTS = [
  { label: 'Ad spend to acquire', amount: 230 },
  { label: 'Forward shipping', amount: 80 },
  { label: 'Reverse shipping (RTO)', amount: 80 },
  { label: 'Repackaging + QC', amount: 40 },
];

const SPINE_STEPS = [
  { n: '01', t: 'NDR intercepted', d: 'A courier logs a failed remark. We catch it in real-time via webhook — before the package starts its return journey.' },
  { n: '02', t: 'WhatsApp rescue dispatched', d: 'Your customer gets a branded message: confirm they\'re home, reschedule, drop a GPS pin, or cancel. Their choice, your brand.' },
  { n: '03', t: 'Address synced to carrier', d: 'Corrected address or pin pushed directly to the driver app via carrier API. No phone calls. No manual entry.' },
  { n: '04', t: 'Revenue recovered', d: 'Order delivered. COD optionally converted to prepaid via payment link. You keep the money.' },
];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

/** Word-by-word spawn reveal */
function SpawnWords({ text, booted, baseDelay = 0, className = '' }: {
  text: string; booted: boolean; baseDelay?: number; className?: string;
}) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="lp-word"
          initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
          animate={booted ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.55, delay: baseDelay + i * 0.065, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}{' '}
        </motion.span>
      ))}
    </span>
  );
}

/** Animated count-up */
function CountUp({ target, booted, prefix = '', suffix = '', duration = 1.6, delay = 0 }: {
  target: number; booted: boolean; prefix?: string; suffix?: string; duration?: number; delay?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!booted) return;
    let raf: number;
    let start: number;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / (duration * 1000), 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.floor(eased * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay * 1000);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [booted, target, duration, delay]);
  return <>{prefix}{val.toLocaleString('en-IN')}{suffix}</>;
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function LandingPage() {
  /* ── boot state ── */
  const [booted, setBooted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  /* ── feed state ── */
  const [feedLines, setFeedLines] = useState<typeof FEED_SCRIPT>([]);
  const [feedIdx, setFeedIdx] = useState(0);

  /* ── counters ── */
  const [recovered, setRecovered] = useState(4_83_750);
  const [rescuedCount, setRescuedCount] = useState(387);

  /* ── order board ── */
  const [orders, setOrders] = useState<OrderCard[]>(ORDER_BOARD);

  /* ── signup ── */
  const [email, setEmail] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── scroll reveal ── */
  const lossRef = useRef<HTMLDivElement>(null);
  const lossIn = useInView(lossRef, { once: true, margin: '-80px' });

  /* ── BOOT SEQUENCE ── */
  useEffect(() => {
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    let seen = false;
    try { seen = !!sessionStorage.getItem('rs_booted'); } catch {}

    if (reduced || seen) {
      setBooted(true);
      setShowOverlay(false);
      return;
    }
    const t1 = setTimeout(() => setBooted(true), 2300);
    const t2 = setTimeout(() => {
      setShowOverlay(false);
      try { sessionStorage.setItem('rs_booted', '1'); } catch {}
    }, 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const skipBoot = useCallback(() => {
    setBooted(true);
    setShowOverlay(false);
    try { sessionStorage.setItem('rs_booted', '1'); } catch {}
  }, []);

  /* ── FEED AUTO-PLAY (starts after boot) ── */
  useEffect(() => {
    if (!booted) return;
    if (feedIdx >= FEED_SCRIPT.length) {
      const reset = setTimeout(() => { setFeedLines([]); setOrders(ORDER_BOARD); setFeedIdx(0); }, 1500);
      return () => clearTimeout(reset);
    }
    const delay = FEED_SCRIPT[feedIdx].cls === 'rescued' ? 800 : 350;
    const timer = setTimeout(() => {
      setFeedLines((prev) => [...prev.slice(-7), FEED_SCRIPT[feedIdx]]);
      setFeedIdx((i) => i + 1);
      if (FEED_SCRIPT[feedIdx].cls === 'rescued') {
        const m = FEED_SCRIPT[feedIdx].msg.match(/[\d,.]+/);
        const amt = m ? Math.round(parseFloat(m[0].replace(',', '')) * 60) : 80;
        setRecovered((r) => r + amt);
        setRescuedCount((c) => c + 1);
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.status === 'failed');
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'rescued' };
          return next;
        });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [booted, feedIdx]);

  /* ── AMBIENT RECOVERY TICK ── */
  useEffect(() => {
    if (!booted) return;
    const iv = setInterval(() => setRecovered((r) => r + Math.floor(Math.random() * 80 + 20)), 5000);
    return () => clearInterval(iv);
  }, [booted]);

  /* ── SIGNUP ── */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !storeUrl) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/plg/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, storeUrl }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Signup failed. Try again.');
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const failedOrders = orders.filter((o) => o.status === 'failed' || o.status === 'pending');
  const rescuedOrders = orders.filter((o) => o.status === 'rescued');

  /* ═══ RENDER ═══ */
  return (
    <div className="lp">

      {/* ── BOOT OVERLAY ── */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className={`lp-boot ${booted ? 'lp-boot--exit' : ''}`}
            onClick={skipBoot}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="lp-boot__grid" aria-hidden="true" />
            <div className="lp-boot__term">
              {BOOT_LINES.map((line, i) => (
                <div key={i} className={`lp-boot__line lp-boot__line--${line.cls}`}
                  style={{ animationDelay: `${0.2 + i * 0.32}s` }}>
                  {line.text}
                </div>
              ))}
              <span className="lp-boot__cursor" />
            </div>
            <div className="lp-boot__bar">
              <div className="lp-boot__bar-fill" />
            </div>
            <span className="lp-boot__skip">click to skip</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAYERED BACKGROUND ── */}
      <div className="lp-grid-bg" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />
      <div className="lp-scan" aria-hidden="true" />

      {/* ── TOP BAR ── */}
      <motion.header
        className="lp-top"
        initial={{ opacity: 0, y: -16 }}
        animate={booted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <a href="/" className="lp-brand"><span>⚓</span> RescueShip</a>
        <span className="lp-top__tag">Autonomous NDR Rescue</span>
        <nav className="lp-top__nav">
          <Link to="/login" className="lp-top__link">Log in</Link>
          <Link to="/register" className="lp-top__cta">Get started</Link>
        </nav>
      </motion.header>

      {/* ═══ HERO: console left, intent right ═══ */}
      <section className="lp-hero">

        {/* LEFT — the live interception console */}
        <motion.div
          className="lp-console"
          initial={{ opacity: 0, y: 60, scale: 0.92 }}
          animate={booted ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="lp-console__head">
            <span className="lp-console__dot lp-console__dot--r" />
            <span className="lp-console__dot lp-console__dot--a" />
            <span className="lp-console__dot lp-console__dot--g" />
            <span className="lp-console__title">rescue_feed — live interception</span>
            <motion.span
              className="lp-console__live"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >● LIVE</motion.span>
          </div>

          <div className="lp-console__body">
            <AnimatePresence mode="popLayout">
              {feedLines.map((line, i) => (
                <motion.div
                  key={`${feedIdx}-${i}`}
                  className={`lp-feed__line ${line.cls ? `lp-feed__line--${line.cls}` : ''}`}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
                <CountUp target={recovered} booted={booted} prefix="₹" delay={0.6} />
              </span>
              <span className="lp-stat__l">recovered today</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n">
                <CountUp target={rescuedCount} booted={booted} delay={0.7} />
              </span>
              <span className="lp-stat__l">orders rescued</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n">
                <CountUp target={90} booted={booted} suffix="s" delay={0.8} duration={1} />
              </span>
              <span className="lp-stat__l">avg intercept</span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT — intent + boarding pass */}
        <div className="lp-intent">
          <motion.p
            className="lp-intent__kicker"
            initial={{ opacity: 0, y: 16 }}
            animate={booted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            For D2C brands shipping on WhatsApp
          </motion.p>

          <h1 className="lp-intent__h1">
            <SpawnWords text="He never" booted={booted} baseDelay={0.35} />
            <SpawnWords text="knocked." booted={booted} baseDelay={0.55} className="lp-intent__accent" />
            <br />
            <SpawnWords text="You lost" booted={booted} baseDelay={0.7} />
            <SpawnWords text="the sale." booted={booted} baseDelay={0.85} className="lp-intent__accent" />
          </h1>

          <motion.p
            className="lp-intent__sub"
            initial={{ opacity: 0 }}
            animate={booted ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            Every failed delivery is a wound — forward freight, reverse freight,
            repackaging, wasted ad spend. RescueShip intercepts the NDR, rescues
            the order on WhatsApp, and syncs the fix back to the carrier.
            In 90 seconds. Without a human.
          </motion.p>

          {submitted ? (
            <motion.div
              className="lp-pass lp-pass--done"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <svg viewBox="0 0 24 24" className="lp-pass__check"><path d="M5 13l4 4L19 7" /></svg>
              <p className="lp-pass__done-t">You're on the manifest.</p>
              <p className="lp-pass__done-s">Check your inbox — your test rescue is on its way.</p>
            </motion.div>
          ) : (
            <motion.form
              className="lp-pass"
              onSubmit={handleSignup}
              initial={{ opacity: 0, x: 48 }}
              animate={booted ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: 'transform, opacity' }}
            >
              <div className="lp-pass__row">
                <label className="lp-pass__label">Work email</label>
                <input className="lp-pass__input" type="email" placeholder="founder@yourbrand.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="lp-pass__row">
                <label className="lp-pass__label">Store URL</label>
                <input className="lp-pass__input" type="url" placeholder="yourbrand.myshopify.com"
                  value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} required />
              </div>
              <button className="lp-pass__btn" type="submit" disabled={submitting}>
                {submitting ? 'Boarding…' : 'Start rescuing →'}
              </button>
              {error && <p className="lp-pass__err">⚠ {error}</p>}
              <p className="lp-pass__fine">Free test rescue · no card · live in 4 minutes</p>
            </motion.form>
          )}
        </div>
      </section>

      {/* ═══ ORDER BOARD: FAILED → RESCUED ═══ */}
      <section className="lp-board">
        <motion.p className="lp-section__kicker"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>
          Live order board
        </motion.p>
        <div className="lp-board__cols">
          <div className="lp-board__col">
            <span className="lp-board__col-h lp-board__col-h--fail">Failed / Pending</span>
            <AnimatePresence mode="popLayout">
              {failedOrders.map((o) => (
                <motion.div key={o.id} className="lp-order lp-order--fail" layout
                  exit={{ opacity: 0, x: 70, scale: 0.92 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <span className="lp-order__id">{o.id}</span>
                  <span className="lp-order__awb">AWB {o.awb}</span>
                  <span className="lp-order__amt">{o.amount}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="lp-board__arrow" aria-hidden="true">→</div>
          <div className="lp-board__col">
            <span className="lp-board__col-h lp-board__col-h--ok">Rescued</span>
            <AnimatePresence mode="popLayout">
              {rescuedOrders.map((o) => (
                <motion.div key={o.id} className="lp-order lp-order--ok" layout
                  initial={{ opacity: 0, x: -70, scale: 0.92 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}>
                  <span className="lp-order__id">{o.id}</span>
                  <span className="lp-order__awb">AWB {o.awb}</span>
                  <span className="lp-order__amt">{o.amount} ✓</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ═══ THE COST: ledger breakdown ═══ */}
      <section className="lp-cost" ref={lossRef}>
        <motion.p className="lp-section__kicker"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>
          The anatomy of a lost order
        </motion.p>
        <div className="lp-cost__shell">
          <div className="lp-cost__total">
            <span className="lp-cost__cur">₹</span>
            <motion.span className="lp-cost__n"
              initial={{ opacity: 0.2, scale: 0.9 }}
              animate={lossIn ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}>
              430
            </motion.span>
            <span className="lp-cost__lbl">
              average cost per failed delivery — your currency, your math
            </span>
          </div>
          <div className="lp-cost__bars">
            {LOSS_PARTS.map((p, i) => (
              <motion.div key={p.label} className="lp-cost__row"
                initial={{ opacity: 0, x: -20 }}
                animate={lossIn ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}>
                <span className="lp-cost__row-l">{p.label}</span>
                <div className="lp-cost__bar-track">
                  <motion.div className="lp-cost__bar-fill"
                    initial={{ width: 0 }}
                    animate={lossIn ? { width: `${(p.amount / 230) * 100}%` } : {}}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }} />
                </div>
                <span className="lp-cost__row-n">₹{p.amount}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.p className="lp-cost__note"
          initial={{ opacity: 0 }} animate={lossIn ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}>
          At 7,500 orders/mo with a 15% failure rate, that's 1,125 lost orders.
          Multiply by <strong>your</strong> cost per failure.{' '}
          <em>Modelled projection — your numbers replace these when you connect.</em>
        </motion.p>
      </section>

      {/* ═══ HOW IT WORKS: the spine ═══ */}
      <section className="lp-how">
        <motion.p className="lp-section__kicker"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>
          The rescue loop
        </motion.p>
        <motion.h2 className="lp-how__h2"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          Four stations. <em>Zero humans.</em>
        </motion.h2>
        <div className="lp-spine">
          {SPINE_STEPS.map((s, i) => (
            <motion.div key={s.n} className="lp-spine__node"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}>
              <div className="lp-spine__rail">
                <span className="lp-spine__dot">{s.n}</span>
                {i < SPINE_STEPS.length - 1 && <span className="lp-spine__line" />}
              </div>
              <div className="lp-spine__content">
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ TRUST / PROOF ═══ */}
      <section className="lp-trust">
        <div className="lp-trust__grid">
          {[
            { n: '2B+', l: 'WhatsApp users reachable' },
            { n: '90s', l: 'NDR → rescue intercept' },
            { n: '0', l: 'humans in the loop' },
            { n: '∞', l: 'carriers via webhook' },
          ].map((item, i) => (
            <motion.div key={item.l} className="lp-trust__item"
              initial={{ opacity: 0, scale: 0.88 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.09, ease: [0.34, 1.56, 0.64, 1] }}>
              <span className="lp-trust__n">{item.n}</span>
              <span className="lp-trust__l">{item.l}</span>
            </motion.div>
          ))}
        </div>
        <motion.p className="lp-trust__disc"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }}>
          Built for India. Ready for every WhatsApp market.
          Stats are modelled projections — pilot data replaces them when available.
        </motion.p>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="lp-final">
        <motion.h2 className="lp-final__h2"
          initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}>
          Stop losing revenue<br /><em>every single time.</em>
        </motion.h2>
        <motion.p className="lp-final__sub"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}>
          Connect your store, verify WhatsApp, link your carrier.
          Live in four minutes — no sales call, no demo.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.35 }}>
          <Link to="/register" className="lp-final__btn">Board the ship →</Link>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-foot">
        <span>⚓ RescueShip · Autonomous NDR Rescue for D2C Brands on WhatsApp</span>
        <span className="lp-foot__links">
          <Link to="/docs">Docs</Link>
          <Link to="/login">Log in</Link>
        </span>
      </footer>
    </div>
  );
}
