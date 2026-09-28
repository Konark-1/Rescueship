import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { TabPill } from '../components/motion/TabPill';
import { Eye, EyeOff, Activity, Power, Send } from 'lucide-react';

interface CodConversionSettings {
  enabled: boolean;
  incentiveType: 'flat' | 'percentage';
  incentiveAmount: number;
  minOrderValue: number;
}

interface SettingsData {
  platformUrl: string;
  platformApiKey: string;
  carrierName: string;
  carrierApiKey: string;
  whatsappToken: string;
  paymentGatewayKey: string;
  codConversion?: CodConversionSettings;
  settings?: {
    codConversion?: CodConversionSettings;
    aiProvider?: string;
  };
}

const tabs = [
  { id: 'platform', label: 'Platform' },
  { id: 'carrier', label: 'Carrier' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'payment', label: 'Payments' },
  { id: 'codConversion', label: 'COD Retention' },
  { id: 'ai', label: 'AI Provider' }
];

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>({
    platformUrl: '',
    platformApiKey: '',
    carrierName: '',
    carrierApiKey: '',
    whatsappToken: '',
    paymentGatewayKey: '',
    codConversion: {
      enabled: true,
      incentiveType: 'percentage',
      incentiveAmount: 5,
      minOrderValue: 0
    }
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
        const cod = res.data.settings?.codConversion || res.data.codConversion || {
          enabled: true,
          incentiveType: 'percentage',
          incentiveAmount: 5,
          minOrderValue: 0
        };
        setSettings({
          ...res.data,
          codConversion: cod
        });
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

  const handleCodChange = (field: keyof CodConversionSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      codConversion: {
        ...(prev.codConversion || { enabled: true, incentiveType: 'percentage', incentiveAmount: 5, minOrderValue: 0 }),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const payload = {
        ...settings,
        settings: {
          ...settings.settings,
          codConversion: settings.codConversion
        }
      };
      await api.put('/api/settings', payload);
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
          <div className="panel__body" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', fontSize: '0.9rem' }}>
            Loading settings…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      <header className="page-head">
        <div>
          <h1 className="page-head__title">Settings</h1>
          <p className="page-head__sub">Manage store integrations, credentials, and automated recovery preferences.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </header>

      {/* Emergency pause */}
      <div className={`alert ${globalPause ? 'alert--bad' : 'alert--ok'} fade-in-up`}>
        <div className="alert__main">
          <Activity size={20} color={globalPause ? 'var(--rose)' : 'var(--emerald)'} />
          <div>
            <p className="alert__title">{globalPause ? 'Emergency pause active' : 'Automated recovery active'}</p>
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

            {activeTab === 'codConversion' && (
              <TabSection
                key="codConversion"
                title="COD Retention & Prepaid Conversion"
                desc="Self-funding retention engine: Incentivize customers to convert COD orders to prepaid, saving ₹40–₹80 in courier cash collection fees and eliminating RTO reverse shipping."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {/* Enable / Disable Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--bg-surface-2, rgba(255,255,255,0.03))', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                        Enable COD-to-Prepaid Retention Offers
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>
                        Automatically offer customers a discount to pay via instant UPI before cancellation or during delivery friction.
                      </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.codConversion?.enabled ?? true}
                        onChange={(e) => handleCodChange('enabled', e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: (settings.codConversion?.enabled ?? true) ? 'var(--emerald)' : 'var(--border)',
                          borderRadius: 24,
                          transition: '0.2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            height: 18,
                            width: 18,
                            left: (settings.codConversion?.enabled ?? true) ? 23 : 3,
                            bottom: 3,
                            backgroundColor: '#fff',
                            borderRadius: '50%',
                            transition: '0.2s',
                          }}
                        />
                      </span>
                    </label>
                  </div>

                  {/* Incentive Type Dropdown */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="cod-incentive-type">Incentive Type</label>
                    <select
                      id="cod-incentive-type"
                      className="form-control"
                      value={settings.codConversion?.incentiveType || 'percentage'}
                      onChange={(e) => handleCodChange('incentiveType', e.target.value as 'flat' | 'percentage')}
                      disabled={!(settings.codConversion?.enabled ?? true)}
                    >
                      <option value="percentage">Percentage Discount (%)</option>
                      <option value="flat">Flat Amount Discount (₹)</option>
                    </select>
                  </div>

                  {/* Incentive Value Input */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="cod-incentive-amount">
                      {settings.codConversion?.incentiveType === 'flat' ? 'Incentive Amount (₹)' : 'Incentive Percentage (%)'}
                    </label>
                    <input
                      id="cod-incentive-amount"
                      type="number"
                      min="0"
                      max={settings.codConversion?.incentiveType === 'flat' ? 2000 : 50}
                      className="form-control"
                      placeholder={settings.codConversion?.incentiveType === 'flat' ? 'e.g. 50' : 'e.g. 5'}
                      value={settings.codConversion?.incentiveAmount ?? 5}
                      onChange={(e) => handleCodChange('incentiveAmount', Number(e.target.value))}
                      disabled={!(settings.codConversion?.enabled ?? true)}
                    />
                  </div>

                  {/* Min Order Value Input */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="cod-min-order-val">
                      Minimum Order Value for Retention (₹)
                    </label>
                    <input
                      id="cod-min-order-val"
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="0 (applies to all orders)"
                      value={settings.codConversion?.minOrderValue ?? 0}
                      onChange={(e) => handleCodChange('minOrderValue', Number(e.target.value))}
                      disabled={!(settings.codConversion?.enabled ?? true)}
                    />
                  </div>

                  {/* Unit Economics Callout */}
                  <div style={{ padding: 'var(--space-3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.82rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 600, color: 'var(--emerald)' }}>
                      💡 Anti-Exploitation & Logistics Unit Economics
                    </div>
                    <div>
                      When a customer accepts this offer, they pay via UPI immediately. Your brand saves the ~₹60 courier COD handling charge, speeds up cash reconciliation by 7–14 days, and prevents an RTO freight loss (₹140+).
                    </div>
                  </div>
                </div>
              </TabSection>
            )}

            {activeTab === 'ai' && (
              <TabSection key="ai" title="AI provider" desc="Select which AI model powers smart responses and image analysis.">
                <AiProviderSelector />
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

/* ── AI Provider Selector ── */
const AiProviderSelector: React.FC = () => {
  const [providers, setProviders] = useState<{ kieAi: boolean; gemini: boolean }>({ kieAi: false, gemini: false });
  const [activeProvider, setActiveProvider] = useState<string>('kieAi');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await api.get('/api/settings/ai-providers');
        setProviders(res.data.providers);
        setActiveProvider(res.data.activeProvider || 'kieAi');
      } catch {
        // Endpoint not available yet — show both as unavailable
        setProviders({ kieAi: false, gemini: false });
      }
    };
    fetchProviders();
  }, []);

  const handleSwitch = async (provider: string) => {
    setSaving(true);
    setMessage('');
    try {
      await api.put('/api/settings', { settings: { aiProvider: provider } });
      setActiveProvider(provider);
      setMessage('AI provider updated');
    } catch {
      setMessage('Failed to update');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: 'var(--space-2)' }}>
        {providers.kieAi || providers.gemini
          ? 'Available providers based on server configuration:'
          : 'No AI providers configured on the server. Add API keys to the backend .env file.'}
      </p>

      {/* KIE AI (GPT-6) */}
      <ProviderCard
        name="KIE AI · GPT-6 Astra"
        id="kieAi"
        configured={providers.kieAi}
        active={activeProvider === 'kieAi'}
        disabled={saving}
        onSelect={() => handleSwitch('kieAi')}
      />

      {/* Gemini */}
      <ProviderCard
        name="Google Gemini · 2.5 Flash"
        id="gemini"
        configured={providers.gemini}
        active={activeProvider === 'gemini'}
        disabled={saving}
        onSelect={() => handleSwitch('gemini')}
      />

      {message && (
        <p style={{ fontSize: '0.8rem', color: message.includes('Failed') ? 'var(--rose)' : 'var(--emerald)', fontFamily: 'var(--font-mono)' }}>
          {message}
        </p>
      )}
    </div>
  );
};

interface ProviderCardProps {
  name: string;
  id: string;
  configured: boolean;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ name, id, configured, active, disabled, onSelect }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-3) var(--space-4)',
      background: active ? 'rgba(79,70,229,0.08)' : 'var(--bg-input)',
      border: `1px solid ${active ? 'var(--indigo)' : configured ? 'var(--border-color)' : 'rgba(255,255,255,0.04)'}`,
      borderRadius: 8,
      cursor: configured ? 'pointer' : 'not-allowed',
      opacity: configured ? 1 : 0.5,
      transition: 'all 0.15s ease',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: configured ? (active ? 'var(--emerald)' : 'var(--text-3)') : 'var(--rose)',
          flexShrink: 0,
        }}
      />
      <div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>{name}</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
          {configured ? (active ? 'Active' : 'Available') : 'Not configured'}
        </span>
      </div>
    </div>
    <input
      type="radio"
      name="aiProvider"
      value={id}
      checked={active}
      disabled={disabled || !configured}
      onChange={onSelect}
      style={{ accentColor: 'var(--indigo)', width: 16, height: 16 }}
    />
  </label>
);

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
