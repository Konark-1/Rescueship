import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { PackageSearch } from 'lucide-react';
import { TabPill } from '../components/motion/TabPill';
import ExportButton from '../components/ExportButton';

interface OrderTimeline {
  event: string;
  date: string;
}

interface Order {
  id: string;
  orderId: string;
  customerName: string;
  phone: string;
  status: string;
  carrier: string;
  timeline: OrderTimeline[];
}

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/orders`, {
        params: {
          page,
          limit,
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
        }
      });
      const data = res.data;
      setOrders(data.orders || data.data || []);
    } catch (error) {
      console.error("Failed to fetch orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchOrders();
    }, 300);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status, search]);

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
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
          <p className="page-head__kicker">02 · Fleet registry</p>
          <h1 className="page-head__title">Order <em>manifest</em></h1>
          <p className="page-head__sub">Every shipment, its live rescue state, and the interception timeline.</p>
        </div>
        <div className="page-head__actions">
          <ExportButton exportType="orders" label="Export orders" />
          <ExportButton exportType="ndr_report" label="NDR report" />
        </div>
      </header>

      {/* Filters */}
      <div className="panel">
        <div className="panel__body" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <input
            type="text"
            placeholder="Search by order ID or phone…"
            aria-label="Search by Order ID or Phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control"
            style={{ flex: 1, minWidth: '220px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
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
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title"><i aria-hidden="true" />Shipments</span>
          <span className="panel__aside">page {page}</span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)' }}>
            <span className="pulse" /> fetching manifest…
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
                  <th>Carrier</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                        <span className="empty__icon"><PackageSearch size={22} /></span>
                        <p className="empty__title">No orders found</p>
                        <p className="empty__sub">Adjust your filters, or wait for the next inbound sync from your store.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => handleRowClick(order)}
                      style={{ cursor: 'pointer' }}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(order); }}
                    >
                      <td className="td-id">{order.orderId}</td>
                      <td className="td-main">{order.customerName}</td>
                      <td className="mono" style={{ fontSize: '0.8rem' }}>{order.phone}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(order.status)}`} style={{ position: 'relative' }}>
                          {order.status.toLowerCase() === 'ndr initiated' && (
                            <span className="pulse" style={{ position: 'absolute', top: '-4px', right: '-4px', width: '6px', height: '6px' }} />
                          )}
                          {order.status}
                        </span>
                      </td>
                      <td>{order.carrier}</td>
                    </tr>
                  ))
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
                <dl className="dl">
                  <div><dt>Customer</dt><dd>{selectedOrder.customerName}</dd></div>
                  <div><dt>Phone</dt><dd className="mono">{selectedOrder.phone}</dd></div>
                  <div><dt>Carrier</dt><dd>{selectedOrder.carrier}</dd></div>
                  <div><dt>Status</dt><dd><span className={`badge ${getStatusBadge(selectedOrder.status)}`}>{selectedOrder.status}</span></dd></div>
                </dl>

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
                <button className="btn btn-primary" onClick={() => alert('Re-triggering WhatsApp Bot for ' + selectedOrder.orderId)}>
                  Re-trigger rescue bot
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrdersPage;
