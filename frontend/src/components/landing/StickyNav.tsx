import { Link } from 'react-router-dom';

export function StickyNav() {
  return (
    <nav className="lnav" aria-label="Landing navigation">
      <div className="lnav__inner">
        <a href="#product" className="lnav__brand">
          <span className="lnav__logo" aria-hidden="true">⚓</span>
          <span className="lnav__name">RescueShip</span>
        </a>

        <div className="lnav__links">
          <a href="#product" className="lnav__link">Product</a>
          <a href="#features" className="lnav__link">Features</a>
          <a href="#pricing" className="lnav__link">Pricing</a>
          <a href="#faq" className="lnav__link">FAQ</a>
        </div>

        <div className="lnav__actions">
          <Link to="/register" className="lnav__cta">Start Free →</Link>
        </div>
      </div>
    </nav>
  );
}
