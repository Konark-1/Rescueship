import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './styles/app.css';
import { AppLayout } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BillingGate } from './components/BillingGate';

// Route-level code-splitting: Heavy dashboard & ancillary pages loaded on-demand
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ConnectedApisPage = lazy(() => import('./pages/ConnectedApisPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const ShopifyLaunchPage = lazy(() => import('./pages/ShopifyLaunchPage'));
const SandboxPage = lazy(() => import('./pages/SandboxPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const DPDPAddendum = lazy(() => import('./pages/DPDPAddendum'));

// Route loading fallback
const RouteLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f4f6f8',
    color: '#5c6370',
    fontSize: '0.9rem',
  }}>
    Loading...
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

  return <BillingGate><AppLayout>{children}</AppLayout></BillingGate>;
};

// Pages a merchant can use before paying: setup and free test rescues (capped server-side).
const UnpaidOkLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
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
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/onboard" element={<Navigate to="/register" replace />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/dpa" element={<DPDPAddendum />} />
              {/* Shopify app launch / install entry (application_url) */}
              <Route path="/shopify" element={<ShopifyLaunchPage />} />

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
              <Route path="/reports" element={
                <ProtectedRoute>
                  <DashboardLayoutWrapper>
                    <ReportsPage />
                  </DashboardLayoutWrapper>
                </ProtectedRoute>
              } />
              <Route path="/connected-apis" element={
                <ProtectedRoute>
                  <DashboardLayoutWrapper>
                    <ConnectedApisPage />
                  </DashboardLayoutWrapper>
                </ProtectedRoute>
              } />
              <Route path="/docs" element={<Navigate to="/connected-apis" replace />} />
              <Route path="/sandbox" element={
                <ProtectedRoute>
                  <UnpaidOkLayoutWrapper>
                    <SandboxPage />
                  </UnpaidOkLayoutWrapper>
                </ProtectedRoute>
              } />

              {/* Onboarding Wizard (not wrapped in standard layout). Open before payment:
                  merchants connect and send free test rescues; going live needs a plan. */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              } />

              {/* Redirect Wildcard */}
              <Route path="*" element={<WildcardRedirect />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
