interface Integration {
  name: string;
  type: 'courier' | 'platform';
  category: string;
  logo: string;
}

const INTEGRATIONS: Integration[] = [
  { name: 'Shiprocket', type: 'courier', category: 'Direct API', logo: '/logos/shiprocket.svg' },
  { name: 'Delhivery', type: 'courier', category: 'Surface & Express', logo: '/logos/delhivery.svg' },
  { name: 'Blue Dart', type: 'courier', category: 'Air Express', logo: '/logos/bluedart.svg' },
  { name: 'ClickPost', type: 'courier', category: 'Multi-Carrier Hub', logo: '/logos/clickpost.svg' },
  { name: 'Shadowfax', type: 'courier', category: 'Hyperlocal & Surface', logo: '/logos/shadowfax.svg' },
  { name: 'Shopify', type: 'platform', category: 'App Bridge', logo: '/logos/shopify.svg' },
  { name: 'WooCommerce', type: 'platform', category: 'REST API v3', logo: '/logos/woocommerce.svg' },
  { name: 'WhatsApp Cloud API', type: 'platform', category: 'Official Meta WABA', logo: '/logos/whatsapp.svg' },
  { name: 'Razorpay', type: 'platform', category: 'Instant UPI Intent', logo: '/logos/razorpay.svg' },
  { name: 'Cashfree', type: 'platform', category: 'Auto-Refunds & COD', logo: '/logos/cashfree.svg' },
];

export function CarrierMarquee() {
  return (
    <div className="rs-mesh rs-mesh--embedded" aria-label="Supported Carriers and Commerce Integrations">
      <div className="rs-marquee" tabIndex={0} aria-label="List of supported carrier and commerce integrations">
        <div className="rs-marquee__track">
          {/* Loop 1 */}
          <div className="rs-marquee__content">
            {INTEGRATIONS.map((item) => (
              <div key={`m1-${item.name}`} className={`rs-logo-pill rs-logo-pill--${item.type}`}>
                <div className="rs-logo-pill__icon-wrap">
                  <img
                    src={item.logo}
                    alt=""
                    width={28}
                    height={28}
                    className="rs-logo-pill__img"
                    loading="lazy"
                    aria-hidden="true"
                  />
                </div>
                <div className="rs-logo-pill__text">
                  <span className="rs-logo-pill__name">{item.name}</span>
                  <span className="rs-logo-pill__cat">{item.category}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Loop 2 for seamless infinite scroll */}
          <div className="rs-marquee__content" aria-hidden="true">
            {INTEGRATIONS.map((item) => (
              <div key={`m2-${item.name}`} className={`rs-logo-pill rs-logo-pill--${item.type}`}>
                <div className="rs-logo-pill__icon-wrap">
                  <img
                    src={item.logo}
                    alt=""
                    width={28}
                    height={28}
                    className="rs-logo-pill__img"
                    loading="lazy"
                    aria-hidden="true"
                  />
                </div>
                <div className="rs-logo-pill__text">
                  <span className="rs-logo-pill__name">{item.name}</span>
                  <span className="rs-logo-pill__cat">{item.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CarrierMarquee;
