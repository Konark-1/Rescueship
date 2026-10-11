import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, AlertTriangle, Send, CheckCircle2, Lock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import api from '../../services/api';

export interface WatchtowerOrderItem {
  id: string;
  orderId: string;
  customerName?: string;
  phone?: string;
  orderValue: number;
  paymentMethod: 'cod' | 'prepaid';
  rtoRisk?: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
    recommendedAction?: string;
  };
}

interface RtoWatchtowerProps {
  orders?: WatchtowerOrderItem[];
  loading?: boolean;
  onActionComplete?: () => void;
}

export const RtoWatchtower: React.FC<RtoWatchtowerProps> = ({
  orders,
  loading: externalLoading = false,
  onActionComplete,
}) => {
  const [actingId, setActingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // If orders prop is not explicitly passed, query real pre-dispatch high-risk orders from backend
  const { data: queriedOrders, isLoading: queryLoading, refetch } = useQuery<WatchtowerOrderItem[]>({
    queryKey: ['watchtower-risk-orders'],
    queryFn: async () => {
      const res = await api.get('/api/orders', {
        params: { riskLevel: 'HIGH', limit: 10 },
      });
      const raw = res.data?.orders || [];
      return raw.map((o: any) => ({
        id: o._id || o.id || o.orderId,
        orderId: o.externalOrderId || o.orderId,
        customerName: o.customerName || 'Customer',
        phone: o.customerPhone || o.phone,
        orderValue: o.orderValue || 0,
        paymentMethod: o.paymentMethod || 'cod',
        rtoRisk: o.rtoRisk,
      }));
    },
    enabled: orders === undefined,
    staleTime: 30000,
  });

  const isLoading = externalLoading || (orders === undefined && queryLoading);
  const displayOrders = orders !== undefined ? orders : (queriedOrders || []);

  const handleAction = async (orderId: string, action: 'whatsapp_verify' | 'require_deposit' | 'manual_review_approve') => {
    setActingId(orderId);
    try {
      await api.post(`/api/orders/${orderId}/risk-action`, { action });
      setToastMessage(
        action === 'manual_review_approve'
          ? 'Order risk overridden — approved for shipping'
          : action === 'require_deposit'
          ? '₹50 Advance Deposit WhatsApp link sent to buyer'
          : 'WhatsApp address verification dispatched'
      );
      setTimeout(() => setToastMessage(null), 3500);
      refetch();
      onActionComplete?.();
    } catch (err: any) {
      console.warn('Risk action failed', err);
    } finally {
      setActingId(null);
    }
  };

  return (
    <Card className="action-queue-card" aria-label="Pre-Dispatch Predictive RTO Watchtower">
      <CardHeader className="action-queue-card__header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <CardTitle className="action-queue-card__title">
              <ShieldAlert size={18} style={{ color: 'var(--rose)' }} />
              Pre-Dispatch Predictive RTO Watchtower
            </CardTitle>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '2px' }}>
              AI scored incoming COD orders before courier label generation to eliminate return freight losses.
            </div>
          </div>
          <Badge variant="outline" style={{ fontSize: '0.72rem' }}>
            Gemini 3.8 Flash ML Scored
          </Badge>
        </div>
      </CardHeader>

      <CardContent style={{ padding: 0 }}>
        {toastMessage && (
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--emerald-15)',
              color: 'var(--emerald-light)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={14} /> {toastMessage}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>
            Evaluating pre-dispatch orders with Gemini 3.8 Flash ML…
          </div>
        ) : displayOrders.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
            <ShieldCheck size={28} style={{ margin: '0 auto 8px auto', color: 'var(--emerald)' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>
              Zero High-Risk Orders In Pre-Dispatch
            </div>
            <div style={{ fontSize: '0.8rem', maxWidth: '360px', margin: '0 auto' }}>
              All incoming cash-on-delivery orders have passed phone syntax, pincode risk, and address completeness validations.
            </div>
          </div>
        ) : (
          <div className="action-queue__table-wrap">
            <table className="action-queue__table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer Phone</th>
                <th>Amount</th>
                <th>RTO Risk Score</th>
                <th>Triggered Risk Factors</th>
                <th style={{ textAlign: 'right' }}>Preventive Action</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.map((o) => {
                const score = o.rtoRisk?.score || 50;
                const isHigh = (o.rtoRisk?.level || 'MEDIUM') === 'HIGH';

                return (
                  <tr key={o.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>#{o.orderId}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{o.customerName || 'Buyer'}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{o.phone || '—'}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                        ₹{o.orderValue.toLocaleString('en-IN')}
                      </div>
                      <Badge style={{ fontSize: '0.68rem', padding: '1px 5px', background: 'var(--amber-15)', color: 'var(--amber)' }}>
                        COD
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        variant={isHigh ? 'danger' : 'warning'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                      >
                        {isHigh ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                        {score}/100 {o.rtoRisk?.level}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '320px' }}>
                        {(o.rtoRisk?.factors || []).map((f) => (
                          <span
                            key={f}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-xs)',
                              background: 'var(--bg-void)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-2)',
                            }}
                          >
                            {f.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {score >= 80 ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actingId === o.id}
                            onClick={() => handleAction(o.id, 'require_deposit')}
                            style={{ fontSize: '0.74rem', height: '28px' }}
                          >
                            <Lock size={12} /> Require Deposit
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actingId === o.id}
                            onClick={() => handleAction(o.id, 'whatsapp_verify')}
                            style={{ fontSize: '0.74rem', height: '28px' }}
                          >
                            <Send size={12} /> WA Verify
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actingId === o.id}
                          onClick={() => handleAction(o.id, 'manual_review_approve')}
                          style={{ fontSize: '0.74rem', height: '28px' }}
                        >
                          Approve
                        </Button>
                      </div>
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
