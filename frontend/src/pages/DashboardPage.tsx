import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import RescueMetrics from '../components/RescueMetrics';
import { SystemHealthRibbon } from '../components/dashboard/SystemHealthRibbon';
import { AttentionPanel } from '../components/dashboard/AttentionPanel';
import { FinancialGrid } from '../components/dashboard/FinancialGrid';
import { ActionQueue, type UrgentOrderItem } from '../components/dashboard/ActionQueue';
import { OrderDrawer } from '../components/dashboard/OrderDrawer';
import { DateRangePicker, type DateRange } from '../components/dashboard/DateRangePicker';
import { CarrierPerformanceCard } from '../components/dashboard/CarrierPerformanceCard';
import { RtoWatchtower } from '../components/dashboard/RtoWatchtower';
import { TopRiskPincodes } from '../components/TopRiskPincodes';
import { FraudWatchtower } from '../components/reports/FraudWatchtower';
import { useFinancialROI } from '../hooks/useFinancialROI';
import { useDashboardSSE } from '../hooks/useDashboardSSE';
import { useMerchantPlatform } from '../hooks/useMerchantPlatform';
import type { DailyTrendItem, NdrReasonItem } from '../components/dashboard/TrendCharts';
import type { UnifiedDashboardOrder } from '../types/dashboard.d';
import { bucketRoiRecordsByWeek } from '../lib/utils';
import '../styles/dashboard.css';

const TrendCharts = lazy(() => import('../components/dashboard/TrendCharts'));
const RescueFunnel = lazy(() => import('../components/reports/RescueFunnel'));

export const DashboardPage: React.FC = () => {
  const { platformName, isShopify, isWooCommerce } = useMerchantPlatform();

  // Selected Order for Slide-over Drawer
  const [selectedOrder, setSelectedOrder] = useState<UnifiedDashboardOrder | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Global Date Range
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  });
  const [hasCustomRange, setHasCustomRange] = useState<boolean>(false);
  const [activePresetLabel, setActivePresetLabel] = useState<string>('This Month');

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [totalSaved, setTotalSaved] = useState<number>(0);
  const [rtoArrestCount, setRtoArrestCount] = useState<number>(0);
  const [ordersNeedingAttention, setOrdersNeedingAttention] = useState<UrgentOrderItem[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [ndrReasons, setNdrReasons] = useState<NdrReasonItem[]>([]);
  const [roiChartData, setRoiChartData] = useState<Array<{ period: string; saved: number }>>([]);

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
    queryKey: ['analytics-roi-records', hasCustomRange ? dateRange.startDate : null, hasCustomRange ? dateRange.endDate : null],
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
    if (rawRoiData?.chartData && Array.isArray(rawRoiData.chartData) && rawRoiData.chartData.length > 0) {
      setRoiChartData(rawRoiData.chartData);
      return;
    }

    const records = rawRoiData?.records || (Array.isArray(rawRoiData) ? rawRoiData : []);
    setRoiChartData(bucketRoiRecordsByWeek(records));
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
                rto: Math.max(1, Math.round((d.conversions || 2) * 0.2)),
              }))
            );
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
          if (typeof a.rtoArrestCount === 'number') {
            setRtoArrestCount(a.rtoArrestCount);
          }
          if (Array.isArray(a.dailyConversions)) {
            setDailyTrend(
              a.dailyConversions.map((d: any) => ({
                date: d.date,
                rescued: d.conversions || d.rescued || 0,
                rto: Math.max(1, Math.round((d.conversions || 2) * 0.2)),
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

  // Open Slide-over Drawer for Order Triage
  const handleSelectOrder = (order: UrgentOrderItem) => {
    const unified: UnifiedDashboardOrder = {
      id: order.id,
      orderId: order.orderId,
      externalOrderId: order.externalOrderId || order.orderId,
      platform: (order.platform as any) || (isShopify ? 'shopify' : isWooCommerce ? 'woocommerce' : 'custom'),
      customerName: order.customerName || 'Customer',
      phone: order.phone || '',
      orderValue: order.orderValue || 0,
      paymentMethod: order.paymentMethod || 'cod',
      status: (order.status as any) || 'ndr_detected',
      carrier: order.carrier,
      createdAt: order.detectedAt ? new Date(order.detectedAt).toISOString() : new Date().toISOString(),
      shippingAddress: order.shippingAddress,
      aiAddress: order.aiAddress,
      ndr: {
        reason: order.ndrReason,
        fakeRemarkScore: order.fakeRemarkScore,
        isFakeAttempt: order.isFakeAttempt,
        detectedAt: order.detectedAt ? new Date(order.detectedAt).toISOString() : null,
      },
      rtoRisk: order.rtoRisk as any,
    };
    setSelectedOrder(unified);
    setIsDrawerOpen(true);
  };

  return (
    <div className="dashboard-page">
      {/* ZONE 0: SYSTEM HEALTH RIBBON (Sticky Top) */}
      <SystemHealthRibbon metaTier={metaTier} />

      {/* Everything that needs the merchant: broken connections, refunds, failed courier actions */}
      <AttentionPanel />

      {/* Hero Recovery Gauge */}
      <section aria-label="Hero Recovery Gauge">
        <RescueMetrics />
      </section>

      {/* DASHBOARD HEADER & CONTROLS */}
      <header className="dashboard-page__header">
        <div className="dashboard-page__title-group">
          <h1 className="dashboard-page__title">
            ₹{totalSaved.toLocaleString('en-IN')} Saved {activePresetLabel}
          </h1>
          <p className="dashboard-page__subtitle">
            Autonomous RTO Interception, NDR Intelligence &amp; COD Conversion Deck ({platformName} Integrated)
          </p>
          <div className="dashboard-page__badges">
            <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
              Orders Rescued: {roi?.rescuedOrders || 0}
            </span>
            <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
              COD Prepaid: {roi?.codToPrepaidCount || 0}
            </span>
            <span className="badge badge-warning" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
              RTO Arrests: {rtoArrestCount}
            </span>
            <span className="badge badge-outline" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
              Orders Needing Attention: {ordersNeedingAttention.length}
            </span>
          </div>
        </div>

        <div className="dashboard-page__actions">
          <DateRangePicker
            value={dateRange}
            activePreset={activePresetLabel}
            onChange={(newRange, label) => {
              setDateRange(newRange);
              setHasCustomRange(true);
              if (label) setActivePresetLabel(label);
            }}
          />
          <button
            type="button"
            data-testid="btn-simulate-ndr"
            className="btn btn-secondary btn-sm"
            onClick={handleSimulateNdr}
            disabled={simulating || metaTier.isLimitReached}
            title={
              metaTier.isLimitReached
                ? 'Daily Meta Tier Limit Reached. Rescues paused until 00:00 IST to protect your WABA reputation.'
                : undefined
            }
          >
            {simulating ? 'Simulating…' : metaTier.isLimitReached ? '⚡ Rescues Paused' : '⚡ Simulate NDR'}
          </button>
        </div>
      </header>

      {/* WHATSAPP NDR SIMULATOR BUBBLE (Preserved for Playwright E2E Spec) */}
      {simResult && (
        <section
          className="simulator-dock"
          data-testid="whatsapp-chat-bubble"
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
                background: 'var(--rose-12)',
                border: '1px solid var(--rose)',
                color: 'var(--rose-light)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '0.82rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>Suspicious Courier Attempt (Fake Remark Intercepted · Score: {simResult.fakeRemarkScore})</span>
            </div>
          )}

          <div
            style={{
              background: 'var(--emerald-20)',
              color: 'var(--emerald-light)',
              border: '1px solid var(--emerald-30)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              maxWidth: '520px',
              fontSize: '0.85rem',
              lineHeight: 1.45,
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

      {/* ZONE 1: FINANCIAL ROI HERO GRID */}
      <FinancialGrid roi={roi} loading={roiLoading} />

      {/* ZONE 2: LIVE NDR SMART ACTION QUEUE */}
      <ActionQueue
        orders={ordersNeedingAttention}
        loading={loading}
        onSelectOrder={handleSelectOrder}
        onReview={handleSelectOrder}
        keysEnabled={!isDrawerOpen}
      />

      {/* ZONE 3: RESCUE FUNNEL + TREND CHARTS (2-Column Grid) */}
      <section className="dashboard-grid--2col" aria-label="Rescue Analytics and Funnel">
        <Suspense fallback={<div className="fin-card">Loading AI Funnel…</div>}>
          <RescueFunnel dateRange={hasCustomRange ? dateRange : undefined} />
        </Suspense>
        <Suspense fallback={<div className="fin-card">Loading Trend Analytics…</div>}>
          <TrendCharts
            trendData={dailyTrend}
            reasonsData={ndrReasons}
            roiChartData={roiChartData}
            loading={loading}
          />
        </Suspense>
      </section>

      {/* ZONE 4: CARRIER MATRIX & COURIER FRAUD WATCHTOWER (2-Column Grid) */}
      <section className="dashboard-grid--2col" aria-label="Courier Intelligence and Fraud Dispute">
        <CarrierPerformanceCard dateRange={hasCustomRange ? dateRange : undefined} />
        <FraudWatchtower dateRange={hasCustomRange ? dateRange : undefined} />
      </section>

      {/* ZONE 5: PRE-DISPATCH PREDICTIVE RTO WATCHTOWER */}
      <RtoWatchtower onActionComplete={fetchDashboardData} />

      {/* ZONE 6: TOP RISK PINCODES & STOREFRONT SYNC */}
      <section aria-label="High Risk Pincodes Intelligence">
        <TopRiskPincodes />
      </section>

      {/* SLIDE-OVER ACTION DRAWER */}
      <OrderDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOrderUpdated={fetchDashboardData}
      />
    </div>
  );
};

export default DashboardPage;
