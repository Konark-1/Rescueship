export function IntelligenceCard() {
  const PINCODE_ROWS = [
    { idx: '01', pincode: '110001', city: 'New Delhi', rto: '32%', badgeClass: 'danger', verdict: '🚚 Courier issue · 22 fake attempts', playbook: 'SYS.05 // AUTO-ESCALATE' },
    { idx: '02', pincode: '560038', city: 'Bengaluru', rto: '28%', badgeClass: 'danger', verdict: '📍 Address issue · enable 2-step fix', playbook: 'SYS.04 // GPS-COORDINATES' },
    { idx: '03', pincode: '400001', city: 'Mumbai', rto: '23%', badgeClass: 'warning', verdict: '👤 Customer refusals · review offer', playbook: 'SYS.03 // UPI-CONVERT' },
    { idx: '04', pincode: '600001', city: 'Chennai', rto: '20%', badgeClass: 'warning', verdict: '🚚 Courier issue · test alternate carrier', playbook: 'SYS.02 // REROUTE-HUB' },
    { idx: '05', pincode: '700001', city: 'Kolkata', rto: '18%', badgeClass: 'warning', verdict: '👁 Monitor · within tolerance', playbook: 'SYS.01 // WATCHLIST' },
  ];

  return (
    <section className="intel" aria-labelledby="intel-heading">
      <div className="intel__container">
        <div className="intel__header">
          <span className="intel__eyebrow">PINCODE INTELLIGENCE</span>
          <h2 id="intel-heading" className="intel__heading">
            Every pincode, ranked by real failure data.
          </h2>
          <p className="intel__sub">
            Courier fraud, bad addresses, or cold customers — know which one is costing you, per pincode.
          </p>
        </div>

        <div className="intel__card">
          <div className="intel__file-bar">
            <span className="intel__file-name">pincode_watchtower.csv</span>
            <span className="intel__file-status">● LIVE TELEMETRY</span>
            <span className="intel__file-tag">5 METRO CLUSTERS</span>
          </div>

          <div className="intel__table-wrap" tabIndex={0} role="region" aria-label="Sample pincode risk report table">
            <table className="intel__table" aria-label="Sample pincode risk report">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Pincode</th>
                  <th scope="col">City</th>
                  <th scope="col">RTO rate</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Autonomous Playbook</th>
                </tr>
              </thead>
              <tbody>
                {PINCODE_ROWS.map((row) => (
                  <tr key={row.pincode}>
                    <td className="intel__cell-idx">{row.idx}</td>
                    <td className="intel__cell-pincode">{row.pincode}</td>
                    <td className="intel__cell-city">{row.city}</td>
                    <td>
                      <span className={`intel__badge intel__badge--${row.badgeClass}`}>
                        {row.rto}
                      </span>
                    </td>
                    <td className="intel__cell-verdict">{row.verdict}</td>
                    <td className="intel__cell-playbook">{row.playbook}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="intel__footnote">
            Live in your dashboard: failure-source split (courier vs customer), fake-attempt counts, average attempts, and a recommended action per pincode.
          </p>
        </div>
      </div>
    </section>
  );
}
