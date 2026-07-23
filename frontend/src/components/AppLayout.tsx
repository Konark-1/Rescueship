import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, ShoppingBag, Settings, MessageSquare, 
  CreditCard, FileText, LogOut, User as UserIcon, Menu, X, Zap, Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-void)' }}>
      {/* Mobile Drawer Toggle */}
      <style>{`
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
          .sidebar { transform: translateX(0) !important; }
          .mobile-backdrop { display: none !important; }
        }
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
      
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mobile-backdrop"
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 35
            }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
      
      <button 
        className="mobile-menu-btn"
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
          background: 'var(--primary)', color: '#fff', border: 'none',
          borderRadius: '50%', width: '3.5rem', height: '3.5rem',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)', cursor: 'pointer'
        }}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside 
        className="sidebar"
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 40,
          transition: 'transform 0.3s ease',
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}>
        {/* Brand Logo */}
        <div style={{
          padding: '2rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), #a855f7)',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.25rem',
            boxShadow: 'var(--shadow-glow)',
            animation: 'pulse-animation 3s infinite'
          }}>
            ⚓
          </div>
          <div>
            <h1 className="chrome-text" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, fontFamily: 'var(--font-display)' }}>RescueShip</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Autonomous NDR &amp; RTO Prevention</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary-glow)' : 'transparent',
                  border: '1px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: '3px', background: 'var(--primary)', borderRadius: '0 4px 4px 0' }} 
                  />
                )}
                <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-secondary)', zIndex: 1 }}>
                  {item.icon}
                </span>
                <span style={{ zIndex: 1 }}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile / Logout */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              <UserIcon size={20} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user?.name || 'Store Merchant'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {user?.platform || 'Shopify'} Partner
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.6rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-sm)',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger-glow)';
              e.currentTarget.style.borderColor = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minWidth: 0,
        }}
      >
        <style>{`
          .main-content { margin-left: 260px; }
          @media (max-width: 768px) {
            .main-content { margin-left: 0; }
          }
        `}</style>
        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Top Header */}
          <header style={{
            height: '70px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            backgroundColor: 'rgba(11, 12, 22, 0.7)',
            backdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="pulse"></span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                CORE_ENGINE: ACTIVE
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={handleQuickAction} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={16} /> Quick Action
              </button>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-glow)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserIcon size={16} color="var(--primary)" />
              </div>
            </div>
          </header>

          {/* Content Wrapper */}
          <main style={{ padding: '2rem', flex: 1, minWidth: 0 }}>
            <div className="bg-noise"></div>
            {children}
          </main>
        </div>
      </div>
      
      {showToast && (
        <div className="toast-notification">
          <Zap size={20} color="var(--primary)" />
          <span>Quick NDR Scan initiated — scanning active orders...</span>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
