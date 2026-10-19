import { Timer, PhoneOff, MessageSquareWarning } from 'lucide-react';

export function AccountabilityScene() {
  return (
    <section className="account" aria-label="Courier audit telemetry and fraud heuristics">
      <div className="account__container">
        <div className="account__grid">
          {/* Left Column: Monospace courier-scan log window */}
          <div className="account__left">
            <div className="account__log-window">
              <div className="account__log-header">
                <span className="account__log-dot account__log-dot--red" aria-hidden="true" />
                <span className="account__log-dot account__log-dot--amber" aria-hidden="true" />
                <span className="account__log-dot account__log-dot--green" aria-hidden="true" />
                <span className="account__log-title">courier_telemetry.log</span>
                <span className="account__log-sample">sample case</span>
              </div>
              <div className="account__log" role="region" aria-label="Courier audit log">
                <div className="account__log-row">
                  <span className="account__log-ts">11:43</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-tag account__log-tag--ofd">OUT FOR DELIVERY</span>
                  <span className="account__log-sep">·</span>
                  <span className="account__log-desc">scan OK</span>
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
            </div>
          </div>

          {/* Right Column: 3 Fraud Detection Heuristics (no duplicate text or headline) */}
          <div className="account__right">
            <div className="nt-heuristics-col">
              <div className="nt-heuristic-card">
                <div className="nt-heuristic-head">
                  <span className="nt-heuristic-tag">HEURISTIC 01</span>
                  <Timer size={15} className="nt-heuristic-icon" aria-hidden="true" />
                </div>
                <h4>Odd-Hour Scan</h4>
                <p>Driver scans &quot;Premises Closed&quot; at 11:47 PM when commercial hubs have shut.</p>
              </div>

              <div className="nt-heuristic-card">
                <div className="nt-heuristic-head">
                  <span className="nt-heuristic-tag">HEURISTIC 02</span>
                  <PhoneOff size={15} className="nt-heuristic-icon" aria-hidden="true" />
                </div>
                <h4>Sub-15m OFD to Failure</h4>
                <p>Out for delivery to failure in 4 minutes — geographically impossible.</p>
              </div>

              <div className="nt-heuristic-card">
                <div className="nt-heuristic-head">
                  <span className="nt-heuristic-tag">HEURISTIC 03</span>
                  <MessageSquareWarning size={15} className="nt-heuristic-icon" aria-hidden="true" />
                </div>
                <h4>Verification Discrepancy</h4>
                <p>Customer instantly replies: &quot;Nobody came, I&apos;ve been waiting at home all day.&quot;</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AccountabilityScene;
