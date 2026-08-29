import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, ShoppingBag, Settings, MessageSquare, 
  CreditCard, FileText, LogOut, User as UserIcon, Menu, X, Zap, Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import './AppLayout.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

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

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingBag size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
    { name: 'Templates', path: '/templates', icon: <MessageSquare size={20} /> },
    { name: 'Billing', path: '/billing', icon: <CreditCard size={20} /> },
    { name: 'Audit Logs', path: '/audit-logs', icon: <FileText size={20} /> },
    { name: 'API Docs', path: '/docs', icon: <Code size={20} /> },
  ];

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
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Landmark */}
      <aside 
        id="app-sidebar"
        className={`app-sidebar ${mobileMenuOpen ? 'app-sidebar--open' : ''}`}
      >
        {/* Brand Header */}
        <div className="app-brand">
          <div className="app-brand-icon" aria-hidden="true">
            ⚓
          </div>
          <div className="app-brand-info">
            <h1 className="app-brand-title">RescueShip</h1>
            <span className="app-brand-subtitle">Autonomous NDR &amp; RTO Prevention</span>
          </div>
        </div>

        {/* Navigation Landmark with aria-label */}
        <nav className="app-nav" aria-label="Main Navigation">
          {navItems.map((item) => {
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
                  <motion.div 
                    layoutId="sidebar-active"
                    className="app-nav-indicator"
                  />
                )}
                <span className="app-nav-icon">
                  {item.icon}
                </span>
                <span className="app-nav-label">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile / Logout Panel */}
        <div className="app-user-panel">
          <div className="app-user-info">
            <div className="app-user-avatar" aria-hidden="true">
              <UserIcon size={20} />
            </div>
            <div className="app-user-details">
              <span className="app-user-name">
                {user?.name || 'Store Merchant'}
              </span>
              <span className="app-user-role">
                {user?.platform || 'Shopify'} Partner
              </span>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={handleLogout}
            className="app-logout-btn"
            aria-label="Log out of account"
          >
            <LogOut size={16} aria-hidden="true" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area Landmark */}
      <div className="app-main-wrap">
        {/* Top Header */}
        <header className="app-header">
          <div className="app-engine-status">
            <span className="pulse" aria-hidden="true"></span>
            <span className="app-engine-status-text">
              CORE_ENGINE: ACTIVE
            </span>
          </div>
          
          <div className="app-header-actions">
            <button 
              type="button" 
              onClick={handleQuickAction} 
              className="btn btn-primary"
            >
              <Zap size={16} aria-hidden="true" /> Quick Action
            </button>
            <div className="app-header-avatar" aria-hidden="true">
              <UserIcon size={16} color="var(--indigo)" />
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="app-content" id="main-content">
          <div className="bg-noise" aria-hidden="true"></div>
          {children}
        </main>
      </div>
      
      {showToast && (
        <div className="toast-notification" role="status" aria-live="polite">
          <Zap size={20} color="var(--indigo)" aria-hidden="true" />
          <span>Quick NDR Scan initiated — scanning active orders...</span>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
