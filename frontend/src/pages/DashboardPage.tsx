import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, Legend
} from 'recharts';
import { ShoppingBag, RefreshCw, ShieldCheck, IndianRupee, AlertCircle, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const EMPTY_DATA: DashboardData = {
  totalOrders: 0,
  codToPrepaid: { count: 0, conversionRate: 0 },
  ndrRescues: { count: 0, rescueRate: 0 },
  revenueSaved: 0,
  activeNdrCases: 0,
  creditsRemaining: 0,
  dailyConversions: [],
  ndrReasons: [],
  carrierPerformance: [],
  recentOrders: [],
};

const COLORS = ['var(--indigo)', 'var(--emerald)', 'var(--amber)', 'var(--rose)'];

const chartTooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-deep)',
  border: '1px solid var(--border-hover)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.78rem',
  boxShadow: '0 12px 32px var(--black-60)',
};

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [usage, setUsage] = useState<{ ordersUsed: number; orderLimit: number }>({ ordersUsed: 0, orderLimit: 0 });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const onboardingSkipped = user?.onboardingStatus === 'skipped';

  const token = localStorage.getItem('token');

  const fetchAnalytics = useCallback(async () => {
    try {
      const [analyticsRes, planRes] = await Promise.allSettled([
        api.get('/api/analytics/dashboard'),
        api.get('/api/billing/plan'),
      ]);

      if (analyticsRes.status === 'fulfilled') {
        const apiData = analyticsRes.value.data;
        if (apiData && typeof apiData === 'object' && Object.keys(apiData).length > 0) {
          setData({
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
            creditsRemaining: apiData.creditsRemaining ?? 0,
            dailyConversions: Array.isArray(apiData.dailyConversions) ? apiData.dailyConversions : [],
            ndrReasons: Array.isArray(apiData.ndrReasons) ? apiData.ndrReasons : [],
            carrierPerformance: Array.isArray(apiData.carrierPerformance) ? apiData.carrierPerformance : [],
            recentOrders: Array.isArray(apiData.recentOrders) ? apiData.recentOrders : [],
          });
        } else {
          setData(EMPTY_DATA);
        }
        setFetchError(null);
      } else {
        setData(prev => prev ?? EMPTY_DATA);
        setFetchError('Live telemetry is unreachable — showing last known state.');
      }

      if (planRes.status === 'fulfilled' && planRes.value.data) {
        setUsage({
          ordersUsed: planRes.value.data.currentMonthOrders ?? 0,
          orderLimit: planRes.value.data.planOrderLimit ?? 0,
        });
      }
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-4)', minHeight: '60vh', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        <span className="pulse" />
        loading telemetry…
      </div>
    );
  }

  const { ordersUsed, orderLimit } = usage;
  const usagePercentage = orderLimit > 0 ? Math.round((ordersUsed / orderLimit) * 100) : 0;

  return (
    <div className="page">

      {/* Page head */}
      <header className="page-head">
        <div>
          <p className="page-head__kicker">01 · Overview</p>
          <h1 className="page-head__title">Command <em>deck</em></h1>
          <p className="page-head__sub">Live NDR telemetry, conversion performance and rescued revenue for your store.</p>
        </div>
        <div className="page-head__actions">
          <span className={`chip ${isConnected ? '' : 'chip--bad'}`}>
            <i aria-hidden="true" style={{ background: isConnected ? 'var(--emerald)' : 'var(--rose)' }} />
            {isConnected ? 'realtime feed · live' : 'reconnecting feed…'}
          </span>
        </div>
      </header>

      {/* Onboarding skipped — engine is dormant until connections are live */}
      {onboardingSkipped && (
        <div className="alert alert--bad fade-in-up" role="alert" style={{ borderColor: 'var(--amber)' }}>
          <div className="alert__main">
            <AlertCircle size={20} color="var(--amber)" />
            <div>
              <p className="alert__title">Setup unfinished — the rescue engine is off</p>
              <p className="alert__text">Connect your store, WhatsApp, courier and payments to start recovering RTO revenue. Takes ~10 minutes.</p>
            </div>
          </div>
          <button onClick={() => navigate('/onboarding')} className="btn btn-primary btn-sm">Resume setup →</button>
        </div>
      )}

      {/* Live-data warning banner */}
      {fetchError && (
        <div className="alert alert--bad fade-in-up" role="alert">
          <div className="alert__main">
            <AlertCircle size={20} color="var(--rose)" />
            <div>
              <p className="alert__title">Telemetry offline</p>
              <p className="alert__text">{fetchError}</p>
            </div>
          </div>
          <button onClick={() => { setLoading(true); fetchAnalytics(); }} className="btn btn-secondary btn-sm">Retry</button>
        </div>
      )}

      {/* Usage limit warning */}
      {orderLimit > 0 && usagePercentage >= 80 && (
        <div className="alert alert--bad fade-in-up">
          <div className="alert__main">
            <AlertCircle size={20} color="var(--rose)" />
            <div>
              <p className="alert__title">Monthly order limit warning</p>
              <p className="alert__text">
                {ordersUsed.toLocaleString()} of {orderLimit.toLocaleString()} orders processed this cycle ({usagePercentage}%).
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/billing')} className="btn btn-primary btn-sm">Upgrade plan →</button>
        </div>
      )}

      {/* Order capacity ledger */}
      {orderLimit > 0 && (
        <div className="panel panel--accent fade-in-up">
          <div className="panel__head">
            <span className="panel__title"><Zap size={12} aria-hidden="true" /> Order capacity</span>
            <span className="panel__aside">{usagePercentage}% consumed</span>
          </div>
          <div className="panel__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
            <div className="meter" style={{ flex: 1 }} data-warn={usagePercentage >= 80 || undefined}>
              <div className="meter__fill" style={{ width: `${usagePercentage}%`, background: usagePercentage >= 80 ? 'linear-gradient(90deg, var(--amber), var(--rose))' : undefined }} />
            </div>
            <span style={{ fontFamily: 'var(--font-num)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {ordersUsed.toLocaleString()} / {orderLimit.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Pilot rescue metrics */}
      <RescueMetrics />

      {/* Stat cards */}
      <motion.section
        className="stat-grid"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
        aria-label="Key metrics"
      >
        <StatCard
          tone="stat--indigo"
          label="Total orders"
          value={data.totalOrders || 0}
          icon={<ShoppingBag size={15} />}
        />
        <StatCard
          tone="stat--violet"
          label="COD → prepaid"
          value={data.codToPrepaid?.count || 0}
          sub={<><TrendingUp size={12} color="var(--emerald)" /><span className="pos">{data.codToPrepaid?.conversionRate || 0}% conversion rate</span></>}
          icon={<RefreshCw size={15} />}
        />
        <StatCard
          tone="stat--amber"
          label="NDR rescues"
          value={data.ndrRescues?.count || 0}
          sub={<span className="pos">{data.ndrRescues?.rescueRate || 0}% rescue rate</span>}
          icon={<ShieldCheck size={15} />}
        />
        <StatCard
          tone="stat--emerald"
          label="Revenue saved"
          value={Math.round((data.revenueSaved || 0) / 100000 * 10) / 10}
          prefix="₹"
          suffix="L"
          icon={<IndianRupee size={15} />}
        />
        <StatCard
          tone="stat--rose"
          label="Active NDR cases"
          value={data.activeNdrCases || 0}
          live={(data.activeNdrCases || 0) > 0}
          icon={<AlertCircle size={15} />}
        />
      </motion.section>

      {/* Charts row */}
      <section className="dash-grid dash-grid--main">
        <div className="panel fade-in-up">
          <div className="panel__head">
            <span className="panel__title"><i aria-hidden="true" />Daily conversions</span>
            <span className="panel__aside">last 7 days</span>
          </div>
          <div className="panel__body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyConversions || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--white-06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  cursor={{ stroke: 'var(--white-10)', strokeWidth: 1 }}
                  contentStyle={chartTooltipStyle}
                  itemStyle={{ color: 'var(--indigo-soft)' }}
                />
                <Line type="monotone" dataKey="conversions" stroke="var(--indigo)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-void)', stroke: 'var(--indigo)', strokeWidth: 2 }} activeDot={{ r: 7, fill: 'var(--indigo)', stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel fade-in-up">
          <div className="panel__head">
            <span className="panel__title"><i aria-hidden="true" />NDR reasons</span>
            <span className="panel__aside">share of failures</span>
          </div>
          <div className="panel__body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.ndrReasons || []}
                  cx="50%"
                  cy="46%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {(data.ndrReasons || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={chartTooltipStyle} itemStyle={{ color: 'var(--text-1)' }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Bottom row */}
      <section className="dash-grid">
        <div className="panel fade-in-up">
          <div className="panel__head">
            <span className="panel__title"><i aria-hidden="true" />Carrier performance</span>
            <span className="panel__aside">rescued vs. rto</span>
          </div>
          <div className="panel__body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.carrierPerformance || []} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--white-06)" vertical={false} />
                <XAxis dataKey="carrier" tick={{ fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: 'var(--white-03)' }} contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }} />
                <Bar dataKey="rescued" name="Rescued" fill="var(--emerald)" radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Bar dataKey="rto" name="RTO" fill="var(--rose)" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel fade-in-up" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel__head">
            <span className="panel__title"><i aria-hidden="true" />Recent orders</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>View all →</button>
          </div>
          <div className="table-container" tabIndex={0} aria-label="Recent orders table">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(data.recentOrders || []).map((order) => (
                  <tr key={order.id}>
                    <td className="td-id">{order.id}</td>
                    <td>
                      <div className="td-main">{order.customer}</div>
                      <div className="td-meta">{order.date}</div>
                    </td>
                    <td><span className={`badge ${getStatusBadge(order.status)}`}>{order.status}</span></td>
                    <td className="td-num">₹{order.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ── Stat card ── */
interface StatCardProps {
  tone: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  live?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ tone, label, value, prefix, suffix, sub, icon, live }) => (
  <motion.div
    className={`stat ${tone}`}
    variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
  >
    <div className="stat__top">
      <span className="stat__label">{label}</span>
      <span className="stat__icon">{icon}</span>
    </div>
    <div className="stat__value">
      {prefix && <small>{prefix}</small>}
      <AnimatedCounter value={value} />
      {suffix && <small>{suffix}</small>}
      {live && <span className="pulse" style={{ alignSelf: 'center', marginLeft: 'var(--space-2)' }} />}
    </div>
    {sub && <p className="stat__sub">{sub}</p>}
  </motion.div>
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
