import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import './landing.css';

/* ═══ BOOT SEQUENCE ═══ */
const BOOT_LINES = [
  { text: '⚓ rescueship v2.4 — autonomous recovery engine', cls: 'brand' },
  { text: '› binding webhook listeners ………… ✓', cls: 'ok' },
  { text: '› connecting carrier APIs ………… ✓', cls: 'ok' },
  { text: '› loading rescue templates ………… ✓', cls: 'ok' },
  { text: '› arming intercept pipeline ………… ✓', cls: 'ok' },
  { text: '✓ system ready — watching for NDRs', cls: 'ready' },
];

/* ═══ SIMULATED RESCUE FEED — global carriers ═══ */
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

const WATCHED = ['Shiprocket', 'Delhivery', 'ClickPost', 'webhook'];

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
  { n: '02', t: 'WhatsApp rescue dispatched', d: 'Your customer gets a branded message: confirm they’re home, reschedule, drop a GPS pin, or cancel. Their choice, your brand.' },
  { n: '03', t: 'Address synced to carrier', d: 'Corrected address or pin pushed straight to the driver app via carrier API. No phone calls. No manual entry.' },
  { n: '04', t: 'Revenue recovered', d: 'Order delivered. COD optionally converted to prepaid via payment link. You keep the money.' },
];

/* ═══ Scroll reel — the same order, told in motion (desktop only) ═══ */
const REEL_BEATS = [
  { tag: '11:43', role: 'move',   t: 'Out for delivery.',            d: 'The parcel leaves the warehouse. So far, so normal.' },
  { tag: '11:47', role: 'wound',  t: '“Door locked.” No knock.',     d: 'Logged four minutes after the scan. No call, no doorbell.' },
  { tag: '11:47', role: 'engine', t: 'RescueShip intercepts.',       d: 'The NDR is caught before the return journey begins.' },
  { tag: '11:48', role: 'engine', t: 'WhatsApp: “are you home?”',    d: 'Verification, never accusation. The customer taps Yes.' },
  { tag: '11:49', role: 'engine', t: 'Driver re‑routed.',            d: 'Corrected intent synced straight to the carrier.' },
  { tag: '15:20', role: 'rescue', t: 'Delivered. ₹1,240 kept.',      d: 'No reverse freight. No repack. No wasted ad spend.' },
];

/* inline-SVG pictograms — one framed "image" per beat, tinted by role colour */
const REEL_ICONS = [
  (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h11v8H2z"/><path d="M13 10h4l3 3v2h-7z"/><circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/></svg>),
  (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="3" width="12" height="18" rx="1.2"/><rect x="9.5" y="11" width="5" height="4.6" rx="0.8"/><path d="M10.5 11V9.6a1.5 1.5 0 0 1 3 0V11"/></svg>),
  (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 12 17.5 7.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16.4" cy="8.6" r="0.9" fill="currentColor" stroke="none"/></svg>),
  (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 8.5h8"/><path d="M8 11.5h5"/></svg>),
  (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z"/><circle cx="12" cy="11" r="2"/><path d="M3 21h5" strokeDasharray="2 2"/></svg>),
  (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9.5" width="16" height="10.5" rx="1.2"/><path d="M4 9.5 6 5h12l2 4.5"/><path d="M9 14.5l2 2 4-4"/></svg>),
];

/* ═══ Helpers ═══ */
function SpawnWords({ text, booted, baseDelay = 0, className = '' }: {
  text: string; booted: boolean; baseDelay?: number; className?: string;
}) {
  return (
    <span className={className}>
      {text.split(' ').map((w, i) => (
        <motion.span
          key={i}
          className="lp-word"
          initial={{ opacity: 0, y: 26, filter: 'blur(7px)' }}
          animate={booted ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.55, delay: baseDelay + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

function CountUp({ target, booted, prefix = '', suffix = '', duration = 1.6, delay = 0 }: {
  target: number; booted: boolean; prefix?: string; suffix?: string; duration?: number; delay?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!booted) return;
    let raf = 0, start = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / (duration * 1000), 1);
        setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay * 1000);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [booted, target, duration, delay]);
  return <>{prefix}{val.toLocaleString('en-IN')}{suffix}</>;
}



/* ═══ WhatsApp rescue chat — interactive decision tree (tap‑driven, all devices) ═══ */
type MsgKind = 'bot' | 'user' | 'sys' | 'status';
interface Msg { id: number; kind: MsgKind; text: string; tone?: 'ok' | 'warn' | 'cancel' | 'engine'; }
interface Choice { id: string; label: string; tone?: 'danger'; run: () => void; }

function WaPhone({ active, reduced }: { active: boolean; reduced: boolean }) {
  const idRef = useRef(0);
  const nid = () => ++idRef.current;
  const [log, setLog] = useState<Msg[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState('8:00 PM · NDR intercepted');
  const [banner, setBanner] = useState<{ text: string; tone: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(false);

  /* ── handlers (declarations → hoisted, safe to reference in topChoices) ── */
  function finish(bText: string, bTone: string, sText: string, sTone: Msg['tone']) {
    setLog((l) => [...l, { id: nid(), kind: 'status', text: sText, tone: sTone }]);
    setBanner({ text: bText, tone: bTone });
    setChoices([]);
  }
  function say(
    user: string | null, sys: string | null, bot: string,
    after: () => void, sysTone: Msg['tone'] = 'engine',
  ) {
    const add: Msg[] = [];
    if (user) add.push({ id: nid(), kind: 'user', text: user });
    if (sys) add.push({ id: nid(), kind: 'sys', text: sys, tone: sysTone });
    setLog((l) => [...l, ...add]);
    setChoices([]);
    setTyping(true);
    timer.current = window.setTimeout(() => {
      setLog((l) => [...l, { id: nid(), kind: 'bot', text: bot }]);
      setTyping(false);
      after();
    }, reduced ? 0 : 750);
  }

  function topChoices(): Choice[] {
    return [
      { id: 'home', label: 'Yes, I’m home', run: doHome },
      { id: 'resched', label: 'Reschedule', run: doReschedule },
      { id: 'pin', label: 'Share my pin', run: doPin },
      { id: 'cancel', label: 'Cancel', tone: 'danger', run: doCancel },
    ];
  }
  function seed() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setBanner(null); setTyping(false); setPhase('8:00 PM · NDR intercepted');
    setLog([{ id: nid(), kind: 'bot', text: 'Hi Priya 👋 Order #89421 (₹1,240) was marked “door locked” at 7:58 PM. We couldn’t confirm a delivery attempt — are you home right now?' }]);
    setChoices(topChoices());
  }

  function doHome() {
    setPhase('8:02 PM · evening exception scan');
    say('Yes I’m home! Nobody came to my door! 😤',
      '⚡ attempt flagged for review · Agent #4471 audit logged · Hub Supervisor',
      'Thanks for confirming, Priya! Evening hub dispatches close at 8 PM, so a same‑day re‑visit isn’t possible tonight — we’ve flagged this attempt for review and reserved First‑Slot Priority Delivery for you tomorrow, 9 AM–12 PM. 🚚',
      () => finish('✅ ORDER RESCUED · RTO prevented', 'ok', 'Order rescued · priority slot reserved · trust restored', 'ok'),
      'warn');
  }
  function doReschedule() {
    say('Can we reschedule this?', null,
      'Of course — pick a window that works and we’ll lock it with the carrier so the same remark can’t happen twice.',
      () => setChoices([
        { id: 'r1', label: 'Tomorrow 9–12', run: () => pickResched('Tomorrow, 9 AM–12 PM') },
        { id: 'r2', label: 'Tomorrow 2–6', run: () => pickResched('Tomorrow, 2 PM–6 PM') },
        { id: 'r3', label: 'Weekend', run: () => pickResched('This weekend') },
      ]));
  }
  function pickResched(w: string) {
    say(`Reschedule for ${w}, please.`, 'reschedule synced to carrier · slot locked',
      `Locked in — your re‑attempt is set for ${w} and the carrier is updated. We’ll message you an hour before the driver arrives. 📅`,
      () => finish('✅ RESCHEDULED · slot locked', 'ok', `Rescheduled · ${w} · reminder set`, 'ok'));
  }
  function doPin() {
    say('Here’s my exact location 📍', 'GPS pin received · address corrected · synced to carrier',
      'Got it — your pin is shared with the driver and the address is corrected on our side. No more “wrong address” remarks on this order. 📍',
      () => finish('✅ ADDRESS SYNCED · rescue in progress', 'ok', 'Address corrected · pin shared with driver', 'ok'));
  }
  function doCancel() {
    say(null, null,
      'We’d hate to lose you on this one, Priya. Mind telling us why, so we can try to make it right?',
      () => setChoices([
        { id: 'c1', label: '🏷️ Found it cheaper', run: reasonCheaper },
        { id: 'c2', label: '⏱️ Taking too long', run: reasonDelay },
        { id: 'c3', label: '🤔 Changed my mind', run: reasonMistake },
      ]));
  }
  function reasonCheaper() {
    setPhase('8:03 PM · price-match engine');
    say('I found this exact serum on another app for ₹1,299.', '🏷️ price-match engine · competitor rate verified',
      'Appreciate the honesty! We’ll match that price AND take an extra ₹75 off — pay ₹1,224 via 1‑click UPI now and delivery is guaranteed tomorrow morning.',
      () => { setBanner({ text: '⚡ Price Match Active', tone: 'engine' }); setChoices([
        { id: 'pay', label: '💳 Pay ₹1,224 via UPI', run: payUpi },
        { id: 'no', label: '❌ Still cancel', tone: 'danger', run: finalCancel },
      ]); });
  }
  function payUpi() {
    say('Paid via UPI ✅', 'COD → prepaid converted · ₹1,224 captured',
      'Payment confirmed — your order is locked in and out for delivery tomorrow morning. Thank you for giving us another shot! 💜',
      () => finish('✅ RESCUED · converted to prepaid', 'ok', 'Rescued · COD → prepaid · ₹200 saved for customer', 'ok'));
  }
  function reasonDelay() {
    setPhase('8:03 PM · SLA compensator');
    say('It’s taking too many days. I don’t need it anymore.', '⚡ SLA compensator · air priority applied',
      'So sorry for the wait! We’ve upgraded you to Priority Air Express at zero extra charge and added ₹100 credit to your account — give us one more day?',
      () => { setBanner({ text: '✈️ Priority Air Applied', tone: 'engine' }); setChoices([
        { id: 'keep', label: '✈️ Keep + Air Upgrade', run: keepAir },
        { id: 'no', label: '❌ No, cancel', tone: 'danger', run: finalCancel },
      ]); });
  }
  function keepAir() {
    say('Okay, the air upgrade works ✈️', 'express upgrade applied · ₹100 credit issued',
      'You’re on Priority Air Express now at no extra charge, and the ₹100 is in your account. It’ll be with you tomorrow. ✈️',
      () => finish('✅ RESCUED · express upgrade', 'ok', 'Rescued · air upgrade + ₹100 credit', 'ok'));
  }
  function reasonMistake() {
    say('Ordered by mistake, don’t need it now.', null,
      'Totally understand! Before this heads back to the warehouse, would an instant ₹100 off (new total ₹1,324) make it worth keeping?',
      () => setChoices([
        { id: 'keepd', label: '💰 Apply ₹100 off', run: keepDiscount },
        { id: 'no', label: '❌ No thanks, cancel', tone: 'danger', run: finalCancel },
      ]));
  }
  function keepDiscount() {
    say('Sure, apply the ₹100 💰', 'retention discount applied · order reactivated at ₹1,324',
      'Done — your total is now ₹1,324 and the order is back on. Glad you’re keeping it! 💜',
      () => finish('✅ RESCUED · retention discount', 'ok', 'Rescued · ₹100 retention applied', 'ok'));
  }
  function finalCancel() {
    say(null, 'order cancelled · return to warehouse initiated',
      'Understood — your order is cancelled and the return is on its way. Here’s ₹150 off whenever you’re ready to try us again: COMEBACK150. 💜',
      () => finish('❌ CANCELLED · win-back issued', 'cancel', 'Order cancelled · coupon COMEBACK150 issued', 'cancel'),
      'cancel');
  }

  /* ── lifecycle ── */
  useEffect(() => { if (active && !started.current) { started.current = true; seed(); } }, [active]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const el = bodyRef.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [log, typing, choices, reduced]);

  const renderItem = (m: Msg) => {
    if (m.kind === 'sys')
      return (
        <motion.div key={m.id} className="lp-wa__row lp-wa__row--sync"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}>
          <span className={`lp-wa__sys ${m.tone ? `lp-wa__sys--${m.tone}` : ''}`}>{m.text}</span>
        </motion.div>
      );
    if (m.kind === 'status')
      return (
        <motion.div key={m.id} className={`lp-wa__status ${m.tone ? `lp-wa__status--${m.tone}` : ''}`}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>{m.text}</motion.div>
      );
    return (
      <motion.div key={m.id} className={`lp-wa__row lp-wa__row--${m.kind}`}
        initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
        <div className={`lp-wa__bubble lp-wa__bubble--${m.kind}`}>{m.text}</div>
      </motion.div>
    );
  };

  return (
    <div className="lp-wa">
      <div className="lp-wa__notch" />
      <div className="lp-wa__head">
        <span className="lp-wa__av">⚓</span>
        <div className="lp-wa__who">
          <span className="lp-wa__name">RescueShip · your brand</span>
          <span className="lp-wa__meta"><i />{phase}</span>
        </div>
        {active && (
          <button type="button" className="lp-wa__reset" onClick={seed} aria-label="Reset conversation" title="Reset">↻</button>
        )}
      </div>

      {active && banner && (
        <div className={`lp-wa__banner lp-wa__banner--${banner.tone}`}>{banner.text}</div>
      )}

      <div className="lp-wa__body" ref={bodyRef}>
        <div className="lp-wa__spacer" aria-hidden="true" />
        {!active && (
          <div className="lp-wa__idle"><span>⚓</span><p>rescue engine arming…</p></div>
        )}
        {active && log.map(renderItem)}
        {active && typing && (
          <div className="lp-wa__row lp-wa__row--bot">
            <div className="lp-wa__bubble lp-wa__bubble--bot lp-wa__typing"><i /><i /><i /></div>
          </div>
        )}
        {active && choices.length > 0 && (
          <div className="lp-wa__choices" aria-disabled={typing || undefined}>
            {choices.map((c) => (
              <button key={c.id} type="button"
                className={`lp-wa__chip ${c.tone === 'danger' ? 'lp-wa__chip--danger' : ''}`}
                disabled={typing} onClick={c.run}>{c.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function LandingPage() {
  const [booted, setBooted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [reduced, setReduced] = useState(false);

  const [feedLines, setFeedLines] = useState<typeof FEED_SCRIPT>([]);
  const [feedIdx, setFeedIdx] = useState(0);
  const [recovered, setRecovered] = useState(4_83_750);
  const [rescuedCount, setRescuedCount] = useState(387);
  const [orders, setOrders] = useState<OrderCard[]>(ORDER_BOARD);

  const [email, setEmail] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lossRef = useRef<HTMLDivElement>(null);
  const lossIn = useInView(lossRef, { once: true, margin: '-80px' });

  useEffect(() => {
    let r = false;
    try { r = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    setReduced(r);
    let seen = false;
    try { seen = !!sessionStorage.getItem('rs_booted'); } catch {}
    if (r || seen) { setBooted(true); setShowOverlay(false); return; }
    const t1 = setTimeout(() => setBooted(true), 2300);
    const t2 = setTimeout(() => { setShowOverlay(false); try { sessionStorage.setItem('rs_booted', '1'); } catch {} }, 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const skipBoot = () => {
    setBooted(true); setShowOverlay(false);
    try { sessionStorage.setItem('rs_booted', '1'); } catch {}
  };

  useEffect(() => {
    if (!booted) return;
    if (feedIdx >= FEED_SCRIPT.length) {
      const reset = setTimeout(() => { setFeedLines([]); setOrders(ORDER_BOARD); setFeedIdx(0); }, 1500);
      return () => clearTimeout(reset);
    }
    const delay = FEED_SCRIPT[feedIdx].cls === 'rescued' ? 800 : 350;
    const timer = setTimeout(() => {
      setFeedLines((prev) => [...prev.slice(-8), FEED_SCRIPT[feedIdx]]);
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

  useEffect(() => {
    if (!booted) return;
    const iv = setInterval(() => setRecovered((r) => r + Math.floor(Math.random() * 80 + 20)), 5000);
    return () => clearInterval(iv);
  }, [booted]);

  /* ── Scroll reel: desktop gate + scroll‑scrubbed parcel (no state on scroll) ── */
  const trackRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [routeH, setRouteH] = useState(0);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const reelY = useTransform(scrollYProgress, [0, 1], [routeH / 12, (11 * routeH) / 12]);
  // function form → explicit 0/1, clamped by construction (no library clamp reliance)
  const ramp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));
  const o0 = useTransform(scrollYProgress, () => 1);                 // lit from the pin start
  const o1 = useTransform(scrollYProgress, (p) => ramp(p, 0.12, 0.20));
  const o2 = useTransform(scrollYProgress, (p) => ramp(p, 0.32, 0.40));
  const o3 = useTransform(scrollYProgress, (p) => ramp(p, 0.52, 0.60));
  const o4 = useTransform(scrollYProgress, (p) => ramp(p, 0.72, 0.80));
  const o5 = useTransform(scrollYProgress, (p) => ramp(p, 0.92, 1.00));
  const beatOpacity = [o0, o1, o2, o3, o4, o5];

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 961px)');
    const upd = () => setIsDesktop(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);

  useEffect(() => {
    const el = routeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRouteH(el.clientHeight));
    ro.observe(el);
    setRouteH(el.clientHeight);
    return () => ro.disconnect();
  }, [isDesktop]);

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
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const failedOrders = orders.filter((o) => o.status === 'failed' || o.status === 'pending');
  const rescuedOrders = orders.filter((o) => o.status === 'rescued');

  return (
    <div className="lp">
      {/* BOOT OVERLAY */}
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

      {/* AMBIENT LAYERS */}
      <div className="lp-orb lp-orb--1" aria-hidden="true" />
      <div className="lp-orb lp-orb--2" aria-hidden="true" />
      <div className="lp-orb lp-orb--3" aria-hidden="true" />
      <div className="lp-grid-bg" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />
      <div className="lp-scan" aria-hidden="true" />

      {/* TOP BAR */}
      <motion.header className="lp-top"
        initial={{ opacity: 0, y: -16 }} animate={booted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
        <a href="/" className="lp-brand"><span>⚓</span> RescueShip</a>
        <span className="lp-top__tag">Autonomous NDR Rescue</span>
        <nav className="lp-top__nav">
          <Link to="/login" className="lp-top__link">Log in</Link>
          <Link to="/register" className="lp-top__cta">Get started</Link>
        </nav>
      </motion.header>

      {/* HERO */}
      <section className="lp-hero">
        <motion.div className="lp-console"
          initial={{ opacity: 0, y: 60, scale: 0.92 }} animate={booted ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ willChange: 'transform, opacity' }}>
          <div className="lp-console__head">
            <span className="lp-console__dot lp-console__dot--r" />
            <span className="lp-console__dot lp-console__dot--a" />
            <span className="lp-console__dot lp-console__dot--g" />
            <span className="lp-console__title">rescue_feed — live interception</span>
            <motion.span className="lp-console__live" animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}>● LIVE</motion.span>
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
                {feedLines.map((line, i) => (
                  <motion.div key={`${feedIdx}-${i}`}
                    className={`lp-feed__line ${line.cls ? `lp-feed__line--${line.cls}` : ''}`}
                    initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
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
              <span className="lp-stat__l">recovered today</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={rescuedCount} booted={booted} delay={0.7} /></span>
              <span className="lp-stat__l">orders rescued</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={90} booted={booted} suffix="s" delay={0.8} duration={1} /></span>
              <span className="lp-stat__l">avg intercept</span>
            </div>
          </div>
        </motion.div>

        <div className="lp-intent">
          <motion.p className="lp-intent__kicker"
            initial={{ opacity: 0, y: 16 }} animate={booted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.25 }}>For D2C brands shipping on WhatsApp</motion.p>

          <h1 className="lp-intent__h1">
            <span className="lp-intent__line">
              <SpawnWords text="He never" booted={booted} baseDelay={0.35} />
              <SpawnWords text="knocked." booted={booted} baseDelay={0.58} className="lp-intent__accent" />
            </span>
            <span className="lp-intent__line">
              <SpawnWords text="You lost" booted={booted} baseDelay={0.78} />
              <SpawnWords text="the sale." booted={booted} baseDelay={1.0} className="lp-intent__accent" />
            </span>
          </h1>

          <motion.p className="lp-intent__sub"
            initial={{ opacity: 0 }} animate={booted ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 1.15 }}>
            Every failed delivery is a wound — forward freight, reverse freight,
            repackaging, wasted ad spend. RescueShip intercepts the NDR, rescues
            the order on WhatsApp, and syncs the fix back to the carrier.
            In 90 seconds. Without a human.
          </motion.p>

          {submitted ? (
            <motion.div className="lp-pass lp-pass--done"
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}>
              <svg viewBox="0 0 24 24" className="lp-pass__check"><path d="M5 13l4 4L19 7" /></svg>
              <p className="lp-pass__done-t">You’re on the manifest.</p>
              <p className="lp-pass__done-s">Check your inbox — your test rescue is on its way.</p>
            </motion.div>
          ) : (
            <motion.form className="lp-pass" onSubmit={handleSignup}
              initial={{ opacity: 0, x: 48 }} animate={booted ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 1.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: 'transform, opacity' }}>
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

      {/* ORDER BOARD */}
      <section className="lp-board">
        <motion.p className="lp-section__kicker" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>Live order board</motion.p>
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
                  initial={{ opacity: 0, x: -70, scale: 0.92 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}>
                  <span className="lp-order__id">{o.id}</span>
                  <span className="lp-order__awb">AWB {o.awb}</span>
                  <span className="lp-order__amt">{o.amount} ✓</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {rescuedOrders.length === 0 && (
              <div className="lp-order lp-order--ghost">awaiting first rescue…</div>
            )}
          </div>
        </div>
      </section>

      {/* COST / LEDGER */}
      <section className="lp-cost" ref={lossRef}>
        <motion.p className="lp-section__kicker" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>The anatomy of a lost order</motion.p>
        <div className="lp-cost__shell">
          <div className="lp-cost__total">
            <span className="lp-cost__cur">₹</span>
            <motion.span className="lp-cost__n"
              initial={{ opacity: 0.2, scale: 0.9 }} animate={lossIn ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}>430</motion.span>
            <span className="lp-cost__lbl">average cost per failed delivery — your currency, your math</span>
          </div>
          <div className="lp-cost__bars">
            {LOSS_PARTS.map((p, i) => (
              <motion.div key={p.label} className="lp-cost__row"
                initial={{ opacity: 0, x: -20 }} animate={lossIn ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}>
                <span className="lp-cost__row-l">{p.label}</span>
                <div className="lp-cost__bar-track">
                  <motion.div className="lp-cost__bar-fill" initial={{ width: 0 }}
                    animate={lossIn ? { width: `${(p.amount / 230) * 100}%` } : {}}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }} />
                </div>
                <span className="lp-cost__row-n">₹{p.amount}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.p className="lp-cost__note" initial={{ opacity: 0 }} animate={lossIn ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}>
          At 7,500 orders/mo with a 15% failure rate, that’s 1,125 lost orders.
          Multiply by <strong>your</strong> cost per failure.{' '}
          <em>Modelled projection — your numbers replace these when you connect.</em>
        </motion.p>
      </section>

      {/* RESCUE LOOP — spine + live WhatsApp proof */}
      <section className="lp-how">
        <div className="lp-how__main">
          <motion.p className="lp-section__kicker" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}>The rescue loop</motion.p>
          <motion.h2 className="lp-how__h2" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            Four stations. <em>Zero humans.</em>
          </motion.h2>
          <div className="lp-spine">
            {SPINE_STEPS.map((s, i) => (
              <motion.div key={s.n} className="lp-spine__node"
                initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
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
        </div>

        <motion.div className="lp-how__aside"
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <span className="lp-how__aside-tag">live rescue · 90s</span>
          <WaPhone active={booted} reduced={reduced} />
          <p className="lp-how__aside-note">The customer taps. The carrier syncs. No one on your team lifts a finger.</p>
        </motion.div>
      </section>

      {/* TRUST */}
      <section className="lp-trust">
        <div className="lp-trust__grid">
          {[
            { n: '2B+', l: 'WhatsApp users reachable' },
            { n: '90s', l: 'NDR → rescue intercept' },
            { n: '0', l: 'humans in the loop' },
            { n: '∞', l: 'carriers via webhook' },
          ].map((item, i) => (
            <motion.div key={item.l} className="lp-trust__item"
              initial={{ opacity: 0, scale: 0.88 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.09, ease: [0.34, 1.56, 0.64, 1] }}>
              <span className="lp-trust__n">{item.n}</span>
              <span className="lp-trust__l">{item.l}</span>
            </motion.div>
          ))}
        </div>
        <motion.p className="lp-trust__disc" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }}>
          Built for India. Ready for every WhatsApp market.
          Stats are modelled projections — pilot data replaces them when available.
        </motion.p>
      </section>

      {/* ═══ SCROLL REEL — the story in motion (desktop only) ═══ */}
      {isDesktop && (
        <section className={`lp-reel${reduced ? ' lp-reel--static' : ''}`} aria-label="How a single rescue plays out">
          <div className="lp-reel__track" ref={trackRef}>
            <div className="lp-reel__stage">
              <p className="lp-section__kicker lp-reel__kicker">The same order, in motion</p>
              <div className="lp-reel__grid">
                <div className="lp-reel__route" ref={routeRef} aria-hidden="true">
                  <span className="lp-reel__line" />
                  {REEL_BEATS.map((b, i) => (
                    <span key={i} className={`lp-reel__dot lp-reel__dot--${b.role}`} />
                  ))}
                  <motion.span
                    className="lp-reel__parcel"
                    style={reduced ? undefined : { x: '-50%', y: reelY }}
                  >📦</motion.span>
                </div>
                <ol className="lp-reel__beats">
                  {REEL_BEATS.map((b, i) => (
                    <motion.li
                      key={i}
                      className={`lp-reel__beat lp-reel__beat--${b.role}`}
                      style={reduced ? undefined : { opacity: beatOpacity[i] }}
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
      )}

      {/* FINAL CTA — framed boarding gate */}
      <section className="lp-final">
        <motion.div className="lp-final__panel"
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <div className="lp-final__glow" aria-hidden="true" />
          <span className="lp-final__kicker">ready when you are</span>
          <h2 className="lp-final__h2">Stop losing revenue<br /><em>every single time.</em></h2>
          <p className="lp-final__sub">
            Connect your store, verify WhatsApp, link your carrier.
            Live in four minutes — no sales call, no demo.
          </p>
          <Link to="/register" className="lp-final__btn">Board the ship →</Link>
          <div className="lp-final__chips">
            <span>no credit card</span><span>no sales call</span><span>live in 4 min</span>
          </div>
        </motion.div>
      </section>

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
