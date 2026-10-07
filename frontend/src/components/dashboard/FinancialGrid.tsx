import React from 'react';
import { IndianRupee, ShieldCheck, CreditCard, Sparkles, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import type { FinancialROIData } from '../../types/analytics.d';

interface FinancialGridProps {
  roi: FinancialROIData;
  loading?: boolean;
}

const formatInr = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const FinancialGrid: React.FC<FinancialGridProps> = ({ roi, loading = false }) => {
  if (loading) {
    return (
      <div
        className="financial-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} style={{ padding: '20px' }}>
            <Skeleton style={{ height: '16px', width: '60%', marginBottom: '12px' }} />
            <Skeleton style={{ height: '32px', width: '80%', marginBottom: '8px' }} />
            <Skeleton style={{ height: '12px', width: '40%' }} />
          </Card>
        ))}
      </div>
    );
  }

  const netSavingsFormatted = formatInr(roi.netSavings);
  const rescueRateFormatted = `${(roi.rescueRate || 0).toFixed(1)}%`;
  const codPrepaidFormatted = formatInr(roi.codToPrepaidGmv);
  const roiMultipleFormatted = `${(roi.roiMultiple || 1.0).toFixed(1)}x`;
  const isHighRoi = (roi.roiMultiple || 0) > 1.0;

  return (
    <section aria-label="Executive Financial ROI Summary" style={{ marginBottom: '24px' }}>
      <div
        className="financial-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Net Money Saved */}
        <Card
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
          }}
        >
          <CardHeader style={{ padding: '18px 20px 8px 20px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Net Money Saved
            </CardTitle>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--emerald, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IndianRupee size={18} />
            </div>
          </CardHeader>
          <CardContent style={{ padding: '0 20px 18px 20px' }}>
            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'var(--font-display, inherit)',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
              }}
            >
              {netSavingsFormatted}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} color="var(--emerald, #10b981)" />
              <span>After WhatsApp HSM costs deducted</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Rescue Rate */}
        <Card
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
          }}
        >
          <CardHeader style={{ padding: '18px 20px 8px 20px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rescue Rate
            </CardTitle>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--indigo-soft, #818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={18} />
            </div>
          </CardHeader>
          <CardContent style={{ padding: '0 20px 18px 20px' }}>
            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'var(--font-display, inherit)',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
              }}
            >
              {rescueRateFormatted}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)' }}>
              <span>{roi.rescuedOrders} deliveries saved from RTO return</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: COD → Prepaid Conversions */}
        <Card
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
          }}
        >
          <CardHeader style={{ padding: '18px 20px 8px 20px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              COD → Prepaid Conversions
            </CardTitle>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--cyan, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={18} />
            </div>
          </CardHeader>
          <CardContent style={{ padding: '0 20px 18px 20px' }}>
            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'var(--font-display, inherit)',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
              }}
            >
              {codPrepaidFormatted}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)' }}>
              <span>{roi.codToPrepaidCount} orders paid via instant UPI</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: ROI Multiple */}
        <Card
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
          }}
        >
          <CardHeader style={{ padding: '18px 20px 8px 20px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ROI Multiple
            </CardTitle>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--amber, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
          </CardHeader>
          <CardContent style={{ padding: '0 20px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '1.85rem',
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: 'var(--font-display, inherit)',
                  letterSpacing: '-0.02em',
                }}
              >
                {roiMultipleFormatted}
              </span>
              {isHighRoi && (
                <Badge variant="success" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                  High Efficiency
                </Badge>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)' }}>
              <span>Gross savings vs outreach spend</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default FinancialGrid;
