import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Anchor, FileCheck2, BellRing, Trash2, Users } from 'lucide-react';
import { LEGAL, legalEntityLine } from '../legal/entity';
import './legal.css';

/* Data Processing Addendum. Every commitment here must be one the operator can actually keep. */
const DPDPAddendum: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-bg-glow" aria-hidden="true" />

      <nav className="legal-nav" aria-label="Legal document navigation">
        <div className="legal-nav__inner">
          <Link to="/" className="legal-nav__brand">
            <span className="legal-nav__brand-icon"><Anchor size={20} /></span>
            <span>{LEGAL.brand}</span>
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

      <main className="legal-container">
        <header className="legal-header">
          <h1 className="legal-title">Data Processing Addendum</h1>
          <p className="legal-subtitle">How {LEGAL.brand} handles your shoppers&rsquo; personal data on your behalf under the Digital Personal Data Protection Act, 2023.</p>
          <div className="legal-meta-bar">
            <div className="legal-meta-item"><span>Roles:</span><strong>Merchant = Data Fiduciary · {LEGAL.brand} = Data Processor</strong></div>
            <div className="legal-meta-item"><span>Effective:</span><strong>{LEGAL.effectiveDate}</strong></div>
            <div className="legal-meta-item"><span>Contact:</span><strong>{LEGAL.contactEmail}</strong></div>
          </div>
        </header>

        <section className="legal-callout-grid" aria-label="Addendum highlights">
          <div className="legal-callout-card">
            <div className="legal-callout-head"><span className="legal-callout-icon legal-callout-icon--emerald"><FileCheck2 size={18} /></span><span>Your instructions only</span></div>
            <p className="legal-callout-desc">We use shopper data only to run delivery follow-ups for you, never for our own marketing.</p>
          </div>
          <div className="legal-callout-card">
            <div className="legal-callout-head"><span className="legal-callout-icon"><BellRing size={18} /></span><span>Breach notice within 72 hours</span></div>
            <p className="legal-callout-desc">We tell you within 72 hours of confirming a breach that affects your shoppers&rsquo; data.</p>
          </div>
          <div className="legal-callout-card">
            <div className="legal-callout-head"><span className="legal-callout-icon"><Trash2 size={18} /></span><span>Deleted when you leave</span></div>
            <p className="legal-callout-desc">Shopper data is deleted within 30 days after your account ends and the 7-day export window closes.</p>
          </div>
        </section>

        <article className="legal-content">
          <section className="legal-section" id="parties-roles">
            <h2 className="legal-section__heading"><span className="legal-section__num">01.</span>Parties and roles</h2>
            <p>This Addendum forms part of the <Link to="/terms">Terms of Service</Link> between the Merchant and <strong>{legalEntityLine()}</strong>.</p>
            <ul>
              <li><strong>Merchant</strong> is the Data Fiduciary for its shoppers&rsquo; personal data.</li>
              <li><strong>{LEGAL.brand}</strong> is the Data Processor and processes that data only on the Merchant&rsquo;s behalf.</li>
              <li><strong>Shoppers</strong> are Data Principals with rights under the DPDP Act, 2023.</li>
            </ul>
          </section>

          <section className="legal-section" id="instructions">
            <h2 className="legal-section__heading"><span className="legal-section__num">02.</span>What we process and why</h2>
            <p>
              Shopper name, phone number, shipping address and pincode, order details, courier tracking and delivery status, and WhatsApp conversations about the order. We process them only to: message the shopper about a failed or risky delivery, act on the shopper&rsquo;s reply, update the courier and the Merchant&rsquo;s store, create payment links in the Merchant&rsquo;s own gateway account, and report results to the Merchant. Turning on {LEGAL.brand} and connecting your accounts is your instruction to do this.
            </p>
          </section>

          <section className="legal-section" id="obligations">
            <h2 className="legal-section__heading"><span className="legal-section__num">03.</span>Our commitments</h2>
            <ul>
              <li>Process shopper data only on your instructions and only for the purpose above.</li>
              <li>Keep reasonable security safeguards: HTTPS for all traffic, AES-256-GCM encryption of your connected-account credentials, signature checks on incoming webhooks, and per-merchant data separation.</li>
              <li>Notify you without undue delay, and within 72 hours, after confirming a personal data breach affecting your shoppers, with what we know and what we are doing about it.</li>
              <li>Help you answer shopper requests to access, correct or erase their data, and honour WhatsApp opt-outs (STOP) automatically.</li>
              <li>Limit access to shopper data to the people who run {LEGAL.brand} and who are bound to keep it confidential.</li>
            </ul>
          </section>

          <section className="legal-section" id="subprocessors">
            <h2 className="legal-section__heading"><span className="legal-section__num">04.</span>Sub-processors</h2>
            <p>You authorise us to use these services to run {LEGAL.brand}. Some may store or process data outside India; we will tell you before adding a new sub-processor that handles shopper data.</p>
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead><tr><th>Sub-processor</th><th>Purpose</th></tr></thead>
                <tbody>
                  <tr><td>Meta Platforms (WhatsApp Business Platform)</td><td>Sending and receiving WhatsApp messages from your number.</td></tr>
                  <tr><td>MongoDB Atlas</td><td>Database.</td></tr>
                  <tr><td>Upstash</td><td>Job queue and short-lived cache.</td></tr>
                  <tr><td>Render</td><td>Application hosting.</td></tr>
                  <tr><td>Netlify</td><td>Website and dashboard hosting.</td></tr>
                  <tr><td>Google (Gemini API, Gmail)</td><td>Reading free-text addresses; sending service emails.</td></tr>
                  <tr><td>Razorpay / Cashfree</td><td>Payment links in your gateway account; our subscription billing.</td></tr>
                </tbody>
              </table>
            </div>
            <p>Your own store platform, couriers and payment gateway are services <em>you</em> chose and connected; data sent to them is sent on your instruction.</p>
          </section>

          <section className="legal-section" id="audits">
            <h2 className="legal-section__heading"><span className="legal-section__num">05.</span>Information and audits</h2>
            <p>Once a year, or after a breach, you may ask us in writing for information showing how we meet this Addendum. We will answer reasonable questions in writing within 30 days.</p>
          </section>

          <section className="legal-section" id="deletion">
            <h2 className="legal-section__heading"><span className="legal-section__num">06.</span>Deletion at the end of the service</h2>
            <div className="legal-notice legal-notice--warning">
              <Users className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                When your account ends you can export your data for 7 days. Within 30 days after that, we delete your shoppers&rsquo; personal data from our systems (automatic logs expire on their own schedule; see the <Link to="/privacy">Privacy Policy</Link>). On request, we will confirm the deletion in writing. Removing our app from Shopify also triggers deletion of that store&rsquo;s shopper data.
              </div>
            </div>
          </section>

          <section className="legal-section" id="governing-law">
            <h2 className="legal-section__heading"><span className="legal-section__num">07.</span>Governing law and precedence</h2>
            <p>This Addendum is governed by the laws of India, with the courts at {LEGAL.jurisdiction} having jurisdiction. If it conflicts with the Terms of Service on personal data, this Addendum prevails.</p>
          </section>
        </article>

        <footer className="legal-footer">
          <div className="legal-footer__links">
            <Link to="/" className="legal-footer__link">Home</Link>
            <Link to="/dashboard" className="legal-footer__link">Merchant Dashboard</Link>
            <Link to="/privacy" className="legal-footer__link">Privacy Policy</Link>
            <Link to="/terms" className="legal-footer__link">Terms of Service</Link>
            <Link to="/dpa" className="legal-footer__link legal-footer__link--active">Data Processing Addendum</Link>
          </div>
          <p className="legal-footer__copy">&copy; {new Date().getFullYear()} {LEGAL.legalName}. Operated by {LEGAL.proprietor}, {LEGAL.country}.</p>
        </footer>
      </main>
    </div>
  );
};

export default DPDPAddendum;
