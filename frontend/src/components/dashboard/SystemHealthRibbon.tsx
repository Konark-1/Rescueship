import React from 'react';
import { ShieldCheck, AlertTriangle, Activity } from 'lucide-react';

interface SystemHealthRibbonProps {
  metaTier: {
    metaTierLimit: number;
    current24hCount: number;
    isLimitReached: boolean;
  };
  dlqFailedCount?: number;
}

export const SystemHealthRibbon: React.FC<SystemHealthRibbonProps> = ({
  metaTier,
  dlqFailedCount = 0,
}) => {
  const current = metaTier.current24hCount || 0;
  const limit = metaTier.metaTierLimit || 1000;
  const percentage = Math.min(100, Math.round((current / limit) * 100));

  const isWarning = percentage >= 75 && !metaTier.isLimitReached;
  const isCritical = metaTier.isLimitReached || percentage >= 95;

  return (
    <aside
      className={`health-ribbon ${isCritical ? 'health-ribbon--critical' : ''}`}
      aria-label="System Health and Meta Tier Watchdog"
      data-testid={isCritical ? 'meta-tier-limit-banner' : 'health-ribbon'}
    >
      <div className="health-ribbon__left">
        <span
          className={`health-ribbon__quality-dot ${
            isCritical
              ? 'health-ribbon__quality-dot--red'
              : isWarning
              ? 'health-ribbon__quality-dot--yellow'
              : 'health-ribbon__quality-dot--green'
          }`}
          aria-hidden="true"
        />
        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={14} /> WABA Quality: {isCritical ? 'Throttled' : isWarning ? 'Warning' : 'Healthy'}
        </span>
      </div>

      <div className="health-ribbon__center">
        <span>
          Tier Usage: {current.toLocaleString('en-IN')}/{limit.toLocaleString('en-IN')} msgs ({percentage}%)
        </span>
        <div className="health-ribbon__tier-bar" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`health-ribbon__tier-fill ${
              isCritical
                ? 'health-ribbon__tier-fill--critical'
                : isWarning
                ? 'health-ribbon__tier-fill--warning'
                : ''
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="health-ribbon__right">
        {dlqFailedCount > 0 ? (
          <span style={{ color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={14} /> DLQ: {dlqFailedCount} anomalous jobs
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-3)' }}>
            <Activity size={14} /> Queues Active · 0 DLQ
          </span>
        )}
      </div>
    </aside>
  );
};
