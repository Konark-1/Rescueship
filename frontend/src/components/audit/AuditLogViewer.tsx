import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Eye,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '../../services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

export interface AuditLog {
  _id: string;
  timestamp: string;
  action: string;
  source: string;
  status: 'success' | 'failed' | 'retrying' | 'warning' | string;
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

interface AuditLogViewerProps {
  pageSize?: number;
  initialFilter?: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  pageSize = 50,
  initialFilter = 'All',
}) => {
  const [filter, setFilter] = useState<string>(initialFilter);
  const [search, setSearch] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: pageSize,
    pages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/api/audit-logs', {
          params: { page, limit: pageSize },
        });
        setLogs(res.data.logs || []);
        setPagination(
          res.data.pagination || { total: 0, page: 1, limit: pageSize, pages: 1 }
        );
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load audit logs.');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const copyPayload = (payload: unknown) => {
    const text = JSON.stringify(payload ?? {}, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter =
      filter === 'All' ||
      log.status === filter ||
      (filter === 'warning' && log.status === 'retrying');

    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return matchesFilter;

    const actionMatches = (log.action || '').toLowerCase().includes(searchLower);
    const sourceMatches = (log.source || '').toLowerCase().includes(searchLower);
    const orderIdMatches =
      (log.orderId || '').toLowerCase().includes(searchLower) ||
      (log.payload &&
        typeof log.payload.orderId === 'string' &&
        log.payload.orderId.toLowerCase().includes(searchLower));

    return matchesFilter && (actionMatches || sourceMatches || orderIdMatches);
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
        return <CheckCircle2 size={12} />;
    }
  };

  return (
    <div className="audit-log-viewer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header controls: Search, Filter pills & Refresh */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '420px' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-3)',
            }}
          />
          <input
            type="text"
            placeholder="Search events or sources…"
            aria-label="Filter audit logs by action or order ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control"
            style={{ paddingLeft: '2.4rem', fontSize: '0.85rem', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['All', 'success', 'warning', 'failed'].map((st) => (
              <button
                key={st}
                type="button"
                className="btn btn-sm"
                onClick={() => setFilter(st)}
                style={{
                  backgroundColor: filter === st ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  borderColor: filter === st ? 'var(--indigo)' : 'var(--border)',
                  color: filter === st ? 'var(--text-1)' : 'var(--text-3)',
                  textTransform: 'capitalize',
                  fontSize: '0.76rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
            title="Refresh logs"
            style={{ padding: '6px 10px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main content table / loading / error / empty */}
      {loading ? (
        <div
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: '0.9rem',
          }}
        >
          <RefreshCw
            size={24}
            className="animate-spin"
            style={{ margin: '0 auto 10px', color: 'var(--indigo)' }}
          />
          Loading immutable audit ledger…
        </div>
      ) : error ? (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--rose)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchLogs(1)}
          >
            Retry
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div
          className="empty"
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-1)' }}>
            No Audit Logs Recorded
          </p>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-3)' }}>
            Events are automatically cryptographically logged as courier webhooks and rescues occur.
          </p>
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
                  (log.payload && typeof log.payload.orderId === 'string'
                    ? log.payload.orderId
                    : '—');
                const dateObj = new Date(log.timestamp);
                const timeStr = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '';
                const dateStr = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : log.timestamp;

                return (
                  <tr key={log._id}>
                    <td className="mono" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-1)', display: 'block' }}>{timeStr}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>{dateStr}</span>
                    </td>
                    <td className="td-main" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {log.action}
                    </td>
                    <td className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                      {orderId}
                    </td>
                    <td>
                      <span
                        className="badge badge-secondary"
                        style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}
                      >
                        {log.source || 'SYSTEM'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${getStatusBadge(log.status)}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem' }}
                      >
                        {getStatusIcon(log.status)}
                        <span style={{ textTransform: 'capitalize' }}>{log.status}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedLog(log)}
                        style={{ padding: '4px 8px', fontSize: '0.74rem', gap: '4px' }}
                        aria-label="Inspect JSON payload"
                      >
                        <Eye size={13} /> Inspect JSON
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && pagination.pages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '12px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchLogs(pagination.page - 1)}
            style={{ gap: '4px' }}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-3)' }}>
            Page {pagination.page} of {pagination.pages} ({pagination.total} entries)
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pagination.page >= pagination.pages}
            onClick={() => fetchLogs(pagination.page + 1)}
            style={{ gap: '4px' }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Radix Accessible Inspect Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        {selectedLog && (
          <DialogContent style={{ maxWidth: '640px' }}>
            <DialogHeader>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '28px' }}>
                <DialogTitle style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
                  audit/{selectedLog.action}
                </DialogTitle>
                <span className={`badge ${getStatusBadge(selectedLog.status)}`}>
                  {selectedLog.status}
                </span>
              </div>
              <DialogDescription style={{ marginTop: '4px' }}>
                Recorded {new Date(selectedLog.timestamp).toLocaleString()} · Source: {selectedLog.source}
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Telemetry Payload (JSON)
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyPayload(selectedLog.payload)}
                  style={{ fontSize: '0.75rem', gap: '4px', padding: '3px 8px' }}
                >
                  {copied ? <Check size={12} color="var(--emerald)" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre
                style={{
                  background: 'var(--bg-void, #050508)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--emerald)',
                  overflowX: 'auto',
                  maxHeight: '340px',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>

              {selectedLog.error && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fca5a5',
                    fontSize: '0.82rem',
                  }}
                >
                  <strong>Error Trace:</strong> {selectedLog.error}
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default AuditLogViewer;
