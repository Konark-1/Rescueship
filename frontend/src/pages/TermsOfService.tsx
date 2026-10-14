import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Anchor, FileText, CheckCircle2, Zap, Scale } from 'lucide-react';
import { LEGAL, legalEntityLine } from '../legal/entity';
import './legal.css';

/* Keep every promise here deliverable. Change LEGAL (legal/entity.ts) rather than hard-coding names. */
const TermsOfService: React.FC = () => {
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
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">The agreement between {LEGAL.brand} and the businesses that use it.</p>
          <div className="legal-meta-bar">
            <div className="legal-meta-item"><span>Effective:</span><strong>{LEGAL.effectiveDate}</strong></div>
            <div className="legal-meta-item"><span>Contact:</span><strong>{LEGAL.contactEmail}</strong></div>
          </div>
        </header>

        <section className="legal-callout-grid" aria-label="Key terms">
          <div className="legal-callout-card">
            <div className="legal-callout-head"><span className="legal-callout-icon"><Zap size={18} /></span><span>What you get</span></div>
            <p className="legal-callout-desc">Automatic WhatsApp follow-up on failed or risky deliveries, with answers sent back to your courier and store.</p>
          </div>
          <div className="legal-callout-card">
            <div className="legal-callout-head"><span className="legal-callout-icon legal-callout-icon--emerald"><CheckCircle2 size={18} /></span><span>{LEGAL.guaranteeDays}-day money-back guarantee</span></div>
            <p className="legal-callout-desc">If your recorded savings in the first {LEGAL.guaranteeDays} days don&rsquo;t exceed the fees you paid, we refund those fees.</p>
          </div>
          <div className="legal-callout-card">
            <div className="legal-callout-head"><span className="legal-callout-icon"><Scale size={18} /></span><span>Liability capped</span></div>
            <p className="legal-callout-desc">Each side&rsquo;s liability is limited to the fees paid in the previous 12 months.</p>
          </div>
        </section>

        <article className="legal-content">
          <section className="legal-section" id="acceptance">
            <h2 className="legal-section__heading"><span className="legal-section__num">01.</span>Who this agreement is with</h2>
            <p>
              These Terms are an agreement between <strong>{legalEntityLine()}</strong> (&ldquo;{LEGAL.brand}&rdquo;, &ldquo;we&rdquo;) and the business or person who creates an account (&ldquo;Merchant&rdquo;, &ldquo;you&rdquo;). By creating an account, connecting a store or using {LEGAL.brand}, you agree to these Terms, the <Link to="/privacy">Privacy Policy</Link> and the <Link to="/dpa">Data Processing Addendum</Link>.
            </p>
          </section>

          <section className="legal-section" id="service">
            <h2 className="legal-section__heading"><span className="legal-section__num">02.</span>The service</h2>
            <ul>
              <li>We receive delivery updates from your courier or shipping aggregator and orders from your store.</li>
              <li>When a delivery fails or is at risk, we message your shopper on WhatsApp from <em>your</em> WhatsApp Business number, using Meta-approved templates.</li>
              <li>We pass the shopper&rsquo;s answer (reschedule, new address, cancel, or pay online through <em>your</em> payment gateway) to your courier and store, and show results in your dashboard.</li>
            </ul>
            <p>Results depend on couriers, Meta, payment gateways and shoppers, which we do not control. We do not guarantee that any particular shipment will be delivered.</p>
          </section>

          <section className="legal-section" id="merchant-responsibilities">
            <h2 className="legal-section__heading"><span className="legal-section__num">03.</span>Your responsibilities</h2>
            <ul>
              <li>Give accurate account and billing details and keep your logins and API keys safe.</li>
              <li>Make sure your shoppers can lawfully be contacted about their orders (for example, through your store&rsquo;s checkout notice and privacy policy), as required by the DPDP Act, 2023.</li>
              <li>Follow WhatsApp&rsquo;s Business and Commerce Policies. Do not use {LEGAL.brand} for spam, promotions shoppers did not agree to, or anything illegal.</li>
              <li>You own your WhatsApp Business Account, store, courier and payment-gateway accounts, and you are responsible for their charges (including Meta&rsquo;s per-message fees).</li>
            </ul>
          </section>

          <section className="legal-section" id="fees">
            <h2 className="legal-section__heading"><span className="legal-section__num">04.</span>Fees and billing</h2>
            <p>
              You pay the plan price shown at checkout, billed in advance through Razorpay for the billing cycle you choose. Prices are in Indian Rupees and include or exclude taxes as stated at checkout. Plans renew automatically until cancelled; you can cancel from the Billing page and keep access until the end of the paid period. If a renewal payment fails, we may pause the service after notifying you.
            </p>
          </section>

          <section className="legal-section" id="guarantee">
            <h2 className="legal-section__heading"><span className="legal-section__num">05.</span>{LEGAL.guaranteeDays}-day money-back guarantee</h2>
            <div className="legal-notice legal-notice--emerald">
              <CheckCircle2 className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                If, in the first {LEGAL.guaranteeDays} days after your <strong>first</strong> paid subscription starts, the savings recorded in your {LEGAL.brand} dashboard (RTO and courier charges avoided) are less than the subscription fees you paid for that period, we will refund those fees in full.
                <br /><br />
                To claim, email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> from your account email within 15 days after the {LEGAL.guaranteeDays}-day period ends. The guarantee applies once per business, and only if your store, courier and WhatsApp connections stayed active and messaging was not paused for most of the period. Refunds go back to the original payment method.
              </div>
            </div>
          </section>

          <section className="legal-section" id="availability">
            <h2 className="legal-section__heading"><span className="legal-section__num">06.</span>Availability and support</h2>
            <p>
              We work to keep {LEGAL.brand} available and to fix problems quickly, but we do not promise a specific uptime and do not offer service credits. Outages at Meta, couriers, payment gateways or store platforms are outside our control. Support is by email at {LEGAL.contactEmail}.
            </p>
          </section>

          <section className="legal-section" id="data">
            <h2 className="legal-section__heading"><span className="legal-section__num">07.</span>Your data</h2>
            <p>
              You own your store and shopper data. We use it only to provide the service, as described in the <Link to="/privacy">Privacy Policy</Link> and <Link to="/dpa">Data Processing Addendum</Link>. After your account ends you can export your data for 7 days; after that we delete it within 30 days, except billing records the law requires us to keep.
            </p>
          </section>

          <section className="legal-section" id="liability">
            <h2 className="legal-section__heading"><span className="legal-section__num">08.</span>Limitation of liability</h2>
            <ul>
              <li>Each party&rsquo;s total liability under these Terms is limited to the fees you paid {LEGAL.brand} in the 12 months before the event that caused the claim.</li>
              <li>Neither party is liable for indirect or consequential losses such as lost profits, or for loss of or damage to goods in transit.</li>
              <li>Nothing here limits liability that cannot be limited under Indian law.</li>
            </ul>
          </section>

          <section className="legal-section" id="termination">
            <h2 className="legal-section__heading"><span className="legal-section__num">09.</span>Ending the agreement</h2>
            <p>
              You can cancel at any time from the Billing page; access continues until the end of the paid period. We may suspend or end your account if you seriously or repeatedly break these Terms or WhatsApp&rsquo;s policies, or put shoppers or the service at risk. Where we end the agreement without cause, we refund the unused part of any prepaid fees.
            </p>
          </section>

          <section className="legal-section" id="changes">
            <h2 className="legal-section__heading"><span className="legal-section__num">10.</span>Changes to these Terms</h2>
            <p>We will give at least 15 days&rsquo; notice by email or in the dashboard before material changes take effect. Continuing to use {LEGAL.brand} after that means you accept the new Terms.</p>
          </section>

          <section className="legal-section" id="governing-law">
            <h2 className="legal-section__heading"><span className="legal-section__num">11.</span>Governing law</h2>
            <p>These Terms are governed by the laws of India. The courts at {LEGAL.jurisdiction} have exclusive jurisdiction over any dispute.</p>
          </section>

          <section className="legal-section" id="contact">
            <h2 className="legal-section__heading"><span className="legal-section__num">12.</span>Contact</h2>
            <div className="legal-notice">
              <FileText className="legal-notice__icon" size={20} />
              <div className="legal-notice__body">
                <strong>{legalEntityLine()}</strong><br />
                Email: <a href={`mailto:${LEGAL.contactEmail}`} style={{ color: 'var(--indigo-soft)' }}>{LEGAL.contactEmail}</a>
              </div>
            </div>
          </section>
        </article>

        <footer className="legal-footer">
          <div className="legal-footer__links">
            <Link to="/" className="legal-footer__link">Home</Link>
            <Link to="/dashboard" className="legal-footer__link">Merchant Dashboard</Link>
            <Link to="/privacy" className="legal-footer__link">Privacy Policy</Link>
            <Link to="/terms" className="legal-footer__link legal-footer__link--active">Terms of Service</Link>
            <Link to="/dpa" className="legal-footer__link">Data Processing Addendum</Link>
          </div>
          <p className="legal-footer__copy">&copy; {new Date().getFullYear()} {LEGAL.legalName}. Operated by {LEGAL.proprietor}, {LEGAL.country}.</p>
        </footer>
      </main>
    </div>
  );
};

export default TermsOfService;
