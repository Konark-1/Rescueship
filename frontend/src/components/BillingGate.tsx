import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { billingApi } from '../services/billing.api';

/**
 * Merchant flow: login → savings + fees (/billing) → Razorpay payment → onboarding → dashboard.
 *
 * Everything behind this gate needs an activated plan. The check is UX only: the
 * backend independently refuses to take a merchant live (/api/connect/finalize)
 * until billing is active, so on a network error we let the page render rather
 * than locking a paying merchant out.
 */
let paidToken: string | null = null; // remember a positive answer for this session token only

export const BillingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'paid' | 'unpaid'>(
    token && paidToken === token ? 'paid' : 'checking'
  );

  useEffect(() => {
    if (!token || paidToken === token) return;
    let cancelled = false;
    billingApi
      .status(token)
      .then((s) => {
        if (cancelled) return;
        if (s?.active) { paidToken = token; setState('paid'); }
        else setState('unpaid');
      })
      .catch(() => { if (!cancelled) setState('paid'); });
    return () => { cancelled = true; };
  }, [token]);

  if (state === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)' }}>
        Checking your plan…
      </div>
    );
  }
  if (state === 'unpaid') {
    const from = location.pathname.startsWith('/onboarding') ? 'onboarding' : 'signup';
    return <Navigate to={`/billing?from=${from}`} replace />;
  }
  return <>{children}</>;
};

/** Call after a successful checkout so the gate does not need another round trip. */
export function markBillingActive(token: string | null) {
  if (token) paidToken = token;
}
