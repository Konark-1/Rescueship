import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import api from '../services/api';
import './onboarding.css';

interface SettingsData {
  platform: string;
  platformConfig: {
    shopifyDomain?: string;
    shopifyAccessToken?: string;
    woocommerceUrl?: string;
    woocommerceKey?: string;
    woocommerceSecret?: string;
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
      carrierConfig: {},
      whatsappConfig: {},
      paymentConfig: {},
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

  const validateStep = (currentStep: number) => {
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
      } else if (formData.platform === 'custom') {
        const secret = formData.platformConfig?.customApiSecret;
        if (!secret || secret.length < 5) {
          setError('Please enter a valid Custom API Secret (minimum 5 characters)');
          return false;
        }
      }
    } else if (currentStep === 3) {
      const provider = formData.carrierConfig?.provider;
      if (!provider || provider.trim().length === 0) {
        setError('Please enter a preferred shipping carrier (e.g., shiprocket, clickpost)');
        return false;
      }
    } else if (currentStep === 4) {
      const phoneId = formData.whatsappConfig?.phoneNumberId;
      const accountId = formData.whatsappConfig?.businessAccountId;
      const token = formData.whatsappConfig?.accessToken;
      if (!phoneId || !/^\d{14,16}$/.test(phoneId)) {
        setError('Invalid Phone Number ID. It must be exactly 14-16 digits (found on your Meta dashboard), NOT your actual phone number.');
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

  const handleNext = () => {
    setError('');
    if (!validateStep(step)) {
      return;
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      await api.put('/api/settings', { onboardingStatus: 'skipped' });
      if (user && token) {
        login(token, { ...user, onboardingStatus: 'skipped' });
      }
      localStorage.removeItem('onboardingStep');
      localStorage.removeItem('onboardingData');
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to skip onboarding', err);
      navigate('/dashboard'); // Still let them go
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content" key="step1">
            <h3>Step 1: Choose Platform</h3>
            <div className="form-group">
              <label>Select your e-commerce platform</label>
              <select name="platform" value={formData.platform} onChange={handleChange}>
                <option value="shopify">Shopify</option>
                <option value="woocommerce">WooCommerce</option>
                <option value="magento">Magento</option>
                <option value="custom">Custom API</option>
              </select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="step-content" key="step2">
            <h3>Step 2: Configure API Keys</h3>
            {formData.platform === 'shopify' && (
              <>
                <div className="info-box" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#818cf8' }}>💡 How to get Shopify API Keys</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <li>Go to your Shopify Admin &gt; <strong>Settings</strong> &gt; <strong>Apps and sales channels</strong></li>
                    <li>Click <strong>Develop apps</strong> and create a new app</li>
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
                <div className="info-box" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#818cf8' }}>💡 How to get WooCommerce API Keys</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <li>Go to your WordPress Admin &gt; <strong>WooCommerce</strong> &gt; <strong>Settings</strong></li>
                    <li>Click the <strong>Advanced</strong> tab, then <strong>REST API</strong></li>
                    <li>Click <strong>Add Key</strong>, and ensure Permissions are set to <strong>Read/Write</strong></li>
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
              <p>For custom setups or Magento, use the API token generated in your RescueShip Dashboard after onboarding.</p>
            )}
          </div>
        );
      case 3:
        return (
          <div className="step-content" key="step3">
            <h3>Step 3: Carrier Configuration</h3>
            <div className="info-box" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#818cf8' }}>💡 How to get your Carrier API Token</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <li><strong>Shiprocket:</strong> Go to Settings &gt; API &gt; Generate API Credential.</li>
                <li><strong>Delhivery:</strong> Go to Settings &gt; API Settings and generate a new token.</li>
              </ul>
            </div>
            <div className="form-group">
              <label>Preferred Shipping Carrier</label>
              <input
                type="text"
                name="carrierConfig.provider"
                value={formData.carrierConfig?.provider || ''}
                onChange={handleChange}
                placeholder="e.g., shiprocket, clickpost"
              />
              <br />
              <label>API Token (optional)</label>
              <input
                type="password"
                name="carrierConfig.apiToken"
                value={formData.carrierConfig?.apiToken || ''}
                onChange={handleChange}
                placeholder="Token..."
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="step-content" key="step4">
            <h3>Step 4: WhatsApp Integration</h3>
            <div className="info-box" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#818cf8' }}>💡 WhatsApp Cloud API Setup</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <li>Go to <strong>Meta for Developers</strong> (developers.facebook.com)</li>
                <li>Select your App &gt; WhatsApp &gt; API Setup</li>
                <li>Copy your <strong>Phone Number ID</strong> and <strong>Business Account ID</strong></li>
                <li>Generate a permanent <strong>Access Token</strong> in the System Users section</li>
              </ul>
            </div>
            <div className="form-group">
              <label>Meta Phone Number ID (NOT your actual phone number)</label>
              <input
                type="text"
                name="whatsappConfig.phoneNumberId"
                value={formData.whatsappConfig?.phoneNumberId || ''}
                onChange={handleChange}
                placeholder="e.g. 102033001234567 (15 digits)"
              />
              <br />
              <label>Meta Business Account ID</label>
              <input
                type="text"
                name="whatsappConfig.businessAccountId"
                value={formData.whatsappConfig?.businessAccountId || ''}
                onChange={handleChange}
                placeholder="e.g. 112033001234567 (15 digits)"
              />
              <br />
              <label>Access Token</label>
              <input
                type="password"
                name="whatsappConfig.accessToken"
                value={formData.whatsappConfig?.accessToken || ''}
                onChange={handleChange}
                placeholder="EAAG..."
              />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="step-content" key="step5">
            <h3>Step 5: Payments Setup</h3>
            <div className="form-group">
              <label>Payment Gateway</label>
              <select 
                name="paymentConfig.gateway" 
                value={formData.paymentConfig?.gateway || 'cashfree'} 
                onChange={handleChange}
              >
                <option value="cashfree">Cashfree</option>
                <option value="razorpay">Razorpay</option>
              </select>
              <br />
              <label>Key ID</label>
              <input
                type="text"
                name="paymentConfig.keyId"
                value={formData.paymentConfig?.keyId || ''}
                onChange={handleChange}
                placeholder="Key ID"
              />
              <br />
              <label>Key Secret</label>
              <input
                type="password"
                name="paymentConfig.keySecret"
                value={formData.paymentConfig?.keySecret || ''}
                onChange={handleChange}
                placeholder="Key Secret"
              />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="step-content" key="step6">
            <h3>Step 6: General Settings</h3>
            <div className="form-group">
              <label>Default Currency</label>
              <input
                type="text"
                name="generalSettings"
                value={formData.generalSettings}
                onChange={handleChange}
                placeholder="USD"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <div className="wizard-card">
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progressPercentage}%` }}></div>
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

        {error && <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>}

        {renderStepContent()}

        <div className="wizard-actions">
          <button
            type="button"
            className="btn-prev"
            onClick={handlePrev}
            style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
          >
            Previous
          </button>
          
          {step < totalSteps ? (
            <button type="button" className="btn-next" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button type="button" className="btn-finish" onClick={handleFinish} disabled={loading}>
              {loading ? 'Saving...' : 'Finish Setup'}
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button 
            type="button" 
            onClick={handleSkip} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              textDecoration: 'underline', 
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Skip for now and go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
