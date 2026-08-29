import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
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

  const statuses = ['All Statuses', 'Pending', 'Shipped', 'Delivered', 'NDR Initiated', 'Cancelled'];

  return (
    <div className="glass-card fade-in-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>Orders Management</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButton exportType="orders" label="📦 Export Orders" />
          <ExportButton exportType="ndr_report" label="🚚 NDR Report" />
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Search by Order ID or Phone" 
          aria-label="Search by Order ID or Phone"
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="form-control"
          style={{ flex: 1, minWidth: '200px' }}
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

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="pulse" style={{ display: 'inline-block', marginRight: '1rem' }}></div>
          Loading Orders...
        </div>
      ) : (
        <div className="table-container" tabIndex={0} aria-label="Orders table">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Carrier</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No orders found</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr 
                    key={order.id} 
                    onClick={() => handleRowClick(order)}
                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--indigo-soft, #818cf8)' }}>{order.orderId}</td>
                    <td>{order.customerName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{order.phone}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(order.status)}`} style={{ position: 'relative' }}>
                        {order.status.toLowerCase() === 'ndr initiated' && (
                          <span className="pulse" style={{ position: 'absolute', top: '-4px', right: '-4px', width: '6px', height: '6px' }}></span>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Page {page}</span>
        <button className="btn btn-secondary" disabled={orders.length < limit} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>

      {/* Glassmorphism Dark Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
              display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }}
            onClick={closeModal}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card"
              style={{ 
                width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto',
                border: '1px solid var(--border-color-glow)',
                boxShadow: 'var(--shadow-glow)', padding: '2rem'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', color: 'var(--primary)' }}>Order Details - {selectedOrder.orderId}</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <span className="form-label">Customer</span>
                  <div style={{ color: 'var(--text-primary)', marginTop: '0.25rem' }}>{selectedOrder.customerName}</div>
                </div>
                <div>
                  <span className="form-label">Phone</span>
                  <div style={{ color: 'var(--text-primary)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>{selectedOrder.phone}</div>
                </div>
                <div>
                  <span className="form-label">Carrier</span>
                  <div style={{ color: 'var(--text-primary)', marginTop: '0.25rem' }}>{selectedOrder.carrier}</div>
                </div>
                <div>
                  <span className="form-label">Status</span>
                  <div style={{ marginTop: '0.25rem' }}><span className={`badge ${getStatusBadge(selectedOrder.status)}`}>{selectedOrder.status}</span></div>
                </div>
              </div>
              
              <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline</h4>
              <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--border-color)' }}></div>
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {selectedOrder.timeline?.map((evt, idx) => (
                    <li key={idx} style={{ position: 'relative', marginBottom: '1.5rem' }}>
                      <div style={{ position: 'absolute', left: '-1.5rem', top: '0.25rem', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--bg-main)', border: '2px solid var(--primary)', zIndex: 1 }}></div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{evt.date}</div>
                      <div style={{ color: 'var(--text-primary)', marginTop: '0.25rem' }}>{evt.event}</div>
                    </li>
                  ))}
                  {(!selectedOrder.timeline || selectedOrder.timeline.length === 0) && (
                    <li style={{ color: 'var(--text-muted)' }}>No timeline events recorded.</li>
                  )}
                </ul>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={() => {
                  // Stub action to re-trigger bot
                  alert('Re-triggering WhatsApp Bot for ' + selectedOrder.orderId);
                }}>Re-trigger WhatsApp Bot</button>
                <button className="btn btn-secondary" onClick={closeModal}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrdersPage;
