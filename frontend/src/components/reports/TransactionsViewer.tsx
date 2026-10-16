import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import api from '../../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

export interface TransactionItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  amountCollected: number;
  platformFee: number;
  amountSettled: number;
  currency: string;
  status: 'collected' | 'transfer_pending' | 'settled' | 'refunded' | 'failed';
  settlementMode: 'direct_gateway' | 'managed_route';
  payoutDestination?: {
    type: 'upi' | 'bank_account';
    upiId?: string;
    accountNumberMasked?: string;
    ifscCode?: string;
  };
  collectedAt: string;
  settledAt?: string;
  paymentId: string;
}

interface TransactionsSummary {
  totalVolume: number;
  totalPlatformFees: number;
  totalSettled: number;
  totalCount: number;
  settledCount: number;
  pendingCount: number;
}

export const TransactionsViewer: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [summary, setSummary] = useState<TransactionsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchTransactions = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = {
        page: targetPage,
        limit: 15,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const [txRes, sumRes] = await Promise.all([
        api.get('/api/transactions', { params }),
        api.get('/api/transactions/summary'),
      ]);

      setTransactions(txRes.data.transactions || []);
      setTotalPages(txRes.data.pagination?.totalPages || 1);
      setTotalCount(txRes.data.pagination?.total || 0);
      setSummary(sumRes.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load transaction ledger.');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions(page);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchTransactions, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const formatInr = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'settled':
        return (
          <Badge variant="outline" style={{ borderColor: 'var(--emerald, #10b981)', color: 'var(--emerald, #10b981)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> Settled
          </Badge>
        );
      case 'collected':
        return (
          <Badge variant="outline" style={{ borderColor: 'var(--blue, #3b82f6)', color: 'var(--blue, #3b82f6)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={12} /> Collected
          </Badge>
        );
      case 'transfer_pending':
        return (
          <Badge variant="outline" style={{ borderColor: 'var(--amber, #f59e0b)', color: 'var(--amber, #f59e0b)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> Transfer Pending
          </Badge>
        );
      case 'refunded':
        return (
          <Badge variant="outline" style={{ borderColor: 'var(--purple, #a855f7)', color: 'var(--purple, #a855f7)' }}>
            Refunded
          </Badge>
        );
      case 'failed':
      default:
        return (
          <Badge variant="outline" style={{ borderColor: 'var(--rose, #ef4444)', color: 'var(--rose, #ef4444)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={12} /> Failed
          </Badge>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '20px', background: 'var(--bg-surface, #111)', border: '1px solid var(--border-subtle, #222)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Total Collected Volume
          </p>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary, #fff)', margin: 0 }}>
            {summary ? formatInr(summary.totalVolume) : '₹0.00'}
          </p>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: '4px', display: 'block' }}>
            {summary?.totalCount || 0} COD-to-Prepaid conversion(s)
          </span>
        </Card>

        <Card style={{ padding: '20px', background: 'var(--bg-surface, #111)', border: '1px solid var(--border-subtle, #222)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Net Settled to Bank/UPI
          </p>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--emerald, #10b981)', margin: 0 }}>
            {summary ? formatInr(summary.totalSettled) : '₹0.00'}
          </p>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: '4px', display: 'block' }}>
            {summary?.settledCount || 0} successfully routed
          </span>
        </Card>

        <Card style={{ padding: '20px', background: 'var(--bg-surface, #111)', border: '1px solid var(--border-subtle, #222)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Total Gateway & Route Fees
          </p>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-secondary, #ccc)', margin: 0 }}>
            {summary ? formatInr(summary.totalPlatformFees) : '₹0.00'}
          </p>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: '4px', display: 'block' }}>
            ~2.65% total (incl. 18% GST)
          </span>
        </Card>

        <Card style={{ padding: '20px', background: 'var(--bg-surface, #111)', border: '1px solid var(--border-subtle, #222)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Settlement Pipeline
          </p>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--amber, #f59e0b)', margin: 0 }}>
            {summary?.pendingCount || 0} Pending
          </p>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: '4px', display: 'block' }}>
            Direct T+1 automated route
          </span>
        </Card>
      </div>

      {/* ── Table & Filter Card ── */}
      <Card style={{ background: 'var(--bg-surface, #111)', border: '1px solid var(--border-subtle, #222)' }}>
        <CardHeader style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle, #222)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <CardTitle style={{ fontSize: '1.15rem', color: 'var(--text-primary, #fff)' }}>
                Doorstep Payment & Settlement Ledger
              </CardTitle>
              <CardDescription style={{ fontSize: '0.84rem', color: 'var(--text-muted, #888)', marginTop: '4px' }}>
                Every customer COD conversion collected via RescueShip gateway with independent customer names, dates, and destination payouts.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTransactions(page)}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #888)' }} />
              <input
                type="text"
                placeholder="Search by customer name, phone, order #, or payment ID..."
                value={search}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle, #333)',
                  background: 'var(--bg-card, #18181b)',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {['all', 'settled', 'collected', 'transfer_pending', 'failed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleStatusChange(st)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: statusFilter === st ? 'var(--indigo, #6366f1)' : 'var(--border-subtle, #333)',
                    background: statusFilter === st ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: statusFilter === st ? 'var(--indigo, #818cf8)' : 'var(--text-muted, #888)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '24px' }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} style={{ height: '44px', width: '100%', marginBottom: '8px' }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--rose, #ef4444)' }}>
              <AlertTriangle size={28} style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0 }}>{error}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted, #888)' }}>
              <CreditCard size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary, #ccc)', margin: '0 0 4px' }}>
                No payment transactions recorded yet
              </p>
              <p style={{ fontSize: '0.84rem', margin: 0 }}>
                When customers convert COD deliveries to online payment via WhatsApp, each transaction appears here in real-time.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ borderBottom: '1px solid var(--border-subtle, #222)' }}>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Net Settled</TableHead>
                    <TableHead>Payout Destination</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle, #222)' }}>
                      <TableCell style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                        {tx.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary, #fff)' }}>{tx.customerName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)' }}>{tx.customerPhone}</div>
                      </TableCell>
                      <TableCell style={{ fontSize: '0.82rem', color: 'var(--text-muted, #888)', whiteSpace: 'nowrap' }}>
                        {formatDate(tx.collectedAt)}
                      </TableCell>
                      <TableCell style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                        {formatInr(tx.amountCollected)}
                      </TableCell>
                      <TableCell style={{ fontSize: '0.84rem', color: 'var(--text-muted, #888)' }}>
                        {formatInr(tx.platformFee)}
                      </TableCell>
                      <TableCell style={{ fontWeight: 600, color: 'var(--emerald, #10b981)' }}>
                        {formatInr(tx.amountSettled)}
                      </TableCell>
                      <TableCell style={{ fontSize: '0.84rem' }}>
                        {tx.payoutDestination?.type === 'upi' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #ccc)' }}>
                            <CreditCard size={13} color="var(--indigo, #818cf8)" /> {tx.payoutDestination.upiId}
                          </span>
                        ) : tx.payoutDestination?.type === 'bank_account' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #ccc)' }}>
                            <Building2 size={13} color="var(--emerald, #10b981)" /> {tx.payoutDestination.accountNumberMasked} ({tx.payoutDestination.ifscCode})
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #888)' }}>
                            {tx.settlementMode === 'direct_gateway' ? 'Direct Merchant Gateway' : 'Standard Payout'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderStatusBadge(tx.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-subtle, #222)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)' }}>
                Showing page {page} of {totalPages} ({totalCount} total)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft size={14} /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
