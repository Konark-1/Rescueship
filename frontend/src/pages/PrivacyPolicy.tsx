import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Database,
  Clock,
  Mail,
  ArrowLeft,
  Anchor,
  CheckCircle2,
  Server
} from 'lucide-react';
import './legal.css';

const PrivacyPolicy: React.FC = () => {
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
            <Link to="/terms" className="legal-nav__link">Terms of Service</Link>
            <Link to="/dpa" className="legal-nav__link">DPDP Addendum</Link>
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
              <CheckCircle2 size={12} /> DPDP Act 2023 Compliant
            </span>
            <span className="legal-badge legal-badge--indigo">
              <Lock size={12} /> AES-256-GCM Encrypted
            </span>
            <span className="legal-badge legal-badge--amber">
              <Server size={12} /> Republic of India Localization
            </span>
          </div>

          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-subtitle">
            How RescueShip processes, safeguards, and respects digital personal data in full compliance with the 
            Digital Personal Data Protection Act, 2023 (DPDP Act 2023).
          </p>

          <div className="legal-meta-bar">
            <div className="legal-meta-item">
              <span>Effective:</span>
              <strong>October 1, 2026</strong>
            </div>
            <div className="legal-meta-item">
              <span>Version:</span>
              <strong>3.1 (DPDP-Enforced)</strong>
            </div>
            <div className="legal-meta-item">
              <span>Data Protection Officer:</span>
              <strong>privacy@rescueship.com</strong>
            </div>
          </div>
        </header>

        {/* Executive Highlights Grid */}
        <section className="legal-callout-grid" aria-label="Privacy Summary Highlights">
          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon legal-callout-icon--emerald"><ShieldCheck size={18} /></span>
              <span>Statutory Alignment</span>
            </div>
            <p className="legal-callout-desc">
              Built natively for the Digital Personal Data Protection Act, 2023. Processing solely for contracted delivery resolution.
            </p>
          </div>

          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><Lock size={18} /></span>
              <span>Military-Grade Cryptography</span>
            </div>
            <p className="legal-callout-desc">
              Customer phone numbers, addresses, and merchant webhook secrets are encrypted at rest with hardware-backed AES-256-GCM.
            </p>
          </div>

          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><Clock size={18} /></span>
              <span>Strict Retention Caps</span>
            </div>
            <p className="legal-callout-desc">
              Operational logs auto-purge at 90 days. Zero data resale or third-party behavioral profiling.
            </p>
          </div>
        </section>

        {/* Policy Body */}
        <article className="legal-content">
          {/* Section 1 */}
          <section className="legal-section" id="scope">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">01.</span>
              Scope &amp; Regulatory Framework
            </h2>
            <p>
              This Privacy Policy governs the processing of Digital Personal Data by <strong>RescueShip Technologies Private Limited</strong> (&ldquo;RescueShip&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) through our autonomous NDR (Non-Delivery Report) rescue and WhatsApp interception platform.
            </p>
            <p>
              Under the <strong>Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act 2023&rdquo;)</strong> of India:
            </p>
            <ul>
              <li>
                <strong>Merchant E-Commerce Brands</strong> act as <strong>Data Fiduciaries</strong> who determine the purpose and means of customer data collection during checkout.
              </li>
              <li>
                <strong>RescueShip</strong> acts as a contracted <strong>Data Processor</strong>, processing personal data solely under the explicit direction of the Data Fiduciary to rescue stranded shipments and prevent Return to Origin (RTO).
              </li>
              <li>
                <strong>End Shoppers</strong> who purchase products from connected merchants are <strong>Data Principals</strong> entitled to statutory privacy rights.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="legal-section" id="data-collected">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">02.</span>
              Categories of Personal Data Collected
            </h2>
            <p>
              RescueShip collects and ingests only the minimum necessary telemetry required to intercept failed delivery attempts, contact the shopper via WhatsApp, and transmit updated fulfillment instructions back to designated logistics partners:
            </p>

            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>Data Category</th>
                    <th>Exact Fields Collected</th>
                    <th>Functional Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Order Identification</strong></td>
                    <td><span className="legal-pill">Order ID</span>, <span className="legal-pill">Shopify/Woo Order ID</span></td>
                    <td>Cross-referencing the purchase in the merchant catalog and updating order status tags.</td>
                  </tr>
                  <tr>
                    <td><strong>Shopper Contact Data</strong></td>
                    <td><span className="legal-pill">Customer Phone Number</span> (E.164 format), <span className="legal-pill">Recipient Name</span></td>
                    <td>Dispatching real-time WhatsApp Cloud API interactive prompts to verify shopper intent and delivery coordinates.</td>
                  </tr>
                  <tr>
                    <td><strong>Delivery Telemetry</strong></td>
                    <td><span className="legal-pill">Shipping Address</span>, <span className="legal-pill">Pincode</span>, <span className="legal-pill">Landmark</span></td>
                    <td>Correcting misspelled addresses, verifying destination postal codes, and updating carrier manifests.</td>
                  </tr>
                  <tr>
                    <td><strong>Carrier &amp; NDR Telemetry</strong></td>
                    <td><span className="legal-pill">Courier AWB</span>, <span className="legal-pill">Delivery Status</span>, <span className="legal-pill">NDR Reason Code</span>, <span className="legal-pill">Attempt Timestamp</span></td>
                    <td>Detecting courier fake remarks (e.g. &ldquo;Customer not available&rdquo;), calculating RTO risk, and re-attempt scheduling.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              We do <strong>not</strong> collect sensitive payment card credentials, CVVs, net banking passwords, biometric records, or Aadhaar credentials.
            </p>
          </section>

          {/* Section 3 */}
          <section className="legal-section" id="legal-basis">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">03.</span>
              Legal Basis of Processing (DPDP Act 2023)
            </h2>
            <p>
              RescueShip processes personal data strictly pursuant to lawful grounds stipulated under the DPDP Act 2023:
            </p>
            <ul>
              <li>
                <strong>Contract Fulfillment (Section 4 &amp; Section 7):</strong> Processing is strictly necessary for fulfilling the commercial contract of sale entered into between the merchant and the consumer—specifically, successfully delivering the physical goods purchased by the consumer.
              </li>
              <li>
                <strong>Legitimate Business Use:</strong> Preventing delivery failure, verifying genuine residential locations, mitigating fraud, and settling cash-on-delivery (COD) logistics liabilities between couriers and merchants.
              </li>
              <li>
                <strong>Explicit Customer Consent:</strong> When shoppers place orders, they provide contact phone numbers for delivery coordination. In addition, every WhatsApp message sent by RescueShip contains clear opt-out commands.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="legal-section" id="retention">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">04.</span>
              Data Retention &amp; Auto-Purge Cycles
            </h2>
            <p>
              In alignment with the DPDP principle of <em>Storage Limitation</em>, personal telemetry is purged as soon as its operational utility terminates:
            </p>

            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>Log / Record Type</th>
                    <th>Retention Period</th>
                    <th>Statutory &amp; Technical Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>AuditLog</strong></td>
                    <td><span className="legal-pill legal-pill--amber">90 Days</span></td>
                    <td>Security audit trails, authentication logs, merchant configuration changes, and incident investigations.</td>
                  </tr>
                  <tr>
                    <td><strong>DeliveryAttempt Logs</strong></td>
                    <td><span className="legal-pill legal-pill--amber">90 Days</span></td>
                    <td>Carrier webhook payloads, WhatsApp message delivery receipts, customer response logs, and re-attempt confirmations.</td>
                  </tr>
                  <tr>
                    <td><strong>RescueLedger Entries</strong></td>
                    <td><span className="legal-pill legal-pill--emerald">Permanent Financial Record</span></td>
                    <td>Financial recovery logs (anonymized Order ID, freight cost saved, ROI accounting) retained for tax compliance and statutory accounting under Indian company law.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="legal-notice legal-notice--emerald">
              <Database className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>Automated Purge Engine:</strong> Background worker jobs run nightly on our database clusters to permanently shred and delete expired records beyond their 90-day window.
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="legal-section" id="encryption">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">05.</span>
              Cryptographic Safeguards &amp; Security Architecture
            </h2>
            <p>
              RescueShip maintains industry-standard technical and organizational security safeguards to protect digital personal data against unauthorized disclosure, accidental destruction, or breach:
            </p>
            <ul>
              <li>
                <strong>AES-256-GCM Encryption at Rest:</strong> All customer phone numbers, complete shipping addresses, and merchant integration tokens (Shopify API tokens, WhatsApp Cloud API access keys, carrier webhook secrets) are encrypted at rest using AES-256-GCM with authenticated tags.
              </li>
              <li>
                <strong>Transport Layer Security (TLS 1.3):</strong> All API calls, courier webhook deliveries, and merchant dashboard sessions are strictly transmitted over TLS 1.3 with forward secrecy.
              </li>
              <li>
                <strong>Hardware Security Module (HSM) Key Management:</strong> Master encryption keys are managed independently of application source code with automatic 90-day cryptographic rotation.
              </li>
              <li>
                <strong>Strict Role-Based Access Control (RBAC):</strong> Employee access to production infrastructure is restricted to authorized site reliability engineers via MFA and ephemeral bastion credentials.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="legal-section" id="rights">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">06.</span>
              Consumer &amp; Data Principal Rights
            </h2>
            <p>
              Under Chapter III of the DPDP Act 2023, Data Principals (consumers) maintain enforceable rights regarding their digital personal data:
            </p>
            <ul>
              <li>
                <strong>Right to Information &amp; Access:</strong> Consumers may request confirmation of whether their personal data is being processed, along with a summary of data categories and processing operations.
              </li>
              <li>
                <strong>Right to Correction &amp; Erasure:</strong> Consumers may correct inaccurate or incomplete delivery details or request complete erasure of their data from our operational buffers.
              </li>
              <li>
                <strong>Right to Permanent Suppression (STOP Opt-Out):</strong> Shoppers receiving WhatsApp NDR alerts may simply respond with <span className="legal-pill">STOP</span>, <span className="legal-pill">CANCEL</span>, or <span className="legal-pill">UNSUBSCRIBE</span>. Our automated parser immediately registers permanent suppression, halts all subsequent messages, and marks the attempt as canceled.
              </li>
              <li>
                <strong>Right to Grievance Redressal:</strong> Data Principals have the right to register complaints regarding data handling directly with our designated Data Protection Officer.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="legal-section" id="dpo">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">07.</span>
              Data Protection Officer &amp; Grievance Redressal
            </h2>
            <p>
              In compliance with Section 8 and Section 10 of the DPDP Act 2023, RescueShip has appointed an official Data Protection Officer (DPO) and established an expedited grievance mechanism:
            </p>

            <div className="legal-notice">
              <Mail className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>Data Protection Officer (DPO) Contact:</strong><br />
                Email: <a href="mailto:privacy@rescueship.com" style={{ color: 'var(--indigo-soft)', textDecoration: 'underline' }}>privacy@rescueship.com</a><br />
                Address: RescueShip Technologies Private Limited, Level 4, Bandra Kurla Complex (BKC), Mumbai, Maharashtra 400051, India.<br />
                Response Timeline: All statutory data privacy requests and grievances are acknowledged within 24 hours and resolved within 72 hours.
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section className="legal-section" id="changes">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">08.</span>
              Amendments to this Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time to maintain compliance with relevant Indian notifications, rules framed under the DPDP Act 2023, or technological enhancements. Material modifications will be posted with an updated effective date and notified through the merchant dashboard.
            </p>
          </section>
        </article>

        {/* Footer */}
        <footer className="legal-footer">
          <div className="legal-footer__links">
            <Link to="/" className="legal-footer__link">Home</Link>
            <Link to="/dashboard" className="legal-footer__link">Merchant Dashboard</Link>
            <Link to="/privacy" className="legal-footer__link legal-footer__link--active">Privacy Policy</Link>
            <Link to="/terms" className="legal-footer__link">Terms of Service</Link>
            <Link to="/dpa" className="legal-footer__link">DPDP Addendum</Link>
          </div>
          <p className="legal-footer__copy">
            &copy; {new Date().getFullYear()} RescueShip Technologies Private Limited. All rights reserved. Registered in Mumbai, India.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
