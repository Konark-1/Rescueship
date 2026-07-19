import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [formData, setFormData] = useState<SettingsData>({
    platform: 'shopify',
    platformConfig: {},
    carrierConfig: {},
    whatsappConfig: {},
    paymentConfig: {},
  });

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

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');
    try {
      await api.put('/api/settings', formData);
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
            <div className="form-group">
              <label>WhatsApp Business Number</label>
              <input
                type="text"
                name="whatsappConfig.phoneNumberId"
                value={formData.whatsappConfig?.phoneNumberId || ''}
                onChange={handleChange}
                placeholder="Phone Number ID"
              />
              <br />
              <label>Business Account ID</label>
              <input
                type="text"
                name="whatsappConfig.businessAccountId"
                value={formData.whatsappConfig?.businessAccountId || ''}
                onChange={handleChange}
                placeholder="Business Account ID"
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
      </div>
    </div>
  );
};

export default OnboardingPage;
