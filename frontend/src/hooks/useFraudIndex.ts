import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const [exporting, setExporting] = useState<boolean>(false);

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['analytics-fraud-index'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/fraud-index');
      return res.data;
    },
    staleTime: 60000,
  });

  const fraudData = useMemo<FraudIndexData>(() => {
    if (!data) return DEFAULT_FRAUD_DATA;
    const source = data.data || data;
    if (!source || !Array.isArray(source.carriers)) return DEFAULT_FRAUD_DATA;

    return {
      carriers: source.carriers,
      totalOrders: Number(source.totalOrders ?? 0),
      totalNDR: Number(source.totalNDR ?? 0),
      totalFakeAttempts: Number(source.totalFakeAttempts ?? 0),
      overallFakeRate: Number(source.overallFakeRate ?? 0),
      totalDisputedFreight: Number(source.totalDisputedFreight ?? 0),
      flaggedCarriersCount: Number(source.flaggedCarriersCount ?? 0),
      period: source.period || DEFAULT_FRAUD_DATA.period,
    };
  }, [data]);

  const exportDisputeCsv = async (carrier?: string) => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token') || '';
      const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || '';
      const params = new URLSearchParams({
        format: 'csv',
        type: 'fake-attempts',
        token,
        ...(carrier ? { carrier } : {}),
      });
      const url = `${baseUrl}/api/export/fake-attempts?${params.toString()}`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `disputed-freight-${carrier || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to trigger native streaming CSV export', err);
    } finally {
      setExporting(false);
    }
  };

  return {
    fraudData,
    loading: isLoading,
    error: queryError ? (queryError as any).message || 'Failed to load fraud telemetry' : null,
    exporting,
    refetch: async () => { await refetch(); },
    exportDisputeCsv,
  };
}
