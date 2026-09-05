import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, AlertCircle, CheckCircle2, AlertTriangle, X, Copy, Check, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { TabPill } from '../components/motion/TabPill';
import api from '../services/api';

interface AuditLog {
  _id: string;
  timestamp: string;
  action: string;
  source: string;
  status: 'success' | 'failed' | 'retrying';
  payload: Record<string, unknown>;
  error?: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'success': return 'badge-success';
    case 'retrying': return 'badge-warning';
    case 'failed': return 'badge-danger';
    default: return 'badge-secondary';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'success': return <CheckCircle2 size={11} />;
    case 'retrying': return <AlertTriangle size={11} />;
    case 'failed': return <AlertCircle size={11} />;
    default: return <CheckCircle2 size={11} />;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'success': return 'Success';
    case 'retrying': return 'Warning';
    case 'failed': return 'Error';
    default: return status;
  }
};

const safeStringify = (payload: Record<string, unknown> | undefined): string => {
  try {
    return JSON.stringify(payload ?? {}, null, 2);
  } catch {
    return String(payload ?? '');
  }
};

const AuditLogsPage = () => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 50, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/audit-logs', { params: { page, limit: 50 } });
      setLogs(res.data.logs || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 50, pages: 1 });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to load audit logs.');
      } else {
        setError('Failed to load audit logs.');
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'All' || log.status === filter;
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.source.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const severityTabs = [
    { id: 'All', label: 'All' },
    { id: 'success', label: 'Success' },
    { id: 'retrying', label: 'Warning' },
    { id: 'failed', label: 'Error' },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="page-head__kicker">06 · Forensics</p>
          <h1 className="page-head__title">Audit <em>ledger</em></h1>
          <p className="page-head__sub">Every webhook, API call and automated message — the full paper trail.</p>
        </div>
        <button
          onClick={() => fetchLogs(pagination.page)}
          className="btn btn-ghost btn-sm"
          aria-label="Refresh audit logs"
          disabled={loading}
        >
          <RefreshCw size={14} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {/* Filters */}
      <div className="panel">
        <div className="panel__body" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 420 }}>
            <Search size={15} style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              type="text"
              placeholder="Search events or sources…"
              aria-label="Search events or sources"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '2.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
            />
          </div>
          <TabPill tabs={severityTabs} activeTab={filter} onChange={setFilter} />
        </div>
      </div>

      {/* Log table */}
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title"><i aria-hidden="true" />Event stream</span>
          <span className="panel__aside">
            {filteredLogs.length} shown · {pagination.total} total
          </span>
        </div>
        <div className="table-container" tabIndex={0} aria-label="Audit logs table">
          <table className="custom-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Source</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log._id}>
                  <td className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="td-main mono" style={{ fontSize: '0.82rem' }}>{log.action}</td>
                  <td>{log.source}</td>
                  <td>
                    <span className={`badge ${statusBadge(log.status)}`}>
                      {statusIcon(log.status)}
                      {statusLabel(log.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => setSelectedLog(log)} className="btn btn-ghost btn-sm">
                      <Eye size={13} /> JSON
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                      <p className="empty__title">Loading events…</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                      <p className="empty__title">Could not load the ledger</p>
                      <p className="empty__sub">{error}</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !error && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                      <p className="empty__title">No matching events</p>
                      <p className="empty__sub">Widen the filter or clear the search to see the full ledger.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="panel__foot" style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-3)' }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchLogs(pagination.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
              {pagination.page} / {pagination.pages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => fetchLogs(pagination.page + 1)}
              aria-label="Next page"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* JSON payload modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => { setSelectedLog(null); setCopied(false); }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="modal"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-label="Event payload"
            >
              <div className="modal__head">
                <span className="modal__dot modal__dot--r" />
                <span className="modal__dot modal__dot--a" />
                <span className="modal__dot modal__dot--g" />
                <span className="modal__title">{selectedLog._id} · {selectedLog.action}</span>
                <button onClick={() => { setSelectedLog(null); setCopied(false); }} aria-label="Close payload modal" className="modal__close"><X size={15} /></button>
              </div>
              <div className="modal__body">
                <pre tabIndex={0} aria-label="JSON event payload" className="code" style={{ margin: 0, color: 'var(--text-2)' }}>
                  {safeStringify(selectedLog.payload)}
                </pre>
                {selectedLog.error && (
                  <p style={{ color: 'var(--rose)', fontSize: '0.82rem', marginTop: 'var(--space-3)' }}>
                    Error: {selectedLog.error}
                  </p>
                )}
              </div>
              <div className="modal__foot">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(safeStringify(selectedLog.payload));
                    setCopied(true);
                    showToast('Payload copied to clipboard.');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`btn btn-sm ${copied ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy payload</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div className="toast-notification" role="status">
          <CheckCircle2 size={18} color="var(--emerald)" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
