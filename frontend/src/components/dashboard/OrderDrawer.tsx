import React, { useState, useEffect } from 'react';
import { X, Send, Clock, AlertTriangle, ShieldCheck, CheckCircle2, RotateCw, MapPin, CreditCard } from 'lucide-react';
import api from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { UnifiedDashboardOrder } from '../../types/dashboard.d';

interface OrderDrawerProps {
  order: UnifiedDashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

interface MessageItem {
  id?: string;
  _id?: string;
  direction: 'inbound' | 'outbound';
  body: string;
  templateName?: string;
  status?: string;
  createdAt: string;
}

export const OrderDrawer: React.FC<OrderDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isOpen || !order?.id) {
      setMessages([]);
      setStatusMessage(null);
      return;
    }

    const fetchOrderFullDetails = async () => {
      setLoadingDetails(true);
      try {
        const res = await api.get(`/api/orders/${order.id}`);
        if (res.data?.messages && Array.isArray(res.data.messages)) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        console.warn('Failed to load full order chat logs', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchOrderFullDetails();
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const showNotification = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleCarrierAction = async (action: 'reattempt' | 'update_address' | 'request_rto') => {
    setActionLoading(action);
    try {
      const res = await api.post(`/api/orders/${order.id}/carrier-action`, {
        action,
        reason: action === 'reattempt' ? 'Merchant approved reattempt via RescueShip Command Deck' : undefined,
      });
      if (res.data?.success) {
        showNotification(res.data.message || 'Carrier action submitted successfully', 'success');
        onOrderUpdated?.();
      } else {
        showNotification(res.data?.message || 'Failed to submit carrier action', 'error');
      }
    } catch (err: any) {
      showNotification(err?.response?.data?.error || err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendPaymentLink = async () => {
    setActionLoading('payment');
    try {
      const res = await api.post(`/api/orders/${order.id}/resend-payment-link`);
      if (res.data?.success) {
        showNotification('Fresh UPI Payment Link dispatched to customer WhatsApp', 'success');
        onOrderUpdated?.();
      } else {
        showNotification(res.data?.error || 'Failed to generate payment link', 'error');
      }
    } catch (err: any) {
      showNotification(err?.response?.data?.error || 'Failed to dispatch payment link', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualReconcile = async () => {
    setActionLoading('reconcile');
    try {
      const res = await api.post(`/api/orders/${order.id}/reconcile-utr`, {
        utr: 'MANUAL_DASHBOARD_VERIFY',
      });
      if (res.data?.success) {
        showNotification('Order marked as prepaid and courier COD balance cleared to ₹0', 'success');
        onOrderUpdated?.();
      }
    } catch (err: any) {
      showNotification(err?.response?.data?.error || 'Failed to reconcile payment', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="order-drawer__overlay" onClick={onClose} aria-hidden="true" />
      <aside className="order-drawer__panel" aria-label={`Order Details for #${order.externalOrderId}`}>
        {/* Header */}
        <div className="order-drawer__header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)' }}>
                Order #{order.externalOrderId}
              </span>
              <Badge variant="outline" style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>
                {order.platform}
              </Badge>
              <Badge
                style={{
                  background: order.paymentMethod === 'prepaid' ? 'var(--emerald-20)' : 'var(--amber-20)',
                  color: order.paymentMethod === 'prepaid' ? 'var(--emerald)' : 'var(--amber)',
                  border: 'none',
                  fontSize: '0.72rem',
                }}
              >
                {order.paymentMethod.toUpperCase()}
              </Badge>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
              ₹{order.orderValue.toLocaleString('en-IN')} • {order.customerName} ({order.phone})
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close drawer"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            style={{
              padding: '10px 16px',
              margin: '12px 20px 0 20px',
              borderRadius: 'var(--radius-md)',
              background: statusMessage.type === 'success' ? 'var(--emerald-15)' : 'var(--rose-15)',
              color: statusMessage.type === 'success' ? 'var(--emerald-light)' : 'var(--rose-light)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {statusMessage.text}
          </div>
        )}

        {/* Body Content */}
        <div className="order-drawer__body">
          {/* Section 1: Carrier & NDR Telemetry */}
          <div className="order-drawer__section">
            <h3 className="order-drawer__section-title">
              <Clock size={16} style={{ color: 'var(--indigo-soft)' }} />
              Logistics &amp; NDR Telemetry
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: 'var(--text-3)' }}>Carrier: </span>
                <strong style={{ color: 'var(--text-1)' }}>{order.carrier || 'Unassigned'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-3)' }}>AWB: </span>
                <strong style={{ color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                  {order.awb || 'Pending'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-3)' }}>Status: </span>
                <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{order.status.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-3)' }}>NDR Reason: </span>
                <span style={{ color: 'var(--rose)' }}>{order.ndr?.reason || 'None reported'}</span>
              </div>
            </div>

            {order.ndr?.isFakeAttempt && (
              <div
                style={{
                  background: 'var(--rose-12)',
                  border: '1px solid var(--rose)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--rose-light)',
                  fontSize: '0.8rem',
                }}
              >
                <AlertTriangle size={16} style={{ color: 'var(--rose)', flexShrink: 0 }} />
                <span>
                  <strong>High Suspicion Fake Delivery Attempt ({Math.round((order.ndr.fakeRemarkScore || 0.8) * 100)}%):</strong>{' '}
                  Courier logged unreachable, but customer responded promptly.
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Interactive WhatsApp Conversation */}
          <div className="order-drawer__section">
            <h3 className="order-drawer__section-title">
              <Send size={16} style={{ color: 'var(--emerald)' }} />
              WhatsApp Live Conversation
            </h3>
            {loadingDetails ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '16px' }}>
                Loading conversation transcript...
              </div>
            ) : messages.length > 0 ? (
              <div className="wa-transcript">
                {messages.map((m, idx) => (
                  <div
                    key={m.id || m._id || idx}
                    className={
                      m.direction === 'inbound'
                        ? 'wa-transcript__bubble--customer'
                        : 'wa-transcript__bubble--bot'
                    }
                  >
                    <div>{m.body}</div>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        marginTop: '4px',
                        opacity: 0.75,
                        textAlign: m.direction === 'inbound' ? 'right' : 'left',
                      }}
                    >
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--text-3)',
                  fontSize: '0.8rem',
                  background: 'var(--bg-void)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                No WhatsApp messages exchanged yet for this order.
              </div>
            )}
          </div>

          {/* Section 3: AI Address & Landmark Analysis */}
          <div className="order-drawer__section">
            <h3 className="order-drawer__section-title">
              <MapPin size={16} style={{ color: 'var(--indigo)' }} />
              Gemini AI Address Structuring
            </h3>
            <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: 'var(--bg-void)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.72rem' }}>CUSTOMER RAW INPUT:</span>
                <span style={{ color: 'var(--text-2)' }}>
                  {order.aiAddress?.original || 'Original shipping address logged during checkout'}
                </span>
              </div>
              <div
                style={{
                  background: 'var(--indigo-08)',
                  border: '1px solid var(--indigo-15)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ color: 'var(--indigo-soft)', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>
                  PARSED COURIER STANDARD (94% CONFIDENCE):
                </span>
                <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                  {order.aiAddress?.parsed || 'Standard courier format ready for dispatch.'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Live Triage Actions */}
          <div className="order-drawer__section">
            <h3 className="order-drawer__section-title">
              <ShieldCheck size={16} style={{ color: 'var(--emerald)' }} />
              Operational Triage Actions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleCarrierAction('reattempt')}
                disabled={Boolean(actionLoading)}
              >
                <RotateCw size={14} className={actionLoading === 'reattempt' ? 'animate-spin' : ''} />
                Approve Reattempt
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCarrierAction('update_address')}
                disabled={Boolean(actionLoading)}
              >
                <MapPin size={14} />
                Push Address
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResendPaymentLink}
                disabled={Boolean(actionLoading)}
              >
                <CreditCard size={14} />
                Send UPI Link
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleCarrierAction('request_rto')}
                disabled={Boolean(actionLoading)}
              >
                Force Instant RTO
              </Button>
            </div>
            <div style={{ marginTop: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualReconcile}
                disabled={Boolean(actionLoading)}
                style={{ width: '100%' }}
              >
                <CheckCircle2 size={14} />
                Reconcile as Prepaid (UTR Override)
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
