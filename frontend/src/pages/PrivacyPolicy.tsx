import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Clock, Mail, ArrowLeft, Anchor, CheckCircle2, Trash2 } from 'lucide-react';
import { LEGAL, legalEntityLine } from '../legal/entity';
import './legal.css';

/*
 * Every statement here must stay true to how the code actually works
 * (retention = TTL indexes in src/models/indexes.ts, encryption = encryption.service.ts,
 * opt-out = OPT_OUT_RE in whatsapp.webhook.ts). Update this page when those change.
 */
const PrivacyPolicy: React.FC = () => {
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
            <Link to="/terms" className="legal-nav__link">Terms of Service</Link>
            <Link to="/dpa" className="legal-nav__link">Data Processing Addendum</Link>
            <Link to="/dashboard" className="legal-nav__btn">
              <span>Go to Dashboard</span>
              <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
            </Link>
          </div>
        </div>
      </nav>

      <main className="legal-container">
        <header className="legal-header">
          <div className="legal-badge-strip">
            <span className="legal-badge legal-badge--emerald"><CheckCircle2 size={12} /> Written for India&rsquo;s DPDP Act, 2023</span>
            <span className="legal-badge legal-badge--indigo"><Lock size={12} /> Merchant credentials encrypted (AES-256-GCM)</span>
          </div>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-subtitle">
            What personal data {LEGAL.brand} handles, why, who it is shared with, how long it is kept, and how to have it corrected or deleted.
          </p>
          <div className="legal-meta-bar">
            <div className="legal-meta-item"><span>Effective:</span><strong>{LEGAL.effectiveDate}</strong></div>
            <div className="legal-meta-item"><span>Contact:</span><strong>{LEGAL.contactEmail}</strong></div>
          </div>
        </header>

        <section className="legal-callout-grid" aria-label="Privacy summary">
          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon legal-callout-icon--emerald"><ShieldCheck size={18} /></span>
              <span>Only for your deliveries</span>
            </div>
            <p className="legal-callout-desc">Shopper data is used only to resolve that shopper&rsquo;s order for the merchant they bought from. We never sell it or use it for advertising.</p>
          </div>
          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><Lock size={18} /></span>
              <span>Credentials encrypted</span>
            </div>
            <p className="legal-callout-desc">Merchant API keys and access tokens are encrypted with AES-256-GCM before they are stored. All traffic uses HTTPS.</p>
          </div>
          <div className="legal-callout-card">
            <div className="legal-callout-head">
              <span className="legal-callout-icon"><Clock size={18} /></span>
              <span>Logs expire automatically</span>
            </div>
            <p className="legal-callout-desc">Webhook, message and activity logs are deleted automatically after 30 to 180 days.</p>
          </div>
        </section>

        <article className="legal-content">
          <section className="legal-section" id="scope">
            <h2 className="legal-section__heading"><span className="legal-section__num">01.</span>Who we are and our role</h2>
            <p>
              {LEGAL.brand} is operated by <strong>{legalEntityLine()}</strong> (&ldquo;{LEGAL.brand}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). {LEGAL.brand} is software for online stores: when a courier reports a failed or risky delivery, it contacts the store&rsquo;s shopper on WhatsApp and passes the shopper&rsquo;s answer back to the courier and the store.
            </p>
            <ul>
              <li><strong>Shopper data</strong> (people who buy from our merchants): the merchant decides why this data is processed and is the <strong>Data Fiduciary</strong> under the Digital Personal Data Protection Act, 2023. We process it on the merchant&rsquo;s behalf as a <strong>Data Processor</strong>, under our <Link to="/dpa">Data Processing Addendum</Link>.</li>
              <li><strong>Merchant account data</strong> (the businesses that sign up): we are the Data Fiduciary.</li>
            </ul>
          </section>

          <section className="legal-section" id="data-collected">
            <h2 className="legal-section__heading"><span className="legal-section__num">02.</span>Data we process</h2>
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead><tr><th>Whose data</th><th>What</th><th>Where it comes from</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>Merchant</strong></td>
                    <td>Name, email, phone number, store name and URL, login details (Google sign-in, or a password stored only as a hash), plan and payment references, and the API keys/tokens the merchant connects (store, WhatsApp, courier, payment gateway).</td>
                    <td>The merchant, when signing up and connecting accounts.</td>
                  </tr>
                  <tr>
                    <td><strong>Shopper</strong></td>
                    <td>Order number, name, phone number, shipping address and pincode, order value and payment method, courier tracking number (AWB), delivery status and failure reason, the WhatsApp messages we send and the shopper&rsquo;s replies, and a location pin if the shopper chooses to share one.</td>
                    <td>The merchant&rsquo;s store (Shopify / WooCommerce), the merchant&rsquo;s courier, and the shopper&rsquo;s own WhatsApp replies.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>We do <strong>not</strong> collect card numbers, CVVs, UPI PINs, bank passwords or Aadhaar numbers. Online payments are made on the payment gateway&rsquo;s own page.</p>
          </section>

          <section className="legal-section" id="use">
            <h2 className="legal-section__heading"><span className="legal-section__num">03.</span>How we use it</h2>
            <ul>
              <li>Send the shopper WhatsApp messages about <em>their own order</em> from the merchant&rsquo;s WhatsApp Business number, using templates approved by Meta.</li>
              <li>Act on the shopper&rsquo;s reply: reschedule delivery, correct the address, cancel, or pay online through a payment link created in the <em>merchant&rsquo;s</em> own payment-gateway account.</li>
              <li>Send the result to the courier and update the order in the merchant&rsquo;s store.</li>
              <li>Read and tidy up free-text addresses. The address text may be sent to Google&rsquo;s Gemini API for this; it is not used to profile anyone.</li>
              <li>Show the merchant dashboards, reports and alerts; bill the merchant for their plan; keep the service secure and prevent abuse.</li>
            </ul>
            <p>Lawful basis: for shopper data, the merchant&rsquo;s instructions and the shopper&rsquo;s purchase and delivery request; for merchant data, our contract with the merchant.</p>
          </section>

          <section className="legal-section" id="sharing">
            <h2 className="legal-section__heading"><span className="legal-section__num">04.</span>Who we share it with</h2>
            <p>Only with the services needed to run {LEGAL.brand}. Some of them may process data outside India.</p>
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead><tr><th>Service</th><th>Why</th></tr></thead>
                <tbody>
                  <tr><td>Meta (WhatsApp Business Platform)</td><td>Sending and receiving WhatsApp messages.</td></tr>
                  <tr><td>The merchant&rsquo;s store platform (Shopify, WooCommerce)</td><td>Reading orders and writing updates back.</td></tr>
                  <tr><td>The merchant&rsquo;s couriers / shipping aggregators (e.g. Shiprocket)</td><td>Receiving delivery status and sending re-attempt or address instructions.</td></tr>
                  <tr><td>Razorpay / Cashfree</td><td>Payment links in the merchant&rsquo;s account; our own subscription billing.</td></tr>
                  <tr><td>Google</td><td>Sign-in with Google, address parsing (Gemini API), and sending service emails.</td></tr>
                  <tr><td>MongoDB Atlas, Upstash, Render, Netlify</td><td>Database, job queue, application hosting and website hosting.</td></tr>
                </tbody>
              </table>
            </div>
            <p>We may also disclose data where Indian law requires it. We do not sell personal data.</p>
          </section>

          <section className="legal-section" id="retention">
            <h2 className="legal-section__heading"><span className="legal-section__num">05.</span>How long we keep it</h2>
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead><tr><th>Record</th><th>Kept for</th></tr></thead>
                <tbody>
                  <tr><td>Raw webhook events (store, courier, payment, WhatsApp)</td><td><span className="legal-pill legal-pill--amber">30 days</span></td></tr>
                  <tr><td>Activity / audit logs and delivery-attempt logs</td><td><span className="legal-pill legal-pill--amber">90 days</span></td></tr>
                  <tr><td>WhatsApp message logs</td><td><span className="legal-pill legal-pill--amber">180 days</span></td></tr>
                  <tr><td>Orders and delivery cases</td><td>While the merchant&rsquo;s account is active; erased when the merchant or shopper asks (see below) or when the store removes our app.</td></tr>
                  <tr><td>Merchant billing records</td><td>As long as Indian tax and accounting law requires.</td></tr>
                </tbody>
              </table>
            </div>
            <p>Logs are deleted automatically by the database when they reach the age above.</p>
          </section>

          <section className="legal-section" id="security">
            <h2 className="legal-section__heading"><span className="legal-section__num">06.</span>Security</h2>
            <ul>
              <li>Merchant credentials and access tokens are encrypted with AES-256-GCM before storage; passwords are stored only as hashes.</li>
              <li>All connections use HTTPS. Incoming webhooks are accepted only with a valid signature or key from the sending service.</li>
              <li>Each merchant can only see their own data. Production access is limited to the operator of {LEGAL.brand}.</li>
            </ul>
            <p>No system is perfectly secure. If a breach affects personal data, we will inform affected merchants and, where required, the Data Protection Board of India.</p>
          </section>

          <section className="legal-section" id="rights">
            <h2 className="legal-section__heading"><span className="legal-section__num">07.</span>Your choices and rights</h2>
            <ul>
              <li><strong>Stop WhatsApp messages:</strong> reply <span className="legal-pill">STOP</span> or <span className="legal-pill">UNSUBSCRIBE</span> to any message. That merchant&rsquo;s messages stop. Reply <span className="legal-pill">START</span> to allow them again.</li>
              <li><strong>Access, correction and erasure:</strong> shoppers can ask the store they bought from, or email us. We act on shopper requests together with the merchant, because the merchant controls that data.</li>
              <li><strong>Grievances:</strong> contact our Grievance Officer below. If you are not satisfied, you may approach the Data Protection Board of India.</li>
            </ul>
          </section>

          <section className="legal-section" id="data-deletion">
            <h2 className="legal-section__heading"><span className="legal-section__num">08.</span>Data deletion</h2>
            <div className="legal-notice legal-notice--emerald">
              <Trash2 className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>Merchants:</strong> email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> from your account email with the subject &ldquo;Delete my account&rdquo;. We delete your account, connections and order data within 30 days, keeping only billing records the law requires. Removing the {LEGAL.brand} app from Shopify also triggers deletion of that store&rsquo;s shopper data.<br />
                <strong>Shoppers:</strong> email us your phone number and the store and order number. We will erase your data with that merchant and confirm by email.
              </div>
            </div>
          </section>

          <section className="legal-section" id="contact">
            <h2 className="legal-section__heading"><span className="legal-section__num">09.</span>Contact and Grievance Officer</h2>
            <div className="legal-notice">
              <Mail className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>Grievance Officer:</strong> {LEGAL.proprietor}<br />
                Email: <a href={`mailto:${LEGAL.contactEmail}`} style={{ color: 'var(--indigo-soft)', textDecoration: 'underline' }}>{LEGAL.contactEmail}</a><br />
                Operator: {legalEntityLine()}
              </div>
            </div>
          </section>

          <section className="legal-section" id="changes">
            <h2 className="legal-section__heading"><span className="legal-section__num">10.</span>Changes to this policy</h2>
            <p>If we change this policy we will update the effective date above and tell merchants in the dashboard before material changes take effect.</p>
          </section>
        </article>

        <footer className="legal-footer">
          <div className="legal-footer__links">
            <Link to="/" className="legal-footer__link">Home</Link>
            <Link to="/dashboard" className="legal-footer__link">Merchant Dashboard</Link>
            <Link to="/privacy" className="legal-footer__link legal-footer__link--active">Privacy Policy</Link>
            <Link to="/terms" className="legal-footer__link">Terms of Service</Link>
            <Link to="/dpa" className="legal-footer__link">Data Processing Addendum</Link>
          </div>
          <p className="legal-footer__copy">&copy; {new Date().getFullYear()} {LEGAL.legalName}. Operated by {LEGAL.proprietor}, {LEGAL.country}.</p>
        </footer>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
