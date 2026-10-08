import React from 'react';
import { Download, ShieldAlert, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useFraudIndex } from '../../hooks/useFraudIndex';
import type { CarrierFraudStats } from '../../types/analytics.d';

const formatInr = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const FraudWatchtower: React.FC = () => {
  const { fraudData, loading, error, exporting, refetch, exportDisputeCsv } = useFraudIndex();

  const handleExportCsv = async () => {
    await exportDisputeCsv();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} style={{ padding: '20px' }}>
              <Skeleton style={{ height: '14px', width: '50%', marginBottom: '10px' }} />
              <Skeleton style={{ height: '28px', width: '70%' }} />
            </Card>
          ))}
        </div>
        <Card style={{ padding: '24px' }}>
          <Skeleton style={{ height: '32px', width: '100%', marginBottom: '16px' }} />
          <Skeleton style={{ height: '48px', width: '100%', marginBottom: '8px' }} />
          <Skeleton style={{ height: '48px', width: '100%', marginBottom: '8px' }} />
          <Skeleton style={{ height: '48px', width: '100%' }} />
        </Card>
      </div>
    );
  }

  if (error) {
    const isPlanGated =
      error.toLowerCase().includes('scale') ||
      error.toLowerCase().includes('growth') ||
      error.toLowerCase().includes('plan');

    return (
      <Card style={{ padding: '36px 24px', textAlign: 'center' }}>
        {isPlanGated ? (
          <ShieldAlert size={36} color="var(--indigo, #6366f1)" style={{ margin: '0 auto 12px' }} />
        ) : (
          <AlertTriangle size={36} color="var(--rose, #f43f5e)" style={{ margin: '0 auto 12px' }} />
        )}
        <CardTitle style={{ color: 'var(--text-1)' }}>
          {isPlanGated ? 'Carrier Fraud Watchtower is a Scale & Fleet Feature' : 'Unable to Load Carrier Fraud Telemetry'}
        </CardTitle>
        <CardDescription style={{ marginTop: '8px', marginBottom: '20px', maxWidth: '520px', marginInline: 'auto' }}>
          {isPlanGated
            ? 'Audit fake delivery remarks across Delhivery, Blue Dart & Shadowfax, and generate one-click reverse-freight dispute dossiers.'
            : error}
        </CardDescription>
        {isPlanGated ? (
          <Button variant="default" onClick={() => { window.location.href = '/billing'; }} style={{ margin: '0 auto' }}>
            <span>Upgrade to Scale Plan →</span>
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => refetch()} style={{ margin: '0 auto' }}>
            <RefreshCw size={14} />
            <span>Retry</span>
          </Button>
        )}
      </Card>
    );
  }

  const { carriers, totalFakeAttempts, totalDisputedFreight, overallFakeRate } = fraudData;

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 4 Summary Telemetry Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <Card style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Fake Delivery Attempts
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--rose, #f43f5e)', marginTop: '6px', fontFamily: 'var(--font-display, inherit)' }}>
            {totalFakeAttempts}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3, #9ca3af)', marginTop: '4px' }}>
            Flagged with fake remarks
          </div>
        </Card>

        <Card style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Disputed Freight Value
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--amber, #f59e0b)', marginTop: '6px', fontFamily: 'var(--font-display, inherit)' }}>
            {formatInr(totalDisputedFreight)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3, #9ca3af)', marginTop: '4px' }}>
            Freight claimable from couriers
          </div>
        </Card>

        <Card style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.03)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Overall Fake Rate
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', marginTop: '6px', fontFamily: 'var(--font-display, inherit)' }}>
            {overallFakeRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3, #9ca3af)', marginTop: '4px' }}>
            Ratio of fake remarks to total NDRs
          </div>
        </Card>

        <Card style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.03)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Carriers Audited
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--indigo-soft, #818cf8)', marginTop: '6px', fontFamily: 'var(--font-display, inherit)' }}>
            {carriers.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3, #9ca3af)', marginTop: '4px' }}>
            Active 3PL logistics partners
          </div>
        </Card>
      </div>

      {/* Main Leaderboard Table */}
      <Card style={{ padding: '24px' }}>
        <CardHeader style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 20px 0', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="var(--rose, #f43f5e)" />
              <CardTitle style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Carrier Fraud Watchtower
              </CardTitle>
            </div>
            <CardDescription style={{ marginTop: '4px' }}>
              Carrier reliability audit ranking couriers by fake delivery attempt frequency and disputed freight exposure
            </CardDescription>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={loading}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || totalFakeAttempts === 0}
              style={{ background: 'var(--indigo, #4f46e5)', color: '#fff' }}
            >
              <Download size={14} />
              <span>{exporting ? 'Generating CSV…' : 'Export Dispute CSV'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent style={{ padding: 0 }}>
          {carriers.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
              <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>No Fraud Telemetry Logged</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                All delivery attempts in this period were legitimate or verified with customers.
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '220px' }}>Carrier Name</TableHead>
                  <TableHead style={{ textAlign: 'right', width: '130px' }}>Total NDRs</TableHead>
                  <TableHead style={{ textAlign: 'center', width: '160px' }}>Fake Attempts %</TableHead>
                  <TableHead style={{ textAlign: 'right', width: '180px' }}>Disputed Freight Value</TableHead>
                  <TableHead style={{ textAlign: 'right', width: '140px' }}>Dispute Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carriers.map((carrier: CarrierFraudStats) => {
                  const fakeRate = Number(carrier.fakeAttemptRate ?? (carrier as any).fakeRate ?? 0);
                  const fakeAttempts = Number(carrier.fakeAttempts ?? (carrier as any).fakeAttemptsCount ?? 0);
                  const isHighFraud = fakeRate > 10;
                  const disputedValue = Number(carrier.disputedFreightValue ?? 0);
                  return (
                    <TableRow key={carrier.carrier}>
                      <TableCell>
                        <div style={{ fontWeight: 600, color: 'var(--text-1, #f4f4f5)', textTransform: 'capitalize' }}>
                          {carrier.carrier}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-3, #9ca3af)' }}>
                          {fakeAttempts} fake / {carrier.totalNDR ?? 0} total NDRs
                        </div>
                      </TableCell>
                      <TableCell style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>
                        {carrier.totalNDR ?? 0}
                      </TableCell>
                      <TableCell style={{ textAlign: 'center' }}>
                        {isHighFraud ? (
                          <Badge variant="danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} />
                            {fakeRate.toFixed(1)}% High
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {fakeRate.toFixed(1)}% Normal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell style={{ textAlign: 'right', fontWeight: 600, color: disputedValue > 0 ? 'var(--amber, #f59e0b)' : 'var(--text-3)' }}>
                        {formatInr(disputedValue)}
                      </TableCell>
                      <TableCell style={{ textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportDisputeCsv(carrier.carrier)}
                          disabled={exporting || fakeAttempts === 0}
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                        >
                          <Download size={12} />
                          <span>Dispute CSV</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FraudWatchtower;
