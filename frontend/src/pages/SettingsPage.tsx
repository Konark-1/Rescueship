import React, { useState, useEffect } from 'react';
import api from '../services/api';

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
  const [message, setMessage] = useState('');

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
    setMessage('');
    try {
      await api.put('/api/settings', settings);
      setMessage('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      setMessage('Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'platform', label: 'Platform Connection' },
    { id: 'carrier', label: 'Carrier Config' },
    { id: 'whatsapp', label: 'WhatsApp Meta' },
    { id: 'payment', label: 'Payment Gateway' },
    { id: 'features', label: 'Feature Toggles' }
  ];

  if (loading) {
    return <div className="glass-card"><h2>Settings</h2><p>Loading...</p></div>;
  }

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h2>Settings</h2>
      
      <div style={{ display: 'flex', gap: '15px', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '300px' }}>
        {activeTab === 'platform' && (
          <div>
            <h3>Platform Connection</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Platform URL</label>
              <input type="text" name="platformUrl" value={settings.platformUrl} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Platform API Key</label>
              <input type="password" name="platformApiKey" value={settings.platformApiKey} onChange={handleChange} placeholder="••••••••••••••••" style={{ width: '100%', padding: '8px' }} />
              <small style={{ color: '#888' }}>Masked for security. Entering a new value overrides the existing one.</small>
            </div>
          </div>
        )}

        {activeTab === 'carrier' && (
          <div>
            <h3>Carrier Configuration</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Carrier Name</label>
              <input type="text" name="carrierName" value={settings.carrierName} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Carrier API Key</label>
              <input type="password" name="carrierApiKey" value={settings.carrierApiKey} onChange={handleChange} placeholder="••••••••••••••••" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div>
            <h3>WhatsApp Meta Setup</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>WhatsApp Token</label>
              <input type="password" name="whatsappToken" value={settings.whatsappToken} onChange={handleChange} placeholder="••••••••••••••••" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div>
            <h3>Payment Gateway Setup</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Payment Gateway Key</label>
              <input type="password" name="paymentGatewayKey" value={settings.paymentGatewayKey} onChange={handleChange} placeholder="••••••••••••••••" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div>
            <h3>Feature Toggles</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" name="enableNotifications" checked={settings.enableNotifications} onChange={handleChange} />
                Enable Push Notifications
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" name="enableAutoFulfillment" checked={settings.enableAutoFulfillment} onChange={handleChange} />
                Enable Auto Fulfillment
              </label>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {message && <span style={{ marginLeft: '15px', color: message.includes('success') ? 'green' : 'red' }}>{message}</span>}
      </div>
    </div>
  );
};

export default SettingsPage;
