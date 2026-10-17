
interface Carrier {
  serial: string;
  name: string;
  type: 'courier' | 'platform';
  latency: string;
  badge: string;
  desc: string;
  logoPath?: string;
}

const INTEGRATIONS: Carrier[] = [
  { serial: 'INT/01', name: 'Shiprocket', type: 'courier', latency: '14ms', badge: 'Direct API', desc: 'Auto-detects NDR remark & re-attempt', logoPath: '/logos/shiprocket.svg' },
  { serial: 'INT/02', name: 'Delhivery', type: 'courier', latency: '11ms', badge: 'Direct API', desc: 'Driver GPS route & address sync', logoPath: '/logos/delhivery.svg' },
  { serial: 'INT/03', name: 'ClickPost', type: 'courier', latency: '12ms', badge: 'Multi-Carrier', desc: 'Blue Dart, Shadowfax & Xpressbees hub', logoPath: '/logos/clickpost.svg' },
  { serial: 'INT/04', name: 'Shopify', type: 'platform', latency: 'Direct', badge: 'App Bridge', desc: '1-click store sync & order updates', logoPath: '/logos/shopify.svg' },
  { serial: 'INT/05', name: 'WooCommerce', type: 'platform', latency: 'Direct', badge: 'REST v3', desc: 'Live order webhooks & status sync', logoPath: '/logos/woocommerce.svg' },
  { serial: 'INT/06', name: 'WhatsApp Cloud API', type: 'platform', latency: '< 90s', badge: 'Meta WABA', desc: '1-tap interactive customer prompts', logoPath: '/logos/whatsapp.svg' },
  { serial: 'INT/07', name: 'Razorpay & Cashfree', type: 'platform', latency: 'Instant', badge: 'UPI Intent', desc: 'COD-to-Prepaid conversion links', logoPath: '/logos/razorpay.svg' },
  { serial: 'INT/08', name: 'Universal Webhook API', type: 'platform', latency: '< 5ms', badge: 'REST JSON', desc: 'Custom courier & ERP webhooks' },
];

function PartnerGlyph({ name }: { name: string }) {
  switch (name) {
    case 'Shiprocket':
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M12 3L4 18H11L9 22L19 9H12L12 3Z" fill="currentColor" />
        </svg>
      );
    case 'Delhivery':
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M7 9H13C14.5 9 15.5 10 15.5 11.5C15.5 13 14.5 14 13 14H9V17H7V9Z" fill="currentColor" />
        </svg>
      );
    case 'ClickPost':
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'Shopify':
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M18 6L14.5 5L13 6.5L11.5 6L10.5 7L6 18L14 21L19.5 19L18 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case 'WooCommerce':
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 10L9 14L11 10L13 14L15 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'WhatsApp Cloud API':
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 10C9 9.5 9.5 9 10 9L11.5 11.5L11 12.5C11.5 13.5 12.5 14.5 13.5 15L14.5 14.5L17 16C17 16.5 16.5 17 16 17C12 17 9 14 9 10Z" fill="currentColor" />
        </svg>
      );
    case 'Razorpay & Cashfree':
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M13 3L6 17H12L10 21L18 9H13L13 3Z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg className="rs-badge__glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M4 8L12 4L20 8L12 12L4 8Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 14L12 18L20 14" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
  }
}

export function CarrierMarquee() {
  return (
    <section className="rs-mesh" aria-label="Supported Carriers and Commerce Integrations">
      <div className="rs-mesh__header">
        <span className="rs-mesh__kicker">Supported Integrations</span>
        <h3 className="rs-mesh__title">Direct connections with India’s leading logistics network</h3>
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
                  <span className="rs-badge__serial">{item.serial}</span>
                  <PartnerGlyph name={item.name} />
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
                  <span className="rs-badge__serial">{item.serial}</span>
                  <PartnerGlyph name={item.name} />
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
