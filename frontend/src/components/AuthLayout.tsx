import React, { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors } from 'lucide-react';
import '../pages/auth.css';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  features?: ReactNode;
  accent?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, features, accent }) => {
  return (
    <div className="auth-layout">
      {/* ── Left: narrative console panel ── */}
      <div className="auth-left">
        <div className="auth-grid-bg" aria-hidden="true" />
        <div className="auth-orb auth-orb--1" aria-hidden="true" />
        <div className="auth-orb auth-orb--2" aria-hidden="true" />
        <div className="auth-scan" aria-hidden="true" />

        <div className="auth-left-content">
          <a className="auth-brand" href="/">
            <span className="auth-brand__logo" aria-hidden="true">⚓</span>
            <span className="auth-brand__name">RescueShip</span>
            <span className="auth-brand__tag">NDR · RTO COMMAND</span>
          </a>

          <div className="auth-hero-text">
            <p className="auth-kicker">Access terminal</p>
            <h1 className="auth-title">
              {title}
              {accent && <em className="auth-title__accent">{accent}</em>}
            </h1>
            <p className="subtitle">{subtitle}</p>

            {/* Neutomni Directional Flow Motif */}
            <div className="auth-ab-path" aria-hidden="true">
              <div className="auth-ab-node auth-ab-node--a">
                <span className="auth-ab-node__tag">NODE A</span>
                <span className="auth-ab-node__title">Disconnected Store</span>
              </div>
              <div className="auth-ab-beam">
                <span className="auth-ab-beam__line" />
                <span className="auth-ab-beam__badge">4 MIN SETUP</span>
                <span className="auth-ab-beam__arrow">──►</span>
              </div>
              <div className="auth-ab-node auth-ab-node--b">
                <span className="auth-ab-node__tag">NODE B</span>
                <span className="auth-ab-node__title">Autonomous Shield Active</span>
              </div>
            </div>
          </div>

          {features && <div className="auth-features">{features}</div>}

          <div className="auth-ticker">
            <span className="ticker-badge"><i aria-hidden="true" />Free</span>
            <span className="ticker-text">3 test rescues to your own phone · pay only when you go live</span>
          </div>
        </div>
      </div>

      {/* ── Right: form console / perforated boarding pass ── */}
      <div className="auth-right">
        <AnimatePresence mode="wait">
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="auth-glass-container auth-pass"
          >
            <div className="auth-window-head" aria-hidden="true">
              <span className="auth-window-dot auth-window-dot--r" />
              <span className="auth-window-dot auth-window-dot--a" />
              <span className="auth-window-dot auth-window-dot--g" />
              <span className="auth-window-title">rescueship://auth/boarding-pass.sh</span>
            </div>
            <div className="auth-pass__waybill-bar" aria-hidden="true">
              <span className="auth-pass__serial">RS/AUTH.PASS // BOARDING SPEC</span>
              <span className="auth-pass__tear">
                <Scissors size={11} className="waybill-scissors" />
                TEAR ALONG LINE
              </span>
            </div>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthLayout;
