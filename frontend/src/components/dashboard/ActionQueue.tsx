import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

export interface UrgentOrderItem {
  id: string;
  orderId: string;
  customerName?: string;
  phone?: string;
  carrier?: string;
  status?: string;
  orderValue?: number;
  ndrReason?: string;
  fakeRemarkScore?: number;
  isFakeAttempt?: boolean;
  rtoRisk?: {
    level?: 'LOW' | 'MEDIUM' | 'HIGH';
    score?: number;
  };
}

interface ActionQueueProps {
  orders: UrgentOrderItem[];
  loading?: boolean;
  onReview?: (order: UrgentOrderItem) => void;
}

export const ActionQueue: React.FC<ActionQueueProps> = ({
  orders,
  loading = false,
  onReview,
}) => {
  const navigate = useNavigate();

  const handleReviewOrder = (order: UrgentOrderItem) => {
    if (onReview) {
      onReview(order);
    } else {
      navigate(`/orders?filter=high-risk&search=${encodeURIComponent(order.orderId || order.id)}`);
    }
  };

  const getRiskTriggerBadge = (order: UrgentOrderItem) => {
    if (order.isFakeAttempt || (order.fakeRemarkScore && order.fakeRemarkScore >= 0.7)) {
      const scorePct = Math.round((order.fakeRemarkScore || 0.88) * 100);
      return (
        <Badge variant="danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle size={12} />
          Fake Attempt Score {scorePct}%
        </Badge>
      );
    }

    if (order.rtoRisk?.level === 'HIGH') {
      return (
        <Badge variant="danger">
          High RTO Risk ({order.rtoRisk.score ?? 85}%)
        </Badge>
      );
    }

    if (order.ndrReason) {
      return (
        <Badge variant="warning" title={order.ndrReason}>
          {order.ndrReason.length > 28 ? `${order.ndrReason.slice(0, 26)}...` : order.ndrReason}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        Review Required
      </Badge>
    );
  };

  return (
    <Card aria-label="Urgent Action Queue Section" style={{ marginTop: '24px' }}>
      <CardHeader style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CardTitle style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              Orders Needing Attention ({orders.length})
            </CardTitle>
            <Badge variant="danger" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
              Urgent
            </Badge>
          </div>
          <CardDescription style={{ marginTop: '4px' }}>
            High-risk delivery exceptions, disputed carrier claims, and fake attempt alerts
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/orders?filter=high-risk')}
        >
          <span>View All High Risk</span>
          <ArrowRight size={14} />
        </Button>
      </CardHeader>

      <CardContent style={{ padding: '0 24px 20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0' }}>
            <Skeleton style={{ height: '40px', width: '100%' }} />
            <Skeleton style={{ height: '40px', width: '100%' }} />
            <Skeleton style={{ height: '40px', width: '100%' }} />
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--emerald, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1, #f4f4f5)' }}>
              All Clear — No Urgent Delivery Exceptions
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-3, #9ca3af)', maxWidth: '400px' }}>
              All current NDRs and high-risk shipments are handled or under automated WhatsApp outreach.
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '140px' }}>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead style={{ width: '120px' }}>Carrier</TableHead>
                <TableHead>Risk Trigger</TableHead>
                <TableHead style={{ textAlign: 'right', width: '120px' }}>Order Value</TableHead>
                <TableHead style={{ textAlign: 'right', width: '100px' }}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id || order.orderId}>
                  <TableCell style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--indigo-soft, #818cf8)' }}>
                    {order.orderId || order.id}
                  </TableCell>
                  <TableCell>
                    <div style={{ fontWeight: 500, color: 'var(--text-1, #f4f4f5)' }}>
                      {order.customerName || 'Customer'}
                    </div>
                    {order.phone && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-3, #9ca3af)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {order.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-2, #d4d4d8)', fontSize: '0.85rem' }}>
                      {order.carrier || 'Unassigned'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getRiskTriggerBadge(order)}
                  </TableCell>
                  <TableCell style={{ textAlign: 'right', fontWeight: 600 }}>
                    ₹{(order.orderValue || 0).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewOrder(order)}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      [Review]
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ActionQueue;
