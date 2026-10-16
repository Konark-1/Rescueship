import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Zap, Building2 } from 'lucide-react';
import { Field, Done } from './Field';

const directFormSchema = z.object({
  keyId: z.string().min(1, 'Key ID / Client ID is required'),
  keySecret: z.string().min(1, 'Key Secret is required'),
  webhookSecret: z.string().optional(),
});

type DirectFormValues = z.infer<typeof directFormSchema>;

interface PaymentSetup {
  gateway?: string;
  webhookVerified?: boolean;
  webhook?: { url: string; events: string[]; secret?: string };
}

interface PaymentStationProps {
  onConnect: (gateway: 'razorpay' | 'cashfree', keyId: string, keySecret: string, webhookSecret?: string) => void;
  onConnectManaged?: (payout: {
    type: 'upi' | 'bank_account';
    upiId?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  }) => void;
  busy: any;
  done: boolean;
  gateway: string;
  paymentDetails?: {
    mode?: 'direct' | 'managed';
    payoutType?: 'upi' | 'bank_account';
    destination?: string;
  };
  setup?: PaymentSetup | null;
  onTestLink?: () => Promise<{ shortUrl: string }>;
}

export function PaymentStation({
  onConnect,
  onConnectManaged,
  busy,
  done,
  gateway,
  paymentDetails,
  setup,
}: PaymentStationProps) {
  // Main mode: 'managed' (Simple) vs 'direct' (Advanced)
  const [mode, setMode] = useState<'managed' | 'direct'>('managed');
  
  // Managed payout type: 'upi' vs 'bank_account'
  const [payoutType, setPayoutType] = useState<'upi' | 'bank_account'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [managedError, setManagedError] = useState<string | null>(null);

  // Direct gateway type: 'razorpay' vs 'cashfree'
  const [g, setG] = useState<'razorpay' | 'cashfree'>('razorpay');
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: directErrors },
  } = useForm<DirectFormValues>({
    resolver: zodResolver(directFormSchema),
    defaultValues: { keyId: '', keySecret: '', webhookSecret: '' },
  });

  const onDirectSubmit = (data: DirectFormValues) => {
    onConnect(g, data.keyId, data.keySecret, data.webhookSecret?.trim() || undefined);
    setEditing(false);
  };

  const onManagedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManagedError(null);

    if (payoutType === 'upi') {
      if (!upiId || !/^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim())) {
        setManagedError('Please enter a valid UPI ID (e.g. yourstore@okaxis or 9876543210@paytm)');
        return;
      }
      onConnectManaged?.({
        type: 'upi',
        upiId: upiId.trim(),
      });
      setEditing(false);
    } else {
      if (!accountNumber || !/^\d{9,18}$/.test(accountNumber.trim())) {
        setManagedError('Please enter a valid Bank Account Number (9 to 18 digits)');
        return;
      }
      if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase())) {
        setManagedError('Please enter an 11-character IFSC code (e.g. HDFC0001234)');
        return;
      }
      if (!accountHolderName || accountHolderName.trim().length < 3) {
        setManagedError('Please enter the Account Holder Name matching your bank account');
        return;
      }
      onConnectManaged?.({
        type: 'bank_account',
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        accountHolderName: accountHolderName.trim(),
      });
      setEditing(false);
    }
  };

  if (done && !editing) {
    const isManaged = gateway === 'managed' || paymentDetails?.mode === 'managed';
    return (
      <div className="ob-form">
        <Done
          provider={
            isManaged
              ? `Connected · Managed Settlement (${paymentDetails?.destination || 'UPI/Bank Active'})`
              : `Connected · Direct Gateway (${gateway})`
          }
          subtitle={
            isManaged
              ? 'Customer payments collected via RescueShip gateway and settled to your account'
              : 'Direct payment recovery gateway active'
          }
        />
        <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="ob-btn ob-btn--ghost"
            style={{ fontSize: '0.84rem', padding: '6px 14px' }}
            onClick={() => setEditing(true)}
          >
            ⚙ Change payment setup / switch method
          </button>
        </div>
        {isManaged ? (
          <div className="ob-steps" style={{ marginTop: 'var(--space-3)' }}>
            <p className="ob-steps__title">⚡ Zero-KYC Managed Settlement Active</p>
            <ul className="ob-steps__list" style={{ listStyle: 'none', paddingLeft: 0 }}>
              <li style={{ marginBottom: '6px' }}>✓ <strong>Transparent Tracking:</strong> Every customer payment is logged independently with customer name, amount, date & time in your dashboard.</li>
              <li style={{ marginBottom: '6px' }}>✓ <strong>Automated Payouts:</strong> Funds collected from doorstep UPI conversions are routed directly to your {paymentDetails?.destination || 'bank/UPI'}.</li>
              <li>✓ <strong>Standard Fees:</strong> ~2.65% total (Razorpay gateway fee + Route transfer + GST). No extra transfer charges.</li>
            </ul>
          </div>
        ) : (
          setup?.webhook && (
            <div className="ob-steps" style={{ marginTop: 'var(--space-3)' }}>
              <p className="ob-steps__title">Finish direct payment setup</p>
              <ol className="ob-steps__list">
                <li>
                  In your {setup.gateway === 'cashfree' ? 'Cashfree' : 'Razorpay'} dashboard add a webhook with URL{' '}
                  <code style={{ wordBreak: 'break-all' }}>{setup.webhook.url}</code> and event{' '}
                  <code>{setup.webhook.events.join(', ')}</code>.
                </li>
                {setup.webhook.secret && (
                  <li>Use this webhook secret: <code style={{ wordBreak: 'break-all' }}>{setup.webhook.secret}</code></li>
                )}
              </ol>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="ob-form">
      {/* ── Mode Selection Header ── */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Choose how you want to collect online payments when customers convert COD orders to prepaid:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {/* Card 1: Managed (Simple) */}
          <div
            onClick={() => setMode('managed')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: mode === 'managed' ? '2px solid var(--accent, #6366f1)' : '1px solid var(--border, #333)',
              background: mode === 'managed' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.94rem' }}>
                <Zap size={16} color="#6366f1" /> Simple: Managed
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                }}
              >
                Recommended
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 10px 0' }}>
              <strong>Zero KYC & No Setup Fees.</strong> Enter your UPI ID or Bank details. Payments are redirected through RescueShip and settled automatically.
            </p>
            <ul style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '16px', margin: 0 }}>
              <li>✓ Instant 10-second setup</li>
              <li>✓ Full transaction visibility in dashboard</li>
              <li>✓ ~2.65% total gateway & transfer fee</li>
            </ul>
          </div>

          {/* Card 2: Direct (Advanced) */}
          <div
            onClick={() => setMode('direct')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: mode === 'direct' ? '2px solid var(--accent, #6366f1)' : '1px solid var(--border, #333)',
              background: mode === 'direct' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.94rem' }}>
                <Building2 size={16} color="#94a3b8" /> Advanced: Direct
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-muted)',
                }}
              >
                Own Keys
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 10px 0' }}>
              <strong>100% Direct Transfer.</strong> Money lands straight into your own Razorpay or Cashfree account with zero RescueShip interference.
            </p>
            <ul style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '16px', margin: 0 }}>
              <li>✓ 0% platform fee from RescueShip</li>
              <li>⚠ Requires active Razorpay account + KYC</li>
              <li>⚠ Requires webhook configuration</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Mode 1: Managed Settlement Form ── */}
      {mode === 'managed' && (
        <form onSubmit={onManagedSubmit}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Settlement Destination:</span>
              <div className="ob-seg" style={{ marginBottom: 0 }}>
                <button
                  type="button"
                  className={payoutType === 'upi' ? 'on' : ''}
                  onClick={() => { setPayoutType('upi'); setManagedError(null); }}
                  style={{ padding: '4px 14px', fontSize: '0.8rem' }}
                >
                  UPI ID (Fastest)
                </button>
                <button
                  type="button"
                  className={payoutType === 'bank_account' ? 'on' : ''}
                  onClick={() => { setPayoutType('bank_account'); setManagedError(null); }}
                  style={{ padding: '4px 14px', fontSize: '0.8rem' }}
                >
                  Bank Account + IFSC
                </button>
              </div>
            </div>

            {payoutType === 'upi' ? (
              <Field label="Your UPI ID (For Direct Payouts)">
                <input
                  className="ob-input"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. storename@okicici or 9876543210@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Customer payments converted from COD will be tracked in your dashboard and settled to this UPI address.
                </span>
              </Field>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Field label="Account Holder Name (As per Bank)">
                  <input
                    className="ob-input"
                    placeholder="e.g. Lighthouse Enterprises or Rahul Sharma"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    required
                  />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Bank Account Number">
                    <input
                      className="ob-input"
                      type="password"
                      autoComplete="off"
                      placeholder="e.g. 50100234567890"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="IFSC Code">
                    <input
                      className="ob-input"
                      placeholder="e.g. HDFC0001234"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      maxLength={11}
                      required
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {managedError && (
            <p className="ob-err" role="alert" style={{ marginBottom: '12px' }}>
              {managedError}
            </p>
          )}

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 6px 0' }}>
              <strong>📋 Terms & Clear Disclosure:</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              <li>Payments from customers are collected via RescueShip's master Razorpay gateway showing your store name.</li>
              <li>Every transaction is recorded individually with customer name, order number, amount, date & time in your dashboard.</li>
              <li>Total fee: <strong>2% gateway fee + 0.25% route transfer fee + 18% GST on fees (~2.65% total)</strong>. No hidden charges.</li>
            </ul>
          </div>

          <button className="ob-btn" disabled={busy} type="submit">
            {busy ? 'Saving details…' : 'Save & Enable Managed Settlement'}
          </button>
        </form>
      )}

      {/* ── Mode 2: Direct Gateway (Own Keys) Form ── */}
      {mode === 'direct' && (
        <form onSubmit={handleSubmit(onDirectSubmit)}>
          <div className="ob-seg">
            {(['razorpay', 'cashfree'] as const).map((x) => (
              <button
                type="button"
                key={x}
                className={g === x ? 'on' : ''}
                onClick={() => {
                  setG(x);
                  reset({ keyId: '', keySecret: '', webhookSecret: '' });
                }}
              >
                {x === 'razorpay' ? 'Razorpay' : 'Cashfree'}
              </button>
            ))}
          </div>

          <Field label={g === 'cashfree' ? 'Cashfree App ID (Client ID)' : 'Razorpay Key ID'}>
            <input
              className="ob-input"
              autoComplete="off"
              spellCheck={false}
              placeholder={g === 'cashfree' ? 'e.g. 123456789abcdef...' : 'e.g. rzp_live_...'}
              {...register('keyId')}
              required
            />
            {directErrors.keyId && (
              <span style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                {directErrors.keyId.message}
              </span>
            )}
          </Field>

          <Field label={g === 'cashfree' ? 'Cashfree Secret Key' : 'Razorpay Key Secret'}>
            <input
              className="ob-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={g === 'cashfree' ? 'Enter Cashfree Secret Key' : 'Enter Razorpay Key Secret'}
              {...register('keySecret')}
              required
            />
            {directErrors.keySecret && (
              <span style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                {directErrors.keySecret.message}
              </span>
            )}
          </Field>

          {g === 'razorpay' && (
            <Field label="Webhook secret (optional — leave empty to generate one)">
              <input
                className="ob-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Secret you set on the Razorpay webhook"
                {...register('webhookSecret')}
              />
            </Field>
          )}

          <p className="ob-note">
            100% direct payment to your own {g === 'razorpay' ? 'Razorpay' : 'Cashfree'} account. RescueShip takes 0% commission. Keys are encrypted with AES-256-GCM.
          </p>

          <button className="ob-btn" disabled={busy} type="submit">
            {busy ? 'Validating…' : 'Validate & Connect Direct Gateway'}
          </button>
        </form>
      )}
    </div>
  );
}

export default PaymentStation;
