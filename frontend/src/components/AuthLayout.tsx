import React, { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BeamsBackground } from './motion/BeamsBackground';
import '../pages/auth.css';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  features?: ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, features }) => {
  return (
    <div className="auth-layout">
      <div className="auth-left">
        <BeamsBackground className="auth-beams-wrapper">
          <div className="auth-mesh-glow"></div>
          <div className="auth-particles">
            <div className="particle p1"></div>
            <div className="particle p2"></div>
            <div className="particle p3"></div>
            <div className="particle p4"></div>
          </div>
          
          <div className="auth-left-content">
            <div className="auth-brand">
              <span className="brand-logo">⚓</span>
              <span className="brand-text">RescueShip</span>
            </div>
            
            <div className="auth-hero-text">
              <h1 className="chrome-text">{title}</h1>
              <p className="subtitle">{subtitle}</p>
            </div>

            {features && <div className="auth-features">{features}</div>}
            
            <div className="auth-ticker">
              <div className="ticker-badge">Live</div>
              <div className="ticker-text">
                <span>854 shipments rescued today • ₹12.5L RTO loss prevented</span>
              </div>
            </div>
          </div>
        </BeamsBackground>
      </div>
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
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthLayout;
