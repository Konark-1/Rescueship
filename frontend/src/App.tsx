import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import SettingsPage from './pages/SettingsPage';
import TemplatesPage from './pages/TemplatesPage';
import BillingPage from './pages/BillingPage';
import AuditLogsPage from './pages/AuditLogsPage';
import DocsPage from './pages/DocsPage';
import OnboardingPage from './pages/OnboardingPage';

import LandingPage from './pages/LandingPage';

// Protected Route wrapper component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-secondary)'
      }}>
        <div className="pulse" style={{ marginRight: '1rem' }}></div>
        Loading session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Layout wrapping component for dashboard pages
const DashboardLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (user?.onboardingStatus !== 'completed') {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

// Wildcard handler component
const WildcardRedirect: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes inside AppLayout */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayoutWrapper>
                <DashboardPage />
              </DashboardLayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute>
              <DashboardLayoutWrapper>
                <OrdersPage />
              </DashboardLayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <DashboardLayoutWrapper>
                <SettingsPage />
              </DashboardLayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/templates" element={
            <ProtectedRoute>
              <DashboardLayoutWrapper>
                <TemplatesPage />
              </DashboardLayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute>
              <DashboardLayoutWrapper>
                <BillingPage />
              </DashboardLayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/audit-logs" element={
            <ProtectedRoute>
              <DashboardLayoutWrapper>
                <AuditLogsPage />
              </DashboardLayoutWrapper>
            </ProtectedRoute>
          } />
          <Route path="/docs" element={
            <ProtectedRoute>
              <DashboardLayoutWrapper>
                <DocsPage />
              </DashboardLayoutWrapper>
            </ProtectedRoute>
          } />

          {/* Onboarding Wizard (not wrapped in standard layout) */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          } />

          {/* Redirect Wildcard */}
          <Route path="*" element={<WildcardRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
