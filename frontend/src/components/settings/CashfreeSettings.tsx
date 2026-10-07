import React, { useState } from 'react';
import { Copy, ShieldCheck, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../services/api';

interface CashfreeSettingsProps {
  onSaved?: () => void;
}

export const CashfreeSettings: React.FC<CashfreeSettingsProps> = ({ onSaved }) => {
  const [appId, setAppId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [webhookUrl] = useState<string>('https://rescueship.onrender.com/webhooks/cashfree/payment');

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId || !secretKey) {
      setStatusMessage({ text: 'Please enter both CASHFREE_APP_ID and CASHFREE_SECRET_KEY.', type: 'error' });
      return;
    }

    setSaving(true);
    setStatusMessage({ text: '', type: '' });
    try {
      await api.post('/api/connect/payment', {
        gateway: 'cashfree',
        keyId: appId,
        keySecret: secretKey,
      });
      setStatusMessage({ text: 'Cashfree credentials validated and saved successfully.', type: 'success' });
      if (onSaved) onSaved();
    } catch (err: any) {
      setStatusMessage({ text: err.response?.data?.error || err.message || 'Failed to validate Cashfree credentials.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="cashfree-settings-card"
      style={{
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-1)' }}>
            Cashfree Payment Gateway Integration
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-3)' }}>
            Configure Cashfree API credentials to generate autonomous COD→UPI payment links.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="form-group">
          <label htmlFor="cashfree-app-id" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>
            CASHFREE_APP_ID (Client ID)
          </label>
          <input
            id="cashfree-app-id"
            type="text"
            className="form-control"
            placeholder="e.g. 123456789abcdef..."
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="form-group">
          <label htmlFor="cashfree-secret-key" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>
            CASHFREE_SECRET_KEY (Client Secret)
          </label>
          <input
            id="cashfree-secret-key"
            type="password"
            className="form-control"
            placeholder="Enter Cashfree Secret Key"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="cashfree-webhook-url" style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>
            Cashfree Webhook Callback URL
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              id="cashfree-webhook-url"
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
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <ShieldCheck size={14} /> {saving ? 'Validating…' : 'Save & Validate Cashfree'}
          </button>

          <a
            href="https://merchant.cashfree.com/merchants/login"
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
            Cashfree Merchant Dashboard <ExternalLink size={12} />
          </a>
        </div>
      </form>

      {statusMessage.text && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            fontSize: '0.82rem',
            color: statusMessage.type === 'success' ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};

export default CashfreeSettings;
