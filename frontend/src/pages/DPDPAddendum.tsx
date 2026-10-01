import React from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  BellRing,
  Trash2,
  FileCheck2,
  ArrowLeft,
  Anchor,
  CheckCircle2
} from 'lucide-react';
import './legal.css';

const DPDPAddendum: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-bg-glow" aria-hidden="true" />

      {/* Top Sticky Navigation */}
      <nav className="legal-nav" aria-label="Legal document navigation">
        <div className="legal-nav__inner">
          <Link to="/" className="legal-nav__brand">
            <span className="legal-nav__brand-icon"><Anchor size={20} /></span>
            <span>RescueShip</span>
          </Link>

          <div className="legal-nav__actions">
            <Link to="/privacy" className="legal-nav__link">Privacy Policy</Link>
            <Link to="/terms" className="legal-nav__link">Terms of Service</Link>
            <Link to="/dashboard" className="legal-nav__btn">
              <span>Go to Dashboard</span>
              <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="legal-container">
        {/* Header / Hero */}
        <header className="legal-header">
          <div className="legal-badge-strip">
            <span className="legal-badge legal-badge--emerald">
              <CheckCircle2 size={12} /> DPDP Act 2023 Statutory Addendum
            </span>
            <span className="legal-badge legal-badge--indigo">
              <Server size={12} /> Indian Server Localization
            </span>
            <span className="legal-badge legal-badge--amber">
              <BellRing size={12} /> 72-Hour Breach SLA
            </span>
          </div>

          <h1 className="legal-title">Data Processor Addendum (DPA)</h1>
          <p className="legal-subtitle">
            Binding statutory data processing agreement pursuant to Section 8 of the Digital Personal Data Protection Act, 2023 (Republic of India).
          </p>

          <div className="legal-meta-bar">
            <div className="legal-meta-item">
              <span>Fiduciary / Processor Status:</span>
              <strong>Merchant = Fiduciary | RescueShip = Processor</strong>
            </div>
            <div className="legal-meta-item">
              <span>Effective:</span>
              <strong>October 1, 2026</strong>
            </div>
            <div className="legal-meta-item">
              <span>DPO Desk:</span>
              <strong>privacy@rescueship.com</strong>
            </div>
          </div>
        </header>

        {/* Executive Highlights Grid */}
        <section className="legal-callout-grid" aria-label="Addendum Highlights">
          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon legal-callout-icon--emerald"><FileCheck2 size={18} /></span>
              <span>Explicit Instructions Only</span>
            </div>
            <p className="legal-callout-desc">
              RescueShip processes customer PII solely under documented instructions from the Merchant to execute NDR rescue workflows.
            </p>
          </div>

          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><BellRing size={18} /></span>
              <span>72-Hour Incident Alert</span>
            </div>
            <p className="legal-callout-desc">
              Guaranteed written notification within 72 hours of identifying any security breach affecting personal data.
            </p>
          </div>

          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><Server size={18} /></span>
              <span>India Data Localization</span>
            </div>
            <p className="legal-callout-desc">
              Customer databases are homed in Mumbai (ap-south-1). No unauthorized cross-border transfers outside India.
            </p>
          </div>
        </section>

        {/* DPA Content */}
        <article className="legal-content">
          {/* Section 1 */}
          <section className="legal-section" id="parties-roles">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">01.</span>
              Scope, Structure &amp; Statutory Roles
            </h2>
            <p>
              This Data Processor Addendum (&ldquo;DPA&rdquo;) supplements and forms an integral part of the RescueShip Master Terms of Service between the Merchant and RescueShip Technologies Private Limited.
            </p>
            <p>
              In accordance with the <strong>Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act 2023&rdquo;)</strong>:
            </p>
            <ul>
              <li>
                <strong>Merchant is the &ldquo;Data Fiduciary&rdquo;:</strong> Under Section 2(i) of the DPDP Act 2023, the Merchant determines the purpose and means of processing personal data collected from its e-commerce shoppers during checkout.
              </li>
              <li>
                <strong>RescueShip is the &ldquo;Data Processor&rdquo;:</strong> Under Section 2(k) of the DPDP Act 2023, RescueShip processes digital personal data on behalf of and strictly under the instructions of the Data Fiduciary.
              </li>
              <li>
                <strong>Shoppers are &ldquo;Data Principals&rdquo;:</strong> Under Section 2(j) of the DPDP Act 2023, end shoppers retain statutory rights regarding access, correction, and erasure.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="legal-section" id="obligations-processor">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">02.</span>
              Obligations of the Data Processor
            </h2>
            <p>
              Pursuant to Section 8 of the DPDP Act 2023, RescueShip covenants and agrees that it shall:
            </p>
            <ul>
              <li>
                <strong>Process Solely on Documented Instructions:</strong> Process personal data exclusively for the purpose of intercepting failed delivery attempts (NDR), dispatching WhatsApp recovery dialogues, verifying customer addresses, and synchronizing delivery coordinates with logistics carriers, as authorized by the Merchant.
              </li>
              <li>
                <strong>Maintain Reasonable Security Safeguards:</strong> Implement and maintain reasonable technical, organizational, and cryptographic security measures to prevent personal data breaches, including hardware-backed AES-256-GCM encryption at rest, TLS 1.3 encryption in transit, strict RBAC, and quarterly penetration testing.
              </li>
              <li>
                <strong>72-Hour Security Incident Notification:</strong> Notify the Data Fiduciary in writing without undue delay, and in no event later than <strong>seventy-two (72) hours</strong>, after confirming any personal data breach or unauthorized access affecting the Merchant&apos;s data. The notification shall describe the nature of the breach, affected records, likely consequences, and remediation actions taken.
              </li>
              <li>
                <strong>Assist in Data Principal Rights:</strong> Provide technical tools and prompt assistance to enable the Data Fiduciary to respond to requests from Data Principals exercising their statutory rights under the DPDP Act 2023 (including right to access, right to correction, right to erasure, and grievance redressal).
              </li>
              <li>
                <strong>Staff Confidentiality:</strong> Ensure all personnel authorized to access customer personal data are bound by strict statutory non-disclosure covenants and periodic privacy training.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="legal-section" id="subprocessors">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">03.</span>
              Authorized Sub-Processors
            </h2>
            <p>
              The Data Fiduciary grants general authorization to RescueShip to engage the following infrastructure and cloud sub-processors to perform designated processing activities:
            </p>

            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>Sub-Processor Entity</th>
                    <th>Processing Purpose</th>
                    <th>Data Center Location</th>
                    <th>Security Safeguards</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>MongoDB Atlas</strong></td>
                    <td>Primary database for merchant accounts, encrypted order metadata &amp; telemetry logs</td>
                    <td><span className="legal-pill">AWS ap-south-1 (Mumbai, India)</span></td>
                    <td>AES-256 encryption at rest, private VPC peering, SOC 2 Type II, ISO 27001</td>
                  </tr>
                  <tr>
                    <td><strong>Render</strong></td>
                    <td>Backend API execution, container hosting &amp; background worker compute</td>
                    <td><span className="legal-pill">High-security cloud compute</span></td>
                    <td>TLS 1.3 enforced, isolated container namespaces, SOC 2 Type II certified</td>
                  </tr>
                  <tr>
                    <td><strong>Upstash</strong></td>
                    <td>In-memory Redis queue for real-time webhook ingestion and deduplication</td>
                    <td><span className="legal-pill">Edge cluster with Mumbai gateway</span></td>
                    <td>TLS encrypted connections, ephemeral in-memory buffering (TTL &lt; 24h)</td>
                  </tr>
                  <tr>
                    <td><strong>Razorpay &amp; Cashfree</strong></td>
                    <td>Merchant SaaS subscription billing &amp; payment gateway processing</td>
                    <td><span className="legal-pill">India (RBI Compliant)</span></td>
                    <td>PCI-DSS Level 1 certified, tokenized payments, RBI data localization compliant</td>
                  </tr>
                  <tr>
                    <td><strong>Meta Platforms Inc.</strong></td>
                    <td>WhatsApp Cloud API gateway for official transactional delivery messaging</td>
                    <td><span className="legal-pill">Meta Cloud Infrastructure</span></td>
                    <td>End-to-end transport encryption, official Meta WhatsApp Business Solution Partner API</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              RescueShip maintains back-to-back data protection agreements with all listed sub-processors imposing obligations no less protective than those set forth in this DPA. RescueShip shall provide at least fourteen (14) days prior notice before onboarding any new sub-processor.
            </p>
          </section>

          {/* Section 4 */}
          <section className="legal-section" id="data-localization">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">04.</span>
              Data Localization &amp; Cross-Border Transfers
            </h2>
            <p>
              RescueShip strictly adheres to sovereign Indian data storage principles under the DPDP Act 2023:
            </p>
            <ul>
              <li>
                <strong>Indian Sovereign Data Localization:</strong> All persistent databases containing Digital Personal Data (including customer phone numbers, shipping addresses, order IDs, and courier delivery remarks) are hosted on dedicated database instances located within the territorial boundaries of the <strong>Republic of India (AWS ap-south-1 region in Mumbai)</strong>.
              </li>
              <li>
                <strong>No Cross-Border Transfers Without Consent:</strong> RescueShip will not transfer, mirror, or store the personal data of Indian consumers outside the territory of India without prior explicit written authorization from the Data Fiduciary and in strict accordance with notifications issued by the Central Government of India under Section 16 of the DPDP Act 2023.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="legal-section" id="audits">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">05.</span>
              Audit Rights &amp; Verification
            </h2>
            <p>
              To confirm ongoing adherence to this DPA:
            </p>
            <ul>
              <li>
                <strong>Annual Verification:</strong> The Data Fiduciary has the right to verify RescueShip&apos;s compliance with this DPA up to once per calendar year upon thirty (30) business days prior written notice.
              </li>
              <li>
                <strong>Compliance Documentation:</strong> RescueShip satisfies this verification requirement by supplying its current SOC 2 Type II summary report, third-party penetration testing attestation letters, and DPDP Act compliance certifications.
              </li>
              <li>
                <strong>On-Site / Virtual Inspection:</strong> In the event of a confirmed security incident, the Data Fiduciary may conduct a reasonable, mutually agreed virtual or on-site security review conducted during normal business hours without disrupting live operations.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="legal-section" id="deletion-conclusion">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">06.</span>
              Data Erasure &amp; Return Upon Conclusion
            </h2>
            <p>
              Upon termination of the SaaS Agreement or upon the written request of the Data Fiduciary:
            </p>
            <div className="legal-notice legal-notice--warning">
              <Trash2 className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>Mandatory 30-Day Complete Data Erasure:</strong><br />
                Within thirty (30) calendar days following contract conclusion (and following the expiration of the 7-day merchant data export window), RescueShip will irreversibly delete and cryptographically shred all copies of the Data Fiduciary&apos;s personal data from all active database collections, temporary storage queues, and worker caches, retaining only immutable financial ledger entries mandated by Indian tax and statutory company law.
              </div>
            </div>
            <p>
              RescueShip will furnish written certification of complete data erasure to the Data Fiduciary upon request.
            </p>
          </section>

          {/* Section 7 */}
          <section className="legal-section" id="governing-law">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">07.</span>
              Governing Law &amp; Precedence
            </h2>
            <p>
              This DPA shall be governed by and construed in accordance with the laws of the Republic of India. In the event of any conflict between the terms of the Master Terms of Service and this DPA regarding personal data protection, the terms of this DPA and the DPDP Act 2023 shall take precedence.
            </p>
          </section>
        </article>

        {/* Footer */}
        <footer className="legal-footer">
          <div className="legal-footer__links">
            <Link to="/" className="legal-footer__link">Home</Link>
            <Link to="/dashboard" className="legal-footer__link">Merchant Dashboard</Link>
            <Link to="/privacy" className="legal-footer__link">Privacy Policy</Link>
            <Link to="/terms" className="legal-footer__link">Terms of Service</Link>
            <Link to="/dpa" className="legal-footer__link legal-footer__link--active">DPDP Addendum</Link>
          </div>
          <p className="legal-footer__copy">
            &copy; {new Date().getFullYear()} RescueShip Technologies Private Limited. All rights reserved. Registered in Mumbai, India.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default DPDPAddendum;
