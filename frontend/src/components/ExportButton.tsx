/**
 * ExportButton.tsx
 * ─────────────────────────────────────────────────────────────
 * Reusable CSV/JSON export button for Scale & Enterprise merchants.
 * Shows plan-gated upgrade prompt for lower tiers.
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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

export default function ExportButton({ exportType, label, className = '' }: ExportButtonProps) {
  const { token, user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = (user as any)?.plan || localStorage.getItem('merchant_plan') || 'scale';
  const isAllowed = ['scale', 'enterprise', 'growth', 'starter'].includes(plan);

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

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
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
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div className="inline-flex items-center gap-2">
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={isAllowed ? 'Download as CSV' : 'Upgrade to Scale plan to export'}
        >
          {isExporting ? '⏳ Exporting...' : (label || EXPORT_LABELS[exportType])} (CSV)
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={isExporting}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={isAllowed ? 'Download as JSON' : 'Upgrade to Scale plan to export'}
        >
          JSON
        </button>
      </div>

      {!isAllowed && (
        <span className="text-[10px] text-amber-500 font-medium">
          🔒 Scale/Enterprise plan required
        </span>
      )}

      {error && (
        <span className="text-[10px] text-red-500 font-medium">{error}</span>
      )}
    </div>
  );
}
