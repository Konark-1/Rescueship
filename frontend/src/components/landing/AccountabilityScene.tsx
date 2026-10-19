import {
  Navigation,
  PhoneOff,
  Timer,
  Layers,
  MessageSquareCheck,
  ShieldAlert,
} from 'lucide-react';

export function AccountabilityScene() {
  return (
    <section className="account" aria-label="Courier audit telemetry and fraud heuristics">
      <div className="account__container">
        <div className="account__grid">
          {/* Left Column: Live AWB #4023118876 Audit Dossier */}
          <div className="account__left">
            <div className="account__log-window">
              <div className="account__log-header">
                <span className="account__log-dot account__log-dot--red" aria-hidden="true" />
                <span className="account__log-dot account__log-dot--amber" aria-hidden="true" />
                <span className="account__log-dot account__log-dot--green" aria-hidden="true" />
                <span className="account__log-title">courier_telemetry.log · AWB #4023118876</span>
                <span className="account__log-sample">sample case</span>
              </div>

              <div className="account__dossier-meta">
                <div className="account__dossier-row">
                  <span className="account__dossier-k">CARRIER</span>
                  <span className="account__dossier-v">DELHIVERY_SURFACE</span>
                </div>
                <div className="account__dossier-row">
                  <span className="account__dossier-k">HUB / PINCODE</span>
                  <span className="account__dossier-v">BLR_KORAMANGALA (560038)</span>
                </div>
                <div className="account__dossier-row">
                  <span className="account__dossier-k">STATUS</span>
                  <span className="account__dossier-v account__dossier-v--alert">FAKE ATTEMPT DETECTED (99.4%)</span>
                </div>
              </div>

              <div className="account__log" role="region" aria-label="Courier audit log">
                <div className="account__log-row">
                  <span className="account__log-ts">11:43</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-tag account__log-tag--ofd">OUT FOR DELIVERY</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-desc">scan OK · van assigned</span>
                </div>
                <div className="account__log-row account__log-row--warning">
                  <span className="account__log-ts">11:47</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-tag account__log-tag--locked">PREMISES LOCKED</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-desc">no call · no doorbell</span>
                </div>
                <div className="account__log-row account__log-row--flagged">
                  <span className="account__log-ts">11:47</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-tag account__log-tag--alert">FLAGGED</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-desc">OFD→NDR 4 min · odd-hour window</span>
                </div>
                <div className="account__log-row account__log-row--escalated">
                  <span className="account__log-ts">11:48</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-tag account__log-tag--success">ESCALATION FILED</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-desc">supervisor #8812 · re-delivery locked</span>
                </div>
              </div>

              <div className="account__dossier-footer">
                <span className="account__dossier-badge">CONFIRMED DISCREPANCY</span>
                <span className="account__dossier-note">Courier SLA penalty invoked automatically</span>
              </div>
            </div>
          </div>

          {/* Right Column: Equal-height 2×3 Grid of 6 Detection Signals */}
          <div className="account__right">
            <div className="nt-signals-grid">
              <div className="nt-signal-card">
                <div className="nt-signal-head">
                  <span className="nt-signal-tag">SIGNAL 01</span>
                  <Navigation size={15} className="nt-signal-icon" aria-hidden="true" />
                </div>
                <h4>GPS Geofence Drift &gt;300m</h4>
                <p>Rider marked failed delivery while located 1.4km away from buyer address coordinates.</p>
              </div>

              <div className="nt-signal-card">
                <div className="nt-signal-head">
                  <span className="nt-signal-tag">SIGNAL 02</span>
                  <PhoneOff size={15} className="nt-signal-icon" aria-hidden="true" />
                </div>
                <h4>Zero-Call IVR Audit</h4>
                <p>Telephony bridge confirms 0 outgoing attempts and 0s talk time to recipient phone.</p>
              </div>

              <div className="nt-signal-card">
                <div className="nt-signal-head">
                  <span className="nt-signal-tag">SIGNAL 03</span>
                  <Timer size={15} className="nt-signal-icon" aria-hidden="true" />
                </div>
                <h4>Sub-15m OFD Velocity</h4>
                <p>Out for delivery to failure in 4 minutes — physically impossible in Bengaluru traffic.</p>
              </div>

              <div className="nt-signal-card">
                <div className="nt-signal-head">
                  <span className="nt-signal-tag">SIGNAL 04</span>
                  <Layers size={15} className="nt-signal-icon" aria-hidden="true" />
                </div>
                <h4>Odd-Hour Batch Dumping</h4>
                <p>Rider dumped 14 failed parcels in under 60 seconds at 11:47 PM to avoid SLA penalties.</p>
              </div>

              <div className="nt-signal-card">
                <div className="nt-signal-head">
                  <span className="nt-signal-tag">SIGNAL 05</span>
                  <MessageSquareCheck size={15} className="nt-signal-icon" aria-hidden="true" />
                </div>
                <h4>Live Buyer Counter-Proof</h4>
                <p>Buyer instantly confirms over WhatsApp: &ldquo;I&apos;m home waiting, nobody visited.&rdquo;</p>
              </div>

              <div className="nt-signal-card">
                <div className="nt-signal-head">
                  <span className="nt-signal-tag">SIGNAL 06</span>
                  <ShieldAlert size={15} className="nt-signal-icon" aria-hidden="true" />
                </div>
                <h4>Pincode &amp; Rider Fault Score</h4>
                <p>Rider failure pattern exceeds 38% fake attempt rate in sector 560038; auto-escalated.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AccountabilityScene;
