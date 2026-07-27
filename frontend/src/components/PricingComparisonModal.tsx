import { useEffect } from 'react';
import { motion } from 'motion/react';

type Cell = 0 | 1 | string;
interface Row { f: string; v: Cell[] }
interface Group { cat: string; rows: Row[] }

const COLS = ['Starter', 'Growth', 'Scale', 'Enterprise'];
const BASE = [2999, 8999, 19999, null] as const; // quarterly standard price

const GROUPS: Group[] = [
  { cat: 'Orders & Capacity', rows: [
    { f: 'Monthly order limit', v: ['2,000', '10,000', '50,000', 'Unlimited'] },
    { f: '80% capacity warning', v: [1, 1, 1, 1] },
  ]},
  { cat: 'NDR Rescue Automation', rows: [
    { f: 'Fake-remark detection', v: [1, 1, 1, 1] },
    { f: 'WhatsApp rescue bot (English)', v: [1, 1, 1, 1] },
    { f: '3-mode smart address correction', v: [1, 1, 1, 1] },
    { f: 'Escalation chain (4h / 12h / 24h)', v: [1, 1, 1, 1] },
    { f: 'Cancel & reschedule via WhatsApp', v: [1, 1, 1, 1] },
  ]},
  { cat: 'COD → Prepaid Conversion', rows: [
    { f: 'Payment links (Razorpay / Cashfree)', v: [1, 1, 1, 1] },
    { f: 'UPI QR code via WhatsApp', v: [1, 1, 1, 1] },
    { f: 'COD discount incentives', v: [1, 1, 1, 1] },
    { f: 'Auto-sync status to your store', v: [1, 1, 1, 1] },
  ]},
  { cat: 'Analytics & Real-time', rows: [
    { f: 'Real-time live dashboard (SSE)', v: [0, 1, 1, 1] },
    { f: 'Revenue-saved & carrier analytics', v: [0, 1, 1, 1] },
    { f: 'Email alerts + daily summary', v: [0, 1, 1, 1] },
    { f: 'Seller payment alerts (WhatsApp)', v: [0, 1, 1, 1] },
  ]},
  { cat: 'Integrations & Security', rows: [
    { f: 'Shopify & WooCommerce', v: [1, 1, 1, 1] },
    { f: 'Shiprocket / Delhivery / ClickPost', v: [1, 1, 1, 1] },
    { f: 'AES-256 credential encryption', v: [1, 1, 1, 1] },
    { f: 'HMAC webhook verification', v: [1, 1, 1, 1] },
    { f: 'Emergency "Pause All" switch', v: [1, 1, 1, 1] },
    { f: 'Audit log (90-day retention)', v: [1, 1, 1, 1] },
  ]},
  { cat: 'Exports & Support', rows: [
    { f: 'CSV / JSON data exports', v: [0, 0, 1, 1] },
    { f: 'Dedicated onboarding session', v: [0, 0, 1, 1] },
    { f: 'Priority support (24h response)', v: [0, 0, 1, 1] },
    { f: 'Dedicated account manager', v: [0, 0, 0, 1] },
    { f: 'Custom integrations & SLA', v: [0, 0, 0, 1] },
  ]},
];

function CellView({ v }: { v: Cell }) {
  if (v === 1) return <span className="pcm-check">✓</span>;
  if (v === 0) return <span className="pcm-dash">—</span>;
  return <span className="pcm-val">{v}</span>;
}

interface PricingComparisonModalProps {
  cycle?: { key: string; discount: number };
  isOpen?: boolean;
  onClose: () => void;
}

export default function PricingComparisonModal({ cycle = { key: 'quarterly', discount: 0 }, isOpen = true, onClose }: PricingComparisonModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const priceFor = (i: number) => {
    const b = BASE[i];
    if (b === null) return 'Custom';
    return `₹${Math.round(b * (1 - cycle.discount)).toLocaleString('en-IN')}/mo`;
  };

  return (
    <motion.div className="pcm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="pcm-card" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.99 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
        <div className="pcm-head">
          <div>
            <h3>Compare all RescueShip plans</h3>
            <p>Detailed feature breakdown · prices shown for {cycle.key === 'quarterly' ? 'quarterly' : cycle.key === 'semi' ? 'semi-annual' : 'annual'} billing</p>
          </div>
          <button className="pcm-close" onClick={onClose} aria-label="Close comparison">✕</button>
        </div>
        <div className="pcm-body">
          <table className="pcm-table">
            <thead>
              <tr>
                <th className="pcm-col-feat">Features</th>
                {COLS.map((c, i) => (
                  <th key={c} className={c === 'Growth' ? 'pcm-pop' : ''}>
                    {c === 'Growth' && <span className="pcm-pill">Popular</span>}
                    <span className="pcm-plan">{c}</span>
                    <span className="pcm-price">{priceFor(i)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <tr key={g.cat} className="pcm-cat-row">
                  <td colSpan={5} style={{ padding: 0 }}>
                    <div style={{ padding: '1.4rem 0.75rem 0.5rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--indigo-soft)', background: 'rgba(255,255,255,0.015)', textAlign: 'left' }}>
                      {g.cat}
                    </div>
                    {g.rows.map((r) => (
                      <div key={r.f} style={{ display: 'grid', gridTemplateColumns: '34% repeat(4, 1fr)', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                        <div style={{ padding: '0.85rem 0.75rem', textAlign: 'left', color: 'var(--text-2)' }}>{r.f}</div>
                        {r.v.map((v, i) => (
                          <div key={i} className={COLS[i] === 'Growth' ? 'pcm-pop' : ''} style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                            <CellView v={v} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
