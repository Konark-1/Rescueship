import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LEGAL } from '../legal/entity';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass,
  ShieldCheck,
  Check,
  SlidersHorizontal,
  MapPin,
  Lock,
  CheckCircle2,
  X,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { markBillingActive } from '../components/BillingGate';
import type { PlanKey, Cycle, StoreMetrics } from '../config/pricing.config';
import {
  PLANS,
  BANDS,
  CYCLES,
  CUSTOM_ABOVE,
  DEFAULT_METRICS,
  priceFor,
  estimate,
  bandFor,
  planByKey,
  recommendedPlan,
  inr,
} from '../config/pricing.config';
import { billingApi, loadRazorpay } from '../services/billing.api';
import { connectApi } from '../lib/connect';
import './billing.css';

const RAZORPAY_THEME_COLOR = '#4f46e5';

export interface Invoice {
  _id?: string;
  number: string;
  description: string;
  amountPaise: number;
  paidAt?: string;
}

export interface SubscriptionStatus {
  active: boolean;
  plan: string;
  activatedAt?: string;
  nextInvoice?: string;
  limit: number;
  renewMonthly: number;
  cycle: string;
  credits?: number;
  status?: string;
  cancelAtCycleEnd?: boolean;
}

export default function BillingPage() {
  const { token, user, logout } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [volume, setVolume] = useState<number>(() => {
    try {
      const q = params.get('v');
      if (q) {
        const parsed = Number(q);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('rs_volume');
        if (stored) {
          const parsed = Number(stored);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
    } catch {
      // fallback
    }
    return 1000;
  });
  // Plan = what is included; the order band (from volume) = how much it costs.
  const [plan, setPlan] = useState<PlanKey>(() => recommendedPlan(Number(params.get('v') || 1000)));
  const [planTouched, setPlanTouched] = useState(false);
  const [cycle, setCycle] = useState<Cycle>('quarterly');
  const [paying, setPaying] = useState(false);
  const [active, setActive] = useState<SubscriptionStatus | null>(null);
  const [setupCallUrl, setSetupCallUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Store metrics for customized RTO calculation
  const [metrics, setMetrics] = useState<StoreMetrics>(DEFAULT_METRICS);
  const [storeSource, setStoreSource] = useState<string | null>(null);
  const [onboardingState, setOnboardingState] = useState<any>(null);

  // Parameters modal
  const [showTuner, setShowTuner] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('rs_volume', String(volume));
      }
    } catch {
      // ignore
    }
  }, [volume]);

  useEffect(() => {
    if (!showTuner) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTuner(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTuner]);

  useEffect(() => {
    if (!token) return;
    billingApi
      .status(token)
      .then((s) => {
        if (s.active) setActive(s);
      })
      .catch(() => {});

    connectApi
      .state(token)
      .then((s: any) => {
        setOnboardingState(s);
        if (s?.setupCallUrl) setSetupCallUrl(s.setupCallUrl);
      })
      .catch(() => {});

    connectApi
      .storeMetrics(token)
      .then((m: any) => {
        if (m?.available) {
          setMetrics((prev) => ({
            ...prev,
            aov: m.aov || prev.aov,
            codPct: typeof m.codPct === 'number' ? m.codPct : prev.codPct,
          }));
          if (m.monthlyOrders) {
            setVolume(m.monthlyOrders);
          }
          setStoreSource(m.storeDomain || 'your store');
        }
      })
      .catch(() => {});
  }, [token]);

  const band = bandFor(volume); // null → above the top band (custom pricing)
  const isCustom = band === null;
  useEffect(() => {
    if (!planTouched) setPlan(recommendedPlan(volume, metrics));
  }, [volume, metrics, planTouched]);
  const est = useMemo(() => estimate(volume, metrics, plan), [volume, metrics, plan]);
  const price = useMemo(() => priceFor(plan, band ?? 10000, cycle), [plan, band, cycle]);
  const cycleMeta = CYCLES.find((c) => c.key === cycle)!;
  const planMeta = planByKey(plan);

  const connectedCount = useMemo(() => {
    if (!onboardingState?.connections) return 0;
    return ['shopify', 'whatsapp', 'carrier', 'payment'].filter(
      (k) => onboardingState.connections[k]?.status === 'connected'
    ).length;
  }, [onboardingState]);

  const allGreen = onboardingState?.ready || connectedCount === 4;

  const pay = async () => {
    setPaying(true);
    setErr(null);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Payment SDK failed to load. Check your internet connection.');
      if (isCustom || band === null) throw new Error(`Above ${CUSTOM_ABOVE.toLocaleString('en-IN')} orders a month we set up a custom plan — write to ${LEGAL.contactEmail}.`);
      const order = await billingApi.checkout(token!, plan, band, cycle);
      const rz = new (window as any).Razorpay({
        key: order.keyId,
        ...(order.subscriptionId ? { subscription_id: order.subscriptionId } : {}),
        order_id: order.orderId,
        name: 'RescueShip',
        description: `${planMeta.name} · up to ${band.toLocaleString('en-IN')} orders/mo · ${cycleMeta.label}`,
        amount: order.amountInr,
        currency: order.currency || 'INR',
        prefill: { email: user?.email, contact: user?.phone },
        theme: { color: RAZORPAY_THEME_COLOR },
        handler: async (resp: any) => {
          try {
            const verified = await billingApi.verify(token!, { ...resp, cycle });
            setActive(verified);
            markBillingActive(token);
            nav(user?.onboardingStatus === 'completed' ? '/dashboard' : '/onboarding?subscribed=true');
          } catch (e: any) {
            setErr(e.message);
          }
          setPaying(false);
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rz.open();
    } catch (e: any) {
      setErr(e.message);
      setPaying(false);
    }
  };

  /* ── STATE 1: ALREADY SUBSCRIBED RECEIPT ── */
  if (active) {
    const formattedStartDate = active.activatedAt
      ? new Date(active.activatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const formattedEndDate = active.nextInvoice
      ? new Date(active.nextInvoice).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

    return (
      <div className="bl-page">
      <div className="bl-glow" />
        <div className="bl-container">
          <header className="bl-nav">
            <a href="/" className="bl-nav__brand">
              <span className="bl-nav__logo-icon"><Compass size={16} /></span>
              <span>RescueShip</span>
            </a>
            <button className="bl-nav__back" onClick={() => nav(user?.onboardingStatus === 'completed' ? '/dashboard' : '/onboarding?subscribed=true')}>
              {user?.onboardingStatus === 'completed' ? 'Back to dashboard' : 'Back to setup'}
            </button>
          </header>

          <motion.div
            className="bl-receipt-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="bl-receipt-card__status">
              <CheckCircle2 size={14} /> Plan active
            </span>
            <h1 className="bl-receipt-card__title">{(PLANS.find((x) => x.key === active.plan)?.name) || active.plan} plan</h1>
            <p className="bl-receipt-card__sub">
              Rescues can run for your real buyers once every connection is green.
            </p>

            <div className="bl-receipt-card__table">
              <div className="bl-receipt-card__row">
                <span>Coverage Capacity</span>
                <span>Up to {Number(active.limit).toLocaleString('en-IN')} orders/mo</span>
              </div>
              <div className="bl-receipt-card__row">
                <span>Billing Rate</span>
                <span>{inr(active.renewMonthly)}/mo ({active.cycle || 'quarterly'})</span>
              </div>
              <div className="bl-receipt-card__row">
                <span>Start Date</span>
                <span>{formattedStartDate}</span>
              </div>
              <div className="bl-receipt-card__row">
                <span>Next Renewal</span>
                <span>{formattedEndDate}</span>
              </div>
              <div className="bl-receipt-card__row">
                <span>WhatsApp message fees</span>
                <span>Billed by Meta to your WhatsApp account</span>
              </div>
            </div>

            <div className="bl-receipt-card__actions bl-receipt-actions--col">
              {setupCallUrl && (
                <a
                  className="bl-btn-secondary bl-btn-link-block"
                  href={setupCallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={15} /> Book a free 15-minute setup call
                </a>
              )}
              <button className="bl-btn-primary bl-btn-full" onClick={() => nav(user?.onboardingStatus === 'completed' ? '/dashboard' : '/onboarding?subscribed=true')}>
                {user?.onboardingStatus === 'completed' ? 'Open dashboard' : 'Continue setup'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── STATE 2: PLAN SELECTION & CALCULATOR ── */
  const cycleIdx = CYCLES.findIndex((c) => c.key === cycle);

  return (
    <div className="bl-page">
      <div className="bl-glow" />

      <div className="bl-container">
        {/* Navigation Bar */}
        <header className="bl-nav">
          <a href="/" className="bl-nav__brand">
            <span className="bl-nav__logo-icon"><Compass size={16} /></span>
              <span>RescueShip</span>
          </a>
          <div className="bl-nav__meta">
            <span className="bl-nav__step-pill">
              Choose a plan to go live
            </span>
            <button className="bl-nav__back" onClick={() => nav('/onboarding')}>
              Back to setup
            </button>
            <button className="bl-nav__back" onClick={() => { logout(); nav('/login'); }}>
              Log out
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bl-hero">
          <div className="bl-hero__badge">
            <ShieldCheck size={14} />
            <span>{LEGAL.guaranteeDays}-day money-back guarantee</span>
          </div>
          <h1 className="bl-hero__title">
            Choose your protection. Pay for your size.
          </h1>
          <p className="bl-hero__sub">
            Every plan works for every brand size — smaller brands pay less for the same features. Rescues for real buyers switch on once a plan is active. Prices are per month, before GST, paid for the whole period up front.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="bl-cycle-wrap">
            <motion.div
              className="bl-cycle-pill"
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              style={{
                left: `calc(${cycleIdx} * (100% / ${CYCLES.length}) + 0.15rem)`,
                width: `calc(100% / ${CYCLES.length} - 0.3rem)`,
              }}
            />
            {CYCLES.map((c) => {
              const activeState = cycle === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  className={`bl-cycle-btn ${activeState ? 'is-active' : ''}`}
                  onClick={() => setCycle(c.key)}
                >
                  <span>{c.label}</span>
                  {c.tag && <span className="bl-cycle-badge">{c.tag}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Main 2-Column Architecture */}
        <div className="bl-layout">
          {/* ── LEFT: ECONOMIC TELEMETRY & PROOF ── */}
          <aside className="bl-engine">
            {/* Interactive Calculator Card */}
            <div className="bl-card">
              <div className="bl-card__header">
                <span className="bl-card__title">
                  <SlidersHorizontal size={15} color="var(--indigo-soft)" />
                  Monthly Order Economics
                </span>
                <button
                  type="button"
                  className="bl-card__btn-subtle"
                  onClick={() => setShowTuner(true)}
                >
                  Tune parameters
                </button>
              </div>

              <div className="bl-vol-box">
                <div className="bl-vol-label">
                  <span>Your Monthly Order Volume</span>
                  <span className="bl-vol-number">{volume.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="range"
                  id="bl-vol-slider"
                  aria-label="Your monthly order volume"
                  className="bl-vol-slider"
                  min={100}
                  max={15000}
                  step={100}
                  value={volume}
                  onChange={(e) => setVolume(+e.target.value)}
                />
                <div className="bl-vol-chips">
                  {BANDS.map((b): { label: string; target: number; active: boolean } => ({
                    label: `≤ ${b >= 1000 ? `${b / 1000}k` : b}`,
                    target: b,
                    active: band === b,
                  })).concat([{ label: '10k+', target: 15000, active: isCustom }]).map((chip) => (
                    <button
                      key={chip.target}
                      type="button"
                      className={`bl-chip ${chip.active ? 'is-active' : ''}`}
                      onClick={() => setVolume(chip.target)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Economic Outcome Split Cells */}
              <div className="bl-econ-grid">
                <div className="bl-econ-cell bl-econ-cell--loss">
                  <div className="bl-econ-label">
                    <span>Monthly RTO burn today</span>
                  </div>
                  <div className="bl-econ-value">{inr(est.burn)}</div>
                  <p className="bl-econ-desc">
                    ~{est.rtos} COD parcels come back ({Math.round(metrics.codRtoRate * 100)}% of {est.codOrders} COD orders)
                  </p>
                </div>

                <div className="bl-econ-cell bl-econ-cell--saved">
                  <div className="bl-econ-label">
                    <span>Expected saving with {planMeta.name}</span>
                  </div>
                  <div className="bl-econ-value">{inr(est.saved)}</div>
                  <p className="bl-econ-desc">
                    ~<strong>{est.rtosAvoided} fewer RTOs</strong> /month (≈{Math.round(est.reduction * 100)}% of returns)
                  </p>
                </div>
              </div>

              <div className="bl-econ-foot">
                <span>Cost basis: {inr(est.costPerRto)} per RTO (freight + packaging + ad spend)</span>
                <span>{isCustom ? 'Custom plan above 10k orders' : <>About <strong>{+(est.saved / price.monthly).toFixed(1)}×</strong> the plan price</>}</span>
              </div>
              <p className="bl-econ-desc" style={{ marginTop: '0.5rem' }}>
                Estimates from Indian D2C benchmarks, kept conservative. After 30 days your dashboard shows the rupees actually recovered.
              </p>
            </div>

            {/* Feature Spotlight: Address Correction */}
            <div className="bl-spotlight">
              <div className="bl-spotlight__head">
                <div className="bl-spotlight__icon-wrap">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="bl-spotlight__title">Automated WhatsApp Address Correction</h3>
                </div>
              </div>
              <p className="bl-spotlight__body">
                Customers frequently order with outdated saved addresses, missing flat numbers, or incomplete landmarks. RescueShip intercepts the delivery failure instantly before return transit starts:
              </p>
              <div className="bl-spotlight__steps">
                <div className="bl-spotlight__step">
                  <span className="bl-spotlight__step-num">1</span>
                  <span><strong>WhatsApp message:</strong> the buyer hears from your brand soon after the courier reports the failed delivery.</span>
                </div>
                <div className="bl-spotlight__step">
                  <span className="bl-spotlight__step-num">2</span>
                  <span><strong>Location pin:</strong> the buyer shares their location or types a landmark, in English or Hinglish.</span>
                </div>
                <div className="bl-spotlight__step">
                  <span className="bl-spotlight__step-num">3</span>
                  <span><strong>Back to the courier:</strong> the corrected address goes to your courier with a re-attempt request.</span>
                </div>
              </div>
            </div>

            {/* Guarantee Assurance */}
            <div className="bl-guarantee-card">
              <ShieldCheck size={24} className="bl-guarantee-card__icon" />
              <div>
                <h4 className="bl-guarantee-card__title">{LEGAL.guaranteeDays}-day money-back guarantee</h4>
                <p className="bl-guarantee-card__text">
                  If the savings recorded in your dashboard in the first {LEGAL.guaranteeDays} days of your first plan are less than the fees you paid for that period, we refund those fees.{' '}
                  <a href="/terms#guarantee" className="pp-link">Conditions</a>
                </p>
              </div>
            </div>
          </aside>

          {/* ── RIGHT: TIERS & CHECKOUT ── */}
          <main className="bl-plans-pane">
            <div className="bl-tiers-list">
              {PLANS.map((t) => {
                const isSelected = t.key === plan;
                const isRec = t.key === recommendedPlan(volume, metrics);
                const p = priceFor(t.key, band ?? 10000, cycle);
                const e = estimate(volume, metrics, t.key);

                return (
                  <div
                    key={t.key}
                    role="button"
                    tabIndex={0}
                    className={`bl-tier-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => { setPlan(t.key); setPlanTouched(true); }}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { setPlan(t.key); setPlanTouched(true); } }}
                  >
                    <div className="bl-tier-card__left">
                      <div className="bl-tier-card__radio">
                        {isSelected ? <div className="bl-tier-card__radio-dot" /> : null}
                      </div>
                      <div className="bl-tier-card__info">
                        <div className="bl-tier-card__title-row">
                          <span className="bl-tier-card__name">{t.name}</span>
                          {isRec && <span className="bl-tier-card__badge">Recommended for you</span>}
                        </div>
                        <p className="bl-tier-card__volume">{t.tagline} {t.actsWhen}.</p>
                        <p className="bl-tier-card__volume">
                          Covers {t.coverage} · expected <strong>≈{Math.round(t.reduction * 100)}% fewer RTOs</strong> · saves ~{inr(e.saved)}/mo
                        </p>
                        {isSelected && (
                          <ul style={{ margin: '6px 0 0', paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {t.features.map((f) => <li key={f}>{f}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="bl-tier-card__right">
                      {isCustom ? (
                        <span className="bl-tier-card__price">Custom</span>
                      ) : (
                        <>
                          <span className="bl-tier-card__price">
                            {inr(p.monthly)}<small>/mo</small>
                          </span>
                          <span className="bl-tier-card__subtext">
                            {cycle === 'quarterly'
                              ? `Billed ${inr(p.upfront)} / 3 mos`
                              : cycle === 'semi'
                              ? `Billed ${inr(p.upfront)} / 6 mos`
                              : `Billed ${inr(p.upfront)} annually`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Direct Checkout Panel */}
            <div className="bl-checkout-panel">
              <h3 className="bl-checkout-panel__title">Subscription Summary</h3>

              <div className="bl-checkout-summary">
                <div className="bl-summary-row">
                  <span>Selected plan</span>
                  <span>{planMeta.name} · up to {(band ?? CUSTOM_ABOVE).toLocaleString('en-IN')} orders/mo</span>
                </div>
                <div className="bl-summary-row">
                  <span>Billing Commitment</span>
                  <span>{cycleMeta.label} ({cycleMeta.months} months)</span>
                </div>
                <div className="bl-summary-row">
                  <span>WhatsApp message fees</span>
                  <span>Billed by Meta to your WhatsApp account</span>
                </div>
                <div className="bl-summary-row is-free">
                  <span>Platform Setup &amp; Onboarding Support</span>
                  <span>Included Free</span>
                </div>
              </div>

              <div className="bl-checkout-total">
                <div className="bl-checkout-total__label">
                  <span>Due today</span>
                  <small>{LEGAL.guaranteeDays}-day money-back guarantee applies</small>
                </div>
                <span className="bl-checkout-total__amount">{inr(price.upfront)}</span>
              </div>

              <button
                type="button"
                className="bl-btn-checkout"
                disabled={paying}
                onClick={pay}
              >
                {paying ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Opening secure Razorpay checkout…
                  </>
                ) : (
                  <>
                    {allGreen
                      ? `Pay ${inr(price.upfront)} and go live`
                      : isCustom
                      ? 'Write to us for a custom plan'
                      : `Pay ${inr(price.upfront)} for ${planMeta.name}`}
                  </>
                )}
              </button>

              {err && (
                <div style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={15} /> {err}
                </div>
              )}

              <div className="bl-checkout-trust">
                <span><Lock size={12} /> 256-Bit Encrypted</span>
                <span><ShieldCheck size={12} /> Razorpay Verified</span>
                <span><Check size={12} /> UPI / Cards / NetBanking</span>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── PARAMETER TUNING MODAL ── */}
      <AnimatePresence>
        {showTuner && (
          <motion.div
            className="bl-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTuner(false)}
          >
            <motion.div
              className="bl-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="param-modal-title"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bl-modal__head">
                <div>
                  <h3 id="param-modal-title" className="bl-modal__title">Custom Store Economics</h3>
                  {storeSource && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--indigo-soft)', display: 'block', marginTop: '2px' }}>
                      Auto-synced from {storeSource}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="bl-modal__close"
                  onClick={() => setShowTuner(false)}
                  aria-label="Close parameters modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bl-modal__fields">
                <div className="bl-field">
                  <div className="bl-field__label">
                    <span>Average Order Value (AOV)</span>
                    <span className="bl-field__val">₹{metrics.aov.toLocaleString('en-IN')}</span>
                  </div>
                  <input
                    type="range"
                    className="bl-field__slider"
                    min={400}
                    max={8000}
                    step={100}
                    value={metrics.aov}
                    aria-label="Average Order Value"
                    aria-valuetext={`₹${metrics.aov.toLocaleString('en-IN')}`}
                    onChange={(e) => setMetrics((m) => ({ ...m, aov: +e.target.value }))}
                  />
                  <p className="bl-field__sub">Typical ticket size per checkout on your store.</p>
                </div>

                <div className="bl-field">
                  <div className="bl-field__label">
                    <span>Cash on Delivery (COD) Share</span>
                    <span className="bl-field__val">{Math.round(metrics.codPct * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="bl-field__slider"
                    min={0}
                    max={1}
                    step={0.05}
                    value={metrics.codPct}
                    aria-label="Cash on Delivery Share"
                    aria-valuetext={`${Math.round(metrics.codPct * 100)}%`}
                    onChange={(e) => setMetrics((m) => ({ ...m, codPct: +e.target.value }))}
                  />
                  <p className="bl-field__sub">COD orders experience the highest incidence of courier return attempts.</p>
                </div>

                <div className="bl-field">
                  <div className="bl-field__label">
                    <span>COD Orders That Come Back (RTO)</span>
                    <span className="bl-field__val">{Math.round(metrics.codRtoRate * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="bl-field__slider"
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    value={metrics.codRtoRate}
                    aria-label="COD return to origin rate"
                    aria-valuetext={`${Math.round(metrics.codRtoRate * 100)}%`}
                    onChange={(e) => setMetrics((m) => ({ ...m, codRtoRate: +e.target.value }))}
                  />
                  <p className="bl-field__sub">Indian COD orders typically come back 30–40% of the time (fashion is higher).</p>
                </div>

                <div className="bl-field">
                  <div className="bl-field__label">
                    <span>Two-Way Courier RTO Fee</span>
                    <span className="bl-field__val">₹{metrics.courierRto}</span>
                  </div>
                  <input
                    type="range"
                    className="bl-field__slider"
                    min={70}
                    max={250}
                    step={10}
                    value={metrics.courierRto}
                    aria-label="Two-Way Courier RTO Fee"
                    aria-valuetext={`₹${metrics.courierRto}`}
                    onChange={(e) => setMetrics((m) => ({ ...m, courierRto: +e.target.value }))}
                  />
                  <p className="bl-field__sub">Combined forward + reverse freight charged by carrier on undelivered returns.</p>
                </div>

                <div className="bl-field">
                  <div className="bl-field__label">
                    <span>Wasted Ad CAC + Box Damage</span>
                    <span className="bl-field__val">₹{metrics.wastedCac}</span>
                  </div>
                  <input
                    type="range"
                    className="bl-field__slider"
                    min={50}
                    max={400}
                    step={10}
                    value={metrics.wastedCac}
                    aria-label="Wasted Ad CAC and Box Damage"
                    aria-valuetext={`₹${metrics.wastedCac}`}
                    onChange={(e) => setMetrics((m) => ({ ...m, wastedCac: +e.target.value }))}
                  />
                  <p className="bl-field__sub">Sunk Meta/Google ad spend and repackaging materials lost on failed shipments.</p>
                </div>
              </div>

              <div className="bl-modal__actions">
                <button
                  type="button"
                  className="bl-btn-secondary"
                  onClick={() => {
                    setMetrics(DEFAULT_METRICS);
                    setShowTuner(false);
                  }}
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  className="bl-btn-primary"
                  onClick={() => setShowTuner(false)}
                >
                  Apply &amp; Recalculate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
