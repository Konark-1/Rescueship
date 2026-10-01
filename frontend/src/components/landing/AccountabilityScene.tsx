import { PhoneOff, Timer, MessageSquareWarning } from 'lucide-react';

export function AccountabilityScene() {
  return (
    <section className="account" aria-labelledby="accountability-heading">
      <div className="account__container">
        <div className="account__grid">
          {/* Left Column: Monospace courier-scan log card */}
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

          {/* Right Column: Narrative + Heuristic Chips */}
          <div className="account__right">
            <span className="account__eyebrow">CARRIER ACCOUNTABILITY</span>
            <h2 id="accountability-heading" className="account__heading">
              &ldquo;Door locked.&rdquo; No knock. No call.
            </h2>
            <p className="account__sub">
              Logged four minutes after the scan. RescueShip flags the lie automatically — and files the escalation so your courier starts behaving.
            </p>

            <div className="account__chips" role="list" aria-label="Courier fraud detection heuristics">
              <div className="account__chip" role="listitem">
                <span className="account__chip-icon" aria-hidden="true">
                  <Timer size={16} />
                </span>
                <span className="account__chip-text">Odd-hour scan (before 8 AM / after 10 PM)</span>
              </div>
              <div className="account__chip" role="listitem">
                <span className="account__chip-icon" aria-hidden="true">
                  <PhoneOff size={16} />
                </span>
                <span className="account__chip-text">OFD → failure under 15 min</span>
              </div>
              <div className="account__chip" role="listitem">
                <span className="account__chip-icon" aria-hidden="true">
                  <MessageSquareWarning size={16} />
                </span>
                <span className="account__chip-text">Customer says &ldquo;nobody came&rdquo;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
