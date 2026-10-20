interface Integration {
  name: string;
  role: string;
  category?: string;
  type?: 'courier' | 'platform';
  logo: string;
}

const INTEGRATIONS: Integration[] = [
  { name: 'Shiprocket', role: 'Direct API', category: 'Direct API', type: 'courier', logo: '/logos/shiprocket.svg' },
  { name: 'Delhivery', role: 'Surface & Express', category: 'Surface & Express', type: 'courier', logo: '/logos/delhivery.svg' },
  { name: 'Blue Dart', role: 'Air Express', category: 'Air Express', type: 'courier', logo: '/logos/bluedart.svg' },
  { name: 'ClickPost', role: 'Multi-Carrier Hub', category: 'Multi-Carrier Hub', type: 'courier', logo: '/logos/clickpost.svg' },
  { name: 'Shadowfax', role: 'Hyperlocal & Surface', category: 'Hyperlocal & Surface', type: 'courier', logo: '/logos/shadowfax.svg' },
  { name: 'Shopify', role: 'App Bridge', category: 'App Bridge', type: 'platform', logo: '/logos/shopify.svg' },
  { name: 'WooCommerce', role: 'REST API v3', category: 'REST API v3', type: 'platform', logo: '/logos/woocommerce.svg' },
  { name: 'WhatsApp Cloud API', role: 'Official Meta WABA', category: 'Official Meta WABA', type: 'platform', logo: '/logos/whatsapp.svg' },
  { name: 'Razorpay', role: 'Instant UPI Intent', category: 'Instant UPI Intent', type: 'platform', logo: '/logos/razorpay.svg' },
  { name: 'Cashfree', role: 'Auto-Refunds & COD', category: 'Auto-Refunds & COD', type: 'platform', logo: '/logos/cashfree.svg' },
];

export function CarrierMarquee() {
  return (
    <div className="rs-mesh rs-mesh--embedded" aria-label="Supported Carriers and Commerce Integrations">
      <div className="rs-marquee" tabIndex={0} aria-label="List of supported carrier and commerce integrations">
        <div className="rs-marquee__track">
          {/* Loop 1 */}
          <div className="rs-marquee__content">
            {INTEGRATIONS.map((item, idx) => (
              <div key={`m1-${item.name}-${idx}`} className="rs-nameplate">
                <img src={item.logo} alt="" aria-hidden="true" className="rs-nameplate__watermark" />
                <div className="rs-nameplate__symbol-box">
                  <img src={item.logo} alt={item.name} width={28} height={28} className="rs-nameplate__logo" loading="lazy" />
                </div>
                <div className="rs-nameplate__label">
                  <span className="rs-nameplate__name">{item.name}</span>
                  <span className="rs-nameplate__role">{item.role}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Loop 2 for seamless infinite scroll */}
          <div className="rs-marquee__content" aria-hidden="true">
            {INTEGRATIONS.map((item, idx) => (
              <div key={`m2-${item.name}-${idx}`} className="rs-nameplate">
                <img src={item.logo} alt="" aria-hidden="true" className="rs-nameplate__watermark" />
                <div className="rs-nameplate__symbol-box">
                  <img src={item.logo} alt={item.name} width={28} height={28} className="rs-nameplate__logo" loading="lazy" />
                </div>
                <div className="rs-nameplate__label">
                  <span className="rs-nameplate__name">{item.name}</span>
                  <span className="rs-nameplate__role">{item.role}</span>
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
