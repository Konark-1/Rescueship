import React, { useState, useMemo } from 'react';
import { AlertTriangle, Clock, Search, ChevronRight, ShieldAlert, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import type { StorePlatform } from '../../types/dashboard.d';

export interface UrgentOrderItem {
  id: string;
  orderId: string;
  externalOrderId?: string;
  customerName?: string;
  phone?: string;
  carrier?: string;
  status?: string;
  orderValue?: number;
  platform?: StorePlatform;
  ndrReason?: string;
  fakeRemarkScore?: number;
  isFakeAttempt?: boolean;
  detectedAt?: string | Date;
  rtoRisk?: {
    level?: 'LOW' | 'MEDIUM' | 'HIGH';
    score?: number;
  };
}

interface ActionQueueProps {
  orders: UrgentOrderItem[];
  loading?: boolean;
  onReview?: (order: UrgentOrderItem) => void;
  onSelectOrder?: (order: UrgentOrderItem) => void;
}

export const ActionQueue: React.FC<ActionQueueProps> = ({
  orders = [],
  loading = false,
  onReview,
  onSelectOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'fake' | 'high_risk'>('all');

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        !searchTerm ||
        (o.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.phone || '').includes(searchTerm) ||
        (o.carrier || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'fake') {
        return Boolean(o.isFakeAttempt || (o.fakeRemarkScore && o.fakeRemarkScore >= 0.7));
      }
      if (filterMode === 'high_risk') {
        return o.rtoRisk?.level === 'HIGH';
      }
      return true;
    });
  }, [orders, searchTerm, filterMode]);

  const handleRowClick = (order: UrgentOrderItem) => {
    if (onSelectOrder) {
      onSelectOrder(order);
    } else if (onReview) {
      onReview(order);
    }
  };

  const getCountdownLabel = (order: UrgentOrderItem) => {
    const isCarrierDelhivery = (order.carrier || '').toLowerCase().includes('delhivery');
    const totalSlaHours = isCarrierDelhivery ? 48 : 24;

    // Simulate countdown hours remaining based on order ID hash for stable demonstration
    const hash = (order.id || order.orderId || '')
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hoursLeft = Math.max(1, (hash % totalSlaHours));
    const minutesLeft = (hash * 7) % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    const text = `${pad(hoursLeft)}h ${pad(minutesLeft)}m`;

    if (hoursLeft <= 3) {
      return { text, className: 'action-queue__countdown--urgent' };
    }
    if (hoursLeft <= 8) {
      return { text, className: 'action-queue__countdown--warning' };
    }
    return { text, className: 'action-queue__countdown--safe' };
  };

  return (
    <Card className="action-queue-card" aria-label="Actionable Orders Queue">
      <CardHeader className="action-queue-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <CardTitle className="action-queue-card__title">
            <ShieldAlert size={18} style={{ color: 'var(--amber)' }} />
            Urgent NDR Action Queue ({orders.length})
          </CardTitle>
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button
              variant={filterMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterMode('all')}
              style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px' }}
            >
              All ({orders.length})
            </Button>
            <Button
              variant={filterMode === 'fake' ? 'danger' : 'ghost'}
              size="sm"
              onClick={() => setFilterMode('fake')}
              style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px' }}
            >
              Fake Attempts
            </Button>
            <Button
              variant={filterMode === 'high_risk' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterMode('high_risk')}
              style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px' }}
            >
              High Risk
            </Button>
          </div>
        </div>

        <div style={{ position: 'relative', width: '220px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}
          />
          <input
            type="text"
            placeholder="Search order or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--bg-void)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          />
        </div>
      </CardHeader>

      <CardContent style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '16px' }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ height: '48px', width: '100%', marginBottom: '8px' }} />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>
            <Sparkles size={24} style={{ margin: '0 auto 8px auto', color: 'var(--emerald)' }} />
            <div>Zero delivery exceptions requiring manual intervention right now.</div>
            <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Autonomous WhatsApp AI is resolving active NDRs in the background.</div>
          </div>
        ) : (
          <div className="action-queue__table-wrap">
            <table className="action-queue__table">
              <thead>
                <tr>
                  <th>Order / Platform</th>
                  <th>Customer</th>
                  <th>Carrier &amp; Reason</th>
                  <th>Risk / Fraud Index</th>
                  <th>Auto-RTO SLA</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const countdown = getCountdownLabel(order);
                  const isFake = Boolean(order.isFakeAttempt || (order.fakeRemarkScore && order.fakeRemarkScore >= 0.7));

                  return (
                    <tr
                      key={order.id || order.orderId}
                      className={`action-queue__row ${isFake ? 'action-queue__row--critical' : ''}`}
                      onClick={() => handleRowClick(order)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                          #{order.externalOrderId || order.orderId}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                          ₹{(order.orderValue || 0).toLocaleString('en-IN')} • {order.platform?.toUpperCase() || 'SHOPIFY'}
                        </div>
                      </td>

                      <td>
                        <div style={{ color: 'var(--text-1)' }}>{order.customerName || 'Customer'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{order.phone || '—'}</div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-1)' }}>
                          {order.carrier || 'Logistics Partner'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                          {order.ndrReason || 'Customer Not Available'}
                        </div>
                      </td>

                      <td>
                        {isFake ? (
                          <Badge variant="danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
                            <AlertTriangle size={10} />
                            Fake Suspicion {Math.round((order.fakeRemarkScore || 0.85) * 100)}%
                          </Badge>
                        ) : order.rtoRisk?.level === 'HIGH' ? (
                          <Badge variant="warning" style={{ fontSize: '0.7rem' }}>
                            High RTO Risk
                          </Badge>
                        ) : (
                          <Badge variant="outline" style={{ fontSize: '0.7rem' }}>
                            Standard NDR
                          </Badge>
                        )}
                      </td>

                      <td>
                        <span className={`action-queue__countdown ${countdown.className}`}>
                          <Clock size={12} />
                          {countdown.text}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(order);
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          Triage <ChevronRight size={14} />
                        </Button>
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
