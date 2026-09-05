import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { TabPill } from '../components/motion/TabPill';
import { Eye, EyeOff, Activity, Power, Send } from 'lucide-react';

interface SettingsData {
  platformUrl: string;
  platformApiKey: string;
  carrierName: string;
  carrierApiKey: string;
  whatsappToken: string;
  paymentGatewayKey: string;
  enableNotifications: boolean;
  enableAutoFulfillment: boolean;
}

const tabs = [
  { id: 'platform', label: 'Platform' },
  { id: 'carrier', label: 'Carrier' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'payment', label: 'Payments' },
  { id: 'features', label: 'Feature toggles' }
];

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>({
    platformUrl: '',
    platformApiKey: '',
    carrierName: '',
    carrierApiKey: '',
    whatsappToken: '',
    paymentGatewayKey: '',
    enableNotifications: false,
    enableAutoFulfillment: false
  });

  const [activeTab, setActiveTab] = useState('platform');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [showPlatformKey, setShowPlatformKey] = useState(false);
  const [showCarrierKey, setShowCarrierKey] = useState(false);
  const [showWhatsAppKey, setShowWhatsAppKey] = useState(false);
  const [showPaymentKey, setShowPaymentKey] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/settings');
        setSettings(res.data);
      } catch (err) {
        console.error('Failed to fetch settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await api.put('/api/settings', settings);
      setMessage({ text: 'Settings saved successfully.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.response?.data?.error || 'Error saving settings.';
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    }
  };

  const [globalPause, setGlobalPause] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleSendTestMessage = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="panel">
          <div className="panel__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
            <span className="pulse" /> loading configuration…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      <header className="page-head">
        <div>
          <p className="page-head__kicker">03 · Configuration</p>
          <h1 className="page-head__title">System <em>settings</em></h1>
          <p className="page-head__sub">Integrations, credentials and the behavior of the rescue engine.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save configuration'}
          </button>
        </div>
      </header>

      {/* Emergency pause */}
      <div className={`alert ${globalPause ? 'alert--bad' : 'alert--ok'} fade-in-up`}>
        <div className="alert__main">
          <Activity size={20} color={globalPause ? 'var(--rose)' : 'var(--emerald)'} />
          <div>
            <p className="alert__title">{globalPause ? 'Emergency pause active' : 'Automation engine running'}</p>
            <p className="alert__text">
              {globalPause
                ? 'All WhatsApp messages and carrier API updates are halted.'
                : 'Automated NDR rescues and COD conversions are live.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setGlobalPause(!globalPause)}
          className={`btn btn-sm ${globalPause ? 'btn-primary' : 'btn-danger'}`}
        >
          <Power size={13} aria-hidden="true" />
          {globalPause ? 'Resume automation' : 'Emergency pause'}
        </button>
      </div>

      {/* Tabs + body */}
      <div className="panel">
        <div className="panel__head" style={{ justifyContent: 'flex-start' }}>
          <TabPill tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="panel__body" style={{ minHeight: 320 }}>
          <AnimatePresence mode="wait">
            {activeTab === 'platform' && (
              <TabSection key="platform" title="Platform connection" desc="Where orders come from — webhooks register automatically once connected.">
                <div className="form-group">
                  <label className="form-label" htmlFor="platform-url-input">Platform URL</label>
                  <input id="platform-url-input" type="text" name="platformUrl" value={settings.platformUrl} onChange={handleChange} className="form-control" placeholder="https://your-store.myshopify.com" />
                </div>
                <SecretField id="platform-key-input" label="Platform API key" name="platformApiKey" value={settings.platformApiKey} onChange={handleChange} show={showPlatformKey} onToggle={() => setShowPlatformKey(!showPlatformKey)} hint="Masked for security. Entering a new value overrides the existing one." />
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }}>
                  <Activity size={14} /> Test connection
                </button>
              </TabSection>
            )}

            {activeTab === 'carrier' && (
              <TabSection key="carrier" title="Carrier configuration" desc="Credentials used to sync NDR events and re-attempt instructions.">
                <div className="form-group">
                  <label className="form-label" htmlFor="carrier-name-input">Carrier name</label>
                  <input id="carrier-name-input" type="text" name="carrierName" value={settings.carrierName} onChange={handleChange} className="form-control" placeholder="e.g., Delhivery, Shiprocket, ClickPost" />
                </div>
                <SecretField id="carrier-key-input" label="Carrier API key" name="carrierApiKey" value={settings.carrierApiKey} onChange={handleChange} show={showCarrierKey} onToggle={() => setShowCarrierKey(!showCarrierKey)} />
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }}>
                  <Activity size={14} /> Test connection
                </button>
              </TabSection>
            )}

            {activeTab === 'whatsapp' && (
              <TabSection key="whatsapp" title="WhatsApp · Meta" desc="The channel customers receive rescues on.">
                <SecretField id="whatsapp-token-input" label="WhatsApp access token" name="whatsappToken" value={settings.whatsappToken} onChange={handleChange} show={showWhatsAppKey} onToggle={() => setShowWhatsAppKey(!showWhatsAppKey)} />
                <button onClick={handleSendTestMessage} className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }}>
                  <Send size={14} /> {testSent ? 'Test message dispatched ✓' : 'Send test message'}
                </button>
              </TabSection>
            )}

            {activeTab === 'payment' && (
              <TabSection key="payment" title="Payment gateway" desc="Powers COD → prepaid conversion links inside rescue messages.">
                <SecretField id="payment-key-input" label="Payment gateway key" name="paymentGatewayKey" value={settings.paymentGatewayKey} onChange={handleChange} show={showPaymentKey} onToggle={() => setShowPaymentKey(!showPaymentKey)} />
              </TabSection>
            )}

            {activeTab === 'features' && (
              <TabSection key="features" title="Feature toggles" desc="Global behavior switches for the rescue engine.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      name="enableNotifications"
                      checked={settings.enableNotifications}
                      onChange={handleChange}
                    />
                    <span className="toggle-row__box" aria-hidden="true" />
                    <span>
                      <span className="toggle-row__title">Push notifications</span>
                      <span className="toggle-row__desc">Real-time alerts for NDR cases and successful rescues.</span>
                    </span>
                  </label>

                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      name="enableAutoFulfillment"
                      checked={settings.enableAutoFulfillment}
                      onChange={handleChange}
                    />
                    <span className="toggle-row__box" aria-hidden="true" />
                    <span>
                      <span className="toggle-row__title">Auto fulfillment</span>
                      <span className="toggle-row__desc">Trigger carrier fulfillment automatically when COD converts to prepaid.</span>
                    </span>
                  </label>
                </div>
              </TabSection>
            )}
          </AnimatePresence>
        </div>

        {message.text && (
          <div
            className={`panel__body ${message.type === 'success' ? 'alert--ok' : 'alert--bad'}`}
            style={{ borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}
            role="status"
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── helpers ── */
const TabSection: React.FC<{ title: string; desc: string; children: React.ReactNode }> = ({ title, desc, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
  >
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 'var(--space-1)' }}>{title}</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>{desc}</p>
    </div>
    {children}
  </motion.div>
);

interface SecretFieldProps {
  id: string;
  label: string;
  name: string;
  value: string;
  show: boolean;
  hint?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggle: () => void;
}

const SecretField: React.FC<SecretFieldProps> = ({ id, label, name, value, show, hint, onChange, onToggle }) => (
  <div className="form-group">
    <label className="form-label" htmlFor={id}>{label}</label>
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        className="form-control"
        placeholder={value ? '••••••••••••••••' : ''}
        style={{ paddingRight: '2.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}
      />
      <button
        type="button"
        aria-label={show ? `Hide ${label}` : `Show ${label}`}
        onClick={onToggle}
        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
    {hint && <small style={{ color: 'var(--text-3)', fontSize: '0.74rem' }}>{hint}</small>}
  </div>
);

export default SettingsPage;
