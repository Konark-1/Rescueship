import type { FC } from 'react';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

interface RiskBadgeProps {
  level?: 'LOW' | 'MEDIUM' | 'HIGH';
  score?: number;
}

export const RiskBadge: FC<RiskBadgeProps> = ({ level, score }) => {
  if (!level) return <span style={{ color: 'var(--text-3, #9ca3af)', fontSize: '0.8rem' }}>—</span>;

  const config = {
    LOW: { color: 'var(--emerald, #10b981)', bg: 'rgba(16, 185, 129, 0.1)', icon: ShieldCheck, label: 'Safe' },
    MEDIUM: { color: 'var(--amber, #f59e0b)', bg: 'rgba(245, 158, 11, 0.1)', icon: ShieldAlert, label: 'Medium' },
    HIGH: { color: 'var(--rose, #ef4444)', bg: 'rgba(239, 68, 68, 0.1)', icon: ShieldX, label: 'High' },
  };

  const { color, bg, icon: Icon, label } = config[level];

  return (
    <span 
      style={{ 
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
        color, backgroundColor: bg, border: `1px solid ${color}30`,
        fontFamily: 'var(--font-mono, monospace)',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} strokeWidth={2.5} />
      {label} {score !== undefined && `(${score})`}
    </span>
  );
};
