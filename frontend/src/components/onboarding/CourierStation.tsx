import React, { useState, useEffect } from 'react';
import { Check, Copy } from 'lucide-react';
import { Field } from './Field';
import { connectApi } from '../../lib/connect';

export type ProviderType =
  | 'shiprocket'
  | 'delhivery'
  | 'bluedart'
  | 'xpressbees'
  | 'shadowfax'
  | 'clickpost'
  | 'ecomexpress'
  | 'dtdc'
  | 'custom';

export interface CarrierDef {
  id: ProviderType;
  name: string;
  badge: string;
  icon: string;
  desc: string;
  apiGuide: string;
  apiInputs: Array<{
    field: string;
    label: string;
    placeholder: string;
    type?: string;
    optional?: boolean;
  }>;
}

const CARRIER_DEFS: CarrierDef[] = [
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    badge: 'Aggregator & Direct',
    icon: '🚀',
    desc: 'Pan-India logistics aggregator supporting 25+ courier partners.',
    apiGuide:
      'Enter your registered Shiprocket account Email & Password. RescueShip automatically handles API authentication and session refresh.',
    apiInputs: [
      { field: 'email', label: 'Shiprocket Email', placeholder: 'shipper@store.com' },
      { field: 'password', label: 'Shiprocket Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'delhivery',
    name: 'Delhivery',
    badge: 'Express & Surface',
    icon: '📦',
    desc: 'Express parcels, heavy surface cargo, and B2B logistics.',
    apiGuide: 'Login to Delhivery One → Settings → API Credentials → Copy your Client Token.',
    apiInputs: [
      { field: 'apiToken', label: 'Delhivery Client API Token', placeholder: 'e.g. 7f9a8b1c...' },
    ],
  },
  {
    id: 'bluedart',
    name: 'Blue Dart (DHL)',
    badge: 'Express Air & Surface',
    icon: '⚡',
    desc: 'Premium express air & priority surface courier with DHL worldwide network.',
    apiGuide:
      'From your Blue Dart contract welcome email or Account Manager: Login ID, License Key & Customer Account Code.',
    apiInputs: [
      { field: 'loginId', label: 'Blue Dart Login ID', placeholder: 'e.g. DEL00123' },
      { field: 'licenseKey', label: 'License Key', placeholder: '••••••••', type: 'password' },
      { field: 'customerCode', label: 'Customer Code (Optional)', placeholder: 'e.g. 123456', optional: true },
    ],
  },
  {
    id: 'xpressbees',
    name: 'Xpressbees',
    badge: 'E-com Logistics',
    icon: '🐝',
    desc: 'High-volume pan-India e-commerce express logistics network.',
    apiGuide: 'From Xpressbees Merchant Portal → Settings / API Management → Copy your XBKey.',
    apiInputs: [
      { field: 'apiKey', label: 'Xpressbees API Key (XBKey)', placeholder: 'e.g. xb_live_...' },
    ],
  },
  {
    id: 'shadowfax',
    name: 'Shadowfax',
    badge: 'Hyperlocal & 3PL',
    icon: '🥷',
    desc: 'Rapid hyperlocal dispatch and pan-India 3PL express delivery.',
    apiGuide:
      'From Shadowfax Flash Dashboard → Developer Settings → Copy your Authorization Token.',
    apiInputs: [
      { field: 'apiToken', label: 'Shadowfax Authorization Token', placeholder: 'e.g. token_shadow_...' },
    ],
  },
  {
    id: 'ecomexpress',
    name: 'Ecom Express',
    badge: 'E-com Dedicated',
    icon: '🚛',
    desc: 'End-to-end dedicated e-commerce delivery across 27,000+ PIN codes.',
    apiGuide:
      'Issued by your Ecom Express account manager: Shipper Username and API Password.',
    apiInputs: [
      { field: 'username', label: 'Ecom Express Username', placeholder: 'Account Username' },
      { field: 'password', label: 'API Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'dtdc',
    name: 'DTDC',
    badge: 'Express & Cargo',
    icon: '📮',
    desc: 'Pan-India express postal network, courier & cargo services.',
    apiGuide:
      'From DTDC Corporate Customer Portal → Web API Integration → Copy your X-Access-Token and Customer Code.',
    apiInputs: [
      { field: 'apiKey', label: 'DTDC API Key / Access Token', placeholder: 'e.g. dtdc_access_token_...' },
      { field: 'customerCode', label: 'Customer Code (Optional)', placeholder: 'e.g. CUST0098', optional: true },
    ],
  },
  {
    id: 'clickpost',
    name: 'ClickPost',
    badge: 'Multi-Courier Gateway',
    icon: '📡',
    desc: 'Multi-carrier tracking gateway and logistics post-purchase platform.',
    apiGuide: 'From ClickPost Dashboard → API & Integrations → Copy your ClickPost API Key.',
    apiInputs: [
      { field: 'apiKey', label: 'ClickPost API Key', placeholder: 'e.g. cp_api_key_...' },
    ],
  },
  {
    id: 'custom',
    name: 'Other / Custom / Aggregator',
    badge: 'Universal Webhook',
    icon: '🌐',
    desc: 'NimbusPost, Shipway, Shyplite, Speed Post / India Post, or in-house fleet.',
    apiGuide:
      'Universal webhook integration. Name your shipping provider and configure webhook notifications in their portal.',
    apiInputs: [
      { field: 'carrierName', label: 'Courier / Aggregator Name', placeholder: 'e.g. NimbusPost or India Post' },
      { field: 'apiKey', label: 'API Key / Secret Token (Optional)', placeholder: 'Optional webhook token or secret', optional: true },
    ],
  },
];

interface CourierStationProps {
  onConnect: (payload: any) => void;
  onDisconnect: (provider: string) => void;
  busy: any;
  provider?: string;
  carriers?: Record<string, any>;
  token: string | null;
  merchantId?: string;
  onNext?: () => void;
}

export function CourierStation({
  onConnect,
  onDisconnect,
  busy,
  provider,
  carriers,
  token,
  merchantId,
  onNext,
}: CourierStationProps) {
  // Map of connected carriers from backend state
  const connectedMap: Record<string, any> = {};
  if (carriers && Object.keys(carriers).length > 0) {
    for (const [k, v] of Object.entries(carriers)) {
      if ((v as any)?.status === 'connected') {
        connectedMap[k] = v;
      }
    }
  } else if (provider) {
    connectedMap[provider] = { status: 'connected', provider };
  }
  const connectedKeys = Object.keys(connectedMap);

  // Multi-select state: which carriers the user has picked to use
  const [selectedCarriers, setSelectedCarriers] = useState<ProviderType[]>(() => {
    if (connectedKeys.length > 0) {
      return Array.from(new Set([...(connectedKeys as ProviderType[]), 'shiprocket']));
    }
    return ['shiprocket'];
  });

  // Ensure connected carriers remain in selected list
  useEffect(() => {
    if (connectedKeys.length > 0) {
      setSelectedCarriers((prev) =>
        Array.from(new Set([...prev, ...(connectedKeys as ProviderType[])]))
      );
    }
  }, [carriers, provider, connectedKeys]);

  // Active carrier tab currently visible in configurator
  const [activeCarrier, setActiveCarrier] = useState<ProviderType>(() => {
    if (connectedKeys.length > 0) {
      const unconnected = selectedCarriers.find((k) => !connectedMap[k]);
      return unconnected || (connectedKeys[0] as ProviderType);
    }
    return 'shiprocket';
  });

  // Guard active tab when selections change
  useEffect(() => {
    if (!selectedCarriers.includes(activeCarrier) && selectedCarriers.length > 0) {
      setActiveCarrier(selectedCarriers[0]);
    }
  }, [selectedCarriers, activeCarrier]);

  // Connection mode toggle for the active carrier: 'api' (Direct API) vs 'webhook' (Zero Keys)
  const [connMode, setConnMode] = useState<'api' | 'webhook'>('api');

  // Input fields state
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [webhookData, setWebhookData] = useState<any[]>([]);

  // Fetch registered webhook URLs from API
  useEffect(() => {
    if (token) {
      connectApi
        .carrierWebhooks(token)
        .then((res: any) => {
          if (res?.carriers) setWebhookData(res.carriers);
        })
        .catch(() => {});
    }
  }, [token, provider, carriers]);

  const toggleCarrierSelect = (id: ProviderType) => {
    setSelectedCarriers((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least one selected
        return prev.filter((x) => x !== id);
      } else {
        const next = [...prev, id];
        setActiveCarrier(id);
        return next;
      }
    });
  };

  const currentDef = CARRIER_DEFS.find((c) => c.id === activeCarrier) || CARRIER_DEFS[0];
  const isCurrentConnected = !!connectedMap[activeCarrier];
  const currentConnectedData = connectedMap[activeCarrier];

  const getWebhookUrl = (providerKey: string) => {
    const found = webhookData.find((w) => w.provider === providerKey);
    if (found?.webhookUrl) return found.webhookUrl;
    const base = (
      import.meta.env.VITE_API_URL || 'https://rescueship.onrender.com'
    ).replace(/\/$/, '');
    const mid = merchantId || '';
    return `${base}/webhooks/${providerKey}/ndr${mid ? `?merchant_id=${encodeURIComponent(mid)}` : ''}`;
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleFieldChange = (field: string, val: string) => {
    setFormFields((prev) => ({ ...prev, [field]: val }));
  };

  const handleApiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { provider: activeCarrier };
    for (const inp of currentDef.apiInputs) {
      if (formFields[inp.field]) {
        payload[inp.field] = formFields[inp.field];
      }
    }
    onConnect(payload);
  };

  const handleWebhookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({
      provider: activeCarrier,
      webhookOnly: true,
      carrierName: formFields.carrierName || undefined,
      apiKey: formFields.apiKey || undefined,
    });
  };

  const activeWebhookUrl = getWebhookUrl(activeCarrier);

  return (
    <div className="ob-carrier-section">
      {/* ── 1. MULTI-SELECT DELIVERY PARTNER SELECTOR ── */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-1)' }}>
            1. Select Your Delivery Partners ({selectedCarriers.length} selected)
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--indigo-soft)', fontWeight: 600 }}>
            Multi-Select Enabled
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
          Pick every courier or aggregator your store uses. You can select multiple partners (e.g.
          Shiprocket for North, Blue Dart for South, or Other Aggregators).
        </p>

        <div className="ob-carrier-grid">
          {CARRIER_DEFS.map((c) => {
            const isSelected = selectedCarriers.includes(c.id);
            const isConn = !!connectedMap[c.id];
            return (
              <div
                key={c.id}
                className={`ob-carrier-card ${isSelected ? 'is-selected' : ''} ${isConn ? 'is-connected' : ''}`}
                onClick={() => toggleCarrierSelect(c.id)}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleCarrierSelect(c.id);
                  }
                }}
              >
                <div className="ob-carrier-card__top">
                  <span className="ob-carrier-card__icon">{c.icon}</span>
                  <div className="ob-carrier-card__check">
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
                {isConn && <span className="ob-carrier-card__status-dot">Active</span>}
                <div className="ob-carrier-card__name">{c.name}</div>
                <div className="ob-carrier-card__badge">{c.badge}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. SELECTED COURIERS CONFIGURATION TABS ── */}
      {selectedCarriers.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div
            style={{
              fontSize: '0.86rem',
              fontWeight: 700,
              color: 'var(--text-1)',
              marginBottom: '8px',
            }}
          >
            2. Configure Selected Partners
          </div>

          <div className="ob-carrier-tabs">
            {selectedCarriers.map((id) => {
              const def = CARRIER_DEFS.find((x) => x.id === id);
              if (!def) return null;
              const isConn = !!connectedMap[id];
              const isActive = activeCarrier === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`ob-carrier-tab ${isActive ? 'active' : ''} ${isConn ? 'connected' : ''}`}
                  onClick={() => setActiveCarrier(id)}
                >
                  <span>{def.icon}</span>
                  <span>{def.name}</span>
                  {isConn ? (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--emerald)',
                        padding: '1px 6px',
                        borderRadius: '8px',
                      }}
                    >
                      ✓ Active
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: 'var(--white-06)',
                        color: 'var(--text-3)',
                        padding: '1px 6px',
                        borderRadius: '8px',
                      }}
                    >
                      Setup
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── ACTIVE CARRIER CARD ── */}
          <div
            style={{
              marginTop: '14px',
              background: 'var(--white-02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>{currentDef.icon}</span>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--text-1)',
                    }}
                  >
                    {currentDef.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-3)' }}>
                    {currentDef.desc}
                  </p>
                </div>
              </div>
              {isCurrentConnected && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--emerald)',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontWeight: 600,
                  }}
                >
                  🟢 Connected
                </span>
              )}
            </div>

            {/* ── IF ALREADY CONNECTED ── */}
            {isCurrentConnected ? (
              <div className="ob-connected-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--emerald)', fontSize: '0.88rem' }}>
                      {currentDef.name} is Connected &amp; Monitoring
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-3)', marginTop: '2px' }}>
                      {currentConnectedData?.mode === 'webhook_only'
                        ? 'Mode: 🔗 Webhook Ingestion Active'
                        : 'Mode: ⚡ Direct 2-Way API Sync Active'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ob-btn ob-btn--ghost"
                    style={{ fontSize: '0.75rem', padding: '4px 12px', color: 'var(--rose)' }}
                    disabled={busy}
                    onClick={() => onDisconnect(activeCarrier)}
                  >
                    Disconnect
                  </button>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                  Delivery Failure &amp; NDR Webhook URL:
                </div>
                <div className="ob-webhook-box">
                  <span className="ob-webhook-code">{activeWebhookUrl}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeWebhookUrl)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--emerald)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Copy size={12} />
                    {copiedUrl === activeWebhookUrl ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>

                {/* Next steps buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {selectedCarriers.some((id) => !connectedMap[id]) && (
                    <button
                      type="button"
                      className="ob-btn ob-btn--ghost"
                      style={{ fontSize: '0.8rem', padding: '6px 14px', color: 'var(--indigo-soft)' }}
                      onClick={() => {
                        const nextUnconnected = selectedCarriers.find((id) => !connectedMap[id]);
                        if (nextUnconnected) setActiveCarrier(nextUnconnected);
                      }}
                    >
                      Configure Next Courier →
                    </button>
                  )}
                  {connectedKeys.length > 0 && onNext && (
                    <button
                      type="button"
                      className="ob-btn ob-btn--primary"
                      style={{ fontSize: '0.8rem', padding: '6px 16px' }}
                      onClick={onNext}
                    >
                      Continue to Payments Station →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── IF NOT YET CONNECTED: DUAL CONNECTION OPTIONS ── */
              <div>
                {/* Mode Selector Toggle */}
                <div style={{ marginBottom: '14px' }}>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-3)',
                      marginBottom: '6px',
                    }}
                  >
                    Choose Connection Method:
                  </div>
                  <div className="ob-mode-toggle">
                    <button
                      type="button"
                      className={`ob-mode-btn ${connMode === 'api' ? 'active' : ''}`}
                      onClick={() => setConnMode('api')}
                    >
                      <span>⚡ Direct API Integration</span>
                      <small>Full 2-Way Sync (Reattempt &amp; Address Push)</small>
                    </button>
                    <button
                      type="button"
                      className={`ob-mode-btn ${connMode === 'webhook' ? 'active' : ''}`}
                      onClick={() => setConnMode('webhook')}
                    >
                      <span>🔗 Webhook Mode (Zero Keys)</span>
                      <small>Instant Setup (No API Keys Required)</small>
                    </button>
                  </div>
                </div>

                {/* OPTION A: DIRECT API INTEGRATION */}
                {connMode === 'api' && (
                  <form className="ob-form" onSubmit={handleApiSubmit} style={{ maxWidth: '100%' }}>
                    {/* Platform Credential Location Guide */}
                    <div className="ob-guide-box">
                      <strong>💡 Where to find your credentials:</strong>
                      {currentDef.apiGuide}
                    </div>

                    {/* Inputs */}
                    {currentDef.apiInputs.map((inp) => (
                      <Field key={inp.field} label={inp.label}>
                        <input
                          className="ob-input"
                          type={inp.type || 'text'}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={inp.placeholder}
                          value={formFields[inp.field] || ''}
                          onChange={(e) => handleFieldChange(inp.field, e.target.value)}
                          required={!inp.optional}
                        />
                      </Field>
                    ))}

                    <p className="ob-note">
                      Validated directly against {currentDef.name}’s live API before storing. Encrypted
                      at rest (AES-256-GCM).
                    </p>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button className="ob-btn" disabled={busy}>
                        {busy ? 'Validating…' : `Validate & Connect ${currentDef.name}`}
                      </button>
                      <button
                        type="button"
                        className="ob-btn ob-btn--ghost"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => setConnMode('webhook')}
                      >
                        Don’t have API keys? Use Webhook instead
                      </button>
                    </div>
                  </form>
                )}

                {/* OPTION B: WEBHOOK-ONLY MODE (ZERO KEYS REQUIRED) */}
                {connMode === 'webhook' && (
                  <form
                    className="ob-form"
                    onSubmit={handleWebhookSubmit}
                    style={{ maxWidth: '100%' }}
                  >
                    <div
                      className="ob-guide-box"
                      style={{ background: 'var(--emerald-06)', borderColor: 'var(--emerald-20)' }}
                    >
                      <strong style={{ color: 'var(--emerald)' }}>
                        ✨ Instant 1-Click Connect — Zero API Keys Needed
                      </strong>
                      Don’t have developer API access or not sure what keys your courier platform uses?
                      Simply paste this Webhook URL into your {currentDef.name} tracking or webhook
                      settings. RescueShip will receive delivery failure events and trigger WhatsApp
                      rescue messages automatically!
                    </div>

                    {activeCarrier === 'custom' && (
                      <Field label="Custom Courier / Aggregator Name">
                        <input
                          className="ob-input"
                          placeholder="e.g. NimbusPost or Speed Post"
                          value={formFields.carrierName || ''}
                          onChange={(e) => handleFieldChange('carrierName', e.target.value)}
                          required
                        />
                      </Field>
                    )}

                    <div className="ob-field">
                      <span>{currentDef.name} Inbound Webhook URL</span>
                      <div className="ob-webhook-box">
                        <span className="ob-webhook-code">{activeWebhookUrl}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeWebhookUrl)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--emerald)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Copy size={12} />
                          {copiedUrl === activeWebhookUrl ? 'Copied!' : 'Copy URL'}
                        </button>
                      </div>
                    </div>

                    <p className="ob-note">
                      <strong>How to activate:</strong> Copy the URL above, paste it in{' '}
                      {currentDef.name} dashboard → <em>Webhooks / NDR Notifications</em>, then click
                      Activate below.
                    </p>

                    <button className="ob-btn ob-btn--primary" disabled={busy}>
                      {busy ? 'Activating…' : `Activate Webhook Mode for ${currentDef.name}`}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. BOTTOM ADVANCE BAR ── */}
      {connectedKeys.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px 18px',
            background: 'var(--emerald-06)',
            border: '1px solid var(--emerald-20)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--emerald)' }}>
              🎉 {connectedKeys.length} Courier Partner{connectedKeys.length === 1 ? '' : 's'} Active
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-3)', marginTop: '2px' }}>
              Connected:{' '}
              {connectedKeys
                .map((k) => CARRIER_DEFS.find((d) => d.id === k)?.name || k)
                .join(', ')}
            </div>
          </div>
          {onNext && (
            <button
              type="button"
              className="ob-btn ob-btn--primary"
              style={{ fontSize: '0.84rem', padding: '8px 18px' }}
              onClick={onNext}
            >
              Proceed to Payments Station (Step 4) →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CourierStation;
