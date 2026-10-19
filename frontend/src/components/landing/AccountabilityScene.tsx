import { Navigation, PhoneOff, Timer, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export function AccountabilityScene() {
  return (
    <section className="account" aria-label="Courier audit telemetry and fraud heuristics">
      <div className="account__container">
        {/* Section Header */}
        <div className="account__head-block">
          <span className="nt-panel-kicker">PANEL 02 // REAL-TIME COURIER TELEMETRY</span>
          <h2 className="account__title nt-display">
            Caught on radar.{' '}
            <em className="nt-serif">Every fake scan proved with live telemetry.</em>
          </h2>
          <p className="account__lead">
            Courier drivers routinely log fake &ldquo;Customer Unavailable&rdquo; marks to beat shift quotas. RescueShip exposes the fraud with millisecond GPS coordinates, telephony records, and velocity audits.
          </p>
        </div>

        <div className="account__grid">
          {/* Left Column: Interactive SVG GPS Geofence Radar Map */}
          <div className="account__left">
            <div className="account__radar-window">
              {/* Critical Playwright Test Invariant: .account__log-header containing 'sample case' */}
              <div className="account__log-header">
                <div className="account__log-dots" aria-hidden="true">
                  <span className="account__log-dot account__log-dot--red" />
                  <span className="account__log-dot account__log-dot--amber" />
                  <span className="account__log-dot account__log-dot--green" />
                </div>
                <span className="account__log-title">courier_telemetry.log · AWB #4023118876</span>
                <span className="account__log-sample">sample case</span>
              </div>

              {/* Radar Meta Status */}
              <div className="account__radar-status-bar">
                <span className="account__radar-pulse-dot" />
                <span className="account__radar-carrier">DELHIVERY_SURFACE · HUB 560038</span>
                <span className="account__radar-flag">
                  <AlertTriangle size={12} aria-hidden="true" />
                  <span>FAKE SCAN DETECTED (99.4%)</span>
                </span>
              </div>

              {/* The SVG Geofence Radar Map */}
              <div className="account__radar-stage">
                <svg
                  className="account__radar-svg"
                  viewBox="0 0 400 400"
                  fill="none"
                  aria-label="GPS Geofence Radar Telemetry Map showing rider 1.42km outside 300m delivery corridor"
                >
                  <defs>
                    {/* Radar Sweep Gradient */}
                    <linearGradient id="radarSweep" x1="50%" y1="50%" x2="100%" y2="50%">
                      <stop offset="0%" stopColor="var(--emerald)" stopOpacity="0" />
                      <stop offset="70%" stopColor="var(--emerald)" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="var(--emerald)" stopOpacity="0.45" />
                    </linearGradient>
                    <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="var(--emerald)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--emerald)" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="breachGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Crosshair Grid Lines */}
                  <line x1="200" y1="20" x2="200" y2="380" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="20" y1="200" x2="380" y2="200" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

                  {/* Outer Geofence Ring: 1.5km Boundary */}
                  <circle cx="200" cy="200" r="160" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="205" y="48" fill="var(--text-3)" fontSize="9" fontFamily="var(--font-mono)">1.5 km boundary</text>

                  {/* Permitted Delivery Corridor: 300m Ring */}
                  <circle cx="200" cy="200" r="95" stroke="var(--emerald)" strokeWidth="1.2" strokeOpacity="0.4" strokeDasharray="2 2" />
                  <text x="205" y="112" fill="var(--emerald)" fontSize="9" fontFamily="var(--font-mono)" opacity="0.8">300m delivery corridor</text>

                  {/* Immediate Precision Ring: 100m */}
                  <circle cx="200" cy="200" r="45" stroke="var(--emerald)" strokeWidth="1" strokeOpacity="0.6" fill="url(#hubGlow)" />
                  <text x="205" y="162" fill="var(--emerald)" fontSize="8" fontFamily="var(--font-mono)">100m address gate</text>

                  {/* Animated Radar Sweep Beam */}
                  <g className="account__radar-beam">
                    <path d="M 200 200 L 360 200 A 160 160 0 0 0 200 40 Z" fill="url(#radarSweep)" />
                    <line x1="200" y1="200" x2="360" y2="200" stroke="var(--emerald)" strokeWidth="1.5" strokeOpacity="0.8" />
                  </g>

                  {/* Telemetry Breach Line from Center (Home) to Rider */}
                  <line
                    x1="200"
                    y1="200"
                    x2="325"
                    y2="95"
                    stroke="var(--signal)"
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                    className="account__radar-breach-line"
                  />

                  {/* Breach Distance Callout Tag */}
                  <g transform="translate(245, 135)">
                    <rect x="0" y="0" width="75" height="20" rx="4" fill="var(--bg-deep)" stroke="var(--signal)" strokeWidth="1" />
                    <text x="37" y="13" textAnchor="middle" fill="var(--signal)" fontSize="10" fontFamily="var(--font-mono)" fontWeight="bold">
                      1.42 km drift
                    </text>
                  </g>

                  {/* Central Customer Pin (0,0) */}
                  <circle cx="200" cy="200" r="8" fill="var(--emerald)" />
                  <circle cx="200" cy="200" r="16" stroke="var(--emerald)" strokeWidth="1" opacity="0.5" className="account__radar-center-pulse" />
                  <circle cx="200" cy="200" r="3" fill="var(--bg-void)" />
                  <text x="200" y="222" textAnchor="middle" fill="var(--text-1)" fontSize="10" fontFamily="var(--font-body)" fontWeight="600">
                    Buyer Address
                  </text>
                  <text x="200" y="234" textAnchor="middle" fill="var(--text-3)" fontSize="8" fontFamily="var(--font-mono)">
                    Koramangala 4th Block
                  </text>

                  {/* Rider Fake Scan Pin (1.42km Breach) */}
                  <circle cx="325" cy="95" r="22" fill="url(#breachGlow)" />
                  <circle cx="325" cy="95" r="9" fill="var(--signal)" />
                  <circle cx="325" cy="95" r="3.5" fill="var(--bg-void)" />
                  <g transform="translate(325, 78)">
                    <text x="0" y="0" textAnchor="middle" fill="var(--signal)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="bold">
                      RIDER SCAN POINT
                    </text>
                  </g>
                </svg>
              </div>

              {/* 3-Metric Telemetry Bar */}
              <div className="account__radar-metrics">
                <div className="account__metric">
                  <div className="account__metric-val account__metric-val--alert">
                    <Navigation size={13} aria-hidden="true" />
                    <span>1.42 km</span>
                  </div>
                  <span className="account__metric-lbl">Geofence Drift</span>
                </div>
                <div className="account__metric">
                  <div className="account__metric-val account__metric-val--alert">
                    <PhoneOff size={13} aria-hidden="true" />
                    <span>0 sec</span>
                  </div>
                  <span className="account__metric-lbl">IVR Call Duration</span>
                </div>
                <div className="account__metric">
                  <div className="account__metric-val account__metric-val--alert">
                    <Timer size={13} aria-hidden="true" />
                    <span>4 min</span>
                  </div>
                  <span className="account__metric-lbl">OFD-to-NDR Velocity</span>
                </div>
              </div>

              {/* Footer Audit Confirmation */}
              <div className="account__radar-footer">
                <span className="account__dossier-badge">CONFIRMED DISCREPANCY</span>
                <span className="account__dossier-note">Courier SLA penalty invoked automatically</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3 High-End shadcn Bento Cards */}
          <div className="account__right">
            <div className="account__bento-stack">
              {/* Bento Card 1 */}
              <div className="account__bento-card" tabIndex={0}>
                <div className="account__bento-head">
                  <div className="account__bento-tag-wrap">
                    <span className="account__bento-tag">SIGNAL 01</span>
                    <span className="account__bento-status account__bento-status--alert">GEOFENCE BREACH</span>
                  </div>
                  <Navigation size={16} className="account__bento-icon account__bento-icon--red" aria-hidden="true" />
                </div>
                <h3 className="account__bento-title">Geofence &amp; Velocity Verification</h3>
                <p className="account__bento-desc">
                  Monitors rider GPS coordinates against the buyer&apos;s mapped address. Flags any delivery logged outside the 300-meter corridor or marked from Out-For-Delivery to NDR in under 15 minutes.
                </p>
                <div className="account__bento-foot">
                  <span className="account__bento-metric-tag">&lt;300m corridor required</span>
                  <span className="account__bento-active-pill">
                    <CheckCircle2 size={11} aria-hidden="true" /> Live audit active
                  </span>
                </div>
              </div>

              {/* Bento Card 2 */}
              <div className="account__bento-card" tabIndex={0}>
                <div className="account__bento-head">
                  <div className="account__bento-tag-wrap">
                    <span className="account__bento-tag">SIGNAL 02</span>
                    <span className="account__bento-status account__bento-status--amber">TELEPHONY AUDIT</span>
                  </div>
                  <PhoneOff size={16} className="account__bento-icon account__bento-icon--amber" aria-hidden="true" />
                </div>
                <h3 className="account__bento-title">Zero-Call IVR &amp; Night-Batch Audit</h3>
                <p className="account__bento-desc">
                  Audits carrier telecom bridges in real time. Detects zero-second call drops, disconnected phone pings, and end-of-shift dumping where riders dump 10+ parcels in under 60 seconds to avoid penalties.
                </p>
                <div className="account__bento-foot">
                  <span className="account__bento-metric-tag">0s talk-time threshold</span>
                  <span className="account__bento-active-pill">
                    <CheckCircle2 size={11} aria-hidden="true" /> Live audit active
                  </span>
                </div>
              </div>

              {/* Bento Card 3 */}
              <div className="account__bento-card" tabIndex={0}>
                <div className="account__bento-head">
                  <div className="account__bento-tag-wrap">
                    <span className="account__bento-tag">SIGNAL 03</span>
                    <span className="account__bento-status account__bento-status--emerald">WHATSAPP ESCALATION</span>
                  </div>
                  <ShieldAlert size={16} className="account__bento-icon account__bento-icon--emerald" aria-hidden="true" />
                </div>
                <h3 className="account__bento-title">Buyer Counter-Proof &amp; Priority Escalation</h3>
                <p className="account__bento-desc">
                  When the customer confirms on WhatsApp (&ldquo;I am home waiting, nobody visited&rdquo;), RescueShip automatically logs a verified fraud dispute and dispatches priority re-dispatch tickets to hub supervisors.
                </p>
                <div className="account__bento-foot">
                  <span className="account__bento-metric-tag">100% hub escalation SLA</span>
                  <span className="account__bento-active-pill">
                    <CheckCircle2 size={11} aria-hidden="true" /> Live audit active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AccountabilityScene;
