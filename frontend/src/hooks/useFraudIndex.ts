import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { FraudIndexData } from '../types/analytics.d';

export const DEFAULT_FRAUD_DATA: FraudIndexData = {
  carriers: [],
  totalOrders: 0,
  totalNDR: 0,
  totalFakeAttempts: 0,
  overallFakeRate: 0,
  totalDisputedFreight: 0,
  flaggedCarriersCount: 0,
  period: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  },
};

export interface UseFraudIndexReturn {
  fraudData: FraudIndexData;
  loading: boolean;
  error: string | null;
  exporting: boolean;
  refetch: () => Promise<void>;
  exportDisputeCsv: (carrier?: string) => Promise<void>;
}

export function useFraudIndex(): UseFraudIndexReturn {
  const [fraudData, setFraudData] = useState<FraudIndexData>(DEFAULT_FRAUD_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFraudIndex = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/analytics/fraud-index');
      const d = res.data;
      const source = d?.data || d;

      if (source && Array.isArray(source.carriers)) {
        setFraudData({
          carriers: source.carriers,
          totalOrders: Number(source.totalOrders ?? 0),
          totalNDR: Number(source.totalNDR ?? 0),
          totalFakeAttempts: Number(source.totalFakeAttempts ?? 0),
          overallFakeRate: Number(source.overallFakeRate ?? 0),
          totalDisputedFreight: Number(source.totalDisputedFreight ?? 0),
          flaggedCarriersCount: Number(source.flaggedCarriersCount ?? 0),
          period: source.period || DEFAULT_FRAUD_DATA.period,
        });
      }
    } catch (err: any) {
      console.warn('Failed to load fraud index telemetry', err?.message);
      setError(err?.response?.data?.error || err?.message || 'Failed to load fraud telemetry');
    } finally {
      setLoading(false);
    }
  }, []);

  const exportDisputeCsv = useCallback(async (carrier?: string) => {
    setExporting(true);
    try {
      const res = await api.get('/api/analytics/fraud-disputes/export', {
        params: { carrier: carrier || 'all' },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `disputed-fake-attempts-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export dispute CSV', err);
      alert('Failed to generate dispute CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    fetchFraudIndex();
  }, [fetchFraudIndex]);

  return {
    fraudData,
    loading,
    error,
    exporting,
    refetch: fetchFraudIndex,
    exportDisputeCsv,
  };
}
