import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { PackageSearch, AlertTriangle } from 'lucide-react';
import { TabPill } from '../components/motion/TabPill';
import ExportButton from '../components/ExportButton';
import { useOrderStore } from '../store/OrderStore';
import { RiskBadge } from '../components/RiskBadge';
import { RiskBreakdownDrawer } from '../components/RiskBreakdownDrawer';

interface OrderTimeline {
  event: string;
  date: string;
}

export interface OrderMessage {
  _id?: string;
  direction?: 'OUTBOUND' | 'INBOUND' | string;
  templateName?: string;
  body?: string;
  status?: string;
  sentAt?: string | Date;
  createdAt?: string | Date;
}

export interface OrderNdr {
  reason?: string | null;
  detectedAt?: string | Date | null;
  rescueMessagesSent?: number;
  lastMessageSentAt?: string | Date | null;
  customerResponse?: string | null;
  resolvedAt?: string | Date | null;
  resolution?: string | null;
  isFakeAttempt?: boolean;
  fakeRemarkScore?: number;
}

export interface Order {
  id: string;
  _id?: string;
  orderId: string;
  externalOrderId?: string;
  customerName: string;
  phone: string;
  customerPhone?: string;
  status: string;
  carrier: string;
  orderValue?: number;
  paymentMethod?: string;
  shippingPincode?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  failureSource?: string | null;
  attemptCount?: number;
  ndr?: OrderNdr;
  messages?: OrderMessage[];
  timeline: OrderTimeline[];
  rtoRisk?: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
    recommendedAction?: 'auto_ship' | 'whatsapp_verify' | 'require_deposit' | 'manual_review';
    scoredAt?: string | Date;
  };
}

export const FailureSourceBadge: React.FC<{ source?: string | null }> = ({ source }) => {
  if (!source) return <span className="badge badge-secondary">COURIER_REPORTED</span>;
  const s = source.toUpperCase();
  let badgeClass = 'badge-secondary';
  if (s.includes('COURIER')) badgeClass = 'badge-danger';
  else if (s.includes('CUSTOMER')) badgeClass = 'badge-warning';
  else if (s.includes('MERCHANT') || s.includes('PLATFORM')) badgeClass = 'badge-primary';
  return <span className={`badge ${badgeClass}`}>{s}</span>;
};

export const OrdersPage: React.FC = () => {
  const { orders: globalOrders, setOrders: setGlobalOrders } = useOrderStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiskOrder, setSelectedRiskOrder] = useState<Order | null>(null);
  const [metaTier, setMetaTier] = useState<{
    metaTierLimit: number;
    current24hCount: number;
    isLimitReached: boolean;
  }>({
    metaTierLimit: 1000,
    current24hCount: 0,
    isLimitReached: false,
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/orders`, {
        params: {
          page,
          limit,
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(riskFilter !== 'ALL' ? { riskLevel: riskFilter } : {}),
        }
      });
      const data = res.data;
      const list = data.orders || data.data || [];
      setOrders(list);
      if (data.metaTier) {
        setMetaTier(data.metaTier);
      }
      // Sync global store on first page load so SSE events can update rows in real-time
      if (page === 1) {
        setGlobalOrders(list);
      }
    } catch (error) {
      console.error("Failed to fetch orders", error);
    } finally {
      setLoading(false);
    }
  };

  // 🛡️ OPTIMISTIC UI: Merge local fetch with global SSE updates
  const displayOrders = useMemo(() => {
    if (page !== 1) return orders;
    return orders.map((localOrder) => {
      const globalMatch = globalOrders.find(
        (g) =>
          g._id === localOrder.id ||
          g._id === (localOrder as any)._id ||
          g.id === localOrder.id ||
          g.externalOrderId === localOrder.orderId ||
          g.orderId === localOrder.orderId
      );
      return globalMatch
        ? {
            ...localOrder,
            status: globalMatch.status,
            rtoRisk: (globalMatch as any).rtoRisk || localOrder.rtoRisk,
          }
        : localOrder;
    });
  }, [orders, globalOrders, page]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchOrders();
    }, 300);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status, search, riskFilter]);

  const [modalLoading, setModalLoading] = useState(false);

  const handleRowClick = async (order: Order) => {
    setSelectedOrder(order);
    const orderIdToFetch = order.id || (order as any)._id || order.orderId;
    if (!orderIdToFetch) return;

    setModalLoading(true);
    try {
      const res = await api.get(`/api/orders/${orderIdToFetch}`);
      const fetchedOrder = res.data?.order || res.data;
      const fetchedMessages = res.data?.messages || fetchedOrder?.messages || [];
      setSelectedOrder((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          ...fetchedOrder,
          messages: fetchedMessages,
        };
      });
    } catch (err) {
      console.error('Failed to fetch full order details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => setSelectedOrder(null);

  const getStatusBadge = (orderStatus: string) => {
    const s = orderStatus.toLowerCase();
    if (s.includes('delivered')) return 'badge-success';
    if (s.includes('ndr')) return 'badge-warning';
    if (s.includes('cancelled') || s.includes('rto')) return 'badge-danger';
    if (s.includes('shipped')) return 'badge-primary';
    return 'badge-secondary';
  };

  const getTimelineClass = (eventText: string) => {
    const s = eventText.toLowerCase();
    if (s.includes('fail') || s.includes('rto') || s.includes('cancel')) return 'timeline--bad';
    if (s.includes('deliver') || s.includes('rescue') || s.includes('convert')) return 'timeline--ok';
    return '';
  };

  const statuses = ['All Statuses', 'Pending', 'Shipped', 'Delivered', 'NDR Initiated', 'Cancelled'];

  return (
    <div className="page">
      {/* Page head */}
      <header className="page-head">
        <div>
          <h1 className="page-head__title">Orders</h1>
          <p className="page-head__sub">Monitor shipments, track delivery exceptions, and view recovery progress.</p>
        </div>
        <div className="page-head__actions">
          <ExportButton exportType="orders" label="Export orders" />
          <ExportButton exportType="ndr_report" label="NDR report" />
        </div>
      </header>

      {/* Meta Tier Hard Pre-Flight Guard Banner */}
      {metaTier.isLimitReached && (
        <div
          data-testid="meta-tier-orders-banner"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '12px 16px',
            marginBottom: 'var(--space-4, 16px)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ fontSize: '0.86rem', lineHeight: '1.4' }}>
            <strong style={{ color: '#fef2f2' }}>
              Daily Meta Tier Limit Reached ({metaTier.current24hCount}/{metaTier.metaTierLimit}):
            </strong>{' '}
            Rescues paused until 00:00 IST to protect your WABA reputation and deliverability. Manual triggers are currently restricted.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="panel">
        <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <input
              type="text"
              placeholder="Search by order ID or phone…"
              aria-label="Search by Order ID or Phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ flex: 1, minWidth: '220px', fontSize: '0.88rem' }}
            />
            <TabPill
              tabs={statuses.map(s => ({
                id: s === 'All Statuses' ? '' : s.toLowerCase(),
                label: s
              }))}
              activeTab={status}
              onChange={(id) => setStatus(id)}
              layoutId="orders-status-filter"
            />
          </div>

          {/* Risk Queue Pill Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              Risk Triage:
            </span>
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
              const isActive = riskFilter === level;
              const color =
                level === 'HIGH'
                  ? 'var(--rose, #ef4444)'
                  : level === 'MEDIUM'
                  ? 'var(--amber, #f59e0b)'
                  : level === 'LOW'
                  ? 'var(--emerald, #10b981)'
                  : 'var(--indigo-soft, #818cf8)';

              return (
                <button
                  key={level}
                  onClick={() => {
                    setRiskFilter(level);
                    setPage(1);
                  }}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                    borderColor: isActive ? color : 'var(--border)',
                    color: isActive ? color : 'var(--text-3)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: '6px',
                  }}
                >
                  {level === 'ALL' ? 'All Orders' : `${level} Risk`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">Shipments & Risk Queue</span>
          <span className="panel__aside">page {page}</span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Loading orders…
          </div>
        ) : (
          <div className="table-container" tabIndex={0} aria-label="Orders table">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>RTO Risk</th>
                  <th>Carrier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                        <span className="empty__icon"><PackageSearch size={22} /></span>
                        <p className="empty__title">No orders found</p>
                        <p className="empty__sub">Adjust your filters, or wait for the next inbound sync from your store.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence initial={false}>
                    {displayOrders.map((order) => (
                      <motion.tr
                        key={order.id || (order as any)._id || order.orderId}
                        layout
                        initial={{ opacity: 0, backgroundColor: 'rgba(99, 102, 241, 0.08)' }}
                        animate={{
                          opacity: 1,
                          backgroundColor:
                            order.rtoRisk?.level === 'HIGH' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, backgroundColor: { duration: 0.8 } }}
                        onClick={() => handleRowClick(order)}
                        style={{ cursor: 'pointer' }}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(order); }}
                      >
                        <td className="td-id">{order.orderId}</td>
                        <td className="td-main">{order.customerName}</td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{order.phone}</td>
                        <td>
                          <span className={`badge ${getStatusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <RiskBadge level={order.rtoRisk?.level} score={order.rtoRisk?.score} />
                        </td>
                        <td>{order.carrier || '—'}</td>
                        <td>
                          {order.rtoRisk && order.rtoRisk.level !== 'LOW' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRiskOrder(order);
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{
                                fontSize: '0.74rem',
                                color: order.rtoRisk.level === 'HIGH' ? 'var(--rose)' : 'var(--amber)',
                                padding: '3px 8px',
                              }}
                            >
                              Analyze
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-4)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel__body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Previous</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-3)' }}>page {page}</span>
          <button className="btn btn-ghost btn-sm" disabled={orders.length < limit} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Order detail modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="modal"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-label={`Order details ${selectedOrder.orderId}`}
            >
              <div className="modal__head">
                <span className="modal__dot modal__dot--r" />
                <span className="modal__dot modal__dot--a" />
                <span className="modal__dot modal__dot--g" />
                <span className="modal__title">order/{selectedOrder.orderId}</span>
              </div>

              <div className="modal__body">
                {modalLoading && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="animate-spin">⟳</span> Fetching latest order telemetry & messages…
                  </div>
                )}

                <dl className="dl">
                  <div><dt>Customer</dt><dd>{selectedOrder.customerName}</dd></div>
                  <div><dt>Phone</dt><dd className="mono">{selectedOrder.phone || selectedOrder.customerPhone || '—'}</dd></div>
                  <div><dt>Carrier</dt><dd>{selectedOrder.carrier || '—'}</dd></div>
                  <div><dt>Status</dt><dd><span className={`badge ${getStatusBadge(selectedOrder.status)}`}>{selectedOrder.status}</span></dd></div>
                </dl>

                {/* Section 1: 📍 Shipping Location */}
                <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-3) var(--space-4)', background: 'var(--white-02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)', margin: '0 0 var(--space-2)' }}>
                    📍 Shipping Location
                  </h4>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-1)' }}>
                    Pincode: {selectedOrder.shippingPincode || '—'} ({selectedOrder.shippingCity || 'City'}, {selectedOrder.shippingState || 'State'})
                  </div>
                </div>

                {/* Section 2: 🚨 NDR Telemetry */}
                {(selectedOrder.ndr || selectedOrder.failureSource) && (
                  <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rose)', margin: '0 0 var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🚨 NDR Telemetry</span>
                      <FailureSourceBadge source={selectedOrder.failureSource || (selectedOrder.ndr?.isFakeAttempt ? 'COURIER_REPORTED' : 'COURIER_REPORTED')} />
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)', fontSize: '0.82rem', marginTop: 'var(--space-2)' }}>
                      <div>
                        <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', display: 'block' }}>Attempts:</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{selectedOrder.attemptCount ?? 1}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', display: 'block' }}>Reason:</span>
                        <span>{selectedOrder.ndr?.reason || '—'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', display: 'block' }}>Fake Score:</span>
                        <span className="mono" style={{ fontWeight: 600, color: (selectedOrder.ndr?.fakeRemarkScore ?? 0) >= 0.7 ? 'var(--rose)' : 'var(--text-1)' }}>
                          {selectedOrder.ndr?.fakeRemarkScore !== undefined ? selectedOrder.ndr.fakeRemarkScore.toFixed(2) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: 💬 WhatsApp Conversation Timeline */}
                {selectedOrder.messages && selectedOrder.messages.length > 0 && (
                  <div style={{ marginTop: 'var(--space-5)' }}>
                    <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)', margin: '0 0 var(--space-3)' }}>
                      💬 WhatsApp Conversation Timeline
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2-5)', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                      {selectedOrder.messages.map((msg, idx) => {
                        const isOutbound = (msg.direction || 'OUTBOUND').toUpperCase() === 'OUTBOUND';
                        const timeStr = msg.sentAt || msg.createdAt ? new Date(msg.sentAt || msg.createdAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        return (
                          <div
                            key={msg._id || idx}
                            style={{
                              padding: 'var(--space-2-5) var(--space-3)',
                              borderRadius: 'var(--radius-md)',
                              background: isOutbound ? 'rgba(99, 102, 241, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                              border: `1px solid ${isOutbound ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                              alignSelf: isOutbound ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.72rem' }}>
                              <span
                                className={`badge ${isOutbound ? 'badge-primary' : 'badge-success'}`}
                                style={{ padding: '1px 6px', fontSize: '0.68rem', textTransform: 'uppercase' }}
                              >
                                {isOutbound ? 'Outbound' : 'Inbound'}
                              </span>
                              {msg.status && (
                                <span className="mono" style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>
                                  [{msg.status}]
                                </span>
                              )}
                              {timeStr && <span className="mono" style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>{timeStr}</span>}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-1)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                              {msg.body || (msg.templateName ? `Template: ${msg.templateName}` : 'Automated WhatsApp Message')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 'var(--space-6) 0 var(--space-4)' }}>
                  Interception timeline
                </h4>
                <ul className="timeline">
                  {selectedOrder.timeline?.map((evt, idx) => (
                    <li key={idx} className={getTimelineClass(evt.event)}>
                      <span className="timeline__dot" />
                      <span className="timeline__date">{evt.date}</span>
                      <div className="timeline__text">{evt.event}</div>
                    </li>
                  ))}
                  {(!selectedOrder.timeline || selectedOrder.timeline.length === 0) && (
                    <li><span className="timeline__text" style={{ color: 'var(--text-3)' }}>No timeline events recorded.</span></li>
                  )}
                </ul>
              </div>

              <div className="modal__foot">
                <button className="btn btn-ghost" onClick={closeModal}>Close</button>
                <button
                  className="btn btn-primary"
                  disabled={metaTier.isLimitReached}
                  title={metaTier.isLimitReached ? "Daily Meta Tier Limit Reached. Rescues paused until 00:00 IST to protect your WABA reputation." : undefined}
                  onClick={() => alert('Re-triggering WhatsApp Bot for ' + selectedOrder.orderId)}
                >
                  {metaTier.isLimitReached ? 'Rescue Bot Paused (Tier Limit)' : 'Re-trigger rescue bot'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RTO Risk Breakdown Slide-out Drawer */}
      <RiskBreakdownDrawer
        order={selectedRiskOrder}
        isOpen={!!selectedRiskOrder}
        onClose={() => setSelectedRiskOrder(null)}
        onActionComplete={fetchOrders}
        metaTierLimitReached={metaTier.isLimitReached}
      />
    </div>
  );
};

export default OrdersPage;
