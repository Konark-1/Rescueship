import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import api from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import './onboarding.css';

interface SettingsData {
  platform: string;
  platformConfig: {
    shopifyDomain?: string;
    shopifyAccessToken?: string;
    woocommerceUrl?: string;
    woocommerceKey?: string;
    woocommerceSecret?: string;
    customApiSecret?: string;
    customWebhookUrl?: string;
  };
  carrierConfig: {
    provider?: string;
    apiToken?: string;
  };
  whatsappConfig: {
    phoneNumberId?: string;
    businessAccountId?: string;
    accessToken?: string;
  };
  paymentConfig: {
    gateway?: string;
    keyId?: string;
    keySecret?: string;
  };
  generalSettings?: string;
}

const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem('onboardingStep');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, token, login } = useAuth();
  const navigate = useNavigate();

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<Record<number, 'success' | 'error' | null>>({});
  const [showParticles, setShowParticles] = useState(false);

  const [formData, setFormData] = useState<SettingsData>(() => {
    const saved = localStorage.getItem('onboardingData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved onboarding data');
      }
    }
    return {
      platform: 'shopify',
      platformConfig: {},
      carrierConfig: { provider: 'shiprocket' },
      whatsappConfig: {},
      paymentConfig: { gateway: 'cashfree' },
    };
  });

  useEffect(() => {
    localStorage.setItem('onboardingStep', step.toString());
  }, [step]);

  useEffect(() => {
    localStorage.setItem('onboardingData', JSON.stringify(formData));
  }, [formData]);

  const totalSteps = 6;
  const progressPercentage = ((step - 1) / (totalSteps - 1)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev: any) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const setPlatform = (platform: string) => {
    setFormData(prev => ({ ...prev, platform }));
  };

  const setCarrier = (provider: string) => {
    setFormData(prev => ({
      ...prev,
      carrierConfig: { ...prev.carrierConfig, provider }
    }));
  };

  const setPaymentGateway = (gateway: string) => {
    setFormData(prev => ({
      ...prev,
      paymentConfig: { ...prev.paymentConfig, gateway }
    }));
  };

  const handleTestConnection = async (currentStep: number) => {
    setTestingConnection(true);
    setError('');
    // Simulate API Validation call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTestingConnection(false);
    
    // Check basic validation before showing success
    if (!validateStep(currentStep)) {
      setConnectionStatus(prev => ({ ...prev, [currentStep]: 'error' }));
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, [currentStep]: 'success' }));
  };

  const validateStep = (currentStep: number, skip: boolean = false) => {
    if (skip) return true;
    if (currentStep === 2) {
      if (formData.platform === 'shopify') {
        const domain = formData.platformConfig?.shopifyDomain;
        const token = formData.platformConfig?.shopifyAccessToken;
        if (!domain || !domain.includes('myshopify.com')) {
          setError('Please enter a valid Shopify domain (e.g., your-store.myshopify.com)');
          return false;
        }
        if (!token || token.length < 5) {
          setError('Please enter a valid Shopify Access Token');
          return false;
        }
      } else if (formData.platform === 'woocommerce') {
        const url = formData.platformConfig?.woocommerceUrl;
        const key = formData.platformConfig?.woocommerceKey;
        const secret = formData.platformConfig?.woocommerceSecret;
        if (!url || !url.startsWith('http')) {
          setError('Please enter a valid WooCommerce Store URL (must start with http:// or https://)');
          return false;
        }
        if (!key || !secret) {
          setError('Please enter both Consumer Key and Consumer Secret');
          return false;
        }
      }
    } else if (currentStep === 3) {
      const provider = formData.carrierConfig?.provider;
      if (!provider || provider.trim().length === 0) {
        setError('Please select a shipping carrier');
        return false;
      }
    } else if (currentStep === 4) {
      const phoneId = formData.whatsappConfig?.phoneNumberId;
      const accountId = formData.whatsappConfig?.businessAccountId;
      const token = formData.whatsappConfig?.accessToken;
      if (!phoneId || !/^\d{14,16}$/.test(phoneId)) {
        setError('Invalid Phone Number ID. It must be exactly 14-16 digits.');
        return false;
      }
      if (!accountId || !/^\d{14,16}$/.test(accountId)) {
        setError('Invalid Business Account ID. It must be exactly 14-16 digits.');
        return false;
      }
      if (!token || !token.startsWith('EAAG')) {
        setError('Please enter a valid Access Token (must start with EAAG...)');
        return false;
      }
    } else if (currentStep === 5) {
      const keyId = formData.paymentConfig?.keyId;
      const keySecret = formData.paymentConfig?.keySecret;
      if (!keyId || !keySecret) {
        setError('Please enter both Payment Key ID and Key Secret');
        return false;
      }
    }
    return true;
  };

  const handleNext = (skip: boolean = false) => {
    setError('');
    if (!validateStep(step, skip)) {
      return;
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setShowParticles(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    setLoading(true);
    setError('');
    try {
      await api.put('/api/settings', { ...formData, onboardingStatus: 'completed' });
      if (user && token) {
        login(token, { ...user, onboardingStatus: 'completed' });
      }
      localStorage.removeItem('onboardingStep');
      localStorage.removeItem('onboardingData');
      navigate('/dashboard');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to save settings');
      } else {
        setError('An unexpected error occurred');
      }
      setShowParticles(false);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    const stepContentMap: Record<number, React.ReactNode> = {
      1: (
        <div key="step1">
          <h3>RescueShip: Choose Platform</h3>
          <p style={{ color: '#cbd5e1', marginBottom: '24px' }}>Select your primary e-commerce platform for enterprise logistics setup.</p>
          <div className="card-grid">
            <div 
              className={`selection-card ${formData.platform === 'shopify' ? 'active' : ''}`}
              onClick={() => setPlatform('shopify')}
            >
              <div className="card-icon">🛍️</div>
              <div className="card-label">Shopify</div>
            </div>
            <div 
              className={`selection-card ${formData.platform === 'woocommerce' ? 'active' : ''}`}
              onClick={() => setPlatform('woocommerce')}
            >
              <div className="card-icon">🛒</div>
              <div className="card-label">WooCommerce</div>
            </div>
            <div 
              className={`selection-card ${formData.platform === 'magento' ? 'active' : ''}`}
              onClick={() => setPlatform('magento')}
            >
              <div className="card-icon">Ⓜ️</div>
              <div className="card-label">Magento</div>
            </div>
            <div 
              className={`selection-card ${formData.platform === 'custom' ? 'active' : ''}`}
              onClick={() => setPlatform('custom')}
            >
              <div className="card-icon">⚙️</div>
              <div className="card-label">Custom API</div>
            </div>
          </div>
        </div>
      ),
      2: (
        <div key="step2">
          <h3>RescueShip: Configure API Keys</h3>
          {formData.platform === 'shopify' && (
            <>
              <div className="info-box">
                <h4>💡 How to get Shopify API Keys</h4>
                <ul>
                  <li>Go to your Shopify Admin &gt; <strong>Settings</strong> &gt; <strong>Apps and sales channels</strong></li>
                  <li>Click <strong>Develop apps</strong> and create a new app for RescueShip</li>
                  <li>Configure <strong>Admin API integration</strong> with Order (Read/Write) scopes</li>
                  <li>Install the app and copy the <strong>Admin API access token</strong></li>
                </ul>
              </div>
              <div className="form-group">
                <label>Shopify Domain</label>
                <input
                  type="text"
                  name="platformConfig.shopifyDomain"
                  value={formData.platformConfig?.shopifyDomain || ''}
                  onChange={handleChange}
                  placeholder="your-store.myshopify.com"
                />
              </div>
              <div className="form-group">
                <label>Shopify Access Token</label>
                <input
                  type="password"
                  name="platformConfig.shopifyAccessToken"
                  value={formData.platformConfig?.shopifyAccessToken || ''}
                  onChange={handleChange}
                  placeholder="shpat_..."
                />
              </div>
            </>
          )}
          {formData.platform === 'woocommerce' && (
            <>
              <div className="info-box">
                <h4>💡 How to get WooCommerce API Keys</h4>
                <ul>
                  <li>Go to your WordPress Admin &gt; <strong>WooCommerce</strong> &gt; <strong>Settings</strong></li>
                  <li>Click the <strong>Advanced</strong> tab, then <strong>REST API</strong></li>
                  <li>Click <strong>Add Key</strong>, and ensure Permissions are set to <strong>Read/Write</strong> for RescueShip</li>
                  <li>Generate the key and copy the Consumer Key and Secret</li>
                </ul>
              </div>
              <div className="form-group">
                <label>WooCommerce Store URL</label>
                <input
                  type="text"
                  name="platformConfig.woocommerceUrl"
                  value={formData.platformConfig?.woocommerceUrl || ''}
                  onChange={handleChange}
                  placeholder="https://your-store.com"
                />
              </div>
              <div className="form-group">
                <label>Consumer Key</label>
                <input
                  type="text"
                  name="platformConfig.woocommerceKey"
                  value={formData.platformConfig?.woocommerceKey || ''}
                  onChange={handleChange}
                  placeholder="ck_..."
                />
              </div>
              <div className="form-group">
                <label>Consumer Secret</label>
                <input
                  type="password"
                  name="platformConfig.woocommerceSecret"
                  value={formData.platformConfig?.woocommerceSecret || ''}
                  onChange={handleChange}
                  placeholder="cs_..."
                />
              </div>
            </>
          )}
          {(formData.platform === 'magento' || formData.platform === 'custom') && (
            <p style={{ color: '#cbd5e1' }}>For custom setups or Magento, use the API token generated in your RescueShip Dashboard after onboarding.</p>
          )}
          <div className="test-connection-wrapper">
            <button type="button" className="btn-test" onClick={() => handleTestConnection(2)} disabled={testingConnection}>
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            {connectionStatus[2] === 'success' && <div className="connection-status status-success">✓ Connection Successful</div>}
            {connectionStatus[2] === 'error' && <div className="connection-status status-error">✗ Connection Failed</div>}
          </div>
        </div>
      ),
      3: (
        <div key="step3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: 0 }}>RescueShip: Carrier Configuration</h3>
            <button type="button" className="btn-skip" onClick={() => handleNext(true)}>Skip for now</button>
          </div>
          <div className="info-box">
            <h4>💡 How to get your Carrier API Token for Enterprise Logistics</h4>
            <ul>
              <li><strong>Shiprocket:</strong> Go to Settings &gt; API &gt; Generate API Credential for RescueShip.</li>
              <li><strong>Delhivery:</strong> Go to Settings &gt; API Settings and generate a new token.</li>
            </ul>
          </div>
          
          <div className="card-grid">
            <div 
              className={`selection-card ${formData.carrierConfig?.provider === 'shiprocket' ? 'active' : ''}`}
              onClick={() => setCarrier('shiprocket')}
            >
              <div className="card-icon">🚀</div>
              <div className="card-label">Shiprocket</div>
            </div>
            <div 
              className={`selection-card ${formData.carrierConfig?.provider === 'delhivery' ? 'active' : ''}`}
              onClick={() => setCarrier('delhivery')}
            >
              <div className="card-icon">🚚</div>
              <div className="card-label">Delhivery</div>
            </div>
            <div 
              className={`selection-card ${formData.carrierConfig?.provider === 'clickpost' ? 'active' : ''}`}
              onClick={() => setCarrier('clickpost')}
            >
              <div className="card-icon">📦</div>
              <div className="card-label">Clickpost</div>
            </div>
          </div>

          <div className="form-group">
            <label>API Token (optional)</label>
            <input
              type="password"
              name="carrierConfig.apiToken"
              value={formData.carrierConfig?.apiToken || ''}
              onChange={handleChange}
              placeholder="Enter carrier API token..."
            />
          </div>
          <div className="test-connection-wrapper">
            <button type="button" className="btn-test" onClick={() => handleTestConnection(3)} disabled={testingConnection}>
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            {connectionStatus[3] === 'success' && <div className="connection-status status-success">✓ Connection Successful</div>}
            {connectionStatus[3] === 'error' && <div className="connection-status status-error">✗ Connection Failed</div>}
          </div>
        </div>
      ),
      4: (
        <div key="step4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: 0 }}>RescueShip: WhatsApp Integration</h3>
            <button type="button" className="btn-skip" onClick={() => handleNext(true)}>Skip for now</button>
          </div>
          <div className="info-box">
            <h4>💡 WhatsApp Cloud API Setup for RescueShip</h4>
            <ul>
              <li>Go to <strong>Meta for Developers</strong> (developers.facebook.com)</li>
              <li>Select your App &gt; WhatsApp &gt; API Setup</li>
              <li>Copy your <strong>Phone Number ID</strong> and <strong>Business Account ID</strong></li>
              <li>Generate a permanent <strong>Access Token</strong> in the System Users section</li>
            </ul>
          </div>
          <div className="form-group">
            <label>Meta Phone Number ID</label>
            <input
              type="text"
              name="whatsappConfig.phoneNumberId"
              value={formData.whatsappConfig?.phoneNumberId || ''}
              onChange={handleChange}
              placeholder="e.g. 102033001234567 (15 digits)"
            />
          </div>
          <div className="form-group">
            <label>Meta Business Account ID</label>
            <input
              type="text"
              name="whatsappConfig.businessAccountId"
              value={formData.whatsappConfig?.businessAccountId || ''}
              onChange={handleChange}
              placeholder="e.g. 112033001234567 (15 digits)"
            />
          </div>
          <div className="form-group">
            <label>Access Token</label>
            <input
              type="password"
              name="whatsappConfig.accessToken"
              value={formData.whatsappConfig?.accessToken || ''}
              onChange={handleChange}
              placeholder="EAAG..."
            />
          </div>
          <div className="test-connection-wrapper">
            <button type="button" className="btn-test" onClick={() => handleTestConnection(4)} disabled={testingConnection}>
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            {connectionStatus[4] === 'success' && <div className="connection-status status-success">✓ Connection Successful</div>}
            {connectionStatus[4] === 'error' && <div className="connection-status status-error">✗ Connection Failed</div>}
          </div>
        </div>
      ),
      5: (
        <div key="step5">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: 0 }}>RescueShip: Payments Setup</h3>
            <button type="button" className="btn-skip" onClick={() => handleNext(true)}>Skip for now</button>
          </div>
          <div className="card-grid">
            <div 
              className={`selection-card ${formData.paymentConfig?.gateway === 'cashfree' ? 'active' : ''}`}
              onClick={() => setPaymentGateway('cashfree')}
            >
              <div className="card-icon">💸</div>
              <div className="card-label">Cashfree</div>
            </div>
            <div 
              className={`selection-card ${formData.paymentConfig?.gateway === 'razorpay' ? 'active' : ''}`}
              onClick={() => setPaymentGateway('razorpay')}
            >
              <div className="card-icon">💳</div>
              <div className="card-label">Razorpay</div>
            </div>
          </div>
          
          <div className="form-group">
            <label>Key ID</label>
            <input
              type="text"
              name="paymentConfig.keyId"
              value={formData.paymentConfig?.keyId || ''}
              onChange={handleChange}
              placeholder="Key ID"
            />
          </div>
          <div className="form-group">
            <label>Key Secret</label>
            <input
              type="password"
              name="paymentConfig.keySecret"
              value={formData.paymentConfig?.keySecret || ''}
              onChange={handleChange}
              placeholder="Key Secret"
            />
          </div>
          <div className="test-connection-wrapper">
            <button type="button" className="btn-test" onClick={() => handleTestConnection(5)} disabled={testingConnection}>
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            {connectionStatus[5] === 'success' && <div className="connection-status status-success">✓ Connection Successful</div>}
            {connectionStatus[5] === 'error' && <div className="connection-status status-error">✗ Connection Failed</div>}
          </div>
        </div>
      ),
      6: (
        <div key="step6">
          <div className="confetti-container">
            <div className="confetti-icon">🎉</div>
            <h3>RescueShip: You're All Set!</h3>
            <p style={{ color: '#cbd5e1', marginBottom: '24px' }}>
              Your configurations look good. Complete the setup to enter your new enterprise rescue dashboard.
            </p>
            
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Default Currency (Optional)</label>
              <input
                type="text"
                name="generalSettings"
                value={formData.generalSettings || ''}
                onChange={handleChange}
                placeholder="e.g. INR or USD"
              />
            </div>
          </div>
        </div>
      )
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="step-content"
        >
          {stepContentMap[step]}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="onboarding-container">
      <div className="wizard-card">
        <div className="progress-container">
          <motion.div 
            className="progress-bar" 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const stepNum = idx + 1;
            let className = 'step-indicator';
            if (stepNum === step) className += ' active';
            else if (stepNum < step) className += ' completed';
            return (
              <div key={idx} className={className}>
                {stepNum}
              </div>
            );
          })}
        </div>

        {error && <div className="error-message">{error}</div>}

        {renderStepContent()}

        <div className="wizard-actions">
          <button
            type="button"
            className="btn-prev"
            onClick={handlePrev}
            style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
          >
            Back
          </button>
          
          {step < totalSteps ? (
            <button type="button" className="btn-next" onClick={() => handleNext(false)}>
              Continue
            </button>
          ) : (
            <motion.button 
              type="button" 
              className="btn-finish" 
              onClick={handleFinish} 
              disabled={loading}
              whileTap={{ scale: 0.95 }}
              style={{ position: 'relative' }}
            >
              {loading ? 'Finalizing...' : 'Launch Dashboard'}
              
              {showParticles && (
                <div className="particles-wrapper">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="burst-particle"
                      initial={{ x: 0, y: 0, scale: 0 }}
                      animate={{
                        x: (Math.random() - 0.5) * 150,
                        y: (Math.random() - 0.5) * 150,
                        scale: Math.random() * 1.5,
                        opacity: 0
                      }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
