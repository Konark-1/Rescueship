import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { RazorpaySettings } from '../components/settings/RazorpaySettings';
import { CashfreeSettings } from '../components/settings/CashfreeSettings';
import { WhatsAppTemplates } from '../components/settings/WhatsAppTemplates';

interface SettingsState {
  ndrRescueEnabled: boolean;
  preDeliveryConfirmationEnabled: boolean;
  codConversionEnabled: boolean;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountCap: number;
  rtoArrestEnabled: boolean;
  language: 'en' | 'hi';
  escalationRemindersEnabled: boolean;
}

interface ToggleProps {
  id?: string;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ id, label, sublabel, checked, onChange, disabled }) => {
  return (
    <label
      htmlFor={id}
      className={`toggle-control ${disabled ? 'toggle-control--disabled' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-3-5) var(--space-4)',
        background: 'var(--white-02)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        gap: 'var(--space-4)',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 2 }}>{sublabel}</div>}
      </div>
      <div style={{ position: 'relative', width: 44, height: 24, flexShrink: 0 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
        />
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: checked ? 'var(--emerald)' : 'var(--border)',
            borderRadius: 24,
            transition: 'background-color 0.2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              height: 18,
              width: 18,
              left: checked ? 23 : 3,
              bottom: 3,
              backgroundColor: '#fff',
              borderRadius: '50%',
              transition: 'left 0.2s',
            }}
          />
        </span>
      </div>
    </label>
  );
};

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [paymentGateway, setPaymentGateway] = useState<'razorpay' | 'cashfree'>('razorpay');

  const [settings, setSettings] = useState<SettingsState>({
    ndrRescueEnabled: true,
    preDeliveryConfirmationEnabled: true,
    codConversionEnabled: true,
    discountType: 'percentage',
    discountValue: 5,
    discountCap: 0,
    rtoArrestEnabled: true,
    language: 'en',
    escalationRemindersEnabled: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/settings');
        const s = res.data?.settings || res.data || {};
        setSettings({
          ndrRescueEnabled: s.ndrRescue?.enabled ?? true,
          preDeliveryConfirmationEnabled: s.preDeliveryConfirmation?.enabled ?? true,
          codConversionEnabled: s.codConversion?.enabled ?? true,
          discountType: (s.codConversion?.incentiveType as 'percentage' | 'flat') || 'percentage',
          discountValue: s.codConversion?.incentiveAmount ?? 5,
          discountCap: s.codConversion?.discountCap ?? 0,
          rtoArrestEnabled: s.rtoArrest?.enabled ?? (s.ndrRescue?.rtoArrestEnabled ?? true),
          language: (s.ndrRescue?.messageLanguage || s.codConversion?.messageLanguage || 'en') as 'en' | 'hi',
          escalationRemindersEnabled: s.ndrRescue?.escalationEnabled ?? true,
        });
      } catch (err) {
        console.error('Failed to fetch settings', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const payload = {
        settings: {
          ndrRescue: {
            enabled: settings.ndrRescueEnabled,
            escalationEnabled: settings.escalationRemindersEnabled,
            messageLanguage: settings.language,
            rtoArrestEnabled: settings.rtoArrestEnabled,
            escalationChain: [4, 12, 24],
          },
          preDeliveryConfirmation: {
            enabled: settings.preDeliveryConfirmationEnabled,
          },
          codConversion: {
            enabled: settings.codConversionEnabled,
            incentiveType: settings.discountType,
            incentiveAmount: Number(settings.discountValue),
            discountCap: Number(settings.discountCap) || 0,
            messageLanguage: settings.language,
          },
          rtoArrest: {
            enabled: settings.rtoArrestEnabled,
          },
        },
      };

      await api.put('/api/settings', payload);
      setMessage({ text: 'Settings saved successfully.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Failed to save settings.';
      setMessage({ text: errMsg, type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="panel">
          <div className="panel__body" style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
            Loading settings…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      {/* Page Header */}
      <header className="page-head">
        <div>
          <h1 className="page-head__title">Settings</h1>
          <p className="page-head__sub">
            Manage autonomous delivery rescues, COD incentives, and notification policies.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </header>

      {/* Status message */}
      {message.text && (
        <div
          className={`alert ${message.type === 'success' ? 'alert--ok' : 'alert--bad'} fade-in-up`}
          role="status"
        >
          {message.text}
        </div>
      )}

      {/* Section 0: 🔌 Couriers & Multi-Carrier Hub */}
      <section className="panel fade-in-up">
        <div className="panel__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <span className="panel__title">🔌 Couriers & Multi-Carrier Hub</span>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-3)' }}>
              Connect multi-carrier APIs (Shiprocket, Delhivery, Blue Dart, Xpressbees, Shadowfax, ClickPost) & copy carrier webhook URLs.
            </p>
          </div>
          <Link to="/onboarding?station=carrier" className="btn btn-primary btn-sm">
            Manage Couriers & Webhooks →
          </Link>
        </div>
      </section>

      {/* Section 1: 🚚 Delivery Rescues */}
      <section className="panel fade-in-up">
        <div className="panel__head">
          <span className="panel__title">🚚 Delivery Rescues</span>
        </div>
        <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Toggle
            id="toggle-ndr-rescues"
            label="Enable autonomous NDR rescues"
            sublabel="Automatically initiate WhatsApp communication with customer when a delivery attempt fails."
            checked={settings.ndrRescueEnabled}
            onChange={(checked) => setSettings((s) => ({ ...s, ndrRescueEnabled: checked }))}
          />
          <Toggle
            id="toggle-pre-delivery"
            label="Send pre-delivery confirmations (high-risk orders)"
            sublabel="Verify address and availability ahead of dispatch on high-risk RTO predictions."
            checked={settings.preDeliveryConfirmationEnabled}
            onChange={(checked) => setSettings((s) => ({ ...s, preDeliveryConfirmationEnabled: checked }))}
          />
        </div>
      </section>

      {/* Section 2: 💳 COD → Prepaid Conversion */}
      <section className="panel fade-in-up">
        <div className="panel__head">
          <span className="panel__title">💳 COD → Prepaid Conversion</span>
        </div>
        <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Toggle
            id="toggle-cod-discounts"
            label="Offer UPI discounts to COD customers"
            sublabel="Incentivize customers to convert Cash on Delivery orders to instant prepaid via UPI."
            checked={settings.codConversionEnabled}
            onChange={(checked) => setSettings((s) => ({ ...s, codConversionEnabled: checked }))}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="discount-type-select">
                Discount Type
              </label>
              <select
                id="discount-type-select"
                className="form-control"
                value={settings.discountType}
                onChange={(e) => setSettings((s) => ({ ...s, discountType: e.target.value as 'percentage' | 'flat' }))}
                disabled={!settings.codConversionEnabled}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="discount-value-input">
                Discount Value
              </label>
              <input
                id="discount-value-input"
                type="number"
                min="0"
                max={settings.discountType === 'percentage' ? 50 : 2000}
                className="form-control"
                placeholder={settings.discountType === 'percentage' ? 'e.g. 5' : 'e.g. 50'}
                value={settings.discountValue}
                onChange={(e) => setSettings((s) => ({ ...s, discountValue: Number(e.target.value) }))}
                disabled={!settings.codConversionEnabled}
              />
            </div>

            {settings.discountType === 'percentage' && (
              <div className="form-group">
                <label className="form-label" htmlFor="discount-cap-input">
                  Max Cap Limit (₹)
                </label>
                <input
                  id="discount-cap-input"
                  type="number"
                  min="0"
                  max="10000"
                  className="form-control"
                  placeholder="e.g. 100 (0 for no cap)"
                  value={settings.discountCap}
                  onChange={(e) => setSettings((s) => ({ ...s, discountCap: Number(e.target.value) }))}
                  disabled={!settings.codConversionEnabled}
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>Payment Gateway Provider</span>
              <div style={{ display: 'inline-flex', padding: 2, background: 'var(--bg-input, #12121a)', borderRadius: 'var(--radius-sm, 8px)', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setPaymentGateway('razorpay')}
                  className={`btn btn-xs ${paymentGateway === 'razorpay' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: '6px', fontSize: '0.8rem', padding: '4px 12px' }}
                >
                  Razorpay
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentGateway('cashfree')}
                  className={`btn btn-xs ${paymentGateway === 'cashfree' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: '6px', fontSize: '0.8rem', padding: '4px 12px' }}
                >
                  Cashfree
                </button>
              </div>
            </div>

            {paymentGateway === 'razorpay' ? <RazorpaySettings /> : <CashfreeSettings />}
          </div>
        </div>
      </section>

      {/* Section 3: 🚨 RTO Arrest */}
      <section className="panel fade-in-up">
        <div className="panel__head">
          <span className="panel__title">🚨 RTO Arrest</span>
        </div>
        <div className="panel__body">
          <Toggle
            id="toggle-rto-arrest"
            label="Attempt to halt RTO via UPI payment"
            sublabel="Trigger instant emergency retention link when courier attempts to flag package for return to origin."
            checked={settings.rtoArrestEnabled}
            onChange={(checked) => setSettings((s) => ({ ...s, rtoArrestEnabled: checked }))}
          />
        </div>
      </section>

      {/* Section 4: 💬 WhatsApp Settings */}
      <section className="panel fade-in-up">
        <div className="panel__head">
          <span className="panel__title">💬 WhatsApp Settings</span>
        </div>
        <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="whatsapp-language-select">
              Language
            </label>
            <select
              id="whatsapp-language-select"
              className="form-control"
              value={settings.language}
              onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value as 'en' | 'hi' }))}
              style={{ maxWidth: '300px' }}
            >
              <option value="en">English (en)</option>
              <option value="hi">Hindi (hi)</option>
            </select>
          </div>

          <Toggle
            id="toggle-escalation-reminders"
            label="Send escalation reminders (4h, 12h, 24h)"
            sublabel="Deliver staggered rescue prompts if customer does not respond to initial delivery exception message."
            checked={settings.escalationRemindersEnabled}
            onChange={(checked) => setSettings((s) => ({ ...s, escalationRemindersEnabled: checked }))}
          />

          <div style={{ marginTop: 'var(--space-4)' }}>
            <WhatsAppTemplates />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="settings-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-2)' }}>
        <Link to="/sandbox" className="btn btn-ghost">
          🧪 Test Mode (Sandbox)
        </Link>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </footer>
    </div>
  );
};

export default SettingsPage;
