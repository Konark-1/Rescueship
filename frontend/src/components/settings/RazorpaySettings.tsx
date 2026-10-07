import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Copy, RefreshCw, AlertCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import api from '../../services/api';

interface RazorpaySettingsProps {
  onVerified?: () => void;
}

export const RazorpaySettings: React.FC<RazorpaySettingsProps> = ({ onVerified }) => {
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>(
    'https://rescueship.onrender.com/webhooks/razorpay/payment'
  );
  const [nonce, setNonce] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const startWebhookProbe = async () => {
    setError(null);
    setVerified(false);
    setTesting(true);
    setSecondsRemaining(60);

    try {
      const res = await api.post('/api/settings/razorpay/verify-webhook');
      const data = res.data;
      if (data.webhookUrl) {
        setWebhookUrl(data.webhookUrl);
      }
      if (data.verificationNonce) {
        setNonce(data.verificationNonce);
      }

      // Automatically copy webhook URL to merchant clipboard
      try {
        await navigator.clipboard.writeText(data.webhookUrl || webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // clipboard access might be blocked
      }

      // Start 60-second polling
      let countdown = 60;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        countdown -= 2;
        setSecondsRemaining(Math.max(0, countdown));

        if (countdown <= 0) {
          clearInterval(pollIntervalRef.current);
          setTesting(false);
          setError('Verification timed out after 60s. Make sure you pasted the URL into Razorpay Webhook settings.');
          return;
        }

        try {
          const statusRes = await api.get('/api/settings/razorpay/verify-webhook-status');
          if (statusRes.data?.verified) {
            clearInterval(pollIntervalRef.current);
            setTesting(false);
            setVerified(true);
            if (onVerified) onVerified();
          }
        } catch {
          // ignore transient poll error
        }
      }, 2000);
    } catch (err: any) {
      setTesting(false);
      setError(err.response?.data?.error || 'Failed to start webhook verification probe.');
    }
  };

  return (
    <div
      className="razorpay-settings-card"
      style={{
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-1)' }}>
            Razorpay Webhook Verification
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-3)' }}>
            Verify your webhook endpoint receives live UPI conversion and refund events.
          </p>
        </div>

        {verified && (
          <span
            className="badge badge-success"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={14} /> ✅ Webhook Verified
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="razorpay-webhook-callback-url" style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>
          Webhook Callback URL
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            id="razorpay-webhook-callback-url"
            name="razorpayWebhookUrl"
            aria-label="Webhook Callback URL"
            type="text"
            readOnly
            value={webhookUrl}
            style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--input-bg, rgba(0, 0, 0, 0.2))',
              color: 'var(--text-1)',
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleCopyUrl}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
          >
            <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={startWebhookProbe}
          disabled={testing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '0.85rem',
          }}
        >
          {testing ? (
            <>
              <RefreshCw size={14} className="spin" /> Testing Receipt ({secondsRemaining}s)…
            </>
          ) : (
            <>
              <ShieldCheck size={14} /> Test Webhook Receipt
            </>
          )}
        </button>

        <a
          href="https://dashboard.razorpay.com/app/webhooks"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'none',
          }}
        >
          Razorpay Webhook Dashboard <ExternalLink size={12} />
        </a>
      </div>

      {testing && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            fontSize: '0.78rem',
            color: '#60a5fa',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div><strong>Active Probe Nonce:</strong> <code style={{ color: '#fff' }}>{nonce}</code></div>
          <div>Paste the Webhook URL above in your Razorpay Dashboard with event <code>payment_link.paid</code>. Listening for incoming probe (window closes in {secondsRemaining}s)...</div>
        </div>
      )}

      {verified && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '0.82rem',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={16} />
          <span><strong>Probe Succeeded:</strong> Webhook received and verified! UPI auto-conversion is active and ready.</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            fontSize: '0.8rem',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default RazorpaySettings;
