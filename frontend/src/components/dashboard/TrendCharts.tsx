import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardTitle, CardDescription } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export interface DailyTrendItem {
  date: string;
  rescued: number;
  rto: number;
}

export interface NdrReasonItem {
  name: string;
  value: number;
  color?: string;
}

interface TrendChartsProps {
  trendData?: DailyTrendItem[];
  reasonsData?: NdrReasonItem[];
  roiChartData?: Array<{ period: string; saved: number }>;
  loading?: boolean;
}

const REASON_COLORS: Record<string, string> = {
  'Fake Attempt': '#f43f5e',
  'Fake Attempt / Courier Fraud': '#f43f5e',
  'Incomplete Address': '#f59e0b',
  'Customer Unavailable': '#38bdf8',
  'Customer Refused COD': '#a78bfa',
  'Customer Refused': '#a78bfa',
  'Out of Delivery Area': '#6366f1',
  'Other / Miscellaneous': '#64748b',
};

const DEFAULT_COLORS = ['#f43f5e', '#f59e0b', '#38bdf8', '#a78bfa', '#6366f1', '#10b981', '#64748b'];

export const TrendCharts: React.FC<TrendChartsProps> = ({
  trendData = [],
  reasonsData = [],
  roiChartData = [
    { period: 'Week 1', saved: 350000 },
    { period: 'Week 2', saved: 350000 },
    { period: 'Week 3', saved: 350000 },
    { period: 'Week 4', saved: 350000 },
  ],
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'roi' | 'trend' | 'reasons'>('roi');
  const [activeReasonIndex, setActiveReasonIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <Card style={{ padding: '24px', marginBottom: '24px' }}>
        <Skeleton style={{ height: '24px', width: '30%', marginBottom: '12px' }} />
        <Skeleton style={{ height: '14px', width: '50%', marginBottom: '20px' }} />
        <Skeleton style={{ height: '260px', width: '100%' }} />
      </Card>
    );
  }

  // Ensure 14 days of trend points exist for smooth area rendering
  const formattedTrendData: DailyTrendItem[] = trendData.length > 0 ? trendData : (() => {
    const list: DailyTrendItem[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      list.push({
        date: label,
        rescued: Math.floor(14 + Math.sin(i) * 5 + (14 - i)),
        rto: Math.max(2, Math.floor(5 + Math.cos(i) * 3)),
      });
    }
    return list;
  })();

  // Format NDR reasons
  const formattedReasons: NdrReasonItem[] = reasonsData.length > 0 ? reasonsData : [
    { name: 'Fake Attempt', value: 38 },
    { name: 'Incomplete Address', value: 27 },
    { name: 'Customer Unavailable', value: 21 },
    { name: 'Customer Refused COD', value: 14 },
  ];

  const totalNdrCases = formattedReasons.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <section aria-label="Operational Analytics Visualizations" style={{ marginBottom: '24px' }}>
      <Card style={{ padding: '24px' }}>
        {/* Header & View Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <CardTitle style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {activeTab === 'roi' && 'RTO Freight Recovery ROI'}
              {activeTab === 'trend' && '14-Day Daily Recovery Trend'}
              {activeTab === 'reasons' && 'NDR Reason Breakdown'}
            </CardTitle>
            <CardDescription style={{ marginTop: '4px' }}>
              {activeTab === 'roi' && 'High-Volume Aggregated Savings Overview'}
              {activeTab === 'trend' && 'Rescued Deliveries vs Terminal RTOs over the last 14 days'}
              {activeTab === 'reasons' && 'Courier failure root-causes & fake delivery telemetry'}
            </CardDescription>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('roi')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'roi' ? 'var(--indigo, #4f46e5)' : 'transparent',
                color: activeTab === 'roi' ? '#fff' : 'var(--text-3, #9ca3af)',
                transition: 'all 0.2s',
              }}
            >
              Freight Recovery ROI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trend')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'trend' ? 'var(--indigo, #4f46e5)' : 'transparent',
                color: activeTab === 'trend' ? '#fff' : 'var(--text-3, #9ca3af)',
                transition: 'all 0.2s',
              }}
            >
              14-Day Recovery Trend
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reasons')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'reasons' ? 'var(--indigo, #4f46e5)' : 'transparent',
                color: activeTab === 'reasons' ? '#fff' : 'var(--text-3, #9ca3af)',
                transition: 'all 0.2s',
              }}
            >
              NDR Reasons
            </button>
          </div>
        </div>

        {/* Tab 1: High-Volume Freight Recovery ROI BarChart */}
        {activeTab === 'roi' && (
          <div data-testid="roi-chart-container" style={{ width: '100%', height: 280, minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={roiChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="period" stroke="#94a3b8" />
                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')} saved`, 'Recovery ROI']}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
                  itemStyle={{ color: '#38bdf8' }}
                />
                <Bar dataKey="saved" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 2: 14-Day Daily Recovery Trend (AreaChart) */}
        {activeTab === 'trend' && (
          <div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={formattedTrendData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRescued" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorRTO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#0d0f15',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rescued"
                    name="Rescued Deliveries"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRescued)"
                  />
                  <Area
                    type="monotone"
                    dataKey="rto"
                    name="RTO Returned"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRTO)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ color: 'var(--text-2, #d4d4d8)' }}>Rescued Deliveries</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f43f5e' }} />
                <span style={{ color: 'var(--text-2, #d4d4d8)' }}>RTO Returns</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: NDR Reason Breakdown (Doughnut Chart) */}
        {activeTab === 'reasons' && (
          <div>
            <div style={{ width: '100%', height: 240, position: 'relative' }}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const num = Number(value);
                      const pct = totalNdrCases > 0 ? ((num / totalNdrCases) * 100).toFixed(1) : '0';
                      return [`${num} orders (${pct}%)`, name];
                    }}
                    contentStyle={{
                      background: '#0d0f15',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Pie
                    data={formattedReasons}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(_, index) => setActiveReasonIndex(index === activeReasonIndex ? null : index)}
                  >
                    {formattedReasons.map((entry, index) => {
                      const color = REASON_COLORS[entry.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={color}
                          stroke={activeReasonIndex === index ? '#fff' : 'rgba(0,0,0,0.4)'}
                          strokeWidth={activeReasonIndex === index ? 2 : 1}
                          style={{ cursor: 'pointer', outline: 'none' }}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                  {totalNdrCases}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', marginTop: '2px' }}>
                  Total NDRs
                </div>
              </div>
            </div>

            {/* Clickable Legend Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px 16px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              }}
            >
              {formattedReasons.map((entry, index) => {
                const color = REASON_COLORS[entry.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                const pct = totalNdrCases > 0 ? ((entry.value / totalNdrCases) * 100).toFixed(0) : '0';
                const isSelected = activeReasonIndex === index;

                return (
                  <div
                    key={entry.name}
                    onClick={() => setActiveReasonIndex(isSelected ? null : index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '2px',
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          color: isSelected ? '#fff' : 'var(--text-2, #d4d4d8)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {entry.name}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-3, #9ca3af)', flexShrink: 0, marginLeft: '8px' }}>
                      {entry.value} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
};

export default TrendCharts;
