import React, { useState, useEffect } from 'react';
import api from '../services/api';
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

export const RescueMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/metrics/my')
      .then(r => {
        if (!cancelled && r.data?.success) {
          setMetrics(r.data.metrics);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!metrics) return <div className="metrics-loading">Loading metrics…</div>;

  const ratePct = (metrics.rescueRate * 100).toFixed(1);
  const rateClass = metrics.rescueRate >= 0.3 ? 'is-ok'
    : metrics.rescueRate >= 0.15 ? 'is-warn' : 'is-bad';

  return (
    <section className="panel panel--accent metrics-widget">
      <div className="panel__head">
        <span className="panel__title">Rescue performance</span>
        <span className="panel__aside">All-time</span>
      </div>

      <div className="metrics-body">
        <div className="metrics-hero">
          <div className={`hero-rate ${rateClass}`}>{ratePct}%</div>
          <div className="hero-label">NDR rescue rate</div>
        </div>

        <div className="metrics-grid">
          <div className="metric-cell">
            <span className="metric-value">{metrics.ndrReceived}</span>
            <span className="metric-label">NDRs received</span>
          </div>
          <div className="metric-cell">
            <span className="metric-value">{metrics.rescuesAttempted}</span>
            <span className="metric-label">Rescues sent</span>
          </div>
          <div className="metric-cell is-ok">
            <span className="metric-value">{metrics.rescuesSucceeded}</span>
            <span className="metric-label">Rescued</span>
          </div>
          <div className="metric-cell">
            <span className="metric-value">{metrics.avgRescueTimeMin.toFixed(0)}m</span>
            <span className="metric-label">Avg rescue time</span>
          </div>
          <div className="metric-cell highlight">
            <span className="metric-value">₹{metrics.revenue.toLocaleString('en-IN')}</span>
            <span className="metric-label">Revenue saved</span>
          </div>
          <div className="metric-cell">
            <span className="metric-value">{(metrics.conversionRate * 100).toFixed(1)}%</span>
            <span className="metric-label">NDR → rescued</span>
          </div>
        </div>
      </div>

      {metrics.rescueRate < 0.15 && metrics.rescuesAttempted >= 5 && (
        <div className="metrics-warning">
          Rescue rate below 15% — check that templates are approved and customer phone numbers are correct.
        </div>
      )}
    </section>
  );
};

export default RescueMetrics;
