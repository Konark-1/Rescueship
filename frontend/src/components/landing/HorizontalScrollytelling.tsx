import { useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react';
import { AccountabilityScene } from './AccountabilityScene';
import { RescueScene } from '../story/RescueScene';
import { TrustStrip } from './TrustStrip';
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

export function HorizontalScrollytelling({
  booted,
  failedOrders,
  rescuedOrders,
  cancelledOrders,
}: HorizontalScrollytellingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 26,
    mass: 0.3,
  });

  const ribbonX = useTransform(smoothProgress, [0, 1], ['0%', '-75%']);
  const parcelProgress = useTransform(smoothProgress, [0.75, 1], ['0%', '100%']);

  const jumpToPanel = (index: number) => {
    if (!containerRef.current) return;
    const top = containerRef.current.offsetTop;
    const height = containerRef.current.offsetHeight - window.innerHeight;
    const targetScroll = top + height * (index / 3);
    window.scrollTo({ top: targetScroll, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <div id="product" ref={containerRef} className="nt-hscroll">
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

        {/* ── 400vw Horizontal Ribbon ── */}
        <motion.div
          className="nt-hscroll__ribbon"
          style={reduced ? { transform: 'none' } : { x: ribbonX }}
        >
          {/* ════════ PANEL 01: THE ₹430 BLEED EQUATION ════════ */}
          <section className="nt-hscroll__panel nt-hscroll__panel--01" tabIndex={0} aria-label="Panel 1: The 430 Rupee Bleed Equation">
            <div className="nt-panel-content">
              <span className="nt-panel-kicker">PANEL 01 // THE ₹430 BLEED EQUATION</span>
              <h2 className="nt-panel-h2 nt-display">
                Every fake remark <em className="nt-serif">burns ₹430.</em>
              </h2>
              <p className="nt-panel-sub">
                When a courier fakes an NDR, you don't just lose forward shipping. You bleed ad spend, double freight, and warehouse handling.
              </p>

              {/* Typographic Equation Block */}
              <div className="nt-equation-block" tabIndex={0} aria-label="₹430 RTO loss equation">
                <div className="nt-equation-part">
                  <span className="nt-equation-label">CAC</span>
                  <span className="nt-equation-val">₹230</span>
                </div>
                <span className="nt-equation-op">+</span>
                <div className="nt-equation-part">
                  <span className="nt-equation-label">FORWARD</span>
                  <span className="nt-equation-val">₹80</span>
                </div>
                <span className="nt-equation-op">+</span>
                <div className="nt-equation-part">
                  <span className="nt-equation-label">REVERSE</span>
                  <span className="nt-equation-val">₹80</span>
                </div>
                <span className="nt-equation-op">+</span>
                <div className="nt-equation-part">
                  <span className="nt-equation-label">REPACK</span>
                  <span className="nt-equation-val">₹40</span>
                </div>
                <span className="nt-equation-op">=</span>
                <div className="nt-equation-part nt-equation-part--total">
                  <span className="nt-equation-label">BLEED / RTO</span>
                  <span className="nt-equation-val nt-equation-val--signal">₹430</span>
                </div>
              </div>

              {/* Animated Breakdown Bar Meters */}
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

              <div className="nt-panel-footer-note">
                <p>
                  At 7,500 orders/mo with a 15% failure rate, that's <strong>1,125 lost orders</strong> costing <strong>₹4,83,750</strong> in dead freight.
                </p>
              </div>
            </div>
          </section>

          {/* ════════ PANEL 02: THE 4-MINUTE LIE ════════ */}
          <section className="nt-hscroll__panel nt-hscroll__panel--02" tabIndex={0} aria-label="Panel 2: The 4-Minute Lie">
            <div className="nt-panel-content">
              <span className="nt-panel-kicker">PANEL 02 // THE 4-MINUTE LIE</span>
              <h2 className="nt-panel-h2 nt-display">
                Four minutes. <em className="nt-serif">No knock. No call.</em>
              </h2>
              <p className="nt-panel-sub">
                Drivers scan 'Customer Unavailable' without leaving their vans. RescueShip captures timestamp telemetry to hold couriers accountable.
              </p>

              {/* Monospace Courier Telemetry Log Window (Preserves AccountabilityScene) */}
              <div className="nt-accountability-wrap">
                <AccountabilityScene />
              </div>

              {/* 3 Fraud Detection Heuristics */}
              <div className="nt-heuristics-grid">
                <div className="nt-heuristic-card">
                  <span className="nt-heuristic-tag">HEURISTIC 01</span>
                  <h4>Odd-Hour Scan</h4>
                  <p>Driver scans "Premises Closed" at 11:47 PM when commercial hubs have shut.</p>
                </div>
                <div className="nt-heuristic-card">
                  <span className="nt-heuristic-tag">HEURISTIC 02</span>
                  <h4>Sub-15m OFD to Failure</h4>
                  <p>Out for delivery to failure in 4 minutes — geographically impossible.</p>
                </div>
                <div className="nt-heuristic-card">
                  <span className="nt-heuristic-tag">HEURISTIC 03</span>
                  <h4>Verification Discrepancy</h4>
                  <p>Customer instantly replies: "Nobody came, I've been waiting at home all day."</p>
                </div>
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

                      <div className="lp-board__arrow" aria-hidden="true">→</div>

                      <div className="lp-board__col">
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

                      <div className="lp-board__col">
                        <div className="lp-board__col-h lp-board__col-h--cancel">
                          <span>Cancelled &amp; Restocked</span>
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

          {/* ════════ PANEL 04: THE 8-BEAT CLOSED LOOP ════════ */}
          <section className="nt-hscroll__panel nt-hscroll__panel--04" tabIndex={0} aria-label="Panel 4: The 8-Beat Closed Loop">
            <div className="nt-panel-content nt-panel-content--wide">
              <span className="nt-panel-kicker">PANEL 04 // THE 8-BEAT CLOSED LOOP</span>
              <h2 className="nt-panel-h2 nt-display">
                From fake scan to redelivery <em className="nt-serif">in 90 seconds.</em>
              </h2>

              {/* Horizontal Timeline Rail */}
              <div className="nt-rail-wrapper">
                <div className="lp-reel__route" aria-hidden="true">
                  <span className="lp-reel__line" />
                  {REEL_BEATS.map((b, i) => (
                    <span key={i} className={`lp-reel__dot lp-reel__dot--${b.role}`} />
                  ))}
                  <motion.span
                    className="lp-reel__parcel nt-reel-parcel-horizontal"
                    style={reduced ? undefined : { left: parcelProgress }}
                    role="img"
                    aria-label="Delivery parcel"
                  >
                    📦
                  </motion.span>
                </div>

                <ol className="lp-reel__beats nt-reel-beats-horizontal">
                  {REEL_BEATS.map((b, i) => (
                    <li key={i} className={`lp-reel__beat lp-reel__beat--${b.role}`}>
                      <div className="lp-reel__beat-top">
                        <span className="lp-reel__beat-time">{b.time}</span>
                        <span className={`lp-reel__beat-role lp-reel__beat-role--${b.role}`}>
                          {b.role.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="lp-reel__beat-title">{b.title}</h3>
                      <p className="lp-reel__beat-desc">{b.desc}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Preserved TrustStrip Badges */}
              <div className="nt-trust-wrap">
                <TrustStrip />
              </div>
            </div>
          </section>
        </motion.div>

        {/* ── Bottom Scroll Progress Indicator ── */}
        <div className="nt-hscroll__foot">
          <div className="nt-hscroll__progress-track">
            <motion.div
              className="nt-hscroll__progress-bar"
              style={{ scaleX: smoothProgress }}
            />
          </div>
          <div className="nt-hscroll__progress-labels">
            <span>01 Bleed</span>
            <span>02 The Lie</span>
            <span>03 Intercept</span>
            <span>04 Closed Loop</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HorizontalScrollytelling;
