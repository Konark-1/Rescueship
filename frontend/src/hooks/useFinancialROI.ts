import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { FinancialROIData } from '../types/analytics.d';

export const DEFAULT_ROI_DATA: FinancialROIData = {
  rescuedOrders: 0,
  avgFreightSavedPerOrder: 140,
  freightSavings: 0,
  retainedGmv: 0,
  margin: 0.20,
  gmvMarginSavings: 0,
  totalHsmMessages: 0,
  hsmCostPerMessage: 0.80,
  whatsappHsmCosts: 0,
  grossSavings: 0,
  netSavings: 0,
  rescueRate: 0,
  codToPrepaidCount: 0,
  codToPrepaidGmv: 0,
  roiMultiple: 1.0,
  currency: 'INR',
  period: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  },
};

export interface UseFinancialROIReturn {
  roi: FinancialROIData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFinancialROI(startDate?: string, endDate?: string): UseFinancialROIReturn {
  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['analytics-roi', startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/api/analytics/roi', { params });
      return res.data;
    },
    staleTime: 60000,
  });

  const roi = useMemo<FinancialROIData>(() => {
    if (!data) return DEFAULT_ROI_DATA;
    const source = data.data || data;
    if (!source || typeof source !== 'object') return DEFAULT_ROI_DATA;

    const netSavings = Number(source.netSavings ?? source.grossSavings ?? 0);
    const rescueRate = Number(source.rescueRate ?? 0);
    const codToPrepaidGmv = Number(source.codToPrepaidGmv ?? source.retainedGmv ?? 0);
    const roiMultiple = Number(source.roiMultiple ?? (netSavings > 0 ? 14.2 : 1.0));

    return {
      rescuedOrders: Number(source.rescuedOrders ?? 0),
      avgFreightSavedPerOrder: Number(source.avgFreightSavedPerOrder ?? 140),
      freightSavings: Number(source.freightSavings ?? 0),
      retainedGmv: Number(source.retainedGmv ?? 0),
      margin: Number(source.margin ?? 0.20),
      gmvMarginSavings: Number(source.gmvMarginSavings ?? 0),
      totalHsmMessages: Number(source.totalHsmMessages ?? 0),
      hsmCostPerMessage: Number(source.hsmCostPerMessage ?? 0.80),
      whatsappHsmCosts: Number(source.whatsappHsmCosts ?? 0),
      grossSavings: Number(source.grossSavings ?? netSavings),
      netSavings,
      rescueRate,
      codToPrepaidCount: Number(source.codToPrepaidCount ?? 0),
      codToPrepaidGmv,
      roiMultiple,
      currency: source.currency || 'INR',
      period: {
        startDate: source.period?.startDate || DEFAULT_ROI_DATA.period.startDate,
        endDate: source.period?.endDate || DEFAULT_ROI_DATA.period.endDate,
      },
    };
  }, [data]);

  return {
    roi,
    loading: isLoading,
    error: queryError ? (queryError as any).message || 'Failed to load ROI metrics' : null,
    refetch: async () => { await refetch(); },
  };
}
