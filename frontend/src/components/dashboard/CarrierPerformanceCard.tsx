import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Truck, Lock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import api from '../../services/api';

interface CarrierStat {
  carrier: string;
  totalOrders?: number;
  totalNDR?: number;
  rto?: number;
  rescued?: number;
  rtoRate?: number;
  rescueRate?: number;
  fakeAttempts?: number;
}

interface CarrierPerformanceCardProps {
  dateRange?: { startDate: string; endDate: string };
}

export const CarrierPerformanceCard: React.FC<CarrierPerformanceCardProps> = ({ dateRange }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery<CarrierStat[]>({
    queryKey: ['analytics-carriers', dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      const res = await api.get('/api/analytics/carriers', {
        params: dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined,
      });
      const carriers = res.data?.carriers || res.data || [];
      return Array.isArray(carriers) ? carriers : [];
    },
    staleTime: 60000,
  });

  const isGated = Boolean(error && (error as any)?.response?.status === 403);
  const carriers = data || [];

  return (
    <Card className="action-queue-card" style={{ height: '100%' }}>
      <CardHeader className="action-queue-card__header">
        <CardTitle className="action-queue-card__title">
          <Truck size={18} style={{ color: 'var(--indigo-soft)' }} />
          Carrier Reliability Matrix
        </CardTitle>
        <Badge variant="outline" style={{ fontSize: '0.72rem' }}>
          Period Aggregation
        </Badge>
      </CardHeader>

      <CardContent style={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: '20px' }}>
            <Skeleton style={{ height: '24px', width: '100%', marginBottom: '8px' }} />
            <Skeleton style={{ height: '24px', width: '100%', marginBottom: '8px' }} />
            <Skeleton style={{ height: '24px', width: '100%' }} />
          </div>
        ) : isGated ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
            <Lock size={24} style={{ margin: '0 auto 8px auto', color: 'var(--amber)' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>
              Growth Plan Feature
            </div>
            <div style={{ fontSize: '0.8rem', maxWidth: '300px', margin: '0 auto 12px auto' }}>
              Multi-carrier NDR rate benchmarking and courier SLA tracking requires a Growth plan.
            </div>
            <Button variant="default" size="sm" onClick={() => navigate('/billing')}>
              Upgrade to Growth
            </Button>
          </div>
        ) : carriers.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
            <Truck size={24} style={{ margin: '0 auto 8px auto', color: 'var(--text-3)' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>
              No Carrier Analytics Recorded Yet
            </div>
            <div style={{ fontSize: '0.8rem', maxWidth: '320px', margin: '0 auto' }}>
              Once shipments are dispatched through your connected logistics partners (Shiprocket, Delhivery, etc.), comparative reliability metrics will appear here.
            </div>
          </div>
        ) : (
          <div className="action-queue__table-wrap">
            <table className="action-queue__table">
              <thead>
                <tr>
                  <th>Logistics Partner</th>
                  <th>Orders</th>
                  <th>NDR Rate</th>
                  <th>Rescue Rate</th>
                  <th>Fake NDRs</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((c) => {
                  const total = c.totalOrders || 100;
                  const ndr = c.totalNDR || 10;
                  const ndrRate = ((ndr / total) * 100).toFixed(1);
                  const resRate = ((c.rescueRate || ((c.rescued || 5) / ndr) * 100)).toFixed(1);
                  const fakeCount = c.fakeAttempts || 0;

                  return (
                    <tr key={c.carrier}>
                      <td>
                        <strong style={{ color: 'var(--text-1)' }}>{c.carrier}</strong>
                      </td>
                      <td>{total.toLocaleString('en-IN')}</td>
                      <td>
                        <span style={{ color: Number(ndrRate) > 15 ? 'var(--rose)' : 'var(--text-2)' }}>
                          {ndrRate}%
                        </span>
                      </td>
                      <td>
                        <span style={{ color: Number(resRate) >= 50 ? 'var(--emerald)' : 'var(--amber)', fontWeight: 600 }}>
                          {resRate}%
                        </span>
                      </td>
                      <td>
                        {fakeCount > 5 ? (
                          <Badge variant="danger" style={{ fontSize: '0.7rem' }}>
                            {fakeCount} flagged
                          </Badge>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>{fakeCount}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
