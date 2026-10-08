import React, { useState, Suspense, lazy } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { TabPill } from '../components/motion/TabPill';
import { TopRiskPincodes } from '../components/TopRiskPincodes';
import { FraudWatchtower } from '../components/reports/FraudWatchtower';
import { AuditLogViewer } from '../components/audit/AuditLogViewer';

const RescueFunnel = lazy(() => import('../components/reports/RescueFunnel'));

interface CarrierStat {
  carrier: string;
  totalOrders?: number;
  totalNDR?: number;
  rto?: number;
  rescued?: number;
  rtoRate?: number;
  rescueRate?: number;
  fakeAttempts?: number;
  fakeAttemptsCount?: number;
}

const REPORT_TABS = [
  { id: 'pincodes', label: 'Top Risk Pincodes' },
  { id: 'fraud', label: 'Carrier Fraud Watchtower' },
  { id: 'funnel', label: 'AI Rescue Funnel' },
  { id: 'carrier', label: 'Carrier Performance' },
  { id: 'audit', label: 'Audit Logs' },
];

import { useQuery } from '@tanstack/react-query';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('pincodes');

  // Carrier Performance Query via TanStack Query
  const {
    data: carriersData,
    isLoading: carrierLoading,
    error: carrierQueryError,
    refetch: refetchCarriers,
  } = useQuery<CarrierStat[]>({
    queryKey: ['analytics-carriers'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/carriers');
      const data = res.data?.carriers || res.data || [];
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'carrier',
    staleTime: 60000,
  });

  const carriers = carriersData || [];
  const carrierError = carrierQueryError
    ? (carrierQueryError as any)?.response?.data?.error || (carrierQueryError as any)?.message || 'Unable to load carrier performance metrics.'
    : null;

  const fetchCarrierPerformance = () => {
    refetchCarriers();
  };

  return (
    <div className="page reports-page">
      {/* Header */}
      <header className="page-head">
        <div>
          <h1 className="page-head__title">Reports &amp; Intelligence</h1>
          <p className="page-head__sub">
            Deep logistics telemetry, regional pincode RTO hotspots, carrier reliability, and audit ledgers.
          </p>
        </div>
        <div className="page-head__actions">
          {activeTab === 'carrier' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={fetchCarrierPerformance}
              disabled={carrierLoading}
            >
              <RefreshCw size={14} className={carrierLoading ? 'animate-spin' : ''} />
              {carrierLoading ? 'Refreshing…' : 'Refresh carriers'}
            </button>
          )}
        </div>
      </header>

      {/* Tab Pill Navigation */}
      <div className="panel" style={{ overflow: 'visible' }}>
        <div className="panel__head" style={{ justifyContent: 'flex-start', padding: 'var(--space-3) var(--space-4)' }}>
          <TabPill
            tabs={REPORT_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
            layoutId="reports-main-tab"
          />
        </div>

        <div className="panel__body" style={{ minHeight: '360px', padding: activeTab === 'pincodes' ? 0 : 'var(--space-5)' }}>
          {/* TAB 1: Top Risk Pincodes */}
          {activeTab === 'pincodes' && (
            <div>
              <TopRiskPincodes />
            </div>
          )}

          {/* TAB 2: Carrier Fraud Watchtower */}
          {activeTab === 'fraud' && (
            <div className="fade-in-up">
              <FraudWatchtower />
            </div>
          )}

          {/* TAB 3: AI Rescue Funnel */}
          {activeTab === 'funnel' && (
            <div className="fade-in-up">
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
                    }}
                  >
                    Loading AI Rescue Funnel &amp; Telemetry…
                  </div>
                }
              >
                <RescueFunnel />
              </Suspense>
            </div>
          )}

          {/* TAB 4: Carrier Performance */}
          {activeTab === 'carrier' && (
            <div className="fade-in-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-1)' }}>Carrier Performance Breakdown</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                    Comparative telemetry evaluating delivery completion, fake remark rates, and RTO return ratios.
                  </p>
                </div>
              </div>

              {carrierLoading ? (
                <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.9rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--indigo)' }} />
                  Aggregating carrier logistics telemetry…
                </div>
              ) : carrierError ? (
                <div className="alert alert--bad" style={{ margin: 'var(--space-4) 0' }}>
                  <AlertCircle size={18} />
                  <span>{carrierError}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={fetchCarrierPerformance} style={{ marginLeft: 'auto' }}>
                    Retry
                  </button>
                </div>
              ) : carriers.length === 0 ? (
                <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                  <p className="empty__title">No Carrier Telemetry Recorded</p>
                  <p className="empty__sub">Carrier stats will automatically populate once orders with courier assignments are synced.</p>
                </div>
              ) : (
                <div className="table-container" tabIndex={0} aria-label="Carrier Performance Table">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Carrier Name</th>
                        <th style={{ textAlign: 'right' }}>Total Orders</th>
                        <th style={{ textAlign: 'right' }}>RTO Rate</th>
                        <th style={{ textAlign: 'right' }}>Fake Attempts Count</th>
                        <th style={{ textAlign: 'right' }}>Rescued Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carriers.map((c) => {
                        const total = c.totalOrders ?? c.totalNDR ?? ((c.rescued ?? 0) + (c.rto ?? 0));
                        const rtoOrders = c.rto ?? 0;
                        const rtoRate =
                          c.rtoRate !== undefined
                            ? c.rtoRate
                            : total > 0
                              ? Number(((rtoOrders / total) * 100).toFixed(1))
                              : 0;
                        const fakeAttempts = c.fakeAttempts ?? c.fakeAttemptsCount ?? 0;
                        const rescued = c.rescued ?? 0;

                        return (
                          <tr key={c.carrier}>
                            <td className="td-main" style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                              {c.carrier}
                            </td>
                            <td className="td-num" style={{ textAlign: 'right' }}>
                              {total.toLocaleString('en-IN')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span
                                className={`badge ${
                                  rtoRate > 30 ? 'badge-danger' : rtoRate > 15 ? 'badge-warning' : 'badge-success'
                                }`}
                              >
                                {rtoRate}%
                              </span>
                            </td>
                            <td className="td-num" style={{ textAlign: 'right' }}>
                              <span className={fakeAttempts > 0 ? 'mono' : 'td-meta'} style={{ color: fakeAttempts > 0 ? 'var(--amber)' : undefined }}>
                                {fakeAttempts}
                              </span>
                            </td>
                            <td className="td-num" style={{ textAlign: 'right', color: 'var(--emerald)', fontWeight: 600 }}>
                              {rescued.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Audit Logs */}
          {activeTab === 'audit' && (
            <div className="fade-in-up">
              <AuditLogViewer pageSize={30} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
