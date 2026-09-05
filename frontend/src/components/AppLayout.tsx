import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ShoppingBag, Settings, MessageSquare,
  CreditCard, FileText, LogOut, Menu, X, Zap, Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import '../styles/app.css';
import './AppLayout.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={17} /> },
      { name: 'Orders', path: '/orders', icon: <ShoppingBag size={17} /> },
    ],
  },
  {
    label: 'Automation',
    items: [
      { name: 'Templates', path: '/templates', icon: <MessageSquare size={17} /> },
      { name: 'Settings', path: '/settings', icon: <Settings size={17} /> },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Billing', path: '/billing', icon: <CreditCard size={17} /> },
      { name: 'Audit Logs', path: '/audit-logs', icon: <FileText size={17} /> },
      { name: 'API Docs', path: '/docs', icon: <Code size={17} /> },
    ],
  },
];

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleQuickAction = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const currentPage = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.path === location.pathname);
  const userInitials = (user?.name || 'R')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="app-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile Menu Toggle Button */}
      <button
        type="button"
        className="app-mobile-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-expanded={mobileMenuOpen}
        aria-controls="app-sidebar"
        aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        className={`app-sidebar ${mobileMenuOpen ? 'app-sidebar--open' : ''}`}
      >
        {/* Brand */}
        <Link to="/dashboard" className="app-brand" onClick={() => setMobileMenuOpen(false)}>
          <span className="app-brand-icon" aria-hidden="true">⚓</span>
          <span className="app-brand-info">
            <span className="app-brand-title">RescueShip</span>
            <span className="app-brand-subtitle">NDR · RTO COMMAND</span>
          </span>
        </Link>

        {/* Nav sections */}
        <nav className="app-nav" aria-label="Main Navigation">
          {NAV_SECTIONS.map((section) => (
            <div className="app-nav-section" key={section.label}>
              <p className="app-nav-section__label">{section.label}</p>
              {section.items.map((item, idx) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`app-nav-link ${isActive ? 'app-nav-link--active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="app-nav-indicator"
                      />
                    )}
                    <span className="app-nav-icon">{item.icon}</span>
                    <span className="app-nav-label">{item.name}</span>
                    <span className="app-nav-idx">{String(idx + 1).padStart(2, '0')}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="app-user-panel">
          <div className="app-user-info">
            <span className="app-user-avatar" aria-hidden="true">{userInitials}</span>
            <span className="app-user-details">
              <span className="app-user-name">{user?.name || 'Store Merchant'}</span>
              <span className="app-user-role">{user?.platform || 'Shopify'} Partner</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="app-logout-btn"
            aria-label="Log out of account"
          >
            <LogOut size={14} aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="app-main-wrap">
        <header className="app-header">
          <div className="app-header__crumb">
            <span className="app-header__crumb-root">rescueship</span>
            <span className="app-header__crumb-sep" aria-hidden="true">//</span>
            <span className="app-header__crumb-page">{currentPage?.name || 'console'}</span>
          </div>

          <div className="app-header-actions">
            <span className="chip app-engine-chip">
              <i aria-hidden="true" />
              core engine · active
            </span>
            <button
              type="button"
              onClick={handleQuickAction}
              className="btn btn-primary btn-sm"
            >
              <Zap size={14} aria-hidden="true" /> Scan NDRs
            </button>
          </div>
        </header>

        <main className="app-content" id="main-content">
          <div className="app-ambient" aria-hidden="true">
            <div className="app-ambient__grid" />
            <div className="app-ambient__orb app-ambient__orb--1" />
            <div className="app-ambient__orb app-ambient__orb--2" />
          </div>
          <div className="app-content__inner">{children}</div>
        </main>
      </div>

      {showToast && (
        <div className="toast-notification" role="status" aria-live="polite">
          <Zap size={18} color="var(--indigo)" aria-hidden="true" />
          <span>Quick NDR scan initiated — checking active orders…</span>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
