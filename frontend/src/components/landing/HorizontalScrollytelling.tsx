import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useReducedMotion, useMotionValueEvent } from 'motion/react';
import { Zap, Terminal } from 'lucide-react';
import { AccountabilityScene } from './AccountabilityScene';
import { RescueScene } from '../story/RescueScene';
import { SpotlightCard } from '../SpotlightCard';

interface OrderCard {
  id: string;
  awb: string;
  amount: string;
  status: 'failed' | 'pending' | 'rescued' | 'cancelled';
}

interface HorizontalScrollytellingProps {
  booted: boolean;
  failedOrders: OrderCard[];
  rescuedOrders: OrderCard[];
  cancelledOrders: OrderCard[];
}

const LOSS_PARTS = [
  { label: 'Customer acquisition cost (CAC)', amount: 230 },
  { label: 'Forward freight committed', amount: 80 },
  { label: 'Reverse RTO freight penalty', amount: 80 },
  { label: 'Repackaging, QA & restocking', amount: 40 },
];

const PIPELINE_STAGES = [
  {
    id: 0,
    time: '00s',
    label: 'Fake Scan Detected',
    carrier: 'DELHIVERY_SURFACE · AWB #4023118876',
    status: 'FAKE ATTEMPT DETECTED (99.4%)',
    telemetry: 'Rider marked "Door Locked" 1.42km outside buyer geofence · 0s telephony talk time.',
    action: 'Webhook fired to RescueShip engine within 400ms.',
    payload: 'POST /api/webhooks/carrier/ndr {"awb": "4023118876", "reason": "CUSTOMER_UNAVAILABLE", "drift": "1.42km"}',
    pnl: {
      headline: 'At-Risk Gross Value',
      value: '₹1,240',
      detail: 'Package scheduled for reverse transit within 120s if unverified.',
      badge: 'RISK ESCALATED',
      badgeTone: 'alert',
    },
  },
  {
    id: 1,
    time: '+12s',
    label: 'WhatsApp Dispatched',
    carrier: 'META CLOUD API · OFFICIAL WABA',
    status: '1-TAP TEMPLATE DELIVERED',
    telemetry: 'WhatsApp Business API fires official verified interactive prompt directly to buyer.',
    action: 'Delivered in 1.2s · Zero app download required.',
    payload: 'WABA_DISPATCH {"to": "+9198765*****", "template": "rs_ndr_instant_v2", "buttons": ["🏠 I am Home", "📅 Reschedule", "❌ Cancel"]}',
    pnl: {
      headline: 'Autonomous Intercept Cost',
      value: '₹0.48',
      detail: 'Standard Meta Utility message fee. Eliminates ₹430 RTO cost.',
      badge: 'ACTIVE RESCUE',
      badgeTone: 'wa',
    },
  },
  {
    id: 2,
    time: '+48s',
    label: 'Buyer Verified & GPS Pin',
    carrier: 'BUYER LIVE VERIFICATION',
    status: 'BUYER COUNTER-PROOF CONFIRMED',
    telemetry: 'Buyer taps "I am Home Now" and shares precise GPS location pin (+12.9716, +77.5946).',
    action: 'Counter-proof encrypted with DPDP-compliant telemetry hash.',
    payload: 'BUYER_REPLY {"status": "HOME_PRESENT", "lat": 12.9716, "lng": 77.5946, "notes": "Tower B, Flat 402, 4th floor"}',
    pnl: {
      headline: 'COD Pre-Paid Conversion',
      value: '₹1,178 Paid',
      detail: 'Buyer converted COD to UPI with 5% instant discount.',
      badge: 'RTO RISK: 0%',
      badgeTone: 'success',
    },
  },
  {
    id: 3,
    time: '+82s',
    label: 'Carrier Reroute Synced',
    carrier: 'DELHIVERY HUB ESCALATION',
    status: 'SUPERVISOR TICKET #8812 LOCKED',
    telemetry: 'Driver handheld device receives supervisor re-attempt lock and updated GPS route.',
    action: 'Carrier SLA penalty invoked; next-day morning delivery committed.',
    payload: 'CARRIER_OVERRIDE {"ticket": "DEL-BLR-8812", "action": "FORCE_REDELIVERY", "slot": "TOMORROW_10AM", "penalty_invoked": true}',
    pnl: {
      headline: 'Net Recovered Capital',
      value: '₹1,240',
      detail: '₹430 RTO loss prevented · CAC saved · 0 human agent hours.',
      badge: 'ORDER SECURED',
      badgeTone: 'success',
    },
  },
];

const REEL_BEATS = [
  { time: '11:20', role: 'gate', title: 'Risk gate', desc: 'Order #89421 cleared · COD verified · address risk normal.' },
  { time: '11:43', role: 'ofd', title: 'Dispatched OFD', desc: 'Driver marks Out For Delivery from Gurugram hub.' },
  { time: '11:47', role: 'ndr', title: 'Fake NDR scan', desc: 'Driver logs "Customer Unavailable". No call, no doorbell.' },
  { time: '11:47:30', role: 'rescue', title: 'Rescue dispatched', desc: 'Webhook fires · RescueShip contacts customer on WhatsApp inside 30s.' },
  { time: '11:48:15', role: 'reply', title: 'Customer replies', desc: 'Customer taps "I am home" · shares live location pin.' },
  { time: '11:49', role: 'carrier', title: 'Carrier sync', desc: 'Escalation raised · attempt flagged · next-day slot committed to carrier.' },
  { time: '14:30', role: 'redeliv', title: 'Re-delivery', desc: 'Out for delivery again — driver receives supervisor notification.' },
  { time: '15:20', role: 'ok', title: 'Delivered · Saved', desc: 'Cash collected · ₹1,240 saved from RTO return transit.' },
];

const FILMSTRIP_SLIDES = [
  { index: '01', code: 'BLEED', label: '₹430 / RTO Bleed Math' },
  { index: '02', code: 'THE LIE', label: '1.42 km Rider GPS Drift' },
  { index: '03', code: 'INTERCEPT', label: '90s WhatsApp + Order Board' },
  { index: '04', code: 'CLOSED LOOP', label: '4-Stage NDR API Pipeline' },
] as const;

export function HorizontalScrollytelling({
  booted,
  failedOrders,
  rescuedOrders,
  cancelledOrders,
}: HorizontalScrollytellingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waypoint0Ref = useRef<HTMLDivElement>(null);
  const waypoint1Ref = useRef<HTMLDivElement>(null);
  const waypoint2Ref = useRef<HTMLDivElement>(null);
  const waypoint3Ref = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const [activeStage, setActiveStage] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [reduced]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v < 0.25) setActiveSlide(0);
    else if (v < 0.52) setActiveSlide(1);
    else if (v < 0.78) setActiveSlide(2);
    else setActiveSlide(3);
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.25,
  });

  // Stepped plateaus: Locks squarely onto 01, 02, 03, 04 without stopping between slides
  const ribbonX = useTransform(
    smoothProgress,
    [0, 0.08, 0.25, 0.35, 0.58, 0.68, 0.90, 1],
    ['0%', '0%', '-25%', '-25%', '-50%', '-50%', '-75%', '-75%']
  );
  const jumpToPanel = (index: number) => {
    const waypoints = [waypoint0Ref, waypoint1Ref, waypoint2Ref, waypoint3Ref];
    waypoints[index]?.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <div id="product" ref={containerRef} className="nt-hscroll">
      {/* 4 Invisible 95vh Snap Waypoint Markers for CSS Scroll-Snap Auto-Locking */}
      <div className="nt-hscroll__waypoints" aria-hidden="true">
        <div ref={waypoint0Ref} className="nt-hscroll__waypoint" />
        <div ref={waypoint1Ref} className="nt-hscroll__waypoint" />
        <div ref={waypoint2Ref} className="nt-hscroll__waypoint" />
        <div ref={waypoint3Ref} className="nt-hscroll__waypoint" />
      </div>

      <div className="nt-hscroll__stage">
        {/* ── Top Scrolly Header Bar ── */}
        <div className="nt-hscroll__head">
          <div className="nt-hscroll__chapter-tag">
            <span className="nt-hscroll__tag-dot" />
            <span>CHAPTER 03 // HORIZONTAL SCROLLYTELLING TRACK</span>
          </div>
          <div className="nt-hscroll__quick-nav">
            <button type="button" className="nt-hscroll__jump-btn" onClick={() => jumpToPanel(0)}>
              01 Bleed
            </button>
            <button type="button" className="nt-hscroll__jump-btn" onClick={() => jumpToPanel(1)}>
              02 The Lie
            </button>
            <button type="button" className="nt-hscroll__jump-btn" onClick={() => jumpToPanel(2)}>
              03 Intercept
            </button>
            <button type="button" className="nt-hscroll__jump-btn" onClick={() => jumpToPanel(3)}>
              04 Closed Loop
            </button>
          </div>
        </div>
        {/* FILMSTRIP MINIMAL GALLERY HUD */}
        <div className="rs-filmstrip-hud" role="navigation" aria-label="Horizontal Story Progress">
          <div className="rs-filmstrip-hud__counter">
            <span className="rs-filmstrip-hud__active">0{activeSlide + 1}</span>
            <span className="rs-filmstrip-hud__sep">/</span>
            <span>04</span>
            <span className="rs-filmstrip-hud__tag">
              {FILMSTRIP_SLIDES[activeSlide].code} — {FILMSTRIP_SLIDES[activeSlide].label}
            </span>
          </div>

          <div className="rs-filmstrip-hud__strip">
            {FILMSTRIP_SLIDES.map((s, i) => (
              <button
                key={s.index}
                type="button"
                onClick={() => jumpToPanel(i)}
                className={`rs-filmstrip-tick ${activeSlide === i ? 'is-current' : ''}`}
                aria-label={`Jump to slide ${s.index}: ${s.label}`}
              >
                <span className="rs-filmstrip-tick__num">[{s.index}]</span>
                <span className="rs-filmstrip-tick__name">{s.code}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 400vw Horizontal Ribbon ── */}
        <motion.div
          className="nt-hscroll__ribbon"
          style={reduced ? { transform: 'none' } : { x: ribbonX }}
        >
          {/* ════════ PANEL 01: THE ₹430 BLEED EQUATION ════════ */}
          <section className="nt-hscroll__panel nt-hscroll__panel--01" tabIndex={0} aria-label="Panel 1: The 430 Rupee Bleed Equation">
            <div className="nt-panel-content nt-panel-content--wide">
              <div className="nt-bleed-split">
                {/* Left Column: Headline & Equation Card */}
                <div className="nt-bleed-split__left">
                  <span className="nt-panel-kicker">PANEL 01 // THE ₹430 BLEED EQUATION</span>
                  <h2 className="nt-panel-h2 nt-display">
                    Every fake remark <em className="nt-serif">burns ₹430.</em>
                  </h2>
                  <p className="nt-panel-sub">
                    When a courier fakes an NDR, you don&apos;t just lose forward shipping. You bleed ad spend, double freight, and warehouse handling.
                  </p>

                  {/* Typographic Equation Block: Indian D2C Breakdown */}
                  <div className="nt-equation-block nt-equation-block--indian-d2c" tabIndex={0} aria-label="₹430 Indian D2C RTO loss equation">
                    <div className="nt-equation-group">
                      <div className="nt-equation-group__tag">₹200 DIRECT COURIER &amp; PACK BURN</div>
                      <div className="nt-equation-group__items">
                        <div className="nt-equation-part">
                          <span className="nt-equation-label">FORWARD</span>
                          <span className="nt-equation-val">₹80</span>
                        </div>
                        <span className="nt-equation-op">+</span>
                        <div className="nt-equation-part">
                          <span className="nt-equation-label">REVERSE RTO</span>
                          <span className="nt-equation-val">₹80</span>
                        </div>
                        <span className="nt-equation-op">+</span>
                        <div className="nt-equation-part">
                          <span className="nt-equation-label">PACK / QC</span>
                          <span className="nt-equation-val">₹40</span>
                        </div>
                      </div>
                    </div>

                    <span className="nt-equation-op nt-equation-op--major">+</span>

                    <div className="nt-equation-group">
                      <div className="nt-equation-group__tag">₹230 WASTED AD CAC</div>
                      <div className="nt-equation-group__items">
                        <div className="nt-equation-part">
                          <span className="nt-equation-label">META / GOOGLE</span>
                          <span className="nt-equation-val">₹230</span>
                        </div>
                      </div>
                    </div>

                    <span className="nt-equation-op nt-equation-op--major">=</span>

                    <div className="nt-equation-part nt-equation-part--total">
                      <span className="nt-equation-label">TOTAL BLEED / RTO</span>
                      <span className="nt-equation-val nt-equation-val--signal">₹430</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Loss Breakdown Bars & Dead Freight Card */}
                <div className="nt-bleed-split__right">
                  <div className="nt-bleed-bars-card">
                    <span className="nt-bleed-card-title">LOSS COMPONENT BREAKDOWN</span>
                    <div className="nt-bleed-bars">
                      {LOSS_PARTS.map((p) => (
                        <div key={p.label} className="nt-bleed-row">
                          <span className="nt-bleed-label">{p.label}</span>
                          <div className="nt-bleed-track">
                            <motion.div
                              className="nt-bleed-fill"
                              initial={reduced ? false : { width: 0 }}
                              whileInView={{ width: `${(p.amount / 230) * 100}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                          <span className="nt-bleed-amount">₹{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="nt-bleed-dead-freight-card">
                    <span className="nt-bleed-calc-badge">MONTHLY BLEED AT SCALE</span>
                    <p>
                      At 7,500 orders/mo with a 15% failure rate, that&apos;s <strong>1,125 lost orders</strong> costing <strong className="nt-bleed-amount-highlight">₹4,83,750/mo</strong> in dead freight.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════ PANEL 02: THE 4-MINUTE LIE ════════ */}
          <section className="nt-hscroll__panel nt-hscroll__panel--02" tabIndex={0} aria-label="Panel 2: The 4-Minute Lie">
            <div className="nt-panel-content nt-panel-content--wide">
              <span className="nt-panel-kicker">PANEL 02 // THE 4-MINUTE LIE</span>
              <h2 className="nt-panel-h2 nt-display">
                Four minutes. <em className="nt-serif">No knock. No call.</em>
              </h2>
              <p className="nt-panel-sub">
                Drivers scan &apos;Customer Unavailable&apos; without leaving their vans. RescueShip captures timestamp telemetry to hold couriers accountable.
              </p>

              {/* Monospace Courier Telemetry Log Window + Heuristics */}
              <div className="nt-accountability-wrap">
                <AccountabilityScene />
              </div>
            </div>
          </section>

          {/* ════════ PANEL 03: LIVE WHATSAPP INTERCEPT ════════ */}
          <section className="nt-hscroll__panel nt-hscroll__panel--03" tabIndex={0} aria-label="Panel 3: Live WhatsApp Intercept">
            <div className="nt-panel-content nt-panel-content--wide">
              <span className="nt-panel-kicker">PANEL 03 // LIVE WHATSAPP INTERCEPT</span>
              <h2 className="nt-panel-h2 nt-display">
                Automated rescue. <em className="nt-serif">Direct to driver app.</em>
              </h2>

              <div className="nt-intercept-split">
                {/* Left: Interactive 5-Scenario WhatsApp Simulator */}
                <div className="nt-intercept-simulator">
                  <div className="nt-simulator-badge">
                    <span>● INTERACTIVE PHONE SIMULATOR</span>
                  </div>
                  <RescueScene active={booted} reduced={reduced} />
                </div>

                {/* Right: Live 3-Column Order Board */}
                <div className="nt-intercept-board">
                  <div className="lp-board">
                    <p className="lp-section__kicker">Order board · sample</p>
                    <div className="lp-board__cols">
                      <div className="lp-board__col">
                        <div className="lp-board__col-h lp-board__col-h--fail">
                          <span>NDR In-Flight</span>
                          <span className="lp-board__col-count">{failedOrders.length}</span>
                        </div>
                        <AnimatePresence mode="popLayout">
                          {failedOrders.map((o) => (
                            <motion.div
                              key={o.id}
                              layout
                              exit={{ opacity: 0, x: 50, scale: 0.94 }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <SpotlightCard className="lp-order lp-order--fail" spotlightColor="var(--signal-soft)">
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

                      <div className={`lp-board__col ${rescuedOrders.length > 0 ? 'lp-board__col--active-rescued' : ''}`}>
                        <div className="lp-board__col-h lp-board__col-h--ok">
                          <span>Rescued &amp; Accepted</span>
                          <span className="lp-board__col-count">{rescuedOrders.length}</span>
                        </div>
                        <AnimatePresence mode="popLayout">
                          {rescuedOrders.map((o) => (
                            <motion.div
                              key={o.id}
                              layout
                              initial={reduced ? false : { opacity: 0, scale: 0.92, y: 12 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <SpotlightCard className="lp-order lp-order--ok" spotlightColor="var(--emerald-15)">
                                <span className="lp-order__id">{o.id}</span>
                                <span className="lp-order__awb">AWB {o.awb}</span>
                                <span className="lp-order__amt">{o.amount}</span>
                                <span className="lp-order__tag">✓ rescued</span>
                              </SpotlightCard>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {rescuedOrders.length === 0 && (
                          <div className="lp-order lp-order--ghost">watching stream…</div>
                        )}
                      </div>

                      <div className={`lp-board__col ${cancelledOrders.length > 0 ? 'lp-board__col--active-cancelled' : ''}`}>
                        <div className="lp-board__col-h lp-board__col-h--cancel">
                          <span style={{ whiteSpace: 'nowrap' }}>RESTORED / RTO</span>
                          <span className="lp-board__col-count">{cancelledOrders.length}</span>
                        </div>
                        <AnimatePresence mode="popLayout">
                          {cancelledOrders.map((o) => (
                            <motion.div
                              key={o.id}
                              layout
                              initial={reduced ? false : { opacity: 0, scale: 0.92, y: 12 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <SpotlightCard className="lp-order lp-order--cancel" spotlightColor="var(--amber-10)">
                                <span className="lp-order__id">{o.id}</span>
                                <span className="lp-order__awb">AWB {o.awb}</span>
                                <span className="lp-order__amt">{o.amount}</span>
                                <span className="lp-order__tag">✕ restocked</span>
                              </SpotlightCard>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {cancelledOrders.length === 0 && (
                          <div className="lp-order lp-order--ghost">watching stream…</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vertically-stable cost container for Playwright invariant */}
                  <div className="lp-cost">
                    <span className="lp-cost__lbl">Active NDR pipeline: 90s response SLA active</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════ PANEL 04: THE 90-SECOND CLOSED LOOP ════════ */}
          <section className="nt-hscroll__panel nt-hscroll__panel--04" tabIndex={0} aria-label="Panel 4: The 90-Second Closed Loop">
            <div className="nt-panel-content nt-panel-content--wide">
              <span className="nt-panel-kicker">PANEL 04 // THE 90-SECOND CLOSED LOOP</span>
              <h2 className="nt-panel-h2 nt-display">
                From fake scan to re-delivery <em className="nt-serif">in 90 seconds.</em>
              </h2>
              <p className="nt-panel-sub">
                Watch how an unverified fake scan is autonomously intercepted, verified with buyer GPS counter-proof, and re-scheduled with courier supervisors before reverse return transit locks.
              </p>

              {/* 1. 21st.dev AnimatedBeam 4-Stage Horizontal Pipeline */}
              <div className="nt-beam-pipeline" aria-label="4-stage autonomous intercept pipeline">
                {/* Connecting Line */}
                <div className="nt-beam-line" aria-hidden="true">
                  <div
                    className="nt-beam-line__fill"
                    style={{ width: `${(activeStage / (PIPELINE_STAGES.length - 1)) * 100}%` }}
                  />
                </div>

                <div className="nt-beam-stages">
                  {PIPELINE_STAGES.map((st, i) => {
                    const isActive = activeStage === i;
                    const isPassed = activeStage > i;
                    return (
                      <button
                        key={st.time}
                        type="button"
                        className={`nt-stage-node ${isActive ? 'nt-stage-node--active' : ''} ${isPassed ? 'nt-stage-node--passed' : ''}`}
                        onClick={() => setActiveStage(i)}
                        aria-pressed={isActive}
                      >
                        <div className="nt-stage-node__circle">
                          <span className="nt-stage-node__pulse" />
                          <span className="nt-stage-node__time">{st.time}</span>
                        </div>
                        <span className="nt-stage-node__label">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Auto-Playing Stage Inspector Split-Card */}
              <div className="nt-inspector-card" tabIndex={0} aria-label={`Stage ${activeStage + 1} inspector`}>
                <div className="nt-inspector-left">
                  <div className="nt-inspector-head">
                    <span className="nt-inspector-dot" />
                    <span className="nt-inspector-carrier">{PIPELINE_STAGES[activeStage].carrier}</span>
                    <span className={`nt-inspector-pill nt-inspector-pill--${PIPELINE_STAGES[activeStage].pnl.badgeTone}`}>
                      {PIPELINE_STAGES[activeStage].status}
                    </span>
                  </div>

                  <div className="nt-inspector-body">
                    <p className="nt-inspector-narrative">
                      {PIPELINE_STAGES[activeStage].telemetry}
                    </p>
                    <div className="nt-inspector-action">
                      <Zap size={13} className="nt-inspector-action-icon" aria-hidden="true" />
                      <span>{PIPELINE_STAGES[activeStage].action}</span>
                    </div>

                    <div className="nt-inspector-code">
                      <div className="nt-inspector-code-head">
                        <Terminal size={11} aria-hidden="true" />
                        <span>webhook_telemetry_payload.json</span>
                      </div>
                      <code>{PIPELINE_STAGES[activeStage].payload}</code>
                    </div>
                  </div>
                </div>

                <div className="nt-inspector-right">
                  <div className="nt-inspector-pnl-card">
                    <span className="nt-inspector-pnl-label">{PIPELINE_STAGES[activeStage].pnl.headline}</span>
                    <div className="nt-inspector-pnl-val">{PIPELINE_STAGES[activeStage].pnl.value}</div>
                    <p className="nt-inspector-pnl-desc">{PIPELINE_STAGES[activeStage].pnl.detail}</p>
                    <div className="nt-inspector-pnl-foot">
                      <span className={`nt-inspector-badge nt-inspector-badge--${PIPELINE_STAGES[activeStage].pnl.badgeTone}`}>
                        {PIPELINE_STAGES[activeStage].pnl.badge}
                      </span>
                      <span className="nt-inspector-timer">Auto-cycle 3.5s · Stage {activeStage + 1}/4</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Visible 4×2 Architectural Lifecycle Grid (Preserves tests/landing-v2.spec.ts:213-217) */}
              <div className="nt-reel-beats-grid" aria-label="8-beat chronological delivery audit">
                {REEL_BEATS.map((beat) => (
                  <div key={beat.time} className="lp-reel__beat nt-reel__beat-card">
                    <div className="lp-reel__beat-top">
                      <span className="lp-reel__beat-time">{beat.time}</span>
                      <span className={`lp-reel__beat-role lp-reel__beat-role--${beat.role}`}>
                        {beat.role.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="lp-reel__beat-title">{beat.title}</h3>
                    <p className="lp-reel__beat-desc">{beat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </motion.div>

        {/* ── Bottom Clickable Progress Tabs ── */}
        <div className="nt-hscroll__foot">
          <div className="nt-hscroll__progress-track">
            <motion.div
              className="nt-hscroll__progress-bar"
              style={{ scaleX: smoothProgress }}
            />
          </div>
          <div className="nt-hscroll__progress-labels">
            <button type="button" className="nt-hscroll__prog-btn" onClick={() => jumpToPanel(0)}>
              01 Bleed
            </button>
            <button type="button" className="nt-hscroll__prog-btn" onClick={() => jumpToPanel(1)}>
              02 The Lie
            </button>
            <button type="button" className="nt-hscroll__prog-btn" onClick={() => jumpToPanel(2)}>
              03 Intercept
            </button>
            <button type="button" className="nt-hscroll__prog-btn" onClick={() => jumpToPanel(3)}>
              04 Closed Loop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HorizontalScrollytelling;
