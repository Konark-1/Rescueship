import type { FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Order } from '../store/OrderStore';
import api from '../services/api';

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
  metaTierLimitReached?: boolean;
}

export const RiskBreakdownDrawer: FC<Props> = ({ order, isOpen, onClose, onActionComplete, metaTierLimitReached = false }) => {
  if (!order || !order.rtoRisk) return null;

  const risk = order.rtoRisk;
  const gaugeColor =
    risk.level === 'HIGH'
      ? 'var(--rose, #ef4444)'
      : risk.level === 'MEDIUM'
      ? 'var(--amber, #f59e0b)'
      : 'var(--emerald, #10b981)';

  const handleAction = async (action: string) => {
    const targetId = order._id || order.id;
    if (!targetId) return;

    try {
      await api.post(`/api/orders/${targetId}/risk-action`, { action });
      onActionComplete();
      onClose();
    } catch (err) {
      console.error('Risk action failed', err);
      alert('Failed to execute action. Please try again.');
    }
  };

  const formatFactor = (factor: string) =>
    factor.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              zIndex: 100,
              backdropFilter: 'blur(3px)',
            }}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '440px',
              maxWidth: '92vw',
              backgroundColor: 'var(--bg-card, #0d0e15)',
              borderLeft: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-16px 0 40px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text-1, #f8fafc)',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  RTO Risk Analysis
                </h2>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-3, #94a3b8)',
                    margin: '3px 0 0 0',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  Order #{order.externalOrderId || order.orderId}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close Drawer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3, #94a3b8)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
              {/* Score Gauge */}
              <div
                style={{
                  marginBottom: '1.75rem',
                  textAlign: 'center',
                  padding: '1.5rem',
                  backgroundColor: 'var(--bg-void, #050508)',
                  borderRadius: '12px',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                }}
              >
                <div
                  style={{
                    fontSize: '3.25rem',
                    fontWeight: 800,
                    color: gaugeColor,
                    lineHeight: 1,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {risk.score}
                  <span style={{ fontSize: '1.15rem', color: 'var(--text-3, #6b7280)', fontWeight: 500 }}>
                    /100
                  </span>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: gaugeColor,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${gaugeColor}40`,
                    marginTop: '0.9rem',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  <AlertTriangle size={13} />
                  {risk.level} RISK DETECTED
                </div>
              </div>

              {/* Order quick overview */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '1.75rem',
                  padding: '12px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.72rem' }}>Customer</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{order.customerName || '—'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.72rem' }}>Order Value</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>₹{order.orderValue || 0}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.72rem' }}>Payment Method</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 600, textTransform: 'uppercase' }}>{order.paymentMethod || 'COD'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.72rem' }}>Phone</span>
                  <span style={{ color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{order.phone || order.customerPhone || '—'}</span>
                </div>
              </div>

              {/* Risk Factors */}
              <div>
                <h3
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: 'var(--text-2, #e2e8f0)',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  Triggered Risk Factors
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {!risk.factors || risk.factors.length === 0 ? (
                    <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>No major risk factors detected.</p>
                  ) : (
                    risk.factors.map((factor, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          backgroundColor: 'var(--bg-void, #050508)',
                          color: 'var(--text-2)',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                        }}
                      >
                        <div
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: gaugeColor,
                            flexShrink: 0,
                          }}
                        />
                        <span>{formatFactor(factor)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-card, #0d0e15)',
              }}
            >
              <h3
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-3, #94a3b8)',
                  marginBottom: '0.2rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                Recommended Actions
              </h3>

              {risk.level === 'MEDIUM' && (
                <button
                  disabled={metaTierLimitReached}
                  title={metaTierLimitReached ? "Daily Meta Tier Limit Reached. Rescues paused until 00:00 IST to protect your WABA reputation." : undefined}
                  onClick={() => handleAction('whatsapp_verify')}
                  className="btn btn-warning"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: metaTierLimitReached ? 0.6 : 1,
                    cursor: metaTierLimitReached ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MessageSquare size={15} /> {metaTierLimitReached ? 'WhatsApp Paused (Tier Limit)' : 'Send WhatsApp Confirmation'}
                </button>
              )}

              {risk.level === 'HIGH' && (
                <>
                  <button
                    disabled={metaTierLimitReached}
                    title={metaTierLimitReached ? "Daily Meta Tier Limit Reached. Rescues paused until 00:00 IST to protect your WABA reputation." : undefined}
                    onClick={() => handleAction('require_deposit')}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: metaTierLimitReached ? 0.6 : 1,
                      cursor: metaTierLimitReached ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <CreditCard size={15} /> {metaTierLimitReached ? 'Deposit Request Paused (Tier Limit)' : 'Request ₹100 Partial Deposit'}
                  </button>
                  <button
                    onClick={() => handleAction('manual_review_approve')}
                    className="btn btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', gap: '8px', border: '1px solid var(--border)' }}
                  >
                    <CheckCircle2 size={15} /> Approve & Ship Anyway
                  </button>
                </>
              )}

              {risk.level === 'LOW' && (
                <button
                  onClick={onClose}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Close Analysis
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
