/**
 * ExportButton.tsx
 * ─────────────────────────────────────────────────────────────
 * Reusable CSV/JSON export button for Scale & Enterprise merchants.
 * Shows plan-gated upgrade prompt for lower tiers.
 * Plan is fetched from the server — never assumed from local storage.
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
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleExport = async (format: 'csv' | 'json') => {
    if (!isAllowed) {
      setError('Data export requires Scale or Enterprise plan. Please upgrade in Billing.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        format,
        startDate: thirtyDaysAgo.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
      });

      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/export/${exportType}?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed (${response.status})`);
      }

      // Download the file
      const blob = await response.blob();
      const filename = response.headers.get('X-Export-Rows')
        ? `rescueship_${exportType}_${params.get('startDate')}_${params.get('endDate')}.${format}`
        : `rescueship_${exportType}.${format}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting || !planLoaded}
          className="btn btn-ghost btn-sm"
          title={isAllowed ? 'Download as CSV' : 'Upgrade to Scale plan to export'}
        >
          {isExporting ? 'Exporting…' : `${label || EXPORT_LABELS[exportType]} · CSV`}
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={isExporting || !planLoaded}
          className="btn btn-ghost btn-sm"
          title={isAllowed ? 'Download as JSON' : 'Upgrade to Scale plan to export'}
        >
          JSON
        </button>
      </div>

      {planLoaded && !isAllowed && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--amber)', letterSpacing: '0.06em' }}>
          🔒 scale / enterprise plan required
        </span>
      )}

      {error && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--rose)' }}>{error}</span>
      )}
    </div>
  );
}
