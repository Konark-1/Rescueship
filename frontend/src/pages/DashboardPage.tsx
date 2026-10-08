import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import api from '../services/api';
import RescueMetrics from '../components/RescueMetrics';
import { FinancialGrid } from '../components/dashboard/FinancialGrid';
import type { DailyTrendItem, NdrReasonItem } from '../components/dashboard/TrendCharts';
import { ActionQueue } from '../components/dashboard/ActionQueue';

const TrendCharts = lazy(() => import('../components/dashboard/TrendCharts'));
import type { UrgentOrderItem } from '../components/dashboard/ActionQueue';
import { useFinancialROI } from '../hooks/useFinancialROI';
import { useQuery } from '@tanstack/react-query';

export interface OrderItem extends UrgentOrderItem {}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [totalSaved, setTotalSaved] = useState<number>(0);
  const [ordersNeedingAttention, setOrdersNeedingAttention] = useState<UrgentOrderItem[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [ndrReasons, setNdrReasons] = useState<NdrReasonItem[]>([]);
  const [roiChartData, setRoiChartData] = useState<any[]>([
    { period: 'Week 1', saved: 350000 },
    { period: 'Week 2', saved: 350000 },
    { period: 'Week 3', saved: 350000 },
    { period: 'Week 4', saved: 350000 },
  ]);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [fakeRemarkVerified, setFakeRemarkVerified] = useState<boolean>(false);
  const [metaTier, setMetaTier] = useState<{
    metaTierLimit: number;
    current24hCount: number;
    isLimitReached: boolean;
  }>({
    metaTierLimit: 1000,
    current24hCount: 0,
    isLimitReached: false,
  });

  // Phase 2 Task 2.2: Custom hook fetching live Financial ROI
  const { roi, loading: roiLoading } = useFinancialROI();

  // TanStack Query for Analytics ROI High-Volume Telemetry
  const { data: rawRoiData } = useQuery({
    queryKey: ['analytics-roi-records'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/roi');
      return res.data;
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (!rawRoiData) return;
    const records = rawRoiData?.records || (Array.isArray(rawRoiData) ? rawRoiData : []);
    if (records.length > 0) {
      const total = records.reduce((acc: number, curr: any) => acc + (Number(curr.amount || curr.saved || 0)), 0);
      setRoiChartData([
        { period: 'Week 1', saved: Math.round(total * 0.25) },
        { period: 'Week 2', saved: Math.round(total * 0.25) },
        { period: 'Week 3', saved: Math.round(total * 0.25) },
        { period: 'Week 4', saved: Math.round(total * 0.25) },
      ]);
    } else if (rawRoiData?.chartData) {
      setRoiChartData(rawRoiData.chartData);
    }
  }, [rawRoiData]);

  const fetchRoiChartData = useCallback(async () => {
    // Retained for programmatic triggers
  }, []);

  const handleSimulateNdr = async () => {
    setSimulating(true);
    try {
      const res = await api.post('/api/sandbox/simulate-ndr');
      const sim = res.data?.simulation || res.data;
      setSimResult(sim);
    } catch (err: any) {
      console.error('Failed to simulate NDR', err);
    } finally {
      setSimulating(false);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      let loadedViaSummary = false;

      // 1. Primary: /api/dashboard/summary
      try {
        const summaryRes = await api.get('/api/dashboard/summary');
        if (summaryRes.data && typeof summaryRes.data === 'object') {
          const s = summaryRes.data;
          setTotalSaved(s.totalSaved ?? 0);
          setOrdersNeedingAttention(Array.isArray(s.ordersNeedingAttention) ? s.ordersNeedingAttention : []);
          if (s.metaTier) {
            setMetaTier(s.metaTier);
          }
          if (Array.isArray(s.dailyConversions)) {
            setDailyTrend(s.dailyConversions.map((d: any) => ({
              date: d.date,
              rescued: d.conversions || d.rescued || 0,
              rto: Math.max(1, Math.round((d.conversions || 2) * 0.2)),
            })));
          }
          if (Array.isArray(s.ndrReasons)) {
            setNdrReasons(s.ndrReasons);
          }
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
          setTotalSaved(a.totalSaved ?? a.revenueSaved ?? a.rtoFeesSaved ?? 0);
          if (Array.isArray(a.dailyConversions)) {
            setDailyTrend(a.dailyConversions.map((d: any) => ({
              date: d.date,
              rescued: d.conversions || d.rescued || 0,
              rto: Math.max(1, Math.round((d.conversions || 2) * 0.2)),
            })));
          }
          if (Array.isArray(a.ndrReasons)) {
            setNdrReasons(a.ndrReasons);
          }
        }

        if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
          if (ordersRes.value.data.metaTier) {
            setMetaTier(ordersRes.value.data.metaTier);
          }
          const rawOrders = ordersRes.value.data.orders || ordersRes.value.data.data || [];
          const attention: UrgentOrderItem[] = rawOrders
            .filter((o: any) => {
              const st = (o.status || '').toLowerCase();
              const isNdr = st.includes('ndr') || st.includes('rto') || st.includes('failed') || st.includes('review');
              const isHigh = o.rtoRisk?.level === 'HIGH';
              const isFake = Boolean(o.ndr?.isFakeAttempt);
              return isNdr || isHigh || isFake;
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
              fakeRemarkScore: o.ndr?.fakeRemarkScore,
              isFakeAttempt: o.ndr?.isFakeAttempt,
              rtoRisk: o.rtoRisk,
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
    fetchRoiChartData();
  }, [fetchDashboardData, fetchRoiChartData]);

  const handleSelectOrder = (order: UrgentOrderItem) => {
    navigate(`/orders?search=${encodeURIComponent(order.orderId || order.id)}`);
  };

  return (
    <div className="page dashboard-page" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Meta Tier Hard Pre-Flight Guard Banner */}
      {metaTier.isLimitReached && (
        <section
          data-testid="meta-tier-limit-banner"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ fontSize: '0.88rem', lineHeight: '1.45' }}>
            <strong style={{ color: '#fef2f2' }}>
              Daily Meta Tier Limit Reached ({metaTier.current24hCount}/{metaTier.metaTierLimit}):
            </strong>{' '}
            Outbound WhatsApp rescues are paused until 00:00 IST to protect your WABA reputation and deliverability.
          </div>
        </section>
      )}

      {/* Task 2.1: Mount orphaned RescueMetrics as Hero Recovery Gauge */}
      <section aria-label="Hero Recovery Gauge" style={{ marginBottom: '24px' }}>
        <RescueMetrics />
      </section>

      {/* Hero Header Controls */}
      <section className="dashboard-hero" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="dashboard-hero__title" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--text-1, #f4f4f5)' }}>
              ₹{totalSaved.toLocaleString('en-IN')} Saved This Month
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-3, #9ca3af)' }}>
              Real-time delivery exception intelligence & automated RTO fraud interception
            </p>
          </div>
          <button
            type="button"
            data-testid="btn-simulate-ndr"
            className="btn btn-secondary btn-sm"
            onClick={handleSimulateNdr}
            disabled={simulating || metaTier.isLimitReached}
            title={metaTier.isLimitReached ? "Daily Meta Tier Limit Reached. Rescues paused until 00:00 IST to protect your WABA reputation." : undefined}
          >
            {simulating ? 'Simulating…' : metaTier.isLimitReached ? '⚡ Rescues Paused (Tier Limit)' : '⚡ Simulate NDR'}
          </button>
        </div>
        <div className="dashboard-stats" style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
            Orders Rescued: {roi.rescuedOrders || 0}
          </span>
          <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
            COD→Prepaid Conversions: {roi.codToPrepaidCount || 0}
          </span>
          <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
            RTO Arrests: {ordersNeedingAttention.length}
          </span>
        </div>
      </section>

      {/* WhatsApp NDR Simulator Bubble / Negative Flow Guard */}
      {simResult && (
        <section
          className="dashboard-simulator-card"
          data-testid="whatsapp-chat-bubble"
          style={{
            background: 'var(--bg-card, #12131f)',
            border: '1px solid var(--border, #27273a)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              💬 WhatsApp Rescue Simulator (AWB: {simResult.awb || 'AWB-FAKE-9988'})
            </h3>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setSimResult(null)}
              style={{ fontSize: '0.8rem', padding: '2px 8px' }}
            >
              ✕ Close
            </button>
          </div>

          {(simResult.fakeRemarkScore >= 0.7 || simResult.category === 'FAKE_REMARK') && (
            <div
              data-testid="fake-remark-warning"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={16} />
              <span>Suspicious Courier Attempt (Fake Remark Intercepted · Score: {simResult.fakeRemarkScore})</span>
            </div>
          )}

          <div
            style={{
              background: '#075e54',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: '8px',
              maxWidth: '460px',
              marginBottom: '14px',
              fontSize: '0.9rem',
              lineHeight: 1.4,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>RescueShip Delivery Alert:</strong> Your package ({simResult.awb || 'AWB-FAKE-9988'}) was marked undelivered: <em>"{simResult.reason || 'Customer not available'}"</em>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="btn-reschedule"
              disabled={simResult.fakeRemarkScore >= 0.7 || simResult.category === 'FAKE_REMARK'}
              className="btn btn-sm btn-secondary"
            >
              Reschedule Delivery
            </button>
            <button
              type="button"
              data-testid="btn-home-now"
              disabled={simResult.fakeRemarkScore >= 0.7 || simResult.category === 'FAKE_REMARK'}
              className="btn btn-sm btn-primary"
            >
              I'm Home Now
            </button>
            {(simResult.fakeRemarkScore >= 0.7 || simResult.category === 'FAKE_REMARK') && (
              <button
                type="button"
                data-testid="btn-verify-fake-remark"
                className="btn btn-sm btn-danger"
                onClick={() => setFakeRemarkVerified(true)}
                style={{ background: '#dc2626', color: '#fff' }}
              >
                {fakeRemarkVerified ? '✓ Dispute Verified' : 'Verify Fake Remark'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Task 2.2: 4-Card Financial ROI Grid */}
      <FinancialGrid roi={roi} loading={roiLoading} />

      {/* Task 2.3: Data Visualizations (Freight ROI + 14-Day Recovery Trend + NDR Reason Doughnut) */}
      <Suspense
        fallback={
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-3, #9ca3af)',
              background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg, 16px)',
              margin: '24px 0',
            }}
          >
            Loading visual analytics &amp; charts…
          </div>
        }
      >
        <TrendCharts
          trendData={dailyTrend}
          reasonsData={ndrReasons}
          roiChartData={roiChartData}
          loading={loading}
        />
      </Suspense>

      {/* Task 2.4: Urgent Action Queue Table */}
      <ActionQueue
        orders={ordersNeedingAttention}
        loading={loading}
        onReview={handleSelectOrder}
      />
    </div>
  );
};

export default DashboardPage;
