import { Link } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'motion/react';

interface StickyNavProps {
  onNavigate?: (anchor: string) => void;
}

export function StickyNav({ onNavigate }: StickyNavProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.25,
  });

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const targetId = href.replace('#', '');
    onNavigate?.(targetId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rs:navigate', { detail: targetId }));
    }
    const el = document.getElementById(targetId);
    if (el) {
      e.preventDefault();
      const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth' });
      window.history.pushState(null, '', href);
    }
  };

  return (
    <nav className="lnav" aria-label="Landing navigation">
      <motion.div className="lnav__progress" style={{ scaleX }} aria-hidden="true" />
      <div className="lnav__inner">
        <div className="lnav__brand-group">
          <a href="#product" className="lnav__brand lp-brand" onClick={(e) => handleNavClick(e, '#product')}>
            <span className="lnav__logo" aria-hidden="true">⚓</span>
            <span className="lnav__name">RescueShip</span>
          </a>
        </div>

        <div className="lnav__links">
          <a href="#product" className="lnav__link" onClick={(e) => handleNavClick(e, '#product')}>Product</a>
          <a href="#features" className="lnav__link" onClick={(e) => handleNavClick(e, '#features')}>Features</a>
          <a href="#calculator" className="lnav__link" onClick={(e) => handleNavClick(e, '#calculator')}>Calculate RTO</a>
          <a href="#pricing" className="lnav__link" onClick={(e) => handleNavClick(e, '#pricing')}>Pricing</a>
          <a href="#faq" className="lnav__link" onClick={(e) => handleNavClick(e, '#faq')}>FAQ</a>
        </div>

        <div className="lnav__actions">
          <Link to="/login" className="lnav__link">Log in</Link>
          <Link to="/register" className="lnav__cta">Start Free →</Link>
        </div>
      </div>
    </nav>
  );
}

export default StickyNav;
