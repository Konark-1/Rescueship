import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Link } from 'react-router-dom';
import './landing.css';

/* ─── Simulated rescue feed script ─── */
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
  { t: '14:52:30', msg: 'NDR received · AWB 5582317790 · ClickPost', cls: 'ndr' },
  { t: '14:52:31', msg: 'reason: out of station · attempt 1/3' },
  { t: '14:52:32', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:52:33', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:55:18', msg: 'customer rescheduled → Jul 30', cls: 'ok' },
  { t: '14:55:18', msg: 'ORDER RESCUED · ₹2,100 recovered', cls: 'rescued' },
];

type OrderStatus = 'failed' | 'pending' | 'rescued';

const ORDER_BOARD: { id: string; awb: string; amount: number; status: OrderStatus }[] = [
  { id: '#89421', awb: '4023118876', amount: 1240, status: 'failed' },
  { id: '#89435', awb: '7719004523', amount: 890, status: 'failed' },
  { id: '#89448', awb: '5582317790', amount: 2100, status: 'failed' },
  { id: '#89452', awb: '3301998871', amount: 1560, status: 'pending' },
  { id: '#89460', awb: '9917234456', amount: 730, status: 'pending' },
];

const LOSS_PARTS = [
  { label: 'Ad spend to acquire', amount: 230 },
  { label: 'Forward shipping', amount: 80 },
  { label: 'Reverse shipping (RTO)', amount: 80 },
  { label: 'Repackaging + QC', amount: 40 },
];

/* ─── Main Component ─── */
export default function LandingPage() {
  const [feedLines, setFeedLines] = useState<typeof FEED_SCRIPT>([]);
  const [feedIdx, setFeedIdx] = useState(0);
  const [recovered, setRecovered] = useState(4_83_750);
  const [rescuedCount, setRescuedCount] = useState(387);
  const [orders, setOrders] = useState(ORDER_BOARD);
  const [email, setEmail] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lossRef = useRef<HTMLDivElement>(null);
  const lossIn = useInView(lossRef, { once: true, margin: '-80px' });

  /* ── Feed auto-play loop ── */
  useEffect(() => {
    if (feedIdx >= FEED_SCRIPT.length) {
      const resetTimer = setTimeout(() => {
        setFeedLines([]);
        setOrders(ORDER_BOARD);
        setFeedIdx(0);
      }, 1200);
      return () => clearTimeout(resetTimer);
    }
    const delay = FEED_SCRIPT[feedIdx].cls === 'rescued' ? 800 : 350;
    const timer = setTimeout(() => {
      setFeedLines((prev) => [...prev.slice(-7), FEED_SCRIPT[feedIdx]]);
      setFeedIdx((i) => i + 1);

      if (FEED_SCRIPT[feedIdx].cls === 'rescued') {
        const amt = parseInt(
          FEED_SCRIPT[feedIdx].msg.match(/₹([\d,]+)/)?.[1]?.replace(',', '') || '0'
        );
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
  }, [feedIdx]);

  /* ── Ambient recovery tick ── */
  useEffect(() => {
    const iv = setInterval(() => {
      setRecovered((r) => r + Math.floor(Math.random() * 80 + 20));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  /* ── Signup ── */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !storeUrl) return;
    setSubmitting(true);
    setError(null);
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

  return (
    <div className="lp">
      {/* Layered background */}
      <div className="lp-grid-bg" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />
      <div className="lp-scan" aria-hidden="true" />

      {/* Top bar */}
      <header className="lp-top">
        <a href="/" className="lp-brand"><span>⚓</span> RescueShip</a>
        <span className="lp-top__tag">Autonomous NDR Rescue</span>
        <nav className="lp-top__nav">
          <Link to="/login" className="lp-top__link">Log in</Link>
          <Link to="/register" className="lp-top__cta">Get started</Link>
        </nav>
      </header>

      {/* ── HERO: the interception console ── */}
      <section className="lp-hero">
        {/* LEFT: live console */}
        <div className="lp-console">
          <div className="lp-console__head">
            <span className="lp-console__dot lp-console__dot--r" />
            <span className="lp-console__dot lp-console__dot--a" />
            <span className="lp-console__dot lp-console__dot--g" />
            <span className="lp-console__title">rescue_feed — live interception</span>
            <span className="lp-console__live">● LIVE</span>
          </div>

          <div className="lp-console__body">
            <AnimatePresence mode="popLayout">
              {feedLines.map((line, i) => (
                <motion.div
                  key={`${feedIdx}-${i}`}
                  className={`lp-feed__line ${line.cls ? `lp-feed__line--${line.cls}` : ''}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
              <span className="lp-stat__n">₹{recovered.toLocaleString('en-IN')}</span>
              <span className="lp-stat__l">recovered today</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n">{rescuedCount}</span>
              <span className="lp-stat__l">orders rescued</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n">90s</span>
              <span className="lp-stat__l">avg intercept</span>
            </div>
          </div>
        </div>

        {/* RIGHT: intent + signup */}
        <div className="lp-intent">
          <p className="lp-intent__kicker">For Indian D2C brands</p>
          <h1 className="lp-intent__h1">
            He never knocked.<br />
            You lost <em>₹430.</em>
          </h1>
          <p className="lp-intent__sub">
            Every fake courier remark is a wound. RescueShip intercepts the NDR,
            rescues the order on WhatsApp, and syncs the fix back to the carrier —
            in 90 seconds, without a human.
          </p>

          {submitted ? (
            <motion.div
              className="lp-pass lp-pass--done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <svg viewBox="0 0 24 24" className="lp-pass__check"><path d="M5 13l4 4L19 7" /></svg>
              <p className="lp-pass__done-t">You're on the manifest.</p>
              <p className="lp-pass__done-s">Check your inbox — your test rescue is on its way.</p>
            </motion.div>
          ) : (
            <form className="lp-pass" onSubmit={handleSignup}>
              <div className="lp-pass__row">
                <label className="lp-pass__label">Work email</label>
                <input
                  className="lp-pass__input"
                  type="email"
                  placeholder="founder@yourbrand.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="lp-pass__row">
                <label className="lp-pass__label">Store URL</label>
                <input
                  className="lp-pass__input"
                  type="url"
                  placeholder="yourbrand.myshopify.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  required
                />
              </div>
              <button className="lp-pass__btn" type="submit" disabled={submitting}>
                {submitting ? 'Boarding…' : 'Start rescuing →'}
              </button>
              {error && <p className="lp-pass__err">⚠ {error}</p>}
              <p className="lp-pass__fine">Free test rescue · no card · live in 4 minutes</p>
            </form>
          )}
        </div>
      </section>

      {/* ── ORDER BOARD: FAILED → RESCUED ── */}
      <section className="lp-board">
        <p className="lp-section__kicker">Live order board</p>
        <div className="lp-board__cols">
          <div className="lp-board__col">
            <span className="lp-board__col-h lp-board__col-h--fail">Failed / Pending</span>
            <AnimatePresence mode="popLayout">
              {failedOrders.map((o) => (
                <motion.div
                  key={o.id}
                  className="lp-order lp-order--fail"
                  layout
                  exit={{ opacity: 0, x: 60, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="lp-order__id">{o.id}</span>
                  <span className="lp-order__awb">AWB {o.awb}</span>
                  <span className="lp-order__amt">₹{o.amount.toLocaleString('en-IN')}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="lp-board__arrow" aria-hidden="true">→</div>
          <div className="lp-board__col">
            <span className="lp-board__col-h lp-board__col-h--ok">Rescued</span>
            <AnimatePresence mode="popLayout">
              {rescuedOrders.map((o) => (
                <motion.div
                  key={o.id}
                  className="lp-order lp-order--ok"
                  layout
                  initial={{ opacity: 0, x: -60, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="lp-order__id">{o.id}</span>
                  <span className="lp-order__awb">AWB {o.awb}</span>
                  <span className="lp-order__amt">₹{o.amount.toLocaleString('en-IN')} ✓</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── THE COST: ledger breakdown ── */}
      <section className="lp-cost" ref={lossRef}>
        <p className="lp-section__kicker">Where each lost order goes</p>
        <div className="lp-cost__shell">
          <div className="lp-cost__total">
            <span className="lp-cost__cur">₹</span>
            <motion.span
              className="lp-cost__n"
              initial={{ opacity: 0.3 }}
              animate={lossIn ? { opacity: 1 } : {}}
              transition={{ duration: 0.6 }}
            >
              430
            </motion.span>
            <span className="lp-cost__lbl">lost per failed delivery</span>
          </div>
          <div className="lp-cost__bars">
            {LOSS_PARTS.map((p, i) => (
              <div key={p.label} className="lp-cost__row">
                <span className="lp-cost__row-l">{p.label}</span>
                <div className="lp-cost__bar-track">
                  <motion.div
                    className="lp-cost__bar-fill"
                    initial={{ width: 0 }}
                    animate={lossIn ? { width: `${(p.amount / 230) * 100}%` } : {}}
                    transition={{ duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <span className="lp-cost__row-n">₹{p.amount}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="lp-cost__note">
          At 7,500 orders/mo with a 15% RTO rate, that's{' '}
          <strong>₹4,83,750/mo</strong> bleeding out.{' '}
          <em>Modelled projection — your numbers may differ.</em>
        </p>
      </section>

      {/* ── HOW IT WORKS: spine, not equal cards ── */}
      <section className="lp-how">
        <p className="lp-section__kicker">The rescue loop</p>
        <h2 className="lp-how__h2">Four stations. <em>Zero humans.</em></h2>
        <div className="lp-spine">
          {[
            { n: '01', t: 'NDR intercepted', d: 'Courier logs a failed remark. We catch it in real-time via webhook — before the package starts its return journey.' },
            { n: '02', t: 'WhatsApp rescue dispatched', d: 'Customer gets a branded message: confirm you\'re home, reschedule, drop a GPS pin, or cancel. Their choice.' },
            { n: '03', t: 'Address synced to carrier', d: 'Corrected address or pin pushed directly to the driver app via carrier API. No phone calls, no manual entry.' },
            { n: '04', t: 'Revenue recovered', d: 'Order delivered. COD optionally converted to prepaid via UPI link. You keep the ₹430.' },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              className="lp-spine__node"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="lp-spine__rail">
                <span className="lp-spine__dot">{s.n}</span>
                {i < 3 && <span className="lp-spine__line" />}
              </div>
              <div className="lp-spine__content">
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── PROOF / TRUST ── */}
      <section className="lp-trust">
        <div className="lp-trust__grid">
          <div className="lp-trust__item">
            <span className="lp-trust__n">60%</span>
            <span className="lp-trust__l">modelled rescue rate</span>
          </div>
          <div className="lp-trust__item">
            <span className="lp-trust__n">90s</span>
            <span className="lp-trust__l">NDR → WhatsApp intercept</span>
          </div>
          <div className="lp-trust__item">
            <span className="lp-trust__n">0</span>
            <span className="lp-trust__l">humans in the loop</span>
          </div>
          <div className="lp-trust__item">
            <span className="lp-trust__n">3</span>
            <span className="lp-trust__l">couriers supported</span>
          </div>
        </div>
        <p className="lp-trust__disc">
          Stats are modelled projections (15% RTO, ₹430 cost, 60% rescue). Pilot data replaces these when available.
        </p>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lp-final">
        <h2 className="lp-final__h2">
          Stop losing ₹430<br />
          <em>every single time.</em>
        </h2>
        <p className="lp-final__sub">
          Connect your store, verify WhatsApp, link your courier. Live in four minutes — no sales call, no demo.
        </p>
        <Link to="/register" className="lp-final__btn">Board the ship →</Link>
      </section>

      {/* Footer */}
      <footer className="lp-foot">
        <span>⚓ RescueShip · Autonomous NDR Rescue for Indian D2C</span>
        <span className="lp-foot__links">
          <Link to="/docs">Docs</Link>
          <Link to="/login">Log in</Link>
        </span>
      </footer>
    </div>
  );
}
