import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, CreditCard, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { AnimatedCounter } from '../components/motion/AnimatedCounter';

export interface OrderItem {
  id: string;
  orderId: string;
  customerName: string;
  phone?: string;
  status: string;
  orderValue?: number;
  carrier?: string;
  ndrReason?: string;
  rtoRisk?: {
    level?: 'LOW' | 'MEDIUM' | 'HIGH';
    score?: number;
  };
  createdAt?: string;
}

interface StatProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  onClick?: () => void;
}

export const Stat: React.FC<StatProps> = ({ label, value, icon, onClick }) => (
  <div
    className="stat dashboard-stat"
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick();
      }
    }}
  >
    <div className="stat__top">
      <span className="stat__label">{label}</span>
      <span className="stat__icon">{icon}</span>
    </div>
    <div className="stat__value">
      <AnimatedCounter value={value} />
    </div>
    <div className="dashboard-stat__hint">
      <span>View in Orders</span>
      <ArrowRight size={12} />
    </div>
  </div>
);

interface OrderListProps {
  orders: OrderItem[];
  compact?: boolean;
  onSelectOrder?: (order: OrderItem) => void;
}

export const OrderList: React.FC<OrderListProps> = ({ orders, compact = false, onSelectOrder }) => {
  const getBadgeClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('delivered') || s.includes('rescued') || s.includes('converted')) return 'badge-success';
    if (s.includes('ndr') || s.includes('pending') || s.includes('review')) return 'badge-warning';
    if (s.includes('rto') || s.includes('cancelled') || s.includes('failed')) return 'badge-danger';
    return 'badge-secondary';
  };

  return (
    <div className={`table-container ${compact ? 'table-container--compact' : ''}`} tabIndex={0} aria-label="Orders needing attention">
      <table className="custom-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Exception / Risk</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isHighRisk = order.rtoRisk?.level === 'HIGH';
            return (
              <tr
                key={order.id || order.orderId}
                onClick={() => onSelectOrder?.(order)}
                style={{ cursor: onSelectOrder ? 'pointer' : 'default' }}
                tabIndex={onSelectOrder ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onSelectOrder && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelectOrder(order);
                  }
                }}
              >
                <td className="td-id">{order.orderId}</td>
                <td>
                  <div className="td-main">{order.customerName || 'Customer'}</div>
                  {order.phone && <div className="td-meta mono">{order.phone}</div>}
                </td>
                <td>
                  <span className={`badge ${getBadgeClass(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td>
                  {order.ndrReason ? (
                    <span className="td-exception" title={order.ndrReason}>
                      <AlertTriangle size={12} color="var(--amber)" />
                      {order.ndrReason}
                    </span>
                  ) : isHighRisk ? (
                    <span className="badge badge-danger">High Risk ({order.rtoRisk?.score ?? 85}%)</span>
                  ) : (
                    <span className="td-meta">—</span>
                  )}
                </td>
                <td className="td-num" style={{ textAlign: 'right' }}>
                  ₹{(order.orderValue || 0).toLocaleString('en-IN')}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOrder?.(order);
                    }}
                  >
                    Resolve →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [totalSaved, setTotalSaved] = useState<number>(0);
  const [rescuedCount, setRescuedCount] = useState<number>(0);
  const [conversionCount, setConversionCount] = useState<number>(0);
  const [rtoArrestCount, setRtoArrestCount] = useState<number>(0);
  const [ordersNeedingAttention, setOrdersNeedingAttention] = useState<OrderItem[]>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      let loadedViaSummary = false;

      // 1. Primary: /api/dashboard/summary
      try {
        const summaryRes = await api.get('/api/dashboard/summary');
        if (summaryRes.data && typeof summaryRes.data === 'object') {
          const s = summaryRes.data;
          setTotalSaved(s.totalSaved ?? 0);
          setRescuedCount(s.rescuedCount ?? 0);
          setConversionCount(s.conversionCount ?? 0);
          setRtoArrestCount(s.rtoArrestCount ?? 0);
          setOrdersNeedingAttention(Array.isArray(s.ordersNeedingAttention) ? s.ordersNeedingAttention : []);
          loadedViaSummary = true;
        }
      } catch {
        loadedViaSummary = false;
      }

      // 2. Fallback: /api/analytics/dashboard + /api/orders
      if (!loadedViaSummary) {
        const [analyticsRes, ordersRes] = await Promise.allSettled([
          api.get('/api/analytics/dashboard'),
          api.get('/api/orders', { params: { limit: 25 } }),
        ]);

        if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data) {
          const a = analyticsRes.value.data;
          const saved = a.totalSaved ?? a.revenueSaved ?? a.rtoFeesSaved ?? 0;
          const rescued = a.rescuedCount ?? a.ndrRescues?.count ?? 0;
          const converted = a.conversionCount ?? a.codToPrepaid?.count ?? 0;
          const arrested = a.rtoArrestCount ?? a.activeNdrCases ?? 0;

          setTotalSaved(saved);
          setRescuedCount(rescued);
          setConversionCount(converted);
          setRtoArrestCount(arrested);
        }

        if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
          const rawOrders = ordersRes.value.data.orders || ordersRes.value.data.data || [];
          const attention: OrderItem[] = rawOrders
            .filter((o: any) => {
              const st = (o.status || '').toLowerCase();
              const isNdr = st.includes('ndr') || st.includes('rto') || st.includes('failed') || st.includes('review');
              const isHigh = o.rtoRisk?.level === 'HIGH';
              return isNdr || isHigh;
            })
            .map((o: any) => ({
              id: o.id || o._id || o.orderId,
              orderId: o.orderId || o.externalOrderId || o.id || o._id,
              customerName: o.customerName || 'Customer',
              phone: o.phone || o.customerPhone,
              status: o.status,
              orderValue: o.orderValue,
              carrier: o.carrier,
              ndrReason: o.ndr?.reason,
              rtoRisk: o.rtoRisk,
              createdAt: o.createdAt,
            }));

          setOrdersNeedingAttention(attention);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSelectOrder = (order: OrderItem) => {
    navigate(`/orders?search=${encodeURIComponent(order.orderId || order.id)}`);
  };

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-spinner" />
          <p>Loading dashboard summary…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      {/* Section 1: Hero Metrics */}
      <section className="dashboard-hero">
        <h1 className="dashboard-hero__title">
          ₹<AnimatedCounter value={totalSaved} /> Saved This Month
        </h1>
        <div className="dashboard-stats">
          <Stat
            label="Orders Rescued"
            value={rescuedCount}
            icon={<CheckCircle size={20} />}
            onClick={() => navigate('/orders')}
          />
          <Stat
            label="COD→Prepaid Conversions"
            value={conversionCount}
            icon={<CreditCard size={20} />}
            onClick={() => navigate('/orders')}
          />
          <Stat
            label="RTO Arrests"
            value={rtoArrestCount}
            icon={<ShieldCheck size={20} />}
            onClick={() => navigate('/orders')}
          />
        </div>
      </section>

      {/* Section 2: Priority Action Queue */}
      <section className="dashboard-actions">
        <div className="dashboard-actions__head">
          <h2>Orders Needing Attention ({ordersNeedingAttention.length})</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/orders')}
          >
            View all orders →
          </button>
        </div>

        {ordersNeedingAttention.length === 0 ? (
          <div className="empty-state">All clear — no orders need attention.</div>
        ) : (
          <OrderList
            orders={ordersNeedingAttention}
            compact
            onSelectOrder={handleSelectOrder}
          />
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
