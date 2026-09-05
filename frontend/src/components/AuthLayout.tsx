import React, { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
          </div>

          {features && <div className="auth-features">{features}</div>}

          <div className="auth-ticker">
            <span className="ticker-badge"><i aria-hidden="true" />Live</span>
            <span className="ticker-text">854 shipments rescued today · ₹12.5L RTO loss prevented</span>
          </div>
        </div>
      </div>

      {/* ── Right: form console ── */}
      <div className="auth-right">
        <AnimatePresence mode="wait">
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="auth-glass-container"
          >
            <div className="auth-window-head" aria-hidden="true">
              <span className="auth-window-dot auth-window-dot--r" />
              <span className="auth-window-dot auth-window-dot--a" />
              <span className="auth-window-dot auth-window-dot--g" />
              <span className="auth-window-title">rescueship://auth</span>
            </div>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthLayout;
