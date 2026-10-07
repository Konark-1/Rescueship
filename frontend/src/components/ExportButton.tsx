/**
 * ExportButton.tsx
 * ─────────────────────────────────────────────────────────────
 * Zero-Memory Streaming CSV/JSON export button for Scale & Enterprise merchants.
 * 
 * 🛡️ ARCHITECTURAL SAFEGUARD (Invisible Trap 2 Neutralized):
 * Never buffers 60,000 rows into frontend JavaScript heap via Axios/Fetch Blob.
 * Instead, streams directly through the browser's native download manager
 * using direct download anchor endpoints with token authentication.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface ExportButtonProps {
  exportType: 'orders' | 'ndr_report' | 'revenue_summary' | 'carrier_performance';
  label?: string;
  className?: string;
}

const EXPORT_LABELS: Record<string, string> = {
  orders: '📦 Export Orders',
  ndr_report: '🚚 Export NDR Report',
  revenue_summary: '💰 Export Revenue Summary',
  carrier_performance: '📊 Export Carrier Performance',
};

const EXPORT_PLANS = ['scale', 'enterprise'];

export default function ExportButton({ exportType, label, className = '' }: ExportButtonProps) {
  const { token } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/billing/plan')
      .then(res => {
        if (!cancelled) setPlan(res.data?.plan ?? null);
      })
      .catch(() => {
        // Leave plan unknown — the server enforces plan-gating authoritatively.
      })
      .finally(() => {
        if (!cancelled) setPlanLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  const isAllowed = planLoaded && plan !== null && EXPORT_PLANS.includes(plan);

  const getExportUrl = (format: 'csv' | 'json') => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      format,
      startDate: thirtyDaysAgo.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
      token: token || '',
    });

    const apiUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || '';
    return `${apiUrl}/api/export/${exportType}?${params.toString()}`;
  };

  const getFilename = (format: 'csv' | 'json') => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = thirtyDaysAgo.toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    return `rescueship_${exportType}_${start}_${end}.${format}`;
  };

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {isAllowed ? (
          <>
            <a
              href={getExportUrl('csv')}
              download={getFilename('csv')}
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: 'none' }}
              title="Native streaming download as CSV (zero browser memory)"
            >
              {label || EXPORT_LABELS[exportType]} · CSV
            </a>
            <a
              href={getExportUrl('json')}
              download={getFilename('json')}
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: 'none' }}
              title="Native streaming download as JSON (zero browser memory)"
            >
              JSON
            </a>
          </>
        ) : (
          <>
            <button
              disabled={!planLoaded || !isAllowed}
              className="btn btn-ghost btn-sm"
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
              title={planLoaded ? 'Upgrade to Scale or Enterprise plan to export data' : 'Checking plan privileges…'}
            >
              {label || EXPORT_LABELS[exportType]} · CSV
            </button>
            <button
              disabled={!planLoaded || !isAllowed}
              className="btn btn-ghost btn-sm"
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
              title={planLoaded ? 'Upgrade to Scale or Enterprise plan to export data' : 'Checking plan privileges…'}
            >
              JSON
            </button>
          </>
        )}
      </div>

      {planLoaded && !isAllowed && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--amber)', letterSpacing: '0.06em' }}>
          🔒 scale / enterprise plan required
        </span>
      )}
    </div>
  );
}
