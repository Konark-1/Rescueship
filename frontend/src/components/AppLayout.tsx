import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Settings, 
  MessageSquare, 
  CreditCard, 
  FileText, 
  LogOut, 
  User as UserIcon
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingBag size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
    { name: 'Templates', path: '/templates', icon: <MessageSquare size={20} /> },
    { name: 'Billing', path: '/billing', icon: <CreditCard size={20} /> },
    { name: 'Audit Logs', path: '/audit-logs', icon: <FileText size={20} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 10,
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
            background: 'linear-gradient(135deg, var(--primary), #4f46e5)',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.25rem',
            boxShadow: 'var(--shadow-glow)'
          }}>
            ⚓
          </div>
          <div>
            <h1 className="chrome-text" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>RescueShip</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0-Human-Ops RTO Rescue</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className="zoom-on-hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary-glow)' : 'transparent',
                  border: isActive ? '1px solid var(--border-color-glow)' : '1px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  {item.icon}
                </span>
                {item.name}
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
      <div style={{ flex: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header style={{
          height: '70px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 2rem',
          backgroundColor: 'rgba(15, 16, 26, 0.5)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="pulse"></span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              RescueShip Core Engine Live
            </span>
            {user?.onboardingStatus === 'skipped' && (
              <button 
                onClick={() => navigate('/onboarding')}
                style={{
                  marginLeft: '1rem',
                  padding: '0.3rem 0.8rem',
                  backgroundColor: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                Complete Onboarding
              </button>
            )}
          </div>
        </header>

        {/* Content Wrapper */}
        <main style={{ padding: '2rem', flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
};
