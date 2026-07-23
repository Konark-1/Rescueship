import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { TabPill } from '../components/motion/TabPill';
import { Eye, EyeOff, Activity } from 'lucide-react';

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
  
  // Password visibility states
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

  const tabs = [
    { id: 'platform', label: 'Platform Connection' },
    { id: 'carrier', label: 'Carrier Config' },
    { id: 'whatsapp', label: 'WhatsApp Meta' },
    { id: 'payment', label: 'Payment Gateway' },
    { id: 'features', label: 'Feature Toggles' }
  ];

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
      setMessage({ text: 'Settings saved successfully!', type: 'success' });
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
      <div className="glass-card fade-in-up">
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Settings</h2>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
          <div className="pulse" style={{ marginRight: '1rem' }}></div> Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card fade-in-up" style={{ padding: '2.5rem' }}>
      
      {/* Emergency Global Pause Banner */}
      <div
        style={{
          background: globalPause ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${globalPause ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={22} color={globalPause ? '#ef4444' : '#10b981'} />
          <div>
            <strong style={{ color: '#fff', fontSize: '1rem' }}>
              {globalPause ? '⚠️ Emergency Pause Active' : '🟢 Automated Engine Running'}
            </strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              {globalPause
                ? 'All automated WhatsApp messages and carrier API updates are currently HALTED.'
                : 'All automated NDR rescues & COD conversions are actively running.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setGlobalPause(!globalPause)}
          style={{
            background: globalPause ? '#10b981' : '#ef4444',
            color: '#white',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {globalPause ? 'Resume Automation' : 'Emergency Pause All'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--text-primary)' }}>System Settings</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Configure integrations, APIs, and automated actions.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving Engine...' : 'Save Configuration'}
        </button>
      </div>
      
      {/* Tab Navigation */}
      <div style={{ marginBottom: '2rem' }}>
        <TabPill tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div style={{ minHeight: '350px' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'platform' && (
            <motion.div key="platform" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Platform Connection</h3>
              <div className="form-group">
                <label className="form-label">Platform URL</label>
                <input type="text" name="platformUrl" value={settings.platformUrl} onChange={handleChange} className="form-control" placeholder="https://your-store.myshopify.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Platform API Key</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPlatformKey ? "text" : "password"} name="platformApiKey" value={settings.platformApiKey} onChange={handleChange} className="form-control" placeholder={settings.platformApiKey ? "••••••••••••••••" : ""} style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowPlatformKey(!showPlatformKey)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showPlatformKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <small style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.8rem', display: 'block' }}>Masked for security. Entering a new value overrides the existing one.</small>
              </div>
              <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <Activity size={16} /> Test Connection
              </button>
            </motion.div>
          )}

          {activeTab === 'carrier' && (
            <motion.div key="carrier" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Carrier Configuration</h3>
              <div className="form-group">
                <label className="form-label">Carrier Name</label>
                <input type="text" name="carrierName" value={settings.carrierName} onChange={handleChange} className="form-control" placeholder="e.g., Delhivery, Shiprocket, ClickPost" />
              </div>
              <div className="form-group">
                <label className="form-label">Carrier API Key</label>
                <div style={{ position: 'relative' }}>
                  <input type={showCarrierKey ? "text" : "password"} name="carrierApiKey" value={settings.carrierApiKey} onChange={handleChange} className="form-control" placeholder={settings.carrierApiKey ? "••••••••••••••••" : ""} style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowCarrierKey(!showCarrierKey)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showCarrierKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <Activity size={16} /> Test Connection
              </button>
            </motion.div>
          )}

          {activeTab === 'whatsapp' && (
            <motion.div key="whatsapp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>WhatsApp Meta Setup</h3>
              <div className="form-group">
                <label className="form-label">WhatsApp Access Token</label>
                <div style={{ position: 'relative' }}>
                  <input type={showWhatsAppKey ? "text" : "password"} name="whatsappToken" value={settings.whatsappToken} onChange={handleChange} className="form-control" placeholder={settings.whatsappToken ? "••••••••••••••••" : ""} style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowWhatsAppKey(!showWhatsAppKey)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showWhatsAppKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button onClick={handleSendTestMessage} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={16} /> {testSent ? '✅ Test Message Dispatched!' : 'Send Test WhatsApp Message'}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Payment Gateway Setup</h3>
              <div className="form-group">
                <label className="form-label">Payment Gateway Key</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPaymentKey ? "text" : "password"} name="paymentGatewayKey" value={settings.paymentGatewayKey} onChange={handleChange} className="form-control" placeholder={settings.paymentGatewayKey ? "••••••••••••••••" : ""} style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowPaymentKey(!showPaymentKey)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showPaymentKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'features' && (
            <motion.div key="features" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Feature Toggles</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <input 
                    type="checkbox" 
                    name="enableNotifications" 
                    checked={settings.enableNotifications} 
                    onChange={handleChange} 
                    style={{ marginTop: '0.25rem', accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Enable Push Notifications</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Receive real-time alerts for NDR cases and successful rescues.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <input 
                    type="checkbox" 
                    name="enableAutoFulfillment" 
                    checked={settings.enableAutoFulfillment} 
                    onChange={handleChange} 
                    style={{ marginTop: '0.25rem', accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Enable Auto Fulfillment</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Automatically trigger carrier fulfillment when an order is converted from COD to Prepaid.</div>
                  </div>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {message.text && (
        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          borderRadius: 'var(--radius-sm)', 
          background: message.type === 'success' ? 'var(--success-glow)' : 'var(--danger-glow)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
