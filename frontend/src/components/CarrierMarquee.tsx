interface Carrier {
  name: string;
  type: 'courier' | 'platform';
  latency: string;
  badge: string;
  desc: string;
}

const INTEGRATIONS: Carrier[] = [
  { name: 'Shiprocket', type: 'courier', latency: '14ms', badge: 'Direct API', desc: 'Auto-detects NDR remark & re-attempt' },
  { name: 'Delhivery', type: 'courier', latency: '11ms', badge: 'Direct API', desc: 'Driver GPS route & address sync' },
  { name: 'ClickPost', type: 'courier', latency: '12ms', badge: 'Multi-Carrier', desc: 'Blue Dart, Shadowfax & Xpressbees hub' },
  { name: 'Shopify', type: 'platform', latency: 'Direct', badge: 'App Bridge', desc: '1-click store sync & order updates' },
  { name: 'WooCommerce', type: 'platform', latency: 'Direct', badge: 'REST v3', desc: 'Live order webhooks & status sync' },
  { name: 'WhatsApp Cloud API', type: 'platform', latency: '< 90s', badge: 'Meta WABA', desc: '1-tap interactive customer prompts' },
  { name: 'Razorpay & Cashfree', type: 'platform', latency: 'Instant', badge: 'UPI Intent', desc: 'COD-to-Prepaid conversion links' },
  { name: 'Universal Webhook API', type: 'platform', latency: '< 5ms', badge: 'REST JSON', desc: 'Custom courier & ERP intercept mesh' },
];

export function CarrierMarquee() {
  return (
    <section className="rs-mesh" aria-label="Supported Carriers and Commerce Integrations">
      <div className="rs-mesh__header">
        <span className="rs-mesh__kicker">autonomous intercept mesh</span>
        <h3 className="rs-mesh__title">Direct webhook listeners for India’s logistics fleet</h3>
        <p className="rs-mesh__sub">
          RescueShip connects directly to India’s courier APIs (Shiprocket, Delhivery, ClickPost for Blue Dart/Shadowfax), commerce platforms (Shopify, WooCommerce), WhatsApp Cloud API, and UPI gateways.
        </p>
      </div>

      <div className="rs-marquee" tabIndex={0} aria-label="List of supported carrier and commerce integrations">
        <div className="rs-marquee__track">
          {/* First loop */}
          <div className="rs-marquee__content">
            {INTEGRATIONS.map((item) => (
              <div key={`m1-${item.name}`} className={`rs-badge rs-badge--${item.type}`}>
                <div className="rs-badge__head">
                  <span className="rs-badge__dot" aria-hidden="true" />
                  <span className="rs-badge__name">{item.name}</span>
                  <span className="rs-badge__tag">{item.badge}</span>
                </div>
                <div className="rs-badge__footer">
                  <span className="rs-badge__desc">{item.desc}</span>
                  <span className="rs-badge__latency">{item.latency}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Duplicated loop for seamless infinite marquee */}
          <div className="rs-marquee__content" aria-hidden="true">
            {INTEGRATIONS.map((item) => (
              <div key={`m2-${item.name}`} className={`rs-badge rs-badge--${item.type}`}>
                <div className="rs-badge__head">
                  <span className="rs-badge__dot" aria-hidden="true" />
                  <span className="rs-badge__name">{item.name}</span>
                  <span className="rs-badge__tag">{item.badge}</span>
                </div>
                <div className="rs-badge__footer">
                  <span className="rs-badge__desc">{item.desc}</span>
                  <span className="rs-badge__latency">{item.latency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CarrierMarquee;
