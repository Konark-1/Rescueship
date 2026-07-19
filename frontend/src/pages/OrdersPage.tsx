import React, { useState, useEffect } from 'react';
import api from '../services/api';

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
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status, search]);

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
  };

  const closeModal = () => setSelectedOrder(null);

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h2>Orders</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Search by Order ID or Phone" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <select 
          value={status} 
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <p>Loading Orders...</p>
      ) : (
        <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '2px solid #eee', textAlign: 'left', padding: '10px' }}>Order ID</th>
              <th style={{ borderBottom: '2px solid #eee', textAlign: 'left', padding: '10px' }}>Customer</th>
              <th style={{ borderBottom: '2px solid #eee', textAlign: 'left', padding: '10px' }}>Phone</th>
              <th style={{ borderBottom: '2px solid #eee', textAlign: 'left', padding: '10px' }}>Status</th>
              <th style={{ borderBottom: '2px solid #eee', textAlign: 'left', padding: '10px' }}>Carrier</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>No orders found</td>
              </tr>
            ) : (
              orders.map(order => (
                <tr 
                  key={order.id} 
                  onClick={() => handleRowClick(order)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
                >
                  <td style={{ padding: '10px' }}>{order.orderId}</td>
                  <td style={{ padding: '10px' }}>{order.customerName}</td>
                  <td style={{ padding: '10px' }}>{order.phone}</td>
                  <td style={{ padding: '10px' }}><span className="badge">{order.status}</span></td>
                  <td style={{ padding: '10px' }}>{order.carrier}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>Next</button>
      </div>

      {selectedOrder && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div 
            style={{ 
              backgroundColor: '#fff', padding: '30px', borderRadius: '8px', 
              width: '500px', maxHeight: '80vh', overflowY: 'auto' 
            }}
            onClick={e => e.stopPropagation()}
            className="glass-card"
          >
            <h3>Order Details - {selectedOrder.orderId}</h3>
            <div style={{ marginBottom: '15px' }}>
              <strong>Customer:</strong> {selectedOrder.customerName} <br />
              <strong>Phone:</strong> {selectedOrder.phone} <br />
              <strong>Carrier:</strong> {selectedOrder.carrier} <br />
              <strong>Status:</strong> <span className="badge">{selectedOrder.status}</span>
            </div>
            
            <h4>Timeline</h4>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {selectedOrder.timeline?.map((evt, idx) => (
                <li key={idx} style={{ marginBottom: '10px', borderLeft: '2px solid #007bff', paddingLeft: '10px' }}>
                  <div style={{ fontSize: '0.9em', color: '#666' }}>{evt.date}</div>
                  <div>{evt.event}</div>
                </li>
              ))}
              {(!selectedOrder.timeline || selectedOrder.timeline.length === 0) && (
                <li>No timeline events</li>
              )}
            </ul>
            <button onClick={closeModal} style={{ marginTop: '20px', padding: '10px 20px' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
