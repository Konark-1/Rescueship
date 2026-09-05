import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useMagnetic } from '../hooks/useMagnetic';
import type { Tier, Cycle } from '../lib/billing';
import { TIERS, CYCLES, priceFor, lossFor, recommendedTier, inr, billingApi, loadRazorpay } from '../lib/billing';
import { connectApi } from '../lib/connect';
import './billing.css';

export default function BillingPage() {
  const { token, user } = useAuth();
  const nav = useNavigate();
  const mag = useMagnetic(0.22);

  const [volume, setVolume] = useState<number>(() => {
    const q = new URLSearchParams(location.search).get('v');
    const stored = localStorage.getItem('rs_volume');
    return Number(q || stored || 5000);
  });
  const [tier, setTier] = useState<Tier>(() => recommendedTier(volume));
  const [cycle, setCycle] = useState<Cycle>('annual');
  const [drawer, setDrawer] = useState(false);
  const [paying, setPaying] = useState(false);
  const [active, setActive] = useState<any>(null); // set after success / if already subscribed
  const [setupCallUrl, setSetupCallUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('rs_volume', String(volume)); setTier(recommendedTier(volume)); }, [volume]);
  useEffect(() => { billingApi.status(token!).then((s) => { if (s.active) setActive(s); }).catch(() => {}); }, [token]);
  useEffect(() => { if (token) connectApi.state(token).then((s: any) => setSetupCallUrl(s?.setupCallUrl || null)).catch(() => {}); }, [token]);

  const loss = useMemo(() => lossFor(volume), [volume]);
  const price = useMemo(() => priceFor(tier, cycle), [tier, cycle]);
  const cycleMeta = CYCLES.find((c) => c.key === cycle)!;
  const tierMeta = TIERS.find((t) => t.key === tier)!;
  // the argument, drawn as geometry: how thin the price slice is vs the loss
  const pricePct = loss.loss > 0 ? Math.max(2, Math.min(100, (price.renewMonthly / loss.loss) * 100)) : 100;

  const barRef = useRef<HTMLDivElement>(null);
  const barIn = useInView(barRef, { once: true, margin: '-60px' });

  const pay = async () => {
    setPaying(true); setErr(null);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Payment SDK failed to load. Check your connection.');
      const order = await billingApi.checkout(token!, tier, cycle);
      const rz = new (window as any).Razorpay({
        key: order.keyId,
        subscription_id: order.subscriptionId,     // recurring renewal
        order_id: order.orderId,                   // upfront intro quarter
        name: 'RescueShip',
        description: `${tierMeta.name} · ${cycleMeta.label} · first quarter ${inr(price.introMonthly)}/mo`,
        amount: order.amountInr, currency: order.currency || 'INR',
        prefill: { email: user?.email, contact: (user as any)?.phone },
        theme: { color: '#6366f1' },
        handler: async (resp: any) => {
          try {
            const verified = await billingApi.verify(token!, { ...resp, tier, cycle });
            setActive(verified); setDrawer(false);
          } catch (e: any) { setErr(e.message); }
          setPaying(false);
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rz.open();
    } catch (e: any) { setErr(e.message); setPaying(false); }
  };

  /* ── already active: the manifest collapses to a single receipt ── */
  if (active) {
    return (
      <div className="bl">
        <div className="bl-paper" aria-hidden="true" /><div className="bl-grain" aria-hidden="true" />
        <Topbar onExit={() => nav('/dashboard')} />
        <motion.div className="bl-receipt" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <svg viewBox="0 0 24 24" className="bl-receipt__check"><path d="M5 13l4 4L19 7" /></svg>
          <p className="bl-receipt__kicker">RescueShip is live</p>
          <h1>{active.plan} <em>· active</em></h1>
          <div className="bl-receipt__rows">
            <Row k="Plan" v={`${active.plan} · up to ${Number(active.limit).toLocaleString('en-IN')} orders/mo`} />
            <Row k="Billing" v={`${active.cycle} · ${inr(active.renewMonthly)}/mo`} />
            <Row k="Next invoice" v={active.nextInvoice ? new Date(active.nextInvoice).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
            <Row k="Activated" v={new Date(active.activatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
          </div>
          {setupCallUrl && (
            <div className="bl-callout">
              <p className="bl-callout__title">📞 Free guided setup call</p>
              <p className="bl-callout__sub">Your plan just went live — we'll finish the store, WhatsApp, courier and payment wiring with you in 20 minutes.</p>
              <div className="bl-callout__actions">
                <a className="bl-callout__btn" href={setupCallUrl} target="_blank" rel="noopener noreferrer">Book your setup call →</a>
                <button className="bl-link bl-link--mute" onClick={() => nav('/onboarding')}>Set it up myself</button>
              </div>
            </div>
          )}
          <div className="bl-receipt__foot">
            <button className="bl-link" onClick={() => nav('/dashboard')}>Open dashboard →</button>
            <button className="bl-link bl-link--mute" onClick={() => nav('/settings')}>Manage billing</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bl">
      <div className="bl-paper" aria-hidden="true" /><div className="bl-grain" aria-hidden="true" /><div className="bl-col-sweep" aria-hidden="true" />
      <Topbar onExit={() => nav('/onboarding')} />

      <div className="bl-shell">
        {/* ── LEFT: your position — the loss, and the price as a slice of it ── */}
        <aside className="bl-position">
          <p className="bl-kicker">Your position this month</p>
          <div className="bl-vol">
            <label htmlFor="volume-range-input">Monthly orders</label>
            <input id="volume-range-input" aria-label="Monthly orders volume" type="range" min={500} max={50000} step={500} value={volume} onChange={(e) => setVolume(+e.target.value)} />
            <span className="bl-vol__n">{volume.toLocaleString('en-IN')}</span>
          </div>

          <div className="bl-loss">
            <span className="bl-loss__cur">₹</span>
            <span className="bl-loss__n">{Math.round(loss.loss).toLocaleString('en-IN')}</span>
            <span className="bl-loss__lbl">at risk · failed deliveries</span>
          </div>

          {/* the proportional rule — the whole argument, as geometry */}
          <div className="bl-rule" ref={barRef}>
            <div className="bl-rule__track">
              <motion.div className="bl-rule__loss" initial={{ width: 0 }} animate={barIn ? { width: '100%' } : {}} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
              <motion.div className="bl-rule__price" initial={{ width: 0 }} animate={barIn ? { width: `${pricePct}%` } : { width: `${pricePct}%` }} key={`${tier}-${cycle}`} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
            </div>
            <div className="bl-rule__legend">
              <span><i className="dot dot--loss" /> your monthly loss</span>
              <span><i className="dot dot--price" /> {tierMeta.name} · {inr(price.renewMonthly)}/mo</span>
            </div>
            <LossTooltip />
          </div>

          <p className="bl-pace">
            At this volume, RescueShip runs at roughly
            <motion.span className="bl-pace__n" key={loss.rescuesPerWeek} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }}>
              {' '}{loss.rescuesPerWeek}{' '}
            </motion.span>
            rescues a week — your projected pace, not a promise.
          </p>
        </aside>

        {/* ── RIGHT: the manifest of tiers (rows, not equal cards) ── */}
        <main className="bl-manifest">
          <header className="bl-manifest__head">
            <h1>Pick the line<br /><em>you stop losing.</em></h1>
            <CycleSwitch value={cycle} onChange={setCycle} />
          </header>

          <div className="bl-rows">
            {TIERS.map((t, i) => {
              const p = priceFor(t.key, cycle);
              const chosen = t.key === tier;
              const rec = t.key === recommendedTier(volume);
              return (
                <motion.button
                  key={t.key}
                  className={`bl-row ${chosen ? 'is-chosen' : ''} ${rec ? 'is-rec' : ''}`}
                  onClick={() => setTier(t.key)}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="bl-row__rail" aria-hidden="true">{rec && <span className="bl-row__anchor">⚓</span>}</span>
                  <span className="bl-row__main">
                    <span className="bl-row__name">{t.name}{rec && <em className="bl-row__rec">recommended for you</em>}</span>
                    <span className="bl-row__cap">up to {t.orders.toLocaleString('en-IN')} orders/mo · {t.blurb}</span>
                  </span>
                  <span className="bl-row__price">
                    <span className="bl-row__intro">{inr(p.introMonthly)}<small>/mo</small></span>
                    <span className="bl-row__renew">first quarter · then {inr(p.renewMonthly)}/mo {cycleMeta.tag && <b>{cycleMeta.tag}</b>}</span>
                  </span>
                  <span className="bl-row__pick" aria-hidden="true">
                    {chosen ? <svg viewBox="0 0 24 24" className="bl-row__check"><path d="M5 13l4 4L19 7" /></svg> : <span className="bl-row__radio" />}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <p className="bl-manifest__note">
            No per-rescue tax. No setup fee. Cancel before your renewal date and the next cycle isn't charged.
            Enterprise volume or a custom SLA? <button className="bl-link" onClick={() => nav('/register')}>Talk to sales</button>
          </p>

          <div className="bl-manifest__cta">
            <div className="bl-manifest__total">
              <span>Due today <small>(first quarter, intro)</small></span>
              <strong>{inr(price.introUpfront)}</strong>
            </div>
            <button className="bl-subscribe" ref={mag.ref as any} onMouseMove={mag.onMouseMove} onMouseLeave={mag.onMouseLeave} onClick={() => setDrawer(true)}>
              Subscribe & go live <span className="bl-subscribe__arrow">→</span>
            </button>
          </div>
          {err && <p className="bl-err">⚠ {err}</p>}
        </main>
      </div>

      {/* ── checkout drawer ── */}
      <AnimatePresence>
        {drawer && (
          <motion.div className="bl-drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !paying && setDrawer(false)}>
            <motion.aside className="bl-drawer" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 220, damping: 26 }} onClick={(e) => e.stopPropagation()}>
              <button className="bl-drawer__x" onClick={() => !paying && setDrawer(false)} aria-label="Close">✕</button>
              <p className="bl-kicker">Checkout</p>
              <h2>{tierMeta.name} · {cycleMeta.label}</h2>
              <div className="bl-drawer__ledger">
                <Row k={`${tierMeta.name} · first quarter`} v={`${inr(price.introMonthly)}/mo × 3`} />
                <Row k="Intro offer" v={`−40% · first quarter only`} accent />
                <div className="bl-drawer__due"><span>Due today</span><strong>{inr(price.introUpfront)}</strong></div>
                <Row k="Then, from your renewal date" v={`${inr(price.renewMonthly)}/mo · ${cycleMeta.label} ${cycleMeta.tag}`} mute />
              </div>
              <p className="bl-drawer__fine">
                You're charged the intro quarter now via Razorpay. The recurring {cycleMeta.label.toLowerCase()} subscription at {inr(price.renewMonthly)}/mo begins on your renewal date. Secured by Razorpay · encrypted at rest.
              </p>
              <button className="bl-subscribe bl-subscribe--full" disabled={paying} onClick={pay} ref={mag.ref as any} onMouseMove={mag.onMouseMove} onMouseLeave={mag.onMouseLeave}>
                {paying ? 'Opening secure checkout…' : <>Pay {inr(price.introUpfront)} & activate <span className="bl-subscribe__arrow">→</span></>}
              </button>
              {err && <p className="bl-err">⚠ {err}</p>}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── small pieces ── */
function Topbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="bl-top">
      <a href="/" className="bl-brand"><span>⚓</span> RescueShip</a>
      <span className="bl-top__crumb">Onboarding <i>/</i> <strong>Billing</strong></span>
      <button className="bl-top__exit" onClick={onExit}>← back</button>
    </header>
  );
}
function Row({ k, v, accent, mute }: { k: string; v: string; accent?: boolean; mute?: boolean }) {
  return <div className={`bl-ledger-row ${accent ? 'accent' : ''} ${mute ? 'mute' : ''}`}><span>{k}</span><span>{v}</span></div>;
}
function CycleSwitch({ value, onChange }: { value: Cycle; onChange: (c: Cycle) => void }) {
  const idx = CYCLES.findIndex((c) => c.key === value);
  return (
    <div className="bl-cycle" role="tablist" aria-label="Billing cycle">
      <motion.span className="bl-cycle__knob" layout transition={{ type: 'spring', stiffness: 380, damping: 30 }} style={{ left: `calc(${idx} * (100% / 3))`, width: `calc(100% / 3)` }} />
      {CYCLES.map((c) => (
        <button
          key={c.key}
          role="tab"
          aria-selected={value === c.key}
          className={value === c.key ? 'on' : ''}
          onClick={() => onChange(c.key)}
        >
          {c.label}{c.tag && <em>{c.tag}</em>}
        </button>
      ))}
    </div>
  );
}
function LossTooltip() {
  const parts = [ ['Ad spend to acquire the customer', 230], ['Forward shipping', 80], ['Reverse shipping (RTO)', 80], ['Repackaging + QC', 40] ] as const;
  return (
    <div className="bl-tip" role="note">
      <span className="bl-tip__h">Where each lost order goes</span>
      {parts.map(([l, a]) => <span key={l} className="bl-tip__r"><i>{l}</i><b>₹{a}</b></span>)}
    </div>
  );
}
