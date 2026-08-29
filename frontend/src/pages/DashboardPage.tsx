import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, 
  BarChart, Bar, Legend
} from 'recharts';
import { ShoppingBag, RefreshCw, ShieldCheck, DollarSign, AlertCircle, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { MotionCard } from '../components/motion/MotionCard';
import { AnimatedCounter } from '../components/motion/AnimatedCounter';
import { useRealtime } from '../hooks/useRealtime';
import { RescueMetrics } from '../components/RescueMetrics';

interface DashboardData {
  totalOrders: number;
  codToPrepaid: { count: number; conversionRate: number };
  ndrRescues: { count: number; rescueRate: number };
  revenueSaved: number;
  activeNdrCases: number;
  creditsRemaining: number;
  
  dailyConversions: { date: string; conversions: number }[];
  ndrReasons: { name: string; value: number }[];
  carrierPerformance: { carrier: string; rto: number; rescued: number }[];
  recentOrders: { id: string; customer: string; status: string; amount: number; date: string }[];
}

const mockData: DashboardData = {
  totalOrders: 12458,
  codToPrepaid: { count: 3210, conversionRate: 25.7 },
  ndrRescues: { count: 854, rescueRate: 42.3 },
  revenueSaved: 1254000,
  activeNdrCases: 142,
  creditsRemaining: 100,
  dailyConversions: [
    { date: 'Mon', conversions: 120 },
    { date: 'Tue', conversions: 150 },
    { date: 'Wed', conversions: 180 },
    { date: 'Thu', conversions: 140 },
    { date: 'Fri', conversions: 210 },
  ],
  ndrReasons: [
    { name: 'Customer Unavailable', value: 45 },
    { name: 'Address Incomplete', value: 25 },
    { name: 'Refused Delivery', value: 15 },
    { name: 'Fake Failure Remark', value: 15 },
  ],
  carrierPerformance: [
    { carrier: 'Delhivery', rto: 120, rescued: 80 },
    { carrier: 'Bluedart', rto: 50, rescued: 40 },
    { carrier: 'Xpressbees', rto: 90, rescued: 60 },
    { carrier: 'Shadowfax', rto: 30, rescued: 20 },
  ],
  recentOrders: [
    { id: 'ORD-9874', customer: 'Rahul Sharma', status: 'Delivered', amount: 1299, date: 'Today, 10:42 AM' },
    { id: 'ORD-9873', customer: 'Priya Singh', status: 'NDR Initiated', amount: 3499, date: 'Today, 09:15 AM' },
    { id: 'ORD-9872', customer: 'Amit Kumar', status: 'Converted', amount: 899, date: 'Yesterday, 04:30 PM' },
    { id: 'ORD-9871', customer: 'Sneha Gupta', status: 'RTO', amount: 2100, date: 'Yesterday, 02:10 PM' },
    { id: 'ORD-9870', customer: 'Vikram Patel', status: 'Delivered', amount: 450, date: 'Yesterday, 11:25 AM' },
  ]
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');

  const fetchAnalytics = useCallback(async () => {
      try {
        const response = await api.get('/api/analytics/dashboard');
        if (response.data && typeof response.data === 'object' && Object.keys(response.data).length > 0) {
          const apiData = response.data;
          const formattedData: DashboardData = {
            totalOrders: apiData.totalOrders ?? 0,
            codToPrepaid: {
              count: apiData.codToPrepaid?.count ?? apiData.conversionCount ?? 0,
              conversionRate: apiData.codToPrepaid?.conversionRate ?? apiData.conversionRate ?? 0,
            },
            ndrRescues: {
              count: apiData.ndrRescues?.count ?? apiData.rescuedCount ?? 0,
              rescueRate: apiData.ndrRescues?.rescueRate ?? apiData.rescueRate ?? 0,
            },
            revenueSaved: apiData.revenueSaved ?? apiData.totalRevenueSaved ?? 0,
            activeNdrCases: apiData.activeNdrCases ?? 0,
            creditsRemaining: apiData.creditsRemaining ?? 100,
            dailyConversions: Array.isArray(apiData.dailyConversions)
              ? apiData.dailyConversions
              : mockData.dailyConversions,
            ndrReasons: Array.isArray(apiData.ndrReasons)
              ? apiData.ndrReasons
              : mockData.ndrReasons,
            carrierPerformance: Array.isArray(apiData.carrierPerformance)
              ? apiData.carrierPerformance
              : mockData.carrierPerformance,
            recentOrders: Array.isArray(apiData.recentOrders)
              ? apiData.recentOrders
              : mockData.recentOrders,
          };
          setData(formattedData);
        } else {
          setData(mockData);
        }
      } catch (error) {
        console.warn("Backend not reachable or returned error, using mock data:", error);
        setData(mockData);
      } finally {
        setLoading(false);
      }
    }, []);

  const { isConnected } = useRealtime(token, {
    onOrderUpdate: () => fetchAnalytics(),
    onNdrDetected: () => fetchAnalytics(),
    onPaymentReceived: () => fetchAnalytics(),
    onStatsRefresh: () => fetchAnalytics(),
  });

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="pulse" style={{ width: '20px', height: '20px' }}></div>
        <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Loading Dashboard...</span>
      </div>
    );
  }

  const ordersUsed = 1240;
  const orderLimit = 2000;
  const usagePercentage = Math.round((ordersUsed / orderLimit) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      
      {/* Live SSE Feed Status Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444', display: 'inline-block' }} />
        <span style={{ color: 'var(--text-secondary)' }}>{isConnected ? 'Realtime Live Feed' : 'Reconnecting Feed...'}</span>
      </div>
      
      {/* 80% Limit Warning Banner */}
      {usagePercentage >= 80 && (
        <div
          className="fade-in-up"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={22} color="#ef4444" />
            <div>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Monthly Order Limit Warning</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                You have processed {ordersUsed.toLocaleString()} of {orderLimit.toLocaleString()} orders ({usagePercentage}%) this cycle.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/billing')}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
          >
            Upgrade Plan →
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="fade-in-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', animationDelay: '0ms' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Overview</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Track your e-commerce performance and NDR rescues.</p>
        </div>
        <div className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ background: 'var(--primary-glow)', padding: '0.5rem', borderRadius: '50%' }}>
            <Zap size={20} color="var(--primary)" />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Capacity</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {ordersUsed} / {orderLimit}
            </p>
          </div>
        </div>
      </div>

      {/* Pilot Rescue Metrics Widget */}
      <div className="fade-in-up">
        <RescueMetrics />
      </div>

      {/* Metric Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}
      >
        <motion.div variants={itemVariants}>
          <MetricCard 
            title="Total Orders" 
            value={data.totalOrders || 0} 
            icon={<ShoppingBag size={24} color="#6366f1" />}
            colorVar="var(--primary)"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard 
            title="COD to Prepaid" 
            value={data.codToPrepaid?.count || 0} 
            subtext={`${data.codToPrepaid?.conversionRate || 0}% Conversion Rate`}
            icon={<RefreshCw size={24} color="#a855f7" />}
            colorVar="var(--accent)"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard 
            title="NDR Rescues" 
            value={data.ndrRescues?.count || 0} 
            subtext={`${data.ndrRescues?.rescueRate || 0}% Rescue Rate`}
            icon={<ShieldCheck size={24} color="#f59e0b" />}
            colorVar="var(--warning)"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard 
            title="Revenue Saved" 
            value={((data.revenueSaved || 0) / 100000)}
            isCurrency={true}
            icon={<DollarSign size={24} color="#a855f7" />}
            colorVar="var(--success)"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard 
            title="Active NDR Cases" 
            value={data.activeNdrCases || 0} 
            icon={<AlertCircle size={24} color="#ef4444" />}
            colorVar="var(--danger)"
            pulse={true}
          />
        </motion.div>
      </motion.div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
        <div className="glass-card fade-in-up" style={{ display: 'flex', flexDirection: 'column', animationDelay: '600ms' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Daily Conversions</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyConversions || []}>
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color-glow)', borderRadius: 'var(--radius-md)', backdropFilter: 'blur(16px)', boxShadow: 'var(--shadow-glow)' }}
                  itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="conversions" stroke="var(--primary)" strokeWidth={3} filter="url(#glow)" dot={{ r: 4, fill: 'var(--bg-main)', stroke: 'var(--primary)', strokeWidth: 2 }} activeDot={{ r: 8, fill: 'var(--primary)', stroke: 'white' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card fade-in-up" style={{ display: 'flex', flexDirection: 'column', animationDelay: '700ms' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>NDR Reasons</h3>
          <div style={{ height: '300px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.ndrReasons || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {(data.ndrReasons || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)', backdropFilter: 'blur(16px)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
        
        {/* Carrier Performance */}
        <div className="glass-card fade-in-up" style={{ display: 'flex', flexDirection: 'column', animationDelay: '800ms' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Carrier Performance</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.carrierPerformance || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="carrier" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)', backdropFilter: 'blur(16px)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
                <Bar dataKey="rescued" name="Rescued" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="rto" name="RTO" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="glass-card fade-in-up" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', animationDelay: '900ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Recent Orders</h3>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => navigate('/orders')}>View All</button>
          </div>
          <div className="table-container" tabIndex={0} aria-label="Recent orders table" style={{ flex: 1, border: 'none', background: 'transparent' }}>
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ background: 'transparent', paddingLeft: 0 }}>Order ID</th>
                  <th style={{ background: 'transparent' }}>Customer</th>
                  <th style={{ background: 'transparent' }}>Status</th>
                  <th style={{ background: 'transparent', textAlign: 'right', paddingRight: 0 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(data.recentOrders || []).map((order) => (
                  <tr key={order.id}>
                    <td style={{ paddingLeft: 0, color: 'var(--indigo-soft, #818cf8)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{order.id}</td>
                    <td>
                      <div>{order.customer}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{order.date}</div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 0, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>₹{order.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
};

// Helper components & functions

const MetricCard = ({ title, value, subtext, icon, colorVar, pulse = false, isCurrency = false }: { title: string, value: number, subtext?: string, icon: React.ReactNode, colorVar: string, pulse?: boolean, isCurrency?: boolean }) => (
  <MotionCard colorVar={colorVar} pulse={pulse} style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
    {/* Background accent glow */}
    <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: colorVar, opacity: 0.1, filter: 'blur(30px)', borderRadius: '50%' }}></div>
    
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{title}</h3>
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${colorVar}30` }}>
        {icon}
      </div>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center' }}>
        {isCurrency && <span>₹</span>}
        <AnimatedCounter value={value} />
        {isCurrency && <span>L</span>}
      </div>
      {pulse && <div className="pulse" style={{ marginBottom: '0.5rem' }}></div>}
    </div>
    
    {subtext && (
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {subtext}
      </p>
    )}
  </MotionCard>
);

const getStatusBadge = (status: string) => {
  if (!status) return 'badge-secondary';
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'badge-success';
    case 'ndr initiated':
    case 'ndr_detected':
    case 'ndr_rescue_sent':
      return 'badge-warning';
    case 'rto':
      return 'badge-danger';
    case 'converted':
    case 'converted_to_prepaid':
    case 'ndr_rescued':
      return 'badge-primary';
    default:
      return 'badge-secondary';
  }
};

export default DashboardPage;
