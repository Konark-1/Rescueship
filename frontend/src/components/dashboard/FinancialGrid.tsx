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
  }).format(amount || 0);
};

export const FinancialGrid: React.FC<FinancialGridProps> = ({ roi, loading = false }) => {
  if (loading) {
    return (
      <div className="fin-grid" aria-label="Loading Financial ROI Summary">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="fin-card">
            <Skeleton style={{ height: '16px', width: '60%', marginBottom: '12px' }} />
            <Skeleton style={{ height: '32px', width: '80%', marginBottom: '8px' }} />
            <Skeleton style={{ height: '12px', width: '40%' }} />
          </Card>
        ))}
      </div>
    );
  }

  const netSavingsFormatted = formatInr(roi?.netSavings || 0);
  const rescueRateFormatted = `${(roi?.rescueRate || 0).toFixed(1)}%`;
  const codPrepaidFormatted = formatInr(roi?.codToPrepaidGmv || 0);
  const roiMultipleFormatted = `${(roi?.roiMultiple || 1.0).toFixed(1)}x`;
  const isHighRoi = (roi?.roiMultiple || 0) > 1.0;

  return (
    <section aria-label="Executive Financial ROI Summary">
      <div className="fin-grid">
        {/* Card 1: Net Money Saved */}
        <Card className="fin-card">
          <CardHeader className="fin-card__header" style={{ padding: 0 }}>
            <CardTitle className="fin-card__label">Net Money Saved</CardTitle>
            <div className="fin-card__icon-wrap" style={{ background: 'var(--emerald-15)', color: 'var(--emerald)' }}>
              <IndianRupee size={18} />
            </div>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            <div className="fin-card__value" style={{ color: 'var(--text-1)' }}>
              {netSavingsFormatted}
            </div>
            <div className="fin-card__subtext">
              <span>₹{(roi?.freightSavings || 0).toLocaleString('en-IN')} freight</span>
              <span>•</span>
              <span className="fin-card__subtext--positive">
                ₹{(roi?.gmvMarginSavings || 0).toLocaleString('en-IN')} retained margin
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Rescue Rate */}
        <Card className="fin-card">
          <CardHeader className="fin-card__header" style={{ padding: 0 }}>
            <CardTitle className="fin-card__label">Rescue Rate</CardTitle>
            <div className="fin-card__icon-wrap" style={{ background: 'var(--indigo-15)', color: 'var(--indigo-soft)' }}>
              <ShieldCheck size={18} />
            </div>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            <div className="fin-card__value">
              {rescueRateFormatted}
            </div>
            <div className="fin-card__subtext">
              <span>{roi?.rescuedOrders || 0} orders rescued</span>
              <Badge variant="outline" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                ₹140/order
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: COD → Prepaid Conversions */}
        <Card className="fin-card">
          <CardHeader className="fin-card__header" style={{ padding: 0 }}>
            <CardTitle className="fin-card__label">COD → Prepaid GMV</CardTitle>
            <div className="fin-card__icon-wrap" style={{ background: 'var(--amber-15)', color: 'var(--amber)' }}>
              <CreditCard size={18} />
            </div>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            <div className="fin-card__value">
              {codPrepaidFormatted}
            </div>
            <div className="fin-card__subtext">
              <span>{roi?.codToPrepaidCount || 0} converted orders</span>
              <span className="fin-card__subtext--positive" style={{ marginLeft: 'auto' }}>
                Zero RTO Risk
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Net ROI Multiple */}
        <Card className="fin-card">
          <CardHeader className="fin-card__header" style={{ padding: 0 }}>
            <CardTitle className="fin-card__label">Net ROI Multiple</CardTitle>
            <div className="fin-card__icon-wrap" style={{ background: isHighRoi ? 'var(--emerald-15)' : 'var(--indigo-10)', color: isHighRoi ? 'var(--emerald)' : 'var(--text-3)' }}>
              {isHighRoi ? <TrendingUp size={18} /> : <Sparkles size={18} />}
            </div>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            <div className="fin-card__value" style={{ color: isHighRoi ? 'var(--emerald)' : 'var(--text-1)' }}>
              {roiMultipleFormatted}
            </div>
            <div className="fin-card__subtext">
              <span>Deducts ₹{(roi?.whatsappHsmCosts || 0).toLocaleString('en-IN')} HSM cost</span>
              <span style={{ marginLeft: 'auto', color: 'var(--emerald)' }}>
                {isHighRoi ? 'High Yield' : 'Baseline'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
