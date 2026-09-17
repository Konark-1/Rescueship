import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './styles/app.css';
import { AppLayout } from './components/AppLayout';

// Route-level code-splitting: Heavy dashboard & ancillary pages loaded on-demand
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const SandboxPage = lazy(() => import('./pages/SandboxPage'));

// Sleek telemetry module loading fallback
const RouteLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-void, #050508)',
    color: 'var(--text-3, #9ca3af)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.85rem',
    letterSpacing: '0.02em',
  }}>
    <div className="pulse" style={{ marginRight: '0.75rem', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--indigo, #4f46e5)' }}></div>
    Initializing module...
  </div>
);

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

  // 'skipped' merchants are allowed in — the dashboard shows a resume banner
  // and the wizard stays reachable at /onboarding. Only 'pending' bounces back.
  if (user?.onboardingStatus === 'pending') {
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
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/onboard" element={<Navigate to="/register" replace />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

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
            {/* Billing — accessible during onboarding (not gated by DashboardLayoutWrapper) */}
            <Route path="/billing" element={
              <ProtectedRoute>
                <BillingPage />
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
            <Route path="/sandbox" element={
              <ProtectedRoute>
                <DashboardLayoutWrapper>
                  <SandboxPage />
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
