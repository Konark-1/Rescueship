import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { RescueFunnelData } from '../types/analytics.d';

export const DEFAULT_FUNNEL_DATA: RescueFunnelData = {
  stages: [
    { stage: 'ndr_triggered', label: 'NDR Triggered', count: 0, conversionRateFromPrevious: 100, conversionRateFromStart: 100, dropOffCount: 0 },
    { stage: 'whatsapp_sent', label: 'WhatsApp Sent', count: 0, conversionRateFromPrevious: 0, conversionRateFromStart: 0, dropOffCount: 0 },
    { stage: 'customer_replied', label: 'Customer Replied', count: 0, conversionRateFromPrevious: 0, conversionRateFromStart: 0, dropOffCount: 0 },
    { stage: 'rescued', label: 'Delivery Rescued', count: 0, conversionRateFromPrevious: 0, conversionRateFromStart: 0, dropOffCount: 0 },
  ],
  ndrTriggered: 0,
  whatsappSent: 0,
  customerReplied: 0,
  rescued: 0,
  overallRescueRate: 0,
  aiTelemetry: {
    parserSuccessRate: 95.4,
    sampleBefore: 'peeli kothi ke peeche ram lal dukan ke paas sec 12 noida call on arrival',
    sampleAfter: 'H-12, Near Peeli Kothi, Opp. Ram Lal Store, Sector 12, Noida 201301. Note: Call on arrival',
    addressesParsedCount: 0,
  },
  period: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  },
};

export interface UseRescueFunnelReturn {
  funnelData: RescueFunnelData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRescueFunnel(): UseRescueFunnelReturn {
  const [funnelData, setFunnelData] = useState<RescueFunnelData>(DEFAULT_FUNNEL_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/analytics/funnel');
      const d = res.data;
      const source = d?.data || d;

      if (source && Array.isArray(source.stages)) {
        setFunnelData({
          stages: source.stages,
          ndrTriggered: Number(source.ndrTriggered ?? 0),
          whatsappSent: Number(source.whatsappSent ?? 0),
          customerReplied: Number(source.customerReplied ?? 0),
          rescued: Number(source.rescued ?? 0),
          overallRescueRate: Number(source.overallRescueRate ?? 0),
          aiTelemetry: source.aiTelemetry || DEFAULT_FUNNEL_DATA.aiTelemetry,
          period: source.period || DEFAULT_FUNNEL_DATA.period,
        });
      }
    } catch (err: any) {
      console.warn('Failed to load rescue funnel statistics', err?.message);
      setError(err?.response?.data?.error || err?.message || 'Failed to load rescue funnel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  return { funnelData, loading, error, refetch: fetchFunnel };
}
