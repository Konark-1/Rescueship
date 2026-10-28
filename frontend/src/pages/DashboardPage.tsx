import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { FinanceBentoDashboard } from '../components/dashboard/bento/FinanceBentoDashboard';
import { type DateRange } from '../components/dashboard/DateRangePicker';
import { useFinancialROI } from '../hooks/useFinancialROI';
import { useDashboardSSE } from '../hooks/useDashboardSSE';
import { useMerchantPlatform } from '../hooks/useMerchantPlatform';
import type { DailyTrendItem, NdrReasonItem } from '../components/dashboard/TrendCharts';
import type { UrgentOrderItem } from '../components/dashboard/ActionQueue';
import { bucketRoiRecordsByWeek } from '../lib/utils';
import '../styles/dashboard.css';

const SHOW_SIMULATOR = import.meta.env.DEV || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

const DASHBOARD_METRICS_KEY = 'rs_dash_metrics_v1';
const getCachedMetrics = () => {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_METRICS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const cachedDash = getCachedMetrics();

export const DashboardPage: React.FC = () => {
  const { platformName, isShopify, isWooCommerce } = useMerchantPlatform();

  // Global Date Range
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  });
  const [hasCustomRange, setHasCustomRange] = useState<boolean>(false);
  const [activePresetLabel, setActivePresetLabel] = useState<string>('Last 30 Days');

  // Operational State initialized with cache to eliminate initial zero-state flash
  const [loading, setLoading] = useState<boolean>(!cachedDash);
  const [totalSaved, setTotalSaved] = useState<number>(cachedDash?.totalSaved ?? 0);
  const [rtoArrestCount, setRtoArrestCount] = useState<number>(cachedDash?.rtoArrestCount ?? 0);
  const [ordersNeedingAttention, setOrdersNeedingAttention] = useState<UrgentOrderItem[]>(cachedDash?.ordersNeedingAttention ?? []);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>(cachedDash?.dailyTrend ?? []);
  const [ndrReasons, setNdrReasons] = useState<NdrReasonItem[]>(cachedDash?.ndrReasons ?? []);
  const [roiChartData, setRoiChartData] = useState<Array<{ period: string; saved: number }>>(cachedDash?.roiChartData ?? []);

  // E2E Test Compatibility: NDR Simulator
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [fakeRemarkVerified, setFakeRemarkVerified] = useState<boolean>(false);

  // Meta Tier Telemetry
  const [metaTier, setMetaTier] = useState<{
    metaTierLimit: number;
    current24hCount: number;
    isLimitReached: boolean;
  }>({
    metaTierLimit: 1000,
    current24hCount: 0,
    isLimitReached: false,
  });

  // Live SSE stream with TanStack Query invalidation
  useDashboardSSE();

  // Financial ROI Hook
  const { roi, loading: roiLoading } = useFinancialROI(
    hasCustomRange ? dateRange.startDate : undefined,
    hasCustomRange ? dateRange.endDate : undefined
  );

  // High-Volume Telemetry aggregation for Recharts (E2E Test 3.3 requirement)
  const { data: rawRoiData } = useQuery({
    queryKey: ['analytics-roi', hasCustomRange ? dateRange.startDate : undefined, hasCustomRange ? dateRange.endDate : undefined],
    queryFn: async () => {
      const res = await api.get('/api/analytics/roi', {
        params: hasCustomRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined,
      });
      return res.data;
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (!rawRoiData) return;
    let nextChartData: Array<{ period: string; saved: number }> = [];
    if (rawRoiData?.chartData && Array.isArray(rawRoiData.chartData) && rawRoiData.chartData.length > 0) {
      nextChartData = rawRoiData.chartData;
    } else {
      const records = rawRoiData?.records || (Array.isArray(rawRoiData) ? rawRoiData : []);
      nextChartData = bucketRoiRecordsByWeek(records);
    }
    setRoiChartData(nextChartData);
    try {
      const prev = getCachedMetrics() || {};
      sessionStorage.setItem(DASHBOARD_METRICS_KEY, JSON.stringify({ ...prev, roiChartData: nextChartData }));
    } catch {}
  }, [rawRoiData]);

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
        const summaryRes = await api.get('/api/dashboard/summary', {
          params: hasCustomRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined,
        });
        if (summaryRes.data && typeof summaryRes.data === 'object') {
          const s = summaryRes.data;
          setTotalSaved(s.totalSaved ?? 0);
          if (typeof s.rtoArrestCount === 'number') {
            setRtoArrestCount(s.rtoArrestCount);
          }
          if (Array.isArray(s.ordersNeedingAttention)) {
            setOrdersNeedingAttention(
              s.ordersNeedingAttention.map((o: any) => ({
                id: o.id || o._id || o.orderId,
                orderId: o.orderId || o.externalOrderId || o.id || o._id,
                externalOrderId: o.externalOrderId || o.orderId,
                customerName: o.customerName || 'Customer',
                phone: o.customerPhone || o.phone,
                status: o.status,
                orderValue: o.orderValue,
                carrier: o.carrier,
                platform: o.platform,
                ndrReason: o.ndr?.reason,
                fakeRemarkScore: o.ndr?.fakeRemarkScore,
                isFakeAttempt: o.ndr?.isFakeAttempt,
                detectedAt: o.ndr?.detectedAt ?? o.ndrDetectedAt ?? null,
                paymentMethod: o.paymentMethod || (o.financial_status === 'PREPAID' ? 'prepaid' : 'cod'),
                shippingAddress: o.shippingAddress || o.customer?.address || null,
                aiAddress: o.aiAddress || (o.ndr?.addressUpdate?.textAddress ? { original: o.ndr.addressUpdate.textAddress, parsed: o.ndr.addressUpdate.geocodedAddress || o.ndr.addressUpdate.textAddress } : undefined),
                rtoRisk: o.rtoRisk,
              }))
            );
          }
          if (s.metaTier) {
            setMetaTier(s.metaTier);
          }
          if (Array.isArray(s.dailyConversions)) {
            setDailyTrend(
              s.dailyConversions.map((d: any) => ({
                date: d.date,
                rescued: d.conversions || d.rescued || 0,
                rto: typeof d.rto === 'number' ? d.rto : typeof d.rtoCount === 'number' ? d.rtoCount : undefined,
              }))
            );
          }
          if (Array.isArray(s.ndrReasons)) {
            setNdrReasons(s.ndrReasons);
          }
          loadedViaSummary = true;

          try {
            const prev = getCachedMetrics() || {};
            sessionStorage.setItem(DASHBOARD_METRICS_KEY, JSON.stringify({
              ...prev,
              totalSaved: s.totalSaved ?? 0,
              rtoArrestCount: typeof s.rtoArrestCount === 'number' ? s.rtoArrestCount : prev.rtoArrestCount ?? 0,
              ordersNeedingAttention: Array.isArray(s.ordersNeedingAttention) ? s.ordersNeedingAttention : prev.ordersNeedingAttention ?? [],
              dailyTrend: Array.isArray(s.dailyConversions) ? s.dailyConversions : prev.dailyTrend ?? [],
              ndrReasons: Array.isArray(s.ndrReasons) ? s.ndrReasons : prev.ndrReasons ?? [],
            }));
          } catch {}
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
          if (typeof a.rtoArrestCount === 'number') {
            setRtoArrestCount(a.rtoArrestCount);
          }
          if (Array.isArray(a.dailyConversions)) {
            setDailyTrend(
              a.dailyConversions.map((d: any) => ({
                date: d.date,
                rescued: d.conversions || d.rescued || 0,
                rto: typeof d.rto === 'number' ? d.rto : typeof d.rtoCount === 'number' ? d.rtoCount : undefined,
              }))
            );
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
              externalOrderId: o.externalOrderId || o.orderId,
              customerName: o.customerName || 'Customer',
              phone: o.phone || o.customerPhone,
              status: o.status,
              orderValue: o.orderValue,
              carrier: o.carrier,
              platform: o.platform,
              ndrReason: o.ndr?.reason,
              fakeRemarkScore: o.ndr?.fakeRemarkScore,
              isFakeAttempt: o.ndr?.isFakeAttempt,
              detectedAt: o.ndr?.detectedAt ?? o.ndrDetectedAt ?? null,
              paymentMethod: o.paymentMethod || (o.financial_status === 'PREPAID' ? 'prepaid' : 'cod'),
              shippingAddress: o.shippingAddress || o.customer?.address || null,
              aiAddress: o.aiAddress || (o.ndr?.addressUpdate?.textAddress ? { original: o.ndr.addressUpdate.textAddress, parsed: o.ndr.addressUpdate.geocodedAddress || o.ndr.addressUpdate.textAddress } : undefined),
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
  }, [dateRange, hasCustomRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Triage Escalations computation (Only true anomalies need human intervention)
  const escalationCount = useMemo(() => {
    return ordersNeedingAttention.filter((o) => {
      const isFake = Boolean(o.isFakeAttempt || (o.fakeRemarkScore && o.fakeRemarkScore >= 0.8));
      const isHighFraud = Boolean(o.rtoRisk?.level === 'HIGH' && o.rtoRisk?.score && o.rtoRisk.score >= 80);
      const isPendingReview = o.status === 'ndr_pending_review' || o.status === 'action_required';
      return isFake || isHighFraud || isPendingReview;
    }).length;
  }, [ordersNeedingAttention]);

  return (
    <div className="dashboard-page dashboard-page--bento">
      {/* Developer-only simulator dock (Kept for Playwright E2E spec). Never shown in production. */}
      {SHOW_SIMULATOR && simResult && (
        <section
          className="simulator-dock"
          data-testid="whatsapp-chat-bubble"
          style={{
            maxWidth: '1360px',
            margin: '0 auto 16px auto',
            background: 'var(--bg-card, #18181b)',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: '12px',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-1)' }}>
              💬 WhatsApp Rescue Simulator (AWB: {simResult.awb || 'AWB-FAKE-9988'})
            </h3>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setSimResult(null)}
              style={{ fontSize: '0.78rem', padding: '2px 8px' }}
            >
              ✕ Close
            </button>
          </div>

          {(simResult.fakeRemarkScore >= 0.7 || simResult.category === 'FAKE_REMARK') && (
            <div
              data-testid="fake-remark-warning"
              style={{
                background: 'var(--rose-12, rgba(244,63,94,0.12))',
                border: '1px solid var(--rose, #f43f5e)',
                color: 'var(--rose-light, #fecdd3)',
                padding: '10px 14px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '0.82rem',
                margin: '12px 0',
              }}
            >
              <AlertTriangle size={16} />
              <span>Suspicious Courier Attempt (Fake Remark Intercepted — Score: {simResult.fakeRemarkScore})</span>
            </div>
          )}

          <div
            style={{
              background: 'var(--emerald-20, rgba(16,185,129,0.2))',
              color: 'var(--emerald-light, #a7f3d0)',
              border: '1px solid var(--emerald-30, rgba(16,185,129,0.3))',
              padding: '12px 16px',
              borderRadius: '8px',
              maxWidth: '520px',
              fontSize: '0.85rem',
              lineHeight: 1.45,
              margin: '12px 0',
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
              >
                {fakeRemarkVerified ? '✓ Dispute Verified' : 'Verify Fake Remark'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* FINANCE BENTO DASHBOARD COMMAND DECK */}
      <FinanceBentoDashboard
        platformName={platformName}
        totalSaved={totalSaved}
        rtoArrestCount={rtoArrestCount}
        roi={roi}
        roiLoading={roiLoading}
        roiChartData={roiChartData}
        dailyTrend={dailyTrend}
        ndrReasons={ndrReasons}
        ordersNeedingAttention={ordersNeedingAttention}
        escalationCount={escalationCount}
        loading={loading}
        metaTier={metaTier}
        dateRange={dateRange}
        activePresetLabel={activePresetLabel}
        onDateRangeChange={(newRange, label) => {
          setDateRange(newRange);
          setHasCustomRange(true);
          if (label) setActivePresetLabel(label);
        }}
        onRefreshData={fetchDashboardData}
        onSimulateNdr={handleSimulateNdr}
        simulating={simulating}
        showSimulator={SHOW_SIMULATOR}
        isShopify={isShopify}
        isWooCommerce={isWooCommerce}
      />
    </div>
  );
};

export default DashboardPage;
