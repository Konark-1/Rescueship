import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Shield,
  Activity,
  DollarSign,
  Scale,
  ArrowLeft,
  Anchor,
  CheckCircle2,
  Zap
} from 'lucide-react';
import './legal.css';

const TermsOfService: React.FC = () => {
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
            <span className="legal-badge legal-badge--indigo">
              <Activity size={12} /> 99.9% Platform SLA
            </span>
            <span className="legal-badge legal-badge--emerald">
              <DollarSign size={12} /> 30-Day Money-Back Guarantee
            </span>
            <span className="legal-badge legal-badge--amber">
              <Scale size={12} /> Mumbai Jurisdiction
            </span>
          </div>

          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">
            Master Software-as-a-Service (SaaS) Agreement governing merchant access to the RescueShip autonomous NDR rescue platform.
          </p>

          <div className="legal-meta-bar">
            <div className="legal-meta-item">
              <span>Effective Date:</span>
              <strong>October 1, 2026</strong>
            </div>
            <div className="legal-meta-item">
              <span>Governing Law:</span>
              <strong>Republic of India</strong>
            </div>
            <div className="legal-meta-item">
              <span>Legal Queries:</span>
              <strong>legal@rescueship.com</strong>
            </div>
          </div>
        </header>

        {/* Executive Highlights Grid */}
        <section className="legal-callout-grid" aria-label="Key Terms Highlights">
          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><Zap size={18} /></span>
              <span>Autonomous Operation</span>
            </div>
            <p className="legal-callout-desc">
              90-second automated WhatsApp interception on courier NDR webhooks with real-time bidirectional carrier re-attempt dispatch.
            </p>
          </div>

          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon legal-callout-icon--emerald"><DollarSign size={18} /></span>
              <span>Guaranteed Performance</span>
            </div>
            <p className="legal-callout-desc">
              Zero-risk 30-day money-back performance guarantee. If recovered order value does not cover platform fees, 100% refund.
            </p>
          </div>

          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><Shield size={18} /></span>
              <span>12-Month Liability Cap</span>
            </div>
            <p className="legal-callout-desc">
              Mutual liability strictly capped at actual SaaS subscription fees paid in the immediately preceding 12 months.
            </p>
          </div>
        </section>

        {/* Terms Body */}
        <article className="legal-content">
          {/* Section 1 */}
          <section className="legal-section" id="acceptance">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">01.</span>
              Acceptance &amp; Contractual Relationship
            </h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo; or &ldquo;Agreement&rdquo;) constitute a legally binding contract between <strong>RescueShip Technologies Private Limited</strong> (&ldquo;RescueShip&rdquo;, &ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) and the business entity or person registering an account (&ldquo;Merchant&rdquo;, &ldquo;you&rdquo;, &ldquo;your&rdquo;).
            </p>
            <p>
              By completing account registration, authenticating your Shopify or WooCommerce store, or accessing any RescueShip APIs, you acknowledge that you have read, understood, and agreed to be bound by these Terms and our incorporated <Link to="/privacy" style={{ color: 'var(--indigo-soft)', textDecoration: 'underline' }}>Privacy Policy</Link> and <Link to="/dpa" style={{ color: 'var(--indigo-soft)', textDecoration: 'underline' }}>Data Processor Addendum</Link>.
            </p>
          </section>

          {/* Section 2 */}
          <section className="legal-section" id="service-description">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">02.</span>
              Service Description &amp; Scope
            </h2>
            <p>
              RescueShip provides a specialized logistics intelligence and communication platform designed to prevent Return to Origin (RTO) in e-commerce fulfillment:
            </p>
            <ul>
              <li>
                <strong>Autonomous NDR Interception:</strong> Ingesting real-time non-delivery report (NDR) status updates from courier shipping aggregators and logistics partners (including Shiprocket, Delhivery, Bluedart, Xpressbees, Shadowfax).
              </li>
              <li>
                <strong>Automated WhatsApp Recovery:</strong> Triggering contextual, interactive transactional messaging over the Meta WhatsApp Cloud API within 90 seconds of an initial delivery failure to collect verified addresses, landmarks, or preferred delivery dates.
              </li>
              <li>
                <strong>Carrier Sync:</strong> Automatically routing shopper-confirmed delivery instructions back into the operating carrier&apos;s logistics API to prompt prioritized re-attempts.
              </li>
              <li>
                <strong>RescueLedger Telemetry:</strong> Providing unified dashboards and financial analytics that track intercepted parcels, converted deliveries, and recovered gross merchandise value (GMV).
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="legal-section" id="merchant-responsibilities">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">03.</span>
              Merchant Responsibilities &amp; Lawful Permissions
            </h2>
            <p>
              To maintain the integrity of our carrier mesh and ensure compliance with telecommunications regulations, the Merchant warrants and covenants that:
            </p>
            <ul>
              <li>
                <strong>Truthful Credentials:</strong> All registration data, business tax identifiers (GSTIN/PAN), store URLs, and billing contacts submitted are accurate, current, and verifiable.
              </li>
              <li>
                <strong>Lawful Consumer Contact Permissions:</strong> The Merchant has obtained lawful, unambiguous consent from each end consumer (shopper) during order placement to receive transactional SMS, WhatsApp, and logistics updates regarding their purchase, in strict accordance with the Digital Personal Data Protection Act, 2023 and TRAI regulations.
              </li>
              <li>
                <strong>Anti-Spam &amp; Content Restrictions:</strong> The Merchant will not use RescueShip infrastructure to broadcast unsolicited promotional marketing, adult content, fraudulent schemes, or messages in violation of Meta WhatsApp Business Policies.
              </li>
              <li>
                <strong>Credential Security:</strong> The Merchant is solely responsible for maintaining the confidentiality of its API keys, webhook secrets, and user logins.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="legal-section" id="sla">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">04.</span>
              Service Level Agreement (SLA): 99.9% Uptime
            </h2>
            <p>
              RescueShip commits to an operational availability Service Level Agreement of <strong>99.9% Platform Uptime</strong> in any given calendar month across our core webhook ingestion pipelines, message dispatch queues, and administrative portal.
            </p>

            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>Monthly Platform Uptime</th>
                    <th>Service Credit (% of Monthly SaaS Fee)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>99.0% &ndash; 99.89%</td>
                    <td><span className="legal-pill">10% Credit</span> applied to following invoice</td>
                  </tr>
                  <tr>
                    <td>95.0% &ndash; 98.99%</td>
                    <td><span className="legal-pill legal-pill--amber">25% Credit</span> applied to following invoice</td>
                  </tr>
                  <tr>
                    <td>Below 95.0%</td>
                    <td><span className="legal-pill legal-pill--amber">50% Credit</span> applied to following invoice</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
              <em>Note:</em> SLA excludes scheduled maintenance communicated at least 48 hours in advance, upstream outages of Meta WhatsApp Cloud API infrastructure, or failures in third-party carrier APIs outside of RescueShip control.
            </p>
          </section>

          {/* Section 5 */}
          <section className="legal-section" id="guarantee">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">05.</span>
              Fees &amp; 30-Day Money-Back Performance Guarantee
            </h2>
            <p>
              Subscription fees are billed monthly or annually according to the plan selected (Starter ₹4,999, Growth ₹11,999, Scale ₹24,999, Fleet ₹44,999).
            </p>

            <div className="legal-notice legal-notice--emerald">
              <CheckCircle2 className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>30-Day Money-Back Performance Guarantee Terms:</strong><br />
                We stand behind our recovery rates. If during your first 30 days of active paid subscription, the net courier freight and RTO fees saved by RescueShip (as audited in your RescueLedger) do not equal or exceed the monthly platform subscription fee paid, you are entitled to a <strong>100% full refund</strong> of that monthly fee. To claim, notify <a href="mailto:support@rescueship.com" style={{ color: 'var(--indigo-soft)' }}>support@rescueship.com</a> within 5 calendar days following your first 30-day billing cycle.
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="legal-section" id="liability">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">06.</span>
              Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable Indian law:
            </p>
            <ul>
              <li>
                <strong>Cap on Direct Damages:</strong> In no event shall the aggregate liability of either party arising out of or related to this Agreement exceed the total amounts actually paid by Merchant to RescueShip in the <strong>twelve (12) months immediately preceding</strong> the event giving rise to the claim.
              </li>
              <li>
                <strong>Consequential Damages Waiver:</strong> Neither party shall be liable to the other for any indirect, incidental, punitive, special, or consequential damages, including loss of profits, goodwill, business interruption, or courier physical cargo damage or loss during transit.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="legal-section" id="termination">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">07.</span>
              Term, Termination &amp; 7-Day Data Export Window
            </h2>
            <p>
              This Agreement remains in effect until terminated by either party:
            </p>
            <ul>
              <li>
                <strong>Termination for Convenience:</strong> Either party may terminate this Agreement by providing <strong>thirty (30) days written notice</strong> to the other party via email or through the account cancellation setting in the Merchant Dashboard.
              </li>
              <li>
                <strong>Termination for Cause:</strong> Either party may terminate immediately if the other commits a material breach that remains uncured after 14 days of written notice, or becomes insolvent.
              </li>
              <li>
                <strong>7-Day Data Export Window:</strong> Upon the effective date of termination, Merchant shall be granted an active, read-only <strong>seven (7) day grace period</strong> to export all historical order logs, audit trails, and RescueLedger financial statements.
              </li>
              <li>
                <strong>Permanent Data Deletion:</strong> Following the 7-day export window, RescueShip will permanently shred and delete all Merchant and customer data in accordance with our DPDP Addendum.
              </li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="legal-section" id="governing-law">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">08.</span>
              Governing Law &amp; Exclusive Jurisdiction
            </h2>
            <p>
              This Agreement, its construction, performance, and any disputes arising out of or related hereto, shall be governed by and construed exclusively in accordance with the <strong>laws of the Republic of India</strong>, without regard to conflict of laws principles.
            </p>
            <p>
              The parties mutually and irrevocably agree that the competent <strong>courts located in Mumbai, Maharashtra, India</strong> shall have exclusive jurisdiction over any suit, dispute, or proceeding arising under or in connection with this Agreement.
            </p>
          </section>

          {/* Section 9 */}
          <section className="legal-section" id="contact">
            <h2 className="legal-section__heading">
              <span className="legal-section__num">09.</span>
              Notices &amp; Contact Information
            </h2>
            <p>
              All formal notices, legal inquiries, or contractual communications must be sent in writing to:
            </p>
            <div className="legal-notice">
              <FileText className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>RescueShip Technologies Private Limited</strong><br />
                Attn: Legal Department<br />
                Email: <a href="mailto:legal@rescueship.com" style={{ color: 'var(--indigo-soft)' }}>legal@rescueship.com</a> | Support: <a href="mailto:support@rescueship.com" style={{ color: 'var(--indigo-soft)' }}>support@rescueship.com</a><br />
                Address: Level 4, Bandra Kurla Complex (BKC), Mumbai, Maharashtra 400051, India.
              </div>
            </div>
          </section>
        </article>

        {/* Footer */}
        <footer className="legal-footer">
          <div className="legal-footer__links">
            <Link to="/" className="legal-footer__link">Home</Link>
            <Link to="/dashboard" className="legal-footer__link">Merchant Dashboard</Link>
            <Link to="/privacy" className="legal-footer__link">Privacy Policy</Link>
            <Link to="/terms" className="legal-footer__link legal-footer__link--active">Terms of Service</Link>
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

export default TermsOfService;
