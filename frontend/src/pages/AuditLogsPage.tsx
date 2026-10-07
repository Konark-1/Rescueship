import React from 'react';
import { AuditLogViewer } from '../components/audit/AuditLogViewer';

export const AuditLogsPage: React.FC = () => {
  return (
    <div className="page audit-logs-page" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page header */}
      <header className="page-head" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-head__title" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
            Audit Logs &amp; Event Ledger
          </h1>
          <p className="page-head__sub" style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-3)' }}>
            Cryptographically sealed, append-only record of system webhooks, actions, and delivery events.
          </p>
        </div>
      </header>

      {/* Main Ledger Card */}
      <div
        className="panel"
        style={{
          background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg, 16px)',
          padding: '24px',
        }}
      >
        <AuditLogViewer pageSize={50} />
      </div>
    </div>
  );
};

export default AuditLogsPage;
