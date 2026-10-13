import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Mail, PlugZap, RefreshCcw, Truck, Wallet } from 'lucide-react';
import api from '../../services/api';

/**
 * Everything the merchant has to act on, from GET /api/dashboard/attention:
 * broken connections, unconfirmed email, refunds awaiting approval, failed courier actions.
 */
interface AttentionItem {
  type: 'connection' | 'email_unverified' | 'refund' | 'courier_action';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail?: string;
  kind?: string;
  orderId?: string | null;
  orderRef?: string;
  refundStatus?: 'pending_approval' | 'approved' | 'failed';
}

const ICONS = { connection: PlugZap, email_unverified: Mail, refund: Wallet, courier_action: Truck } as const;

export const AttentionPanel: React.FC = () => {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-attention'],
    queryFn: async () => (await api.get('/api/dashboard/attention')).data as { items: AttentionItem[] },
    refetchInterval: 60_000,
  });

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setNote(null);
    try {
      await fn();
      setNote(done);
      await qc.invalidateQueries({ queryKey: ['dashboard-attention'] });
    } catch (e: any) {
      setNote(e?.response?.data?.error || e?.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const refund = (item: AttentionItem, action: 'approve' | 'mark_refunded' | 'reject') => {
    const text =
      action === 'approve'
        ? `Refund ${item.title.replace(/^Refund /, '')} for order ${item.orderRef}? Razorpay refunds go out immediately.`
        : action === 'reject'
        ? `Mark no refund owed for order ${item.orderRef}?`
        : `Confirm you already refunded order ${item.orderRef} in your gateway dashboard?`;
    if (!window.confirm(text)) return;
    return run(`${item.orderId}:${action}`, () => api.post(`/api/orders/${item.orderId}/refund`, { action }), 'Refund updated');
  };

  const items = data?.items || [];

  return (
    <section className="action-queue-card" aria-label="Needs your attention" style={{ marginBottom: 'var(--space-5, 20px)' }}>
      <div className="action-queue-card__header">
        <h2 className="action-queue-card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} aria-hidden="true" /> Needs your attention
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy === 'health'}
          onClick={() => run('health', () => api.post('/api/connect/health/check', {}), 'Connections re-checked')}
        >
          <RefreshCcw size={14} aria-hidden="true" /> {busy === 'health' ? 'Checking…' : 'Check connections'}
        </button>
      </div>

      <div style={{ padding: 'var(--space-4, 16px) var(--space-5, 20px)' }}>
        {isLoading && <p style={{ color: 'var(--text-3)', margin: 0 }}>Loading…</p>}
        {isError && <p style={{ color: 'var(--rose)', margin: 0 }}>Could not load action items.</p>}
        {!isLoading && !isError && items.length === 0 && (
          <p style={{ color: 'var(--text-3)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} color="var(--emerald)" aria-hidden="true" /> Nothing needs you right now.
          </p>
        )}
        {note && <p role="status" style={{ color: 'var(--text-2)', marginTop: 0 }}>{note}</p>}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {items.map((item, i) => {
            const Icon = ICONS[item.type];
            const color = item.severity === 'high' ? 'var(--rose)' : item.severity === 'medium' ? 'var(--amber)' : 'var(--text-3)';
            return (
              <li key={`${item.type}-${item.orderId || item.kind || i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Icon size={16} color={color} aria-hidden="true" style={{ marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{item.title}</div>
                  {item.detail && <div style={{ color: 'var(--text-3)', fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{item.detail}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {item.type === 'connection' && (
                    <a className="btn btn-ghost" href="/onboarding">Fix</a>
                  )}
                  {item.type === 'email_unverified' && (
                    <button type="button" className="btn btn-ghost" disabled={busy === 'email'}
                      onClick={() => run('email', () => api.post('/api/auth/resend-verification', {}), 'Verification email sent')}>
                      Resend link
                    </button>
                  )}
                  {item.type === 'refund' && item.orderId && (
                    <>
                      {item.refundStatus !== 'approved' && (
                        <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => refund(item, 'approve')}>Approve refund</button>
                      )}
                      <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => refund(item, 'mark_refunded')}>Already refunded</button>
                      {item.refundStatus !== 'approved' && (
                        <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => refund(item, 'reject')}>No refund</button>
                      )}
                    </>
                  )}
                  {item.type === 'courier_action' && (
                    <a className="btn btn-ghost" href="/orders">Open orders</a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default AttentionPanel;
