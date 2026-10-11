import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  MessageSquare,
  Truck,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  X,
  Play,
  Check,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { connectApi } from '../lib/connect';

export interface CarrierDef {
  id: string;
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
    apiGuide: 'Enter your registered Shiprocket account Email & Password. RescueShip verifies and securely encrypts your credentials.',
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
    apiGuide: 'From your Blue Dart contract welcome email: Login ID, License Key & Customer Account Code.',
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
    apiGuide: 'From Shadowfax Flash Dashboard → Developer Settings → Copy your Authorization Token.',
    apiInputs: [
      { field: 'apiToken', label: 'Shadowfax Authorization Token', placeholder: 'e.g. token_shadow_...' },
    ],
  },
  {
    id: 'ecomexpress',
    name: 'Ecom Express',
    badge: 'E-com Dedicated',
    icon: '🚛',
    desc: 'Dedicated e-commerce delivery across 27,000+ PIN codes.',
    apiGuide: 'Issued by your Ecom Express account manager: Shipper Username and API Password.',
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
    apiGuide: 'From DTDC Corporate Customer Portal → Web API Integration → Copy your X-Access-Token.',
    apiInputs: [
      { field: 'apiKey', label: 'DTDC API Key / Access Token', placeholder: 'e.g. dtdc_access_token_...' },
      { field: 'customerCode', label: 'Customer Code (Optional)', placeholder: 'e.g. CUST0098', optional: true },
    ],
  },
  {
    id: 'clickpost',
    name: 'ClickPost',
    badge: 'Gateway',
    icon: '📡',
    desc: 'Multi-carrier tracking gateway and logistics post-purchase platform.',
    apiGuide: 'From ClickPost Dashboard → API & Integrations → Copy your ClickPost API Key.',
    apiInputs: [
      { field: 'apiKey', label: 'ClickPost API Key', placeholder: 'e.g. cp_api_key_...' },
    ],
  },
  {
    id: 'custom',
    name: 'Other / Custom Aggregator',
    badge: 'Universal Webhook',
    icon: '🌐',
    desc: 'NimbusPost, Shipway, Shyplite, Speed Post, or in-house fleet.',
    apiGuide: 'Universal webhook integration. Name your shipping provider and configure webhook notifications in their portal.',
    apiInputs: [
      { field: 'carrierName', label: 'Courier / Aggregator Name', placeholder: 'e.g. NimbusPost' },
      { field: 'apiKey', label: 'API Key / Secret Token (Optional)', placeholder: 'Optional secret token', optional: true },
    ],
  },
];

export const ConnectedApisPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectState, setConnectState] = useState<any>(null);
  const [webhookData, setWebhookData] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Connect new shipment modal state
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierDef>(CARRIER_DEFS[0]);
  const [connMode, setConnMode] = useState<'api' | 'webhook'>('api');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [connectingBusy, setConnectingBusy] = useState(false);
  const [pulseBusy, setPulseBusy] = useState(false);

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showNotification(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [s, w] = await Promise.all([
        connectApi.state(token).catch(() => null),
        connectApi.carrierWebhooks(token).catch(() => null),
      ]);
      setConnectState(s);
      setWebhookData(w);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load connections', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Disconnect a carrier
  const handleDisconnectCarrier = async (provider: string) => {
    if (!token) return;
    const confirm = window.confirm(`Are you sure you want to disconnect ${provider.toUpperCase()}? RescueShip will stop intercepting NDRs for this courier.`);
    if (!confirm) return;

    try {
      await connectApi.carrierDisconnect(token, provider);
      showNotification(`${provider.toUpperCase()} disconnected successfully.`);
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to disconnect carrier', 'error');
    }
  };

  // Submit connect new shipment
  const handleConnectShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setConnectingBusy(true);
    try {
      const payload: any = {
        provider: selectedCarrier.id,
        webhookOnly: connMode === 'webhook',
        ...formFields,
      };

      await connectApi.carrier(token, payload);
      showNotification(`${selectedCarrier.name} successfully connected!`);
      setShowShipmentModal(false);
      setFormFields({});
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Carrier connection failed. Please verify credentials.', 'error');
    } finally {
      setConnectingBusy(false);
    }
  };

  // Send WhatsApp test pulse
  const handleTestPulse = async () => {
    if (!token) return;
    setPulseBusy(true);
    try {
      await connectApi.testPulse(token);
      showNotification('Test message dispatched successfully to your registered number!');
    } catch (err: any) {
      showNotification(err.message || 'Could not send test pulse.', 'error');
    } finally {
      setPulseBusy(false);
    }
  };

  // Gather connected carriers
  const conns = connectState?.connections || {};
  const shopify = conns.shopify || {};
  const whatsapp = conns.whatsapp || {};
  const carrierConn = conns.carrier || {};
  const carriersMap = conns.carriers || {};

  // Build list of active carriers
  const activeCarriers: Array<{
    id: string;
    name: string;
    icon: string;
    badge: string;
    status: string;
    mode: string;
    connectedAt?: string;
    webhookUrl?: string;
    webhookSecret?: string;
  }> = [];

  // Check carriers map first
  if (carriersMap && Object.keys(carriersMap).length > 0) {
    for (const [key, val] of Object.entries(carriersMap)) {
      if ((val as any)?.status === 'connected') {
        const def = CARRIER_DEFS.find((d) => d.id === key);
        const whItem = webhookData?.carriers?.find((c: any) => c.provider === key);
        activeCarriers.push({
          id: key,
          name: def?.name || (val as any)?.carrierName || key.toUpperCase(),
          icon: def?.icon || '🚚',
          badge: def?.badge || 'Courier Partner',
          status: 'connected',
          mode: (val as any)?.mode === 'webhook' ? 'Webhook' : 'Direct API',
          connectedAt: (val as any)?.connectedAt,
          webhookUrl: whItem?.webhookUrl || webhookData?.webhookUrl,
          webhookSecret: whItem?.webhookSecret || webhookData?.webhookSecret,
        });
      }
    }
  } else if (carrierConn?.status === 'connected') {
    const key = carrierConn.provider || 'shiprocket';
    const def = CARRIER_DEFS.find((d) => d.id === key);
    activeCarriers.push({
      id: key,
      name: def?.name || carrierConn.carrierName || key.toUpperCase(),
      icon: def?.icon || '🚚',
      badge: def?.badge || 'Courier Partner',
      status: 'connected',
      mode: carrierConn.mode === 'webhook' ? 'Webhook' : 'Direct API',
      connectedAt: carrierConn.connectedAt,
      webhookUrl: webhookData?.webhookUrl,
      webhookSecret: webhookData?.webhookSecret,
    });
  }

  const isShopifyConnected = shopify.status === 'connected';
  const isWhatsAppConnected = whatsapp.status === 'connected';
  const isWhatsAppPending = whatsapp.status === 'templates_pending';

  return (
    <div className="page" style={{ maxWidth: 1120, margin: '0 auto', paddingBottom: 'var(--space-8)' }}>
      {/* Toast Alert */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderRadius: 8,
            backgroundColor: toastType === 'success' ? '#064e3b' : '#7f1d1d',
            color: '#fff',
            border: `1px solid ${toastType === 'success' ? '#059669' : '#dc2626'}`,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          {toastType === 'success' ? <CheckCircle2 size={18} color="#34d399" /> : <AlertCircle size={18} color="#f87171" />}
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="page-head" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <div className="page-head__kicker">
            <Zap size={13} color="var(--indigo)" /> System Integrations &amp; APIs
          </div>
          <h1 className="page-head__title">Connected APIs</h1>
          <p className="page-head__sub">
            Real-time status of your store, WhatsApp Cloud API, and active courier shipment logistics.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Syncing...' : 'Refresh Status'}
          </button>
        </div>
      </header>

      {/* Grid of Storefront & WhatsApp APIs */}
      <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-5)' }}>
        
        {/* ── CARD 1: SHOPIFY API ── */}
        <div className="panel panel--accent" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
              <ShoppingBag size={15} color="var(--emerald)" /> Storefront API (Shopify)
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                backgroundColor: isShopifyConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: isShopifyConnected ? 'var(--emerald)' : 'var(--rose)',
                border: `1px solid ${isShopifyConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: isShopifyConnected ? 'var(--emerald)' : 'var(--rose)',
                }}
              />
              {isShopifyConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="panel__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {isShopifyConnected ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Store Domain</span>
                  <span style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                    {shopify.shopDomain || connectState?.storeName || 'Shopify Store'}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--white-02)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Order Sync Stream</span>
                    <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>Active (orders/create)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Fulfillment Tracker</span>
                    <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>Active (fulfillments/update)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Data Privacy Guarantee</span>
                    <span style={{ color: 'var(--indigo-soft)', fontWeight: 500 }}>Per-tenant isolated</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding')}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%' }}
                  >
                    Manage Store Settings
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  No Shopify store currently connected. Connect your store credentials to automatically import orders and intercept shipping issues.
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding')}
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', gap: 6 }}
                  >
                    <Plus size={14} /> Connect Shopify Store
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── CARD 2: WHATSAPP CLOUD API ── */}
        <div className="panel panel--accent" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
              <MessageSquare size={15} color="var(--emerald)" /> Official WhatsApp Cloud API
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                backgroundColor: isWhatsAppConnected
                  ? 'rgba(16, 185, 129, 0.12)'
                  : isWhatsAppPending
                  ? 'rgba(59, 130, 246, 0.12)'
                  : 'rgba(239, 68, 68, 0.12)',
                color: isWhatsAppConnected
                  ? 'var(--emerald)'
                  : isWhatsAppPending
                  ? '#60a5fa'
                  : 'var(--rose)',
                border: `1px solid ${
                  isWhatsAppConnected
                    ? 'rgba(16, 185, 129, 0.3)'
                    : isWhatsAppPending
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'rgba(239, 68, 68, 0.3)'
                }`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: isWhatsAppConnected
                    ? 'var(--emerald)'
                    : isWhatsAppPending
                    ? '#60a5fa'
                    : 'var(--rose)',
                }}
              />
              {isWhatsAppConnected ? 'Active' : isWhatsAppPending ? 'Templates Pending' : 'Disconnected'}
            </span>
          </div>

          <div className="panel__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {isWhatsAppConnected || isWhatsAppPending ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone Number ID</span>
                  <span style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                    {whatsapp.phoneNumberId ? `•••• •••• ${String(whatsapp.phoneNumberId).slice(-4)}` : 'Verified via Meta'}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--white-02)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Meta Graph API v22.0</span>
                    <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>NDR Rescue Templates</span>
                    <span style={{ color: isWhatsAppConnected ? 'var(--emerald)' : '#60a5fa', fontWeight: 600 }}>
                      {isWhatsAppConnected ? 'Meta Approved' : 'Review in Progress'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Registered Store Phone</span>
                    <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{connectState?.ownerPhone || 'Registered'}</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: 10, paddingTop: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={handleTestPulse}
                    disabled={pulseBusy}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, gap: 6 }}
                  >
                    <Play size={13} /> {pulseBusy ? 'Sending Pulse...' : 'Send Test Pulse'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding')}
                    className="btn btn-ghost btn-sm"
                  >
                    Configure
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Connect your official Meta WhatsApp Business API account to dispatch automated delivery recovery messages when couriers fail delivery.
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding')}
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', gap: 6 }}
                  >
                    <Plus size={14} /> Connect WhatsApp Number
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ── CARD 3: CONNECTED SHIPMENT LOGISTICS ── */}
      <div className="panel" style={{ marginTop: 'var(--space-6)' }}>
        <div className="panel__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
              <Truck size={17} color="var(--indigo)" /> Connected Shipment Logistics
            </span>
            <span className="panel__aside" style={{ marginTop: 2 }}>
              {activeCarriers.length} courier provider{activeCarriers.length === 1 ? '' : 's'} linked to your account
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowShipmentModal(true)}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> Connect New Shipment
          </button>
        </div>

        <div className="panel__body">
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.88rem' }}>
              Loading connected shipment integrations...
            </div>
          ) : activeCarriers.length === 0 ? (
            /* Empty State */
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--white-01)',
                border: '1px dashed var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--white-03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                }}
              >
                <Truck size={26} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)' }}>
                No Shipment Courier Connected Yet
              </h3>
              <p style={{ margin: 0, maxWidth: 460, fontSize: '0.86rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
                Connect Shiprocket, Delhivery, Blue Dart, Xpressbees, or your custom courier to automatically intercept Non-Delivery Reports (NDR) and rescue failed orders.
              </p>
              <button
                type="button"
                onClick={() => setShowShipmentModal(true)}
                className="btn btn-primary btn-sm"
                style={{ marginTop: 'var(--space-2)', gap: 6 }}
              >
                <Plus size={15} /> Connect New Shipment
              </button>
            </div>
          ) : (
            /* Connected Carriers List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {activeCarriers.map((carrier) => (
                <div
                  key={carrier.id}
                  style={{
                    background: 'var(--white-02)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4) var(--space-5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '1.7rem' }}>{carrier.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)' }}>
                            {carrier.name}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: 12,
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: 'var(--indigo-soft)',
                              fontWeight: 600,
                            }}
                          >
                            {carrier.badge}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: '0.78rem', color: 'var(--text-3)' }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--emerald)' }} />
                          <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>Active · Ingesting NDRs</span>
                          <span>•</span>
                          <span>Integration: {carrier.mode}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleDisconnectCarrier(carrier.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--rose)', borderColor: 'rgba(239, 68, 68, 0.2)', fontSize: '0.78rem' }}
                      >
                        <Trash2 size={13} /> Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Webhook endpoint bar */}
                  {carrier.webhookUrl && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 6,
                        backgroundColor: 'var(--black-30)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ color: 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Webhook URL:</span>
                        <code style={{ color: 'var(--indigo-soft)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {carrier.webhookUrl}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(carrier.webhookUrl!, `${carrier.name} Webhook URL`)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 10px', height: 'auto', fontSize: '0.74rem', gap: 4 }}
                      >
                        {copiedKey === `${carrier.name} Webhook URL` ? <Check size={12} color="var(--emerald)" /> : <Copy size={12} />}
                        {copiedKey === `${carrier.name} Webhook URL` ? 'Copied' : 'Copy URL'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: CONNECT NEW SHIPMENT ── */}
      {showShipmentModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-main, #0c0d12)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg, 14px)',
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-1)' }}>
                  Connect New Shipment
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                  Link a courier to ingest delivery tracking and failed attempt (NDR) events.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShipmentModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConnectShipment} style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              
              {/* Carrier Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                  Select Courier Partner
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: 8,
                    maxHeight: 180,
                    overflowY: 'auto',
                    padding: 4,
                  }}
                >
                  {CARRIER_DEFS.map((c) => {
                    const isSelected = selectedCarrier.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCarrier(c);
                          setFormFields({});
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          padding: '10px 8px',
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? 'var(--indigo)' : 'var(--border)'}`,
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--white-02)',
                          color: isSelected ? 'var(--text-1)' : 'var(--text-2)',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <span style={{ fontSize: '1.4rem' }}>{c.icon}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, textAlign: 'center' }}>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Toggle: Direct API vs Webhook */}
              <div style={{ display: 'flex', gap: 8, background: 'var(--black-30)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setConnMode('api')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: connMode === 'api' ? 'var(--indigo)' : 'transparent',
                    color: connMode === 'api' ? '#fff' : 'var(--text-3)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Direct API Credentials
                </button>
                <button
                  type="button"
                  onClick={() => setConnMode('webhook')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: connMode === 'webhook' ? 'var(--indigo)' : 'transparent',
                    color: connMode === 'webhook' ? '#fff' : 'var(--text-3)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  1-Click Webhook (Zero Keys)
                </button>
              </div>

              {/* Mode Content */}
              {connMode === 'api' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
                    {selectedCarrier.apiGuide}
                  </p>
                  {selectedCarrier.apiInputs.map((input) => (
                    <div key={input.field}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                        {input.label} {input.optional && <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(Optional)</span>}
                      </label>
                      <input
                        type={input.type || 'text'}
                        value={formFields[input.field] || ''}
                        onChange={(e) => setFormFields({ ...formFields, [input.field]: e.target.value })}
                        placeholder={input.placeholder}
                        required={!input.optional}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 6,
                          backgroundColor: 'var(--black-30)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-1)',
                          fontSize: '0.86rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
                    Copy this Webhook URL and paste it into your <strong>{selectedCarrier.name}</strong> admin dashboard under <em>Webhooks → NDR &amp; Tracking</em>:
                  </p>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      backgroundColor: 'var(--black-30)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <code style={{ fontSize: '0.78rem', color: 'var(--indigo-soft)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                      {`https://rescueship.onrender.com/webhooks/${selectedCarrier.id}?merchant_id=${connectState?.merchantId || ''}`}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `https://rescueship.onrender.com/webhooks/${selectedCarrier.id}?merchant_id=${connectState?.merchantId || ''}`,
                          'Webhook URL'
                        )
                      }
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 10px', height: 'auto', fontSize: '0.74rem', gap: 4, flexShrink: 0 }}
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingBusy}
                  className="btn btn-primary btn-sm"
                  style={{ gap: 6 }}
                >
                  {connectingBusy ? 'Verifying & Saving...' : `Link ${selectedCarrier.name}`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ConnectedApisPage;
