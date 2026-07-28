import React, { useState, useEffect } from 'react';
import './rescue-metrics.css';

interface Metrics {
  ndrReceived: number;
  rescuesAttempted: number;
  rescuesSucceeded: number;
  rescuesFailed: number;
  rescueRate: number;
  conversionRate: number;
  avgRescueTimeMin: number;
  revenue: number;
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const RescueMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    fetch(`${API}/api/metrics/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setMetrics(d.metrics); })
      .catch(() => {});
  }, []);

  if (!metrics) return <div className="metrics-loading">Loading metrics…</div>;

  const ratePct = (metrics.rescueRate * 100).toFixed(1);
  const rateColor = metrics.rescueRate >= 0.3 ? '#22c55e'
    : metrics.rescueRate >= 0.15 ? '#fbbf24' : '#ef4444';

  return (
    <div className="metrics-widget">
      <h3>📊 Your Rescue Performance</h3>

      <div className="metrics-hero">
        <div className="hero-rate" style={{ color: rateColor }}>
          {ratePct}%
        </div>
        <div className="hero-label">Rescue Rate</div>
      </div>

      <div className="metrics-grid">
        <div className="metric-cell">
          <span className="metric-value">{metrics.ndrReceived}</span>
          <span className="metric-label">NDRs Received</span>
        </div>
        <div className="metric-cell">
          <span className="metric-value">{metrics.rescuesAttempted}</span>
          <span className="metric-label">Rescues Sent</span>
        </div>
        <div className="metric-cell">
          <span className="metric-value">{metrics.rescuesSucceeded}</span>
          <span className="metric-label">Rescued ✓</span>
        </div>
        <div className="metric-cell">
          <span className="metric-value">{metrics.avgRescueTimeMin.toFixed(0)}m</span>
          <span className="metric-label">Avg Rescue Time</span>
        </div>
        <div className="metric-cell highlight">
          <span className="metric-value">₹{metrics.revenue.toLocaleString('en-IN')}</span>
          <span className="metric-label">Revenue Saved</span>
        </div>
        <div className="metric-cell">
          <span className="metric-value">{(metrics.conversionRate * 100).toFixed(1)}%</span>
          <span className="metric-label">NDR → Rescue</span>
        </div>
      </div>

      {metrics.rescueRate < 0.15 && metrics.rescuesAttempted >= 5 && (
        <div className="metrics-warning">
          ⚠️ Your rescue rate is below 15%. Check that your templates are approved
          and customer phone numbers are correct.
        </div>
      )}
    </div>
  );
};

export default RescueMetrics;
