import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Check,
  ArrowRight,
  SlidersHorizontal,
  MapPin,
  Lock,
  CheckCircle2,
  X,
  Compass,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Tier, Cycle, StoreMetrics } from '../lib/billing';
import {
  TIERS,
  CYCLES,
  DEFAULT_METRICS,
  priceFor,
  lossFor,
  recommendedTier,
  inr,
  billingApi,
  loadRazorpay,
} from '../lib/billing';
import { connectApi } from '../lib/connect';
import './billing.css';

export default function BillingPage() {
  const { token, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [volume, setVolume] = useState<number>(() => {
    const q = params.get('v');
    const stored = localStorage.getItem('rs_volume');
    return Number(q || stored || 1000);
  });
  const [tier, setTier] = useState<Tier>(() => recommendedTier(volume));
  const [cycle, setCycle] = useState<Cycle>('quarterly');
  const [paying, setPaying] = useState(false);
  const [active, setActive] = useState<any>(null);
  const [setupCallUrl, setSetupCallUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Store metrics for customized RTO calculation
  const [metrics, setMetrics] = useState<StoreMetrics>(DEFAULT_METRICS);
  const [storeSource, setStoreSource] = useState<string | null>(null);
  const [onboardingState, setOnboardingState] = useState<any>(null);

  // Parameters modal
  const [showTuner, setShowTuner] = useState(false);

  useEffect(() => {
    localStorage.setItem('rs_volume', String(volume));
    setTier(recommendedTier(volume));
  }, [volume]);

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

  const loss = useMemo(() => lossFor(volume, metrics), [volume, metrics]);
  const price = useMemo(() => priceFor(tier, cycle), [tier, cycle]);
  const cycleMeta = CYCLES.find((c) => c.key === cycle)!;
  const tierMeta = TIERS.find((t) => t.key === tier)!;

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
      const order = await billingApi.checkout(token!, tier, cycle);
      const rz = new (window as any).Razorpay({
        key: order.keyId,
        ...(order.subscriptionId ? { subscription_id: order.subscriptionId } : {}),
        order_id: order.orderId,
        name: 'RescueShip',
        description: `${tierMeta.name} · ${cycleMeta.label} · ${inr(price.monthly)}/mo (90-Day Guarantee)`,
        amount: order.amountInr,
        currency: order.currency || 'INR',
        prefill: { email: user?.email, contact: (user as any)?.phone },
        theme: { color: '#4f46e5' },
        handler: async (resp: any) => {
          try {
            const verified = await billingApi.verify(token!, { ...resp, tier, cycle });
            setActive(verified);
            nav('/onboarding?subscribed=true');
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
              ← {user?.onboardingStatus === 'completed' ? 'Dashboard' : 'Continue Onboarding'}
            </button>
          </header>

          <motion.div
            className="bl-receipt-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="bl-receipt-card__status">
              <CheckCircle2 size={14} /> Plan active · 90-day guarantee protected
            </span>
            <h1 className="bl-receipt-card__title">{active.plan} Tier</h1>
            <p className="bl-receipt-card__sub">
              Your automated WhatsApp NDR rescue service is active and monitoring store logistics.
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
                <span>Meta WhatsApp API Surcharges</span>
                <span style={{ color: '#34d399' }}>100% Paid by RescueShip</span>
              </div>
            </div>

            <div className="bl-receipt-card__actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {setupCallUrl && (
                <a
                  className="bl-btn-secondary"
                  href={setupCallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', textDecoration: 'none', width: '100%', padding: '0.8rem' }}
                >
                  <ExternalLink size={15} /> Book Free 15-Min Guided Setup Call
                </a>
              )}
              <button className="bl-btn-primary" style={{ width: '100%' }} onClick={() => nav(user?.onboardingStatus === 'completed' ? '/dashboard' : '/onboarding?subscribed=true')}>
                {user?.onboardingStatus === 'completed' ? 'Open Dashboard →' : 'Continue to Onboarding →'}
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
              Step 1 of 2 · Plan & Guarantee
            </span>
            <button className="bl-nav__back" onClick={() => nav('/onboarding')}>
              ← Back to Onboarding
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bl-hero">
          <div className="bl-hero__badge">
            <ShieldCheck size={14} />
            <span>90-Day &ldquo;Pays-For-Itself&rdquo; Guarantee · Zero Risk</span>
          </div>
          <h1 className="bl-hero__title">
            Stop losing capital on courier delivery failures.
          </h1>
          <p className="bl-hero__sub">
            RescueShip intercepts courier NDRs in real-time, verifying customer addresses and re-attempt schedules via WhatsApp. Select your order volume below to lock in protection.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="bl-cycle-wrap">
            <motion.div
              className="bl-cycle-pill"
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              style={{
                left: cycleIdx === 0 ? '0.3rem' : 'calc(50% + 0.15rem)',
                width: 'calc(50% - 0.45rem)',
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
                  <SlidersHorizontal size={15} color="#818cf8" />
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
                  min={500}
                  max={25000}
                  step={500}
                  value={volume}
                  onChange={(e) => setVolume(+e.target.value)}
                />
                <div className="bl-vol-chips">
                  {[
                    { label: 'Up to 1k', target: 1000, active: volume <= 1000 },
                    { label: '1k – 5k', target: 5000, active: volume > 1000 && volume <= 5000 },
                    { label: '5k – 12k', target: 12000, active: volume > 5000 && volume <= 12000 },
                    { label: '12k – 25k', target: 25000, active: volume > 12000 },
                  ].map((chip) => (
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
                    <span>Estimated RTO Loss</span>
                  </div>
                  <div className="bl-econ-value">₹{loss.loss.toLocaleString('en-IN')}</div>
                  <p className="bl-econ-desc">
                    ~{loss.failedDeliveries} failed shipments without real-time rescue
                  </p>
                </div>

                <div className="bl-econ-cell bl-econ-cell--saved">
                  <div className="bl-econ-label">
                    <span>Projected Recovery</span>
                  </div>
                  <div className="bl-econ-value">₹{loss.saved.toLocaleString('en-IN')}</div>
                  <p className="bl-econ-desc">
                    ~<strong>{loss.rescuesPerMonth} rescued</strong> /month (~{loss.rescuesPerWeek}/wk)
                  </p>
                </div>
              </div>

              <div className="bl-econ-foot">
                <span>Cost basis: ₹{loss.costPerFailed}/return (Courier + Packaging)</span>
                <span>Net ROI: <strong>{+(loss.saved / price.monthly).toFixed(1)}x Plan Value</strong></span>
              </div>
            </div>

            {/* Feature Spotlight: Address Correction */}
            <div className="bl-spotlight">
              <div className="bl-spotlight__head">
                <div className="bl-spotlight__icon-wrap">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="bl-spotlight__title">Automated WhatsApp Address Correction</h3>
                  <span className="bl-spotlight__badge">Solves 38% of all Indian RTOs</span>
                </div>
              </div>
              <p className="bl-spotlight__body">
                Customers frequently order with outdated saved addresses, missing flat numbers, or incomplete landmarks. RescueShip intercepts the delivery failure instantly before return transit starts:
              </p>
              <div className="bl-spotlight__steps">
                <div className="bl-spotlight__step">
                  <span className="bl-spotlight__step-num">1</span>
                  <span><strong>Instant WhatsApp Ping:</strong> Shopper receives automated WhatsApp message within 60s of courier NDR.</span>
                </div>
                <div className="bl-spotlight__step">
                  <span className="bl-spotlight__step-num">2</span>
                  <span><strong>Live GPS Pin Drop:</strong> Customer drops WhatsApp location pin without typing long confusing instructions.</span>
                </div>
                <div className="bl-spotlight__step">
                  <span className="bl-spotlight__step-num">3</span>
                  <span><strong>Carrier API Push:</strong> Validated coordinates sync directly into Shiprocket &amp; Delhivery for immediate reattempt.</span>
                </div>
              </div>
            </div>

            {/* Guarantee Assurance */}
            <div className="bl-guarantee-card">
              <ShieldCheck size={24} className="bl-guarantee-card__icon" />
              <div>
                <h4 className="bl-guarantee-card__title">The 90-Day &ldquo;Pays-For-Itself&rdquo; Commitment</h4>
                <p className="bl-guarantee-card__text">
                  Use RescueShip for 90 days. If your documented RTO savings do not exceed what you spent on our platform fee, our support team will refund your entire subscription immediately. Zero risk.
                </p>
              </div>
            </div>
          </aside>

          {/* ── RIGHT: TIERS & CHECKOUT ── */}
          <main className="bl-plans-pane">
            <div className="bl-tiers-list">
              {TIERS.map((t) => {
                const isSelected = t.key === tier;
                const isRec = t.key === recommendedTier(volume);
                const p = priceFor(t.key, cycle);

                return (
                  <div
                    key={t.key}
                    role="button"
                    tabIndex={0}
                    className={`bl-tier-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setTier(t.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTier(t.key); }}
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
                        <p className="bl-tier-card__volume">
                          Up to {t.orders.toLocaleString('en-IN')} orders/mo · {t.blurb}
                        </p>
                      </div>
                    </div>

                    <div className="bl-tier-card__right">
                      <span className="bl-tier-card__price">
                        {inr(p.monthly)}<small>/mo</small>
                      </span>
                      <span className="bl-tier-card__subtext">
                        {cycle === 'quarterly' ? `Billed ${inr(p.upfront)} / 3 mos` : `Billed ${inr(p.upfront)} annually`}
                      </span>
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
                  <span>Selected Tier</span>
                  <span>{tierMeta.name} Plan ({tierMeta.orders.toLocaleString('en-IN')} orders/mo)</span>
                </div>
                <div className="bl-summary-row">
                  <span>Billing Commitment</span>
                  <span>{cycleMeta.label} ({cycleMeta.months} months)</span>
                </div>
                <div className="bl-summary-row is-free">
                  <span>Meta WhatsApp API Platform Fees</span>
                  <span>100% Paid by RescueShip</span>
                </div>
                <div className="bl-summary-row is-free">
                  <span>Platform Setup &amp; Onboarding Support</span>
                  <span>Included Free</span>
                </div>
              </div>

              <div className="bl-checkout-total">
                <div className="bl-checkout-total__label">
                  <span>Due today</span>
                  <small>Protected by 90-Day Money-Back Guarantee</small>
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
                    <RefreshCw size={18} className="animate-spin" />
                    Opening secure Razorpay checkout…
                  </>
                ) : (
                  <>
                    {allGreen
                      ? `Subscribe & Activate (${inr(price.upfront)})`
                      : `Lock In ${tierMeta.name} (${inr(price.upfront)}) & Connect Store`}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {err && (
                <div style={{ color: '#fb7185', fontSize: '0.8rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bl-modal__head">
                <div>
                  <h3 className="bl-modal__title">Custom Store Economics</h3>
                  {storeSource && (
                    <span style={{ fontSize: '0.72rem', color: '#818cf8', display: 'block', marginTop: '2px' }}>
                      Auto-synced from {storeSource}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="bl-modal__close"
                  onClick={() => setShowTuner(false)}
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
                    onChange={(e) => setMetrics((m) => ({ ...m, codPct: +e.target.value }))}
                  />
                  <p className="bl-field__sub">COD orders experience the highest incidence of courier return attempts.</p>
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
