import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useMagnetic } from '../hooks/useMagnetic';
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
  const { token, user, updateUser } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mag = useMagnetic(0.22);

  const [volume, setVolume] = useState<number>(() => {
    const q = params.get('v');
    const stored = localStorage.getItem('rs_volume');
    return Number(q || stored || 1000);
  });
  const [tier, setTier] = useState<Tier>(() => recommendedTier(volume));
  const [cycle, setCycle] = useState<Cycle>('quarterly');
  const [drawer, setDrawer] = useState(false);
  const [paying, setPaying] = useState(false);
  const [active, setActive] = useState<any>(null); // set after success / if already subscribed
  const [setupCallUrl, setSetupCallUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Store metrics for customized RTO calculation
  const [metrics, setMetrics] = useState<StoreMetrics>(DEFAULT_METRICS);
  const [shopifySource, setShopifySource] = useState<string | null>(null);
  const [onboardingState, setOnboardingState] = useState<any>(null);

  // Step-by-step Questionnaire state
  const [showQuiz, setShowQuiz] = useState<boolean>(() => params.get('from') === 'onboarding');
  const [quizStep, setQuizStep] = useState<number>(1);

  useEffect(() => {
    localStorage.setItem('rs_volume', String(volume));
    setTier(recommendedTier(volume));
  }, [volume]);

  useEffect(() => {
    if (!token) return;
    billingApi.status(token).then((s) => {
      if (s.active) setActive(s);
    }).catch(() => {});

    connectApi.state(token).then((s: any) => {
      setOnboardingState(s);
      if (s?.setupCallUrl) setSetupCallUrl(s.setupCallUrl);
    }).catch(() => {});

    connectApi.shopifyMetrics(token).then((m: any) => {
      if (m?.available) {
        setMetrics((prev) => ({
          ...prev,
          aov: m.aov || prev.aov,
          codPct: typeof m.codPct === 'number' ? m.codPct : prev.codPct,
        }));
        if (m.monthlyOrders) {
          setVolume(m.monthlyOrders);
        }
        setShopifySource(m.storeDomain || 'Shopify');
      }
    }).catch(() => {});
  }, [token]);

  const loss = useMemo(() => lossFor(volume, metrics), [volume, metrics]);
  const price = useMemo(() => priceFor(tier, cycle), [tier, cycle]);
  const cycleMeta = CYCLES.find((c) => c.key === cycle)!;
  const tierMeta = TIERS.find((t) => t.key === tier)!;

  // The geometry argument: how thin the price slice is vs the loss
  const pricePct = loss.loss > 0 ? Math.max(2, Math.min(100, (price.monthly / loss.loss) * 100)) : 100;

  const barRef = useRef<HTMLDivElement>(null);
  const barIn = useInView(barRef, { once: true, margin: '-60px' });

  // Connected stations tally
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
      if (!ok) throw new Error('Payment SDK failed to load. Check your connection.');
      const order = await billingApi.checkout(token!, tier, cycle);
      const rz = new (window as any).Razorpay({
        key: order.keyId,
        subscription_id: order.subscriptionId,
        order_id: order.orderId,
        name: 'RescueShip',
        description: `${tierMeta.name} · ${cycleMeta.label} · ${inr(price.monthly)}/mo (90-Day Guarantee)`,
        amount: order.amountInr,
        currency: order.currency || 'INR',
        prefill: { email: user?.email, contact: (user as any)?.phone },
        theme: { color: '#6366f1' },
        handler: async (resp: any) => {
          try {
            const verified = await billingApi.verify(token!, { ...resp, tier, cycle });
            setActive(verified);
            setDrawer(false);

            // If all 4 integrations were ready, finalize onboarding right away
            if (allGreen) {
              try {
                await connectApi.finalize(token!);
                updateUser({ onboardingStatus: 'completed' });
              } catch {
                // If finalize fails (e.g. sandbox check), proceed gracefully
              }
            }
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

  /* ── STATE 1: ALREADY ACTIVE SUBSCRIPTION ── */
  if (active) {
    const formattedStartDate = active.activatedAt
      ? new Date(active.activatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const formattedEndDate = active.nextInvoice
      ? new Date(active.nextInvoice).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

    return (
      <div className="bl">
        <div className="bl-paper" aria-hidden="true" />
        <div className="bl-grain" aria-hidden="true" />
        <Topbar onExit={() => nav(allGreen ? '/dashboard' : '/onboarding')} />

        <motion.div
          className="bl-receipt"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <svg viewBox="0 0 24 24" className="bl-receipt__check">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <p className="bl-receipt__kicker">Plan active · 90-day guarantee protected</p>
          <h1>{active.plan} <em>· active</em></h1>

          <div className="bl-receipt__rows">
            <Row k="Current Plan" v={`${active.plan.toUpperCase()} (up to ${Number(active.limit).toLocaleString('en-IN')} orders/mo)`} />
            <Row k="Subscription Rate" v={`${inr(active.renewMonthly)}/mo · ${active.cycle || 'quarterly'}`} />
            <Row k="Start Date" v={formattedStartDate} />
            <Row k="End / Renewal Date" v={formattedEndDate} accent />
            <Row k="Meta / WhatsApp API Costs" v="100% Paid by RescueShip" />
          </div>

          {!allGreen && (
            <div className="bl-incomplete-banner" style={{ marginTop: '1.5rem' }}>
              <span>⚠️ Integrations in progress ({connectedCount}/4 connected). Finish connecting your store and courier to begin live rescues.</span>
              <button onClick={() => nav('/onboarding')}>Go to Onboarding →</button>
            </div>
          )}

          {setupCallUrl && (
            <div className="bl-callout">
              <p className="bl-callout__title">📞 Free guided setup call</p>
              <p className="bl-callout__sub">
                Your plan is live — let's finish the store, WhatsApp, courier, and payment wiring together in 15 minutes.
              </p>
              <div className="bl-callout__actions">
                <a className="bl-callout__btn" href={setupCallUrl} target="_blank" rel="noopener noreferrer">
                  Book your setup call →
                </a>
                <button className="bl-link bl-link--mute" onClick={() => nav(allGreen ? '/dashboard' : '/onboarding')}>
                  {allGreen ? 'Go to dashboard' : 'Continue self-setup'}
                </button>
              </div>
            </div>
          )}

          <div className="bl-receipt__foot">
            <button className="bl-link" onClick={() => nav('/dashboard')}>
              Open dashboard →
            </button>
            <button className="bl-link bl-link--mute" onClick={() => nav('/settings')}>
              Settings & logs
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── STATE 2: NOT SUBSCRIBED — SLIDER + QUESTIONS + PLAN MANIFEST ── */
  return (
    <div className="bl">
      <div className="bl-paper" aria-hidden="true" />
      <div className="bl-grain" aria-hidden="true" />
      <div className="bl-col-sweep" aria-hidden="true" />
      <Topbar onExit={() => nav(allGreen ? '/dashboard' : '/onboarding')} />

      {/* ── 90-DAY GUARANTEE HERO BANNER ── */}
      <section className="bl-guarantee-hero" aria-label="90-Day Pays-For-Itself Guarantee">
        <div className="bl-guarantee-hero__icon">🛡️</div>
        <div className="bl-guarantee-hero__content">
          <div className="bl-guarantee-hero__title">
            The 90-Day &ldquo;Pays-For-Itself&rdquo; Guarantee
            <span className="bl-guarantee-hero__badge">Zero Risk</span>
          </div>
          <p className="bl-guarantee-hero__body">
            Use RescueShip risk-free for your first 3 months. If your total RTO savings over 90 days don&apos;t beat our subscription fee, we&apos;ll refund your entire trial.
          </p>
          <p className="bl-guarantee-hero__sub">
            Every returned order burns ₹350+. It only takes a handful of rescued deliveries a month for the platform to completely pay for itself. We take all the risk so you can protect your margins.
          </p>
        </div>
        <div className="bl-guarantee-hero__pill">
          ✓ Meta API Costs 100% Paid by Us
        </div>
      </section>

      {/* ── INCOMPLETE ONBOARDING STATUS REMINDER (If visited before all 4 stations are connected) ── */}
      {!allGreen && (
        <div className="bl-incomplete-banner" style={{ maxWidth: '1180px', margin: '0 auto 2rem' }}>
          <span>
            ⚡ Integrations in progress ({connectedCount}/4 connected). You can pick your plan and lock in your 90-day guarantee now, and complete integrations anytime.
          </span>
          <button onClick={() => nav('/onboarding')}>Return to Onboarding →</button>
        </div>
      )}

      <div className="bl-shell">
        {/* ── LEFT: YOUR POSITION — ORDERS SLIDER, PARAMETERS CARD & LOSS ENGINE ── */}
        <aside className="bl-position">
          <p className="bl-kicker">Your position this month</p>

          <div className="bl-vol">
            <label htmlFor="volume-range-input">Monthly orders</label>
            <input
              id="volume-range-input"
              aria-label="Monthly orders volume"
              type="range"
              min={500}
              max={50000}
              step={500}
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
            />
            <span className="bl-vol__n">{volume.toLocaleString('en-IN')}</span>
          </div>

          {/* Dynamic Parameters Summary Card with link to step-by-step questions */}
          <div className="bl-params-card">
            <div className="bl-params-card__head">
              <span>RTO Cost Parameters</span>
              <button
                type="button"
                className="bl-params-card__btn"
                onClick={() => { setQuizStep(1); setShowQuiz(true); }}
              >
                Tune with questions ✏️
              </button>
            </div>
            <div className="bl-params-grid">
              <div className="bl-param-item">
                <small>Average Order (AOV)</small>
                <strong>₹{metrics.aov.toLocaleString('en-IN')}</strong>
              </div>
              <div className="bl-param-item">
                <small>Cash on Delivery (COD)</small>
                <strong>{Math.round(metrics.codPct * 100)}%</strong>
              </div>
              <div className="bl-param-item">
                <small>Courier 2-Way RTO</small>
                <strong>₹{metrics.courierRto}</strong>
              </div>
              <div className="bl-param-item">
                <small>Wasted Ad CAC + Box</small>
                <strong>₹{metrics.wastedCac}</strong>
              </div>
            </div>
          </div>

          <div className="bl-loss">
            <span className="bl-loss__cur">₹</span>
            <span className="bl-loss__n">{Math.round(loss.loss).toLocaleString('en-IN')}</span>
            <span className="bl-loss__lbl">
              at risk · estimated {loss.failedDeliveries.toLocaleString('en-IN')} failed deliveries (@ ₹{loss.costPerFailed}/return)
            </span>
          </div>

          {/* The proportional rule — the visual geometry */}
          <div className="bl-rule" ref={barRef}>
            <div className="bl-rule__track">
              <motion.div
                className="bl-rule__loss"
                initial={{ width: 0 }}
                animate={barIn ? { width: '100%' } : {}}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="bl-rule__price"
                initial={{ width: 0 }}
                animate={barIn ? { width: `${pricePct}%` } : { width: `${pricePct}%` }}
                key={`${tier}-${cycle}`}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              />
            </div>
            <div className="bl-rule__legend">
              <span><i className="dot dot--loss" /> your monthly loss</span>
              <span><i className="dot dot--price" /> {tierMeta.name} · {inr(price.monthly)}/mo</span>
            </div>
            <LossTooltip metrics={metrics} />
          </div>

          <p className="bl-pace">
            At this volume, RescueShip rescues roughly
            <motion.span className="bl-pace__n" key={loss.rescuesPerWeek} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }}>
              {' '}{loss.rescuesPerWeek}{' '}
            </motion.span>
            deliveries a week — saving approx <strong>{inr(loss.saved)}/mo</strong>.
          </p>
        </aside>

        {/* ── RIGHT: THE MANIFEST OF 4 TIERS & CHECKOUT ── */}
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
                  type="button"
                  className={`bl-row ${chosen ? 'is-chosen' : ''} ${rec ? 'is-rec' : ''}`}
                  onClick={() => setTier(t.key)}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="bl-row__rail" aria-hidden="true">
                    {rec && <span className="bl-row__anchor">⚓</span>}
                  </span>
                  <span className="bl-row__main">
                    <span className="bl-row__name">
                      {t.name}
                      {rec && <em className="bl-row__rec">recommended for you</em>}
                    </span>
                    <span className="bl-row__cap">
                      up to {t.orders.toLocaleString('en-IN')} orders/mo · {t.blurb}
                    </span>
                  </span>
                  <span className="bl-row__price">
                    <span className="bl-row__intro">
                      {inr(p.monthly)}<small>/mo</small>
                    </span>
                    <span className="bl-row__renew">
                      {cycle === 'quarterly' ? 'Quarterly trial' : 'Annual billing'}
                      {cycleMeta.tag && <b> · {cycleMeta.tag}</b>}
                    </span>
                  </span>
                  <span className="bl-row__pick" aria-hidden="true">
                    {chosen ? (
                      <svg viewBox="0 0 24 24" className="bl-row__check">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="bl-row__radio" />
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <p className="bl-manifest__note">
            No per-rescue commissions. No WhatsApp messaging surcharges (paid 100% by us). Cancel anytime before renewal.
            Enterprise volume (25k+ orders/mo)? <button type="button" className="bl-link" onClick={() => nav('/register')}>Talk to team</button>
          </p>

          <div className="bl-manifest__cta">
            <div className="bl-manifest__total">
              <span>Due today <small>({cycleMeta.label}, 90-Day Guarantee)</small></span>
              <strong>{inr(price.upfront)}</strong>
            </div>
            <button
              type="button"
              className="bl-subscribe"
              ref={mag.ref as any}
              onMouseMove={mag.onMouseMove}
              onMouseLeave={mag.onMouseLeave}
              onClick={() => setDrawer(true)}
            >
              Subscribe & go live <span className="bl-subscribe__arrow">→</span>
            </button>
          </div>
          {err && <p className="bl-err">⚠ {err}</p>}
        </main>
      </div>

      {/* ── STEP-BY-STEP QUESTIONNAIRE MODAL ── */}
      <AnimatePresence>
        {showQuiz && (
          <motion.div
            className="bl-quiz-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowQuiz(false)}
          >
            <motion.div
              className="bl-quiz-box"
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bl-quiz-top">
                <span className="bl-quiz-progress">Step {quizStep} of 4 · RTO Cost Calculator</span>
                <button type="button" className="bl-quiz-close" onClick={() => setShowQuiz(false)} aria-label="Close">✕</button>
              </div>

              {quizStep === 1 && (
                <div>
                  {shopifySource && (
                    <div className="bl-shopify-pill">
                      <span>🛍️</span> Synced from {shopifySource}
                    </div>
                  )}
                  <h2 className="bl-quiz-title">What is your Average Order Value (AOV)?</h2>
                  <p className="bl-quiz-sub">
                    When high-ticket orders return to origin, inventory lockup and lost margins are twice as severe.
                  </p>
                  <div className="bl-quiz-val-display">
                    <span className="bl-quiz-val-unit">₹</span>
                    <span className="bl-quiz-val-n">{metrics.aov.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bl-quiz-slider-wrap">
                    <input
                      type="range"
                      className="bl-quiz-slider"
                      min={400}
                      max={10000}
                      step={100}
                      value={metrics.aov}
                      onChange={(e) => setMetrics((m) => ({ ...m, aov: +e.target.value }))}
                    />
                    <div className="bl-quiz-slider-ticks">
                      <span>₹400</span>
                      <span>₹5,000</span>
                      <span>₹10,000</span>
                    </div>
                  </div>
                </div>
              )}

              {quizStep === 2 && (
                <div>
                  {shopifySource && (
                    <div className="bl-shopify-pill">
                      <span>🛍️</span> Analyzed from store payment gateways
                    </div>
                  )}
                  <h2 className="bl-quiz-title">What % of your orders are Cash on Delivery (COD)?</h2>
                  <p className="bl-quiz-sub">
                    In India, COD orders face 20–35% RTO, whereas prepaid orders only experience 2–4%. COD is the #1 driver of failed deliveries.
                  </p>
                  <div className="bl-quiz-val-display">
                    <span className="bl-quiz-val-n">{Math.round(metrics.codPct * 100)}</span>
                    <span className="bl-quiz-val-unit">%</span>
                  </div>
                  <div className="bl-quiz-slider-wrap">
                    <input
                      type="range"
                      className="bl-quiz-slider"
                      min={0}
                      max={1}
                      step={0.05}
                      value={metrics.codPct}
                      onChange={(e) => setMetrics((m) => ({ ...m, codPct: +e.target.value }))}
                    />
                    <div className="bl-quiz-slider-ticks">
                      <span>0% (All Prepaid)</span>
                      <span>50%</span>
                      <span>100% (All COD)</span>
                    </div>
                  </div>
                </div>
              )}

              {quizStep === 3 && (
                <div>
                  <h2 className="bl-quiz-title">What is your two-way courier RTO charge?</h2>
                  <p className="bl-quiz-sub">
                    The combined forward shipping + reverse return shipping fee billed by Shiprocket, Delhivery, or BlueDart when an order fails.
                  </p>
                  <div className="bl-quiz-val-display">
                    <span className="bl-quiz-val-unit">₹</span>
                    <span className="bl-quiz-val-n">{metrics.courierRto}</span>
                  </div>
                  <div className="bl-quiz-slider-wrap">
                    <input
                      type="range"
                      className="bl-quiz-slider"
                      min={60}
                      max={300}
                      step={10}
                      value={metrics.courierRto}
                      onChange={(e) => setMetrics((m) => ({ ...m, courierRto: +e.target.value }))}
                    />
                    <div className="bl-quiz-slider-ticks">
                      <span>₹60 (Local)</span>
                      <span>₹140 (National avg)</span>
                      <span>₹300 (Heavy/Air)</span>
                    </div>
                  </div>
                </div>
              )}

              {quizStep === 4 && (
                <div>
                  <h2 className="bl-quiz-title">Wasted Ad Spend (CAC) + Packaging Damage per Return?</h2>
                  <p className="bl-quiz-sub">
                    Meta/Google ad dollars spent to acquire the customer, plus damaged packaging boxes and inspection labor.
                  </p>
                  <div className="bl-quiz-val-display">
                    <span className="bl-quiz-val-unit">₹</span>
                    <span className="bl-quiz-val-n">{metrics.wastedCac}</span>
                  </div>
                  <div className="bl-quiz-slider-wrap">
                    <input
                      type="range"
                      className="bl-quiz-slider"
                      min={50}
                      max={600}
                      step={25}
                      value={metrics.wastedCac}
                      onChange={(e) => setMetrics((m) => ({ ...m, wastedCac: +e.target.value }))}
                    />
                    <div className="bl-quiz-slider-ticks">
                      <span>₹50 (Organic)</span>
                      <span>₹250 (Typical D2C)</span>
                      <span>₹600 (High CAC)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bl-quiz-foot">
                {quizStep > 1 ? (
                  <button type="button" className="bl-quiz-btn bl-quiz-btn--subtle" onClick={() => setQuizStep((s) => s - 1)}>
                    ← Back
                  </button>
                ) : (
                  <button type="button" className="bl-quiz-btn bl-quiz-btn--subtle" onClick={() => setShowQuiz(false)}>
                    Use Defaults
                  </button>
                )}

                {quizStep < 4 ? (
                  <button type="button" className="bl-quiz-btn bl-quiz-btn--primary" onClick={() => setQuizStep((s) => s + 1)}>
                    Next Question →
                  </button>
                ) : (
                  <button type="button" className="bl-quiz-btn bl-quiz-btn--primary" onClick={() => setShowQuiz(false)}>
                    Apply & View Plans →
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CHECKOUT DRAWER ── */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            className="bl-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !paying && setDrawer(false)}
          >
            <motion.aside
              className="bl-drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="bl-drawer__x" onClick={() => !paying && setDrawer(false)} aria-label="Close">
                ✕
              </button>
              <p className="bl-kicker">Checkout · 90-Day Guarantee</p>
              <h2>{tierMeta.name} · {cycleMeta.label}</h2>

              <div className="bl-drawer__ledger">
                <Row k={`${tierMeta.name} Plan (${tierMeta.orders.toLocaleString('en-IN')} orders/mo)`} v={`${inr(price.monthly)}/mo`} />
                <Row k="Billing Cycle" v={`${cycleMeta.label} (${cycleMeta.months} months)`} />
                <Row k="Meta / WhatsApp Conversation Costs" v="100% Paid by RescueShip" accent />
                <Row k="Guarantee" v="100% Refund if savings < subscription fee" accent />
                <div className="bl-drawer__due">
                  <span>Total Due Today</span>
                  <strong>{inr(price.upfront)}</strong>
                </div>
              </div>

              <p className="bl-drawer__fine">
                Protected by the 90-Day &ldquo;Pays-For-Itself&rdquo; Guarantee. If your total RTO savings over the 3-month trial don&apos;t exceed your subscription fee, contact us for a full refund. Secured by Razorpay · encrypted at rest.
              </p>

              <button
                type="button"
                className="bl-subscribe bl-subscribe--full"
                disabled={paying}
                onClick={pay}
                ref={mag.ref as any}
                onMouseMove={mag.onMouseMove}
                onMouseLeave={mag.onMouseLeave}
              >
                {paying ? 'Opening secure checkout…' : <>Pay {inr(price.upfront)} & activate <span className="bl-subscribe__arrow">→</span></>}
              </button>
              {err && <p className="bl-err">⚠ {err}</p>}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── SMALL HELPER PIECES ── */
function Topbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="bl-top">
      <a href="/" className="bl-brand">
        <span>⚓</span> RescueShip
      </a>
      <span className="bl-top__crumb">Onboarding <i>/</i> <strong>Billing & Guarantee</strong></span>
      <button type="button" className="bl-top__exit" onClick={onExit}>← back</button>
    </header>
  );
}

function Row({ k, v, accent, mute }: { k: string; v: string; accent?: boolean; mute?: boolean }) {
  return (
    <div className={`bl-ledger-row ${accent ? 'accent' : ''} ${mute ? 'mute' : ''}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function CycleSwitch({ value, onChange }: { value: Cycle; onChange: (c: Cycle) => void }) {
  const idx = CYCLES.findIndex((c) => c.key === value);
  return (
    <div className="bl-cycle" role="tablist" aria-label="Billing cycle">
      <motion.span
        className="bl-cycle__knob"
        layout
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        style={{ left: `calc(${idx} * (100% / 2))`, width: `calc(100% / 2)` }}
      />
      {CYCLES.map((c) => (
        <button
          key={c.key}
          type="button"
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

function LossTooltip({ metrics }: { metrics: StoreMetrics }) {
  const parts = [
    ['Wasted CAC + Packaging', metrics.wastedCac],
    ['Two-way courier RTO shipping', metrics.courierRto],
  ] as const;

  return (
    <div className="bl-tip" role="note">
      <span className="bl-tip__h">Cost breakdown per failed delivery</span>
      {parts.map(([l, a]) => (
        <span key={l} className="bl-tip__r">
          <i>{l}</i>
          <b>₹{a}</b>
        </span>
      ))}
      <span className="bl-tip__r" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.3rem', marginTop: '0.2rem' }}>
        <i>Total cost per return</i>
        <b style={{ color: 'var(--rose)' }}>₹{metrics.courierRto + metrics.wastedCac}</b>
      </span>
    </div>
  );
}
