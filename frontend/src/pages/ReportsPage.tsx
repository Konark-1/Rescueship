import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Eye, AlertCircle, CheckCircle2, AlertTriangle, X, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';
import { TabPill } from '../components/motion/TabPill';
import { TopRiskPincodes } from '../components/TopRiskPincodes';

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

interface AuditLog {
  _id: string;
  timestamp: string;
  action: string;
  source: string;
  status: 'success' | 'failed' | 'retrying';
  orderId?: string;
  payload: Record<string, unknown>;
  error?: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const REPORT_TABS = [
  { id: 'pincodes', label: 'Top Risk Pincodes' },
  { id: 'carrier', label: 'Carrier Performance' },
  { id: 'audit', label: 'Audit Logs' },
];

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('pincodes');

  // Carrier Performance State
  const [carriers, setCarriers] = useState<CarrierStat[]>([]);
  const [carrierLoading, setCarrierLoading] = useState<boolean>(false);
  const [carrierError, setCarrierError] = useState<string | null>(null);

  // Audit Logs State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logLoading, setLogLoading] = useState<boolean>(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 30, pages: 1 });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch Carrier Stats
  const fetchCarrierPerformance = useCallback(async () => {
    setCarrierLoading(true);
    setCarrierError(null);
    try {
      const res = await api.get('/api/analytics/carriers');
      const data = res.data?.carriers || res.data || [];
      if (Array.isArray(data)) {
        setCarriers(data);
      } else {
        setCarriers([]);
      }
    } catch (err: any) {
      console.warn('Could not load carrier performance', err);
      setCarrierError(err?.response?.data?.error || 'Unable to load carrier performance metrics.');
    } finally {
      setCarrierLoading(false);
    }
  }, []);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async (page = 1) => {
    setLogLoading(true);
    setLogError(null);
    try {
      const res = await api.get('/api/audit-logs', { params: { page, limit: 30 } });
      setLogs(res.data?.logs || []);
      setPagination(res.data?.pagination || { total: 0, page: 1, limit: 30, pages: 1 });
    } catch (err: any) {
      console.warn('Could not load audit logs', err);
      setLogError(err?.response?.data?.error || 'Failed to load audit logs.');
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'carrier') {
      fetchCarrierPerformance();
    } else if (activeTab === 'audit') {
      fetchAuditLogs(1);
    }
  }, [activeTab, fetchCarrierPerformance, fetchAuditLogs]);

  // Filtered Audit Logs by Action or Order ID
  const filteredLogs = logs.filter((log) => {
    const matchesStatus =
      statusFilter === 'All' ||
      log.status === statusFilter ||
      (statusFilter === 'warning' && log.status === 'retrying');

    const searchLower = searchFilter.toLowerCase().trim();
    const actionMatches = log.action?.toLowerCase().includes(searchLower);
    const sourceMatches = log.source?.toLowerCase().includes(searchLower);
    const orderIdMatches =
      log.orderId?.toLowerCase().includes(searchLower) ||
      (log.payload && typeof log.payload.orderId === 'string' && log.payload.orderId.toLowerCase().includes(searchLower));

    return matchesStatus && (!searchLower || actionMatches || sourceMatches || orderIdMatches);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return 'badge-success';
      case 'retrying':
      case 'warning':
        return 'badge-warning';
      case 'failed':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={12} />;
      case 'retrying':
      case 'warning':
        return <AlertTriangle size={12} />;
      case 'failed':
        return <AlertCircle size={12} />;
      default:
        return null;
    }
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
          {activeTab === 'audit' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => fetchAuditLogs(pagination.page)}
              disabled={logLoading}
            >
              <RefreshCw size={14} className={logLoading ? 'animate-spin' : ''} />
              {logLoading ? 'Refreshing…' : 'Refresh logs'}
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

          {/* TAB 2: Carrier Performance */}
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

          {/* TAB 3: Audit Logs */}
          {activeTab === 'audit' && (
            <div className="fade-in-up">
              {/* Filter controls */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '420px' }}>
                  <Search size={15} style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                  <input
                    type="text"
                    placeholder="Filter by action or order ID…"
                    aria-label="Filter audit logs by action or order ID"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {['All', 'success', 'warning', 'failed'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setStatusFilter(st)}
                      style={{
                        backgroundColor: statusFilter === st ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        borderColor: statusFilter === st ? 'var(--indigo)' : 'var(--border)',
                        color: statusFilter === st ? 'var(--text-1)' : 'var(--text-3)',
                        textTransform: 'capitalize',
                        fontSize: '0.76rem',
                        padding: '4px 10px',
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {logLoading ? (
                <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.9rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--indigo)' }} />
                  Loading audit logs…
                </div>
              ) : logError ? (
                <div className="alert alert--bad">
                  <AlertCircle size={18} />
                  <span>{logError}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchAuditLogs(1)} style={{ marginLeft: 'auto' }}>
                    Retry
                  </button>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                  <p className="empty__title">No Audit Logs Found</p>
                  <p className="empty__sub">Try adjusting your search query or status filter.</p>
                </div>
              ) : (
                <div className="table-container" tabIndex={0} aria-label="Audit Logs Table">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action / Event</th>
                        <th>Order ID</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const orderId =
                          log.orderId ||
                          (log.payload && typeof log.payload.orderId === 'string' ? log.payload.orderId : '—');
                        return (
                          <tr key={log._id}>
                            <td className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="td-main mono" style={{ fontSize: '0.8rem' }}>
                              {log.action}
                            </td>
                            <td className="td-id">{orderId}</td>
                            <td>{log.source || 'system'}</td>
                            <td>
                              <span className={`badge ${getStatusBadge(log.status)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {getStatusIcon(log.status)}
                                {log.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedLog(log)}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                              >
                                <Eye size={12} /> JSON
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pagination.page <= 1 || logLoading}
                    onClick={() => fetchAuditLogs(pagination.page - 1)}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                    {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pagination.page >= pagination.pages || logLoading}
                    onClick={() => fetchAuditLogs(pagination.page + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* JSON Payload Inspection Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => {
              setSelectedLog(null);
              setCopied(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.22 }}
              className="modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Audit Log Payload"
            >
              <div className="modal__head">
                <span className="modal__dot modal__dot--r" />
                <span className="modal__dot modal__dot--a" />
                <span className="modal__dot modal__dot--g" />
                <span className="modal__title">
                  {selectedLog.action} · {selectedLog._id}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLog(null);
                    setCopied(false);
                  }}
                  className="modal__close"
                  aria-label="Close modal"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="modal__body">
                <pre tabIndex={0} className="code" style={{ maxHeight: '340px', overflowY: 'auto', margin: 0 }}>
                  {JSON.stringify(selectedLog.payload ?? {}, null, 2)}
                </pre>
                {selectedLog.error && (
                  <p style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: 'var(--space-3)' }}>
                    Error: {selectedLog.error}
                  </p>
                )}
              </div>

              <div className="modal__foot">
                <button
                  type="button"
                  className={`btn btn-sm ${copied ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedLog.payload ?? {}, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={14} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy JSON
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportsPage;
