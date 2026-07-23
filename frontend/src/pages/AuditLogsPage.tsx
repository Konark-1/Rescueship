import { useState } from 'react';
import { Search, Eye, AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TabPill } from '../components/motion/TabPill';

interface AuditLog {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  status: string;
  payload: string;
}

const mockLogs: AuditLog[] = [
  { id: 'evt_1', timestamp: '2026-07-22T08:12:34Z', type: 'order.created', source: 'Shopify Webhook', status: 'Success', payload: '{"order_id": 1001, "customer": "John Doe", "total": 120.50}' },
  { id: 'evt_2', timestamp: '2026-07-22T08:15:02Z', type: 'message.sent', source: 'WhatsApp API', status: 'Success', payload: '{"to": "+1234567890", "template": "rto_warning", "status": "delivered"}' },
  { id: 'evt_3', timestamp: '2026-07-22T08:20:10Z', type: 'shipment.updated', source: 'Carrier Callback', status: 'Warning', payload: '{"tracking_id": "AWB123", "status": "delayed", "reason": "weather"}' },
  { id: 'evt_4', timestamp: '2026-07-22T08:45:00Z', type: 'webhook.failed', source: 'Custom API', status: 'Error', payload: '{"error": "timeout", "endpoint": "https://api.merchant.com/webhook"}' },
  { id: 'evt_5', timestamp: '2026-07-22T09:00:12Z', type: 'order.cancelled', source: 'Shopify Webhook', status: 'Success', payload: '{"order_id": 1002, "reason": "customer_request"}' },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Success': return <CheckCircle2 size={16} className="text-green-500" style={{ color: '#10b981' }} />;
    case 'Warning': return <AlertTriangle size={16} className="text-yellow-500" style={{ color: '#f59e0b' }} />;
    case 'Error': return <AlertCircle size={16} className="text-red-500" style={{ color: '#ef4444' }} />;
    default: return <CheckCircle2 size={16} />;
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'Success': return { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' };
    case 'Warning': return { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' };
    case 'Error': return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
    default: return {};
  }
};

const AuditLogsPage = () => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const filteredLogs = mockLogs.filter(log => {
    const matchesFilter = filter === 'All' || log.status === filter;
    const matchesSearch = log.type.toLowerCase().includes(search.toLowerCase()) || log.source.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const severityTabs = [
    { id: 'All', label: 'All' },
    { id: 'Success', label: 'Success' },
    { id: 'Warning', label: 'Warning' },
    { id: 'Error', label: 'Error' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>System Audit Logs</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Monitor real-time events, API requests, and webhook deliveries.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', position: 'relative', flex: 1, minWidth: '250px', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search events or sources..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', 
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' 
            }}
          />
        </div>
        <TabPill tabs={severityTabs} activeTab={filter} onChange={setFilter} />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Timestamp</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Event Type</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Trigger Source</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{log.type}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{log.source}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.375rem', 
                      padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 500,
                      ...getStatusStyle(log.status)
                    }}>
                      {getStatusIcon(log.status)}
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => setSelectedLog(log)}
                      style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                        padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    >
                      <Eye size={16} /> View JSON
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No logs found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
              padding: '1rem'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '600px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden'
              }}
            >
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Event Payload</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedLog.id} • {selectedLog.type}</span>
                </div>
                <button 
                  onClick={() => { setSelectedLog(null); setCopied(false); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.3)' }}>
                <pre style={{ 
                  margin: 0, padding: '1rem', background: '#0d1117', borderRadius: 'var(--radius-sm)',
                  overflowX: 'auto', color: '#e6edf3', fontSize: '0.875rem', border: '1px solid #30363d',
                  fontFamily: 'monospace'
                }}>
                  {JSON.stringify(JSON.parse(selectedLog.payload), null, 2)}
                </pre>
              </div>
              <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => { 
                    navigator.clipboard.writeText(selectedLog.payload); 
                    setCopied(true);
                    showToast('JSON Payload copied to clipboard!');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    background: copied ? 'var(--success)' : 'var(--primary)', color: 'black', border: 'none',
                    padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
                  }}
                >
                  {copied ? <><CheckCircle2 size={16} /> Copied</> : 'Copy Payload'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--success-glow)', border: '1px solid var(--success)', color: 'var(--success)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 2000, boxShadow: 'var(--shadow-glow)', animation: 'fadeInUp 0.3s ease-out' }}>
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 500 }}>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
