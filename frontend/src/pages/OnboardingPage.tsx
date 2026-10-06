import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Anchor, ShieldCheck, Truck, Phone, RefreshCw, Zap, KeyRound, AlertTriangle, Smartphone, Check, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { connectApi } from '../lib/connect';
import { billingApi } from '../lib/billing';
import SetupGuide from '../components/SetupGuide';
import './onboarding.css';

type Key = 'shopify' | 'whatsapp' | 'carrier' | 'payment';
const STATIONS: { key: Key; label: string; verb: string; hint: string }[] = [
  { key: 'shopify',  label: 'Your store',     verb: 'connect',   hint: 'Shopify: paste the key + secret from your own admin app. WooCommerce: paste your REST API keys. Either way, your store stays fully isolated.' },
  { key: 'whatsapp', label: 'WhatsApp number', verb: 'verify',    hint: 'Your official WhatsApp Cloud API. Enables autonomous GPS pin sharing and AI address fix when buyers order with multiple/confusing addresses.' },
  { key: 'carrier',  label: 'Courier partners', verb: 'link',      hint: 'Shiprocket, Blue Dart, Delhivery, DTDC, Xpressbees, Shadowfax, Ecom Express, ClickPost, or Custom: connect one or multiple couriers with live API or 1-click webhook.' },
  { key: 'payment',  label: 'Payments',        verb: 'enable',    hint: 'Razorpay or Cashfree: generates instant payment links with discounts to convert risky COD orders to prepaid.' },
];

declare global { interface Window { FB: any; fbAsyncInit?: () => void; } }
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID || '';
const META_APP_ID = import.meta.env.VITE_META_APP_ID || '';
// Embedded Signup UI must never fire without both — an undefined appId fails
// silently inside Meta's SDK and the merchant sees "nothing happened".
const META_SIGNUP_READY = Boolean(META_APP_ID && META_CONFIG_ID);

export default function OnboardingPage() {
  const { token, user, logout } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<any>(null);
  const [active, setActive] = useState<Key>('shopify');
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [assist, setAssist] = useState<'idle' | 'busy' | 'done'>('idle');
  const [wcManual, setWcManual] = useState<{ webhookUrl: string; webhookSecret: string } | null>(null);
  const [planInfo, setPlanInfo] = useState<any>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    if (!token) {
      nav('/login', { replace: true });
    } else {
      billingApi.status(token).then((b) => {
        if (b?.active || b?.plan) setPlanInfo(b);
      }).catch(() => {});
    }
  }, [token, nav]);

  const requestAssist = async () => {
    if (!token) return;
    setAssist('busy'); setErr(null);
    try {
      const r = await connectApi.requestAssistedSetup(token);
      setAssist('done');
      push('✓ guided setup requested — the rescue team will reach out');
      if (r?.setupCallUrl) window.open(r.setupCallUrl, '_blank', 'noopener');
    } catch (e: any) { setErr(e.message); setAssist('idle'); }
  };

  const push = (line: string) => setLog((l) => [...l.slice(-5), line]);
  const refresh = async () => {
    if (!token) return null;
    try {
      const s = await connectApi.state(token);
      setState(s);
      return s;
    } catch {
      return null;
    }
  };

  const advanceToNext = (fromStation?: Key) => {
    const currentKey = fromStation || active;
    const idx = STATIONS.findIndex((s) => s.key === currentKey);
    if (idx >= 0 && idx < STATIONS.length - 1) {
      const nextKey = STATIONS[idx + 1].key;
      setTimeout(() => {
        setActive(nextKey);
        setErr(null);
      }, 700);
    }
  };

  const isStationDone = (k: Key, conns?: any) => {
    const c = conns || state?.connections;
    if (k === 'shopify') return c?.shopify?.status === 'connected' || c?.woocommerce?.status === 'connected';
    if (k === 'whatsapp') {
      const ws = c?.whatsapp?.status;
      return ws === 'connected' || ws === 'templates_pending';
    }
    return c?.[k]?.status === 'connected';
  };

  useEffect(() => {
    const stationParam = params.get('station') as Key | null;
    if (stationParam && STATIONS.some((s) => s.key === stationParam)) {
      setActive(stationParam);
    }
    refresh().then((s: any) => {
      if (s?.connections && !params.get('station')) {
        const isStoreConnected = s.connections.shopify?.status === 'connected' || s.connections.woocommerce?.status === 'connected';
        if (isStoreConnected) {
          const nextIncomplete = STATIONS.find((st) => {
            if (st.key === 'shopify') return false;
            return !isStationDone(st.key, s.connections);
          });
          if (nextIncomplete) {
            setActive(nextIncomplete.key);
          }
        }
      }
    });
    return () => clearInterval(pollRef.current);
  }, [token, params]);

  useEffect(() => {
    if (params.get('connected') === 'shopify') {
      push('✓ store connected · webhooks registered');
      refresh().then(() => advanceToNext('shopify'));
    }
    if (params.get('subscribed') === 'true') {
      push('✓ plan activated · 90-day money-back guarantee active');
    }
    if (params.get('error')) setErr('Store connection was cancelled or failed.');
  }, [params]);

  // poll template approval while pending
  useEffect(() => {
    if (state?.connections?.whatsapp?.status === 'templates_pending') {
      pollRef.current = setInterval(async () => {
        try {
          const s = await connectApi.whatsappTemplates(token!);
          if (s?.templates?.length) {
            setState((prev: any) => prev ? {
              ...prev,
              templates: s.templates,
              connections: {
                ...prev.connections,
                whatsapp: {
                  ...prev.connections?.whatsapp,
                  status: s.status,
                }
              }
            } : prev);
          }
          if (s.status === 'connected') {
            push('✓ all templates approved');
            clearInterval(pollRef.current);
            refresh();
          } else if (s.status === 'templates_rejected') {
            push('⚠ a template was rejected — click Fix & Resubmit below');
            clearInterval(pollRef.current);
            refresh();
          } else if (s.status === 'token_expired') {
            push('⚠ WhatsApp token expired — please update your token');
            clearInterval(pollRef.current);
            refresh();
          }
        } catch { /* ignore */ }
      }, 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [state?.connections?.whatsapp?.status]);

  const storeDone = () => state?.connections?.shopify?.status === 'connected' || state?.connections?.woocommerce?.status === 'connected';
  const done = (k: Key) => isStationDone(k);
  const statusOf = (k: Key) => k === 'shopify' ? (storeDone() ? 'connected' : (state?.connections?.shopify?.status || 'disconnected')) : (state?.connections?.[k]?.status || 'disconnected');
  const currentIndex = STATIONS.findIndex((s) => s.key === active);
  const allGreen = !!state?.ready;

  // ── actions ──
  const handleOAuthConnect = async (shop: string) => {
    setBusy('shopify');
    setErr(null);
    push(`› generating one-click connect link for ${shop}…`);
    try {
      const res = await connectApi.shopifyUrl(token!, shop);
      if (res?.url) {
        push('› redirecting to Shopify to authorize…');
        window.location.href = res.url;
      } else if (res?.demo) {
        await connectApi.shopifyDemoConnect(token!, shop);
        push(`✓ ${shop} connected (demo mode)`);
        await refresh();
        advanceToNext('shopify');
        setBusy(null);
      }
    } catch (e: any) {
      setErr(e.message);
      push('✗ connection failed');
      setBusy(null);
    }
  };

  const loadFbSdk = () => new Promise<void>((res) => {
    if (window.FB) return res();
    window.fbAsyncInit = () => res();
    const id = 'facebook-jssdk'; if (document.getElementById(id)) return;
    const s = document.createElement('script'); s.id = id; s.src = 'https://connect.facebook.net/en_US/sdk.js'; s.async = true; s.defer = true; document.body.appendChild(s);
  });
  const connectWhatsApp = async () => {
    setBusy('whatsapp'); setErr(null); push('› opening Meta Embedded Signup…');
    try {
      await loadFbSdk();
      window.FB.init({ appId: import.meta.env.VITE_META_APP_ID, version: 'v22.0' });
      window.FB.login((resp: any) => {
        const code = resp?.authResponse?.code || resp?.code;
        if (!code) { setErr('Signup was cancelled.'); setBusy(null); return; }
        push('› exchanging signup code for a permanent token…');
        connectApi.whatsappSignup(token!, code, resp?.authResponse?.business_id).then(async () => {
          push('✓ WhatsApp connected · submitting templates');
          await refresh();
          advanceToNext('whatsapp');
          setBusy(null);
        }).catch((e: any) => { setErr(e.message); setBusy(null); });
      }, { config_id: META_CONFIG_ID, response_type: 'code', override_default_response_type: true });
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };
  const connectWhatsAppManual = async (phoneNumberId: string, wabaId: string, accessToken: string) => {
    setBusy('whatsapp'); setErr(null); push('› validating WhatsApp credentials…');
    try {
      await connectApi.whatsappManual(token!, phoneNumberId, wabaId, accessToken);
      push('✓ WhatsApp connected · submitting templates');
      await refresh();
      advanceToNext('whatsapp');
      setBusy(null);
    }
    catch (e: any) { setErr(e.message); push('✗ credentials rejected — nothing saved'); setBusy(null); }
  };
  const handleResubmitTemplates = async () => {
    setBusy('resubmit_templates');
    setErr(null);
    push('› syncing templates with Meta…');
    try {
      await connectApi.resubmitWhatsAppTemplates(token!);
      push('✓ templates synchronized with Meta — awaiting approval');
      await refresh();
      setBusy(null);
    } catch (e: any) {
      const rawMsg = e.message || '';
      let cleanMsg = rawMsg;
      if (/max requests|quota|limit exceeded|redis/i.test(rawMsg)) {
        cleanMsg = 'Templates submitted to Meta. Awaiting review.';
      } else if (/expired|oauthexception|code 190/i.test(rawMsg)) {
        cleanMsg = 'Meta Access Token Expired. Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App Dashboard or use a permanent System User token to resume.';
      } else if (/deletion|wait|minute/i.test(rawMsg)) {
        cleanMsg = 'Meta is updating your templates. Please wait a moment.';
      }
      setErr(cleanMsg);
      push(`✗ resubmission: ${cleanMsg}`);
      setBusy(null);
    }
  };
  const connectCarrier = async (creds: any, shouldAdvance = false) => {
    const provider = creds.provider;
    const name = creds.carrierName || provider;
    setBusy('carrier'); setErr(null); push(`› connecting ${name}…`);
    try {
      await connectApi.carrier(token!, creds);
      push(`✓ ${name} connected successfully`);
      await refresh();
      if (shouldAdvance) {
        advanceToNext('carrier');
      }
      setBusy(null);
    }
    catch (e: any) { setErr(e.message); push(`✗ ${name} connection rejected: ${e.message}`); setBusy(null); }
  };
  const handleDisconnectCarrier = async (provider?: string) => {
    setBusy('carrier'); setErr(null); push(`› disconnecting ${provider || 'courier'}…`);
    try {
      await connectApi.carrierDisconnect(token!, provider);
      push(`✓ ${provider || 'courier'} disconnected`);
      await refresh();
      setBusy(null);
    } catch (e: any) {
      setErr(e.message);
      push(`✗ disconnect failed: ${e.message}`);
      setBusy(null);
    }
  };
  const connectWooCommerce = async (url: string, consumerKey: string, consumerSecret: string) => {
    setBusy('shopify'); setErr(null); setWcManual(null); push(`› validating ${url}…`);
    try {
      const r = await connectApi.woocommerce(token!, url, consumerKey, consumerSecret);
      if (r?.needsManualWebhook) {
        setWcManual({ webhookUrl: r.webhookUrl, webhookSecret: r.webhookSecret });
        push('⚠ connected, but webhook was not auto-registered — add it manually below');
      } else {
        push(`✓ ${url} connected · webhooks registered`);
      }
      await refresh();
      if (!r?.needsManualWebhook) {
        advanceToNext('shopify');
      }
      setBusy(null);
    }
    catch (e: any) { setErr(e.message); push('✗ keys rejected — nothing saved'); setBusy(null); }
  };
  const connectPayment = async (gateway: string, keyId: string, keySecret: string) => {
    setBusy('payment'); setErr(null); push(`› validating ${gateway} keys…`);
    try {
      await connectApi.payment(token!, gateway, keyId, keySecret);
      push(`✓ ${gateway} validated`);
      await refresh();
      advanceToNext('payment');
      setBusy(null);
    }
    catch (e: any) { setErr(e.message); push('✗ keys rejected — nothing saved'); setBusy(null); }
  };
  const pulse = async (targetPhone?: string, storeName?: string) => {
    setBusy('pulse');
    setErr(null);
    push('› sending test rescue to your number…');
    try {
      if (targetPhone) {
        await connectApi.ownerPhone(token!, targetPhone, storeName || '');
      }
      await connectApi.testPulse(token!);
      push('✓ test rescue sent — check your phone');
      await refresh();
      setBusy(null);
    } catch (e: any) {
      setErr(e.message);
      setBusy(null);
    }
  };
  const goLive = async () => {
    setBusy('finalize');
    try {
      await connectApi.finalize(token!);
      // Sync the cached user so the dashboard gate sees the new status
      const raw = localStorage.getItem('user');
      if (raw) { try { localStorage.setItem('user', JSON.stringify({ ...JSON.parse(raw), onboardingStatus: 'completed' })); } catch { /* ignore */ } }
      window.location.href = '/dashboard';
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };
  // Bail out of the wizard but keep the account — dashboard unlocks in "skipped" mode.
  const skipOnboarding = async () => {
    setBusy('skip'); setErr(null);
    try {
      await connectApi.skip(token!);
      const raw = localStorage.getItem('user');
      if (raw) {
        try { localStorage.setItem('user', JSON.stringify({ ...JSON.parse(raw), onboardingStatus: 'skipped' })); } catch { /* ignore */ }
      }
      window.location.href = '/dashboard'; // full reload so AuthContext rehydrates the new status
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };
  const handleSkip = () => {
    if (currentIndex >= STATIONS.length - 1) void skipOnboarding();
    else setActive(STATIONS[currentIndex + 1].key);
  };

  return (
    <div className="ob">
      <div className="ob-grid-bg" aria-hidden="true" />
      <div className="ob-scan" aria-hidden="true" />

      <header className="ob-top">
        <a href="/" className="ob-brand"><span><Anchor size={18} aria-hidden="true" /></span> RescueShip</a>
        <div className="ob-topbar"><motion.div className="ob-topbar__fill" style={{ width: `${(STATIONS.filter((s) => done(s.key)).length / STATIONS.length) * 100}%` }} /></div>
        <span className="ob-topbar__pct" role="progressbar" aria-label="Onboarding setup progress" aria-valuenow={Math.round((STATIONS.filter((s) => done(s.key)).length / STATIONS.length) * 100)} aria-valuemin={0} aria-valuemax={100}>{Math.round((STATIONS.filter((s) => done(s.key)).length / STATIONS.length) * 100)}% ready</span>
        {user && (
          <div className="ob-topbar__actions">
            {user.onboardingStatus !== 'pending' && (
              <button
                type="button"
                onClick={() => nav('/dashboard')}
                className="ob-btn ob-btn--ghost"
                style={{ marginRight: 8, padding: '4px 12px', fontSize: '0.85rem' }}
              >
                ← Back to Dashboard
              </button>
            )}
            <span className="ob-topbar__email">
              {user.email}
            </span>
            <div className="ob-plan-badge ob-plan-badge--header">
              <span className="ob-plan-badge__status"><ShieldCheck size={14} aria-hidden="true" /> 90-Day Guarantee Protected</span>
              <strong>Plan: {planInfo?.plan ? planInfo.plan.toUpperCase() : 'LOCKED IN'}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                nav('/login', { replace: true });
              }}
              className="ob-btn ob-btn--ghost ob-topbar__logout"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      

      <div className="ob-shell">
        {/* ── the route / spine ── */}
        <aside className="ob-spine">
          <p className="ob-spine__kicker">Setup route<span className="ob-spine__kicker-sub"> — Step 2 of 2: Integration Wiring</span></p>
          <div className="ob-spine__track">
            {STATIONS.map((s, i) => {
              const st = statusOf(s.key);
              const isDone = st === 'connected';
              const isActive = s.key === active;
              const pending = st === 'templates_pending' || st === 'connecting';
              return (
                <button key={s.key} className={`ob-node ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`} onClick={() => { setActive(s.key); setErr(null); }} style={{ '--i': i } as React.CSSProperties} aria-current={isActive ? 'step' : undefined}>
                  <span className="ob-node__line" data-fill={i < currentIndex || isDone ? '1' : '0'} />
                  <span className="ob-node__dot">
                    {isDone ? <svg viewBox="0 0 24 24" className="ob-check"><path d="M5 13l4 4L19 7" /></svg>
                      : (s.key === 'whatsapp' && st === 'templates_pending') ? <svg viewBox="0 0 24 24" className="ob-check" style={{ stroke: 'var(--cyan)' }}><path d="M5 13l4 4L19 7" /></svg>
                      : pending ? <span className="ob-spin" /> : <span className="ob-node__n">{i + 1}</span>}
                    {isActive && <Truck size={14} className="ob-marker" aria-hidden="true" />}
                  </span>
                  <span className="ob-node__text">
                    <strong>{s.label}</strong>
                    <em>{isDone ? 'connected' : pending ? (s.key === 'whatsapp' ? 'verified · in review' : 'in progress') : 'awaiting'}</em>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ob-feed" aria-live="polite">
            {log.map((l, i) => <span key={i} className="ob-feed__line">{l}</span>)}
            {log.length === 0 && <span className="ob-feed__line ob-feed__idle">› idle · pick a station to begin</span>}
          </div>

          {/* Guided setup card */}
          <div className="ob-assist">
            <p className="ob-assist__title">Need a hand?</p>
            <p className="ob-assist__sub">Every step above is self-serve — or we'll do it with you on a free 20-minute call.</p>
            <div className="ob-assist__actions">
              {state?.setupCallUrl && (
                <a className="ob-assist__btn ob-assist__btn--primary" href={state.setupCallUrl} target="_blank" rel="noopener noreferrer">
                  <Phone size={14} aria-hidden="true" /> Book free setup call
                </a>
              )}
              <button
                className="ob-assist__btn"
                onClick={requestAssist}
                disabled={assist !== 'idle'}
              >
                {assist === 'done' ? '✓ Request sent — check your email' : assist === 'busy' ? 'Sending…' : 'Send me a setup guide'}
              </button>
            </div>
          </div>
        </aside>

        {/* ── active station card ── */}
        <main className="ob-stage">
          <AnimatePresence mode="wait">
            <motion.section key={active} className="ob-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <p className="ob-card__kicker" style={{ margin: 0 }}>{STATIONS[currentIndex].hint}</p>
                <SetupGuide
                  station={active === 'shopify' ? 'store' : active === 'carrier' ? 'courier' : active === 'payment' ? 'payments' : 'whatsapp'}
                  storeUrl={state?.connections?.shopify?.shopDomain}
                />
              </div>
              <h1 className="ob-card__title">{STATIONS[currentIndex].verb === 'connect' ? 'Connect' : STATIONS[currentIndex].verb === 'verify' ? 'Verify' : STATIONS[currentIndex].verb === 'link' ? 'Link' : 'Enable'} <em>{STATIONS[currentIndex].label.toLowerCase()}</em></h1>

              {active === 'shopify' && (
                <StoreForm
                  onTokenConnect={(shop: string, accessToken: string, apiSecret: string) => {
                    setBusy('shopify');
                    setErr(null);
                    push('› validating Shopify key with your store…');
                    connectApi.shopifyToken(token!, shop, accessToken, apiSecret).then(() => {
                      push(`✓ ${shop} connected via API key`);
                      refresh().then(() => advanceToNext('shopify'));
                      setBusy(null);
                    }).catch((e: any) => {
                      setErr(e.message);
                      push('✗ key rejected — nothing saved');
                      setBusy(null);
                    });
                  }}
                  onOAuthConnect={handleOAuthConnect}
                  onConnectWooCommerce={connectWooCommerce}
                  busy={busy === 'shopify'}
                  storeDone={storeDone()}
                  shop={state?.connections?.shopify?.shopDomain}
                  wcUrl={state?.connections?.woocommerce?.url}
                  wcManual={wcManual}
                />
              )}
              {active === 'whatsapp' && (
                <WhatsAppPanel
                  onConnect={connectWhatsApp}
                  onManualConnect={connectWhatsAppManual}
                  onPulse={pulse}
                  onResubmitTemplates={handleResubmitTemplates}
                  busy={busy}
                  status={statusOf('whatsapp')}
                  templates={state?.templates}
                  ownerPhone={state?.ownerPhone}
                  metaReady={META_SIGNUP_READY}
                  onNext={() => advanceToNext('whatsapp')}
                  connectionDetails={state?.connections?.whatsapp}
                />
              )}
              {active === 'carrier' && (
                <CarrierForm
                  onConnect={connectCarrier}
                  onDisconnect={handleDisconnectCarrier}
                  busy={busy === 'carrier'}
                  done={done('carrier')}
                  provider={state?.connections?.carrier?.provider}
                  carriers={state?.connections?.carriers}
                  token={token}
                  merchantId={state?.merchantId}
                  onNext={() => advanceToNext('carrier')}
                />
              )}
              {active === 'payment' && <PaymentForm onConnect={connectPayment} busy={busy === 'payment'} done={done('payment')} gateway={state?.connections?.payment?.gateway} />}

              {err && <p className="ob-err" role="alert" aria-live="polite"><AlertTriangle size={14} aria-hidden="true" /> {err}</p>}
            </motion.section>
          </AnimatePresence>

          <footer className="ob-foot">
            <button className="ob-foot__skip" onClick={handleSkip} disabled={busy === 'skip'}>
              {busy === 'skip' ? 'Opening dashboard…' : currentIndex >= STATIONS.length - 1 ? 'Finish later → dashboard' : 'Skip for now'}
            </button>
            <button
              className="ob-foot__go"
              disabled={!allGreen || busy === 'finalize'}
              onClick={() => {
                if (allGreen && !state?.paid && !planInfo?.active) {
                  nav('/billing?from=onboarding');
                } else if (allGreen) {
                  goLive();
                }
              }}
            >
              {allGreen
                ? (busy === 'finalize' ? 'Activating rescues…' : '🚀 Activate live rescues →')
                : `${STATIONS.filter((s) => !done(s.key)).length} station${STATIONS.filter((s) => !done(s.key)).length === 1 ? '' : 's'} to go`}
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ── station forms (compact, real) ── */
function Field({ label, children }: any) { return <label className="ob-field"><span>{label}</span>{children}</label>; }

function StoreForm({ onTokenConnect, onOAuthConnect, onConnectWooCommerce, busy, storeDone, shop, wcUrl, wcManual }: any) {
  const [platform, setPlatform] = useState<'shopify' | 'woocommerce'>(shop ? 'shopify' : wcUrl ? 'woocommerce' : 'shopify');
  const [showChange, setShowChange] = useState(false);
  if (storeDone && !showChange) {
    return (
      <div className="ob-form">
        <Done provider={`Connected · ${shop || wcUrl || 'store'}`} />
        {wcManual && <ManualWebhook info={wcManual} />}
        <button
          type="button"
          className="ob-btn ob-btn--ghost"
          style={{ marginTop: 'var(--space-2)' }}
          onClick={() => setShowChange(true)}
        >
          <RefreshCw size={14} aria-hidden="true" /> Reconnect or change store
        </button>
      </div>
    );
  }
  return (
    <div className="ob-form">
      <div className="ob-seg">
        <button type="button" className={platform === 'shopify' ? 'on' : ''} onClick={() => setPlatform('shopify')}>Shopify</button>
        <button type="button" className={platform === 'woocommerce' ? 'on' : ''} onClick={() => setPlatform('woocommerce')}>WooCommerce</button>
      </div>
      {platform === 'shopify'
        ? <ShopifyForm onTokenConnect={onTokenConnect} onOAuthConnect={onOAuthConnect} busy={busy} defaultShop={shop} />
        : <WooCommerceForm onConnect={onConnectWooCommerce} busy={busy} />}
      {wcManual && <ManualWebhook info={wcManual} />}
    </div>
  );
}

function ManualWebhook({ info }: { info: { webhookUrl: string; webhookSecret: string } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(`${info.webhookUrl}\nSecret: ${info.webhookSecret}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } };
  return (
    <div className="ob-note ob-note--warn">
      <strong>Add the webhook manually</strong> — in WordPress go to <strong>WooCommerce → Settings → Advanced → Webhooks → Add webhook</strong>, set Topic to <strong>Order created</strong>, Status <strong>Active</strong>, paste this Delivery URL and Secret, then Save.
      <div className="ob-mono">
        <code>{info.webhookUrl}</code>
      </div>
      <div className="ob-mono">
        <code>Secret: {info.webhookSecret}</code>
      </div>
      <button type="button" className="ob-btn ob-btn--ghost" onClick={copy}>{copied ? 'Copied ✓' : 'Copy URL + secret'}</button>
    </div>
  );
}

function WooCommerceForm({ onConnect, busy }: any) {
  const [url, setUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const urlValid = /^https:\/\/.+/i.test(url.trim());
  return (
    <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onConnect(url.trim(), consumerKey.trim(), consumerSecret.trim()); }}>
      <Field label="Store URL"><input className="ob-input" placeholder="https://yourstore.com" value={url} onChange={(e) => setUrl(e.target.value)} required /></Field>
      <Field label="Consumer key"><input className="ob-input" placeholder="ck_…" autoComplete="off" spellCheck={false} value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} required /></Field>
      <Field label="Consumer secret"><input className="ob-input" type="password" autoComplete="off" spellCheck={false} placeholder="cs_…" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} required /></Field>
      <div className="ob-steps">
        <p className="ob-steps__title">How to get these (2 min):</p>
        <ol className="ob-steps__list">
          <li>In WordPress admin, go to <strong>WooCommerce → Settings → Advanced → REST API</strong></li>
          <li>Click <strong>Add key</strong> → set Permissions to <strong>Read/Write</strong> → Generate</li>
          <li>Copy the <strong>Consumer key</strong> (ck_…) and <strong>Consumer secret</strong> (cs_…)</li>
          <li>If the REST API page is missing, enable it from <a href="https://woocommerce.com/document/woocommerce-rest-api/" target="_blank" rel="noopener noreferrer">WooCommerce REST API docs</a></li>
        </ol>
      </div>
      <button className="ob-btn" disabled={busy || !urlValid || !consumerKey.trim() || !consumerSecret.trim()}>{busy ? 'Validating…' : 'Validate & connect'}</button>
    </form>
  );
}

function ShopifyForm({ onTokenConnect, onOAuthConnect, busy, defaultShop }: any) {
  const [method, setMethod] = useState<'oauth' | 'manual'>('oauth');
  const [shop, setShop] = useState(defaultShop || '');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  const shopTrimmed = shop.trim().toLowerCase();
  const shopValid = shopTrimmed.length > 2;
  const fullShopDomain = shopTrimmed.includes('.myshopify.com')
    ? shopTrimmed
    : (shopTrimmed ? `${shopTrimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}.myshopify.com` : '');
  const shopSlug = shopTrimmed.replace(/^https?:\/\//, '').replace(/\.myshopify\.com.*$/, '').replace(/\/.*$/, '');

  return (
    <div className="ob-shopify-container">
      <div className="ob-seg" style={{ marginBottom: 'var(--space-3)' }}>
        <button type="button" className={method === 'oauth' ? 'on' : ''} onClick={() => setMethod('oauth')}>
          <Zap size={14} aria-hidden="true" /> One-click connect (Recommended)
        </button>
        <button type="button" className={method === 'manual' ? 'on' : ''} onClick={() => setMethod('manual')}>
          <KeyRound size={14} aria-hidden="true" /> Manual app keys
        </button>
      </div>

      {method === 'oauth' ? (
        <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onOAuthConnect(fullShopDomain); }}>
          <Field label="Store address">
            <input
              className="ob-input"
              placeholder="your-brand.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              required
            />
          </Field>
          <div className="ob-note" style={{ color: 'var(--text-3)', fontSize: '0.82rem', lineHeight: '1.5' }}>
            <p style={{ margin: '0 0 var(--space-1) 0' }}>
              <strong>Zero setup required:</strong> Enter your store handle or domain above and click <em>Connect with Shopify</em>. You will be redirected directly to your Shopify store to approve order access in 1 click, and then automatically returned here.
            </p>
          </div>
          <button className="ob-btn" disabled={busy || !shopValid}>
            {busy ? 'Opening Shopify login…' : 'Connect with Shopify →'}
          </button>
        </form>
      ) : (
        <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onTokenConnect(fullShopDomain, consumerKey.trim(), consumerSecret.trim()); }}>
          <Field label="Store address">
            <input className="ob-input" placeholder="your-brand.myshopify.com" value={shop} onChange={(e) => setShop(e.target.value)} required />
          </Field>
          <Field label="Consumer key (Admin API access token)">
            <input className="ob-input" type="password" autoComplete="off" spellCheck={false} placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} required />
          </Field>
          <Field label="Consumer secret (API secret key)">
            <input className="ob-input" type="password" autoComplete="off" spellCheck={false} placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxx" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} required />
          </Field>
          <div className="ob-steps">
            <p className="ob-steps__title">How to get these in Shopify:</p>
            <ol className="ob-steps__list">
              <li>{shopSlug
                ? <>Open <a href={`https://admin.shopify.com/store/${shopSlug}/apps`} target="_blank" rel="noopener noreferrer">Apps</a> in your Shopify admin sidebar, or go to <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noopener noreferrer">Shopify Dev Dashboard</a></>
                : <>Open <strong>Apps</strong> in your Shopify admin sidebar, or go to <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noopener noreferrer">Shopify Dev Dashboard</a></>}</li>
              <li>Under <strong>Develop apps</strong> (or Dev Dashboard), create or open your app (name it "RescueShip").</li>
              <li>Go to <strong>Configuration → Admin API</strong>, click <strong>Configure</strong>, and tick: <code>read_orders, write_orders, read_fulfillments, write_fulfillments, read_products</code> → Save.</li>
              <li>Go to <strong>API credentials</strong>, click <strong>Install app</strong>, then click <strong>Reveal token once</strong> to copy your <strong>Admin API access token</strong> (starts with <code>shpat_…</code>).</li>
              <li>Copy your <strong>API secret key</strong> (starts with <code>shpss_…</code>).</li>
            </ol>
            <p style={{ marginTop: 'var(--space-2)', fontSize: '0.74rem', color: 'var(--amber)' }}>
              ⚠️ <strong>Important:</strong> Do NOT enter your 32-character Client ID in the access token field. Shopify requires the Admin API access token starting with <code>shpat_</code>.
            </p>
          </div>
          <p className="ob-note" style={{ color: 'var(--text-3)', fontSize: '0.74rem' }}>No RescueShip keys involved — just the key + secret you generate in your own admin.</p>
          <button className="ob-btn" disabled={busy || !shopValid || !consumerKey.trim() || !consumerSecret.trim()}>{busy ? 'Validating…' : 'Validate & connect'}</button>
        </form>
      )}
    </div>
  );
}

function WhatsAppPanel({
  onConnect,
  onManualConnect,
  onPulse,
  onResubmitTemplates,
  busy,
  status,
  templates,
  ownerPhone,
  metaReady,
  onNext,
  connectionDetails,
}: any) {
  const [phone, setPhone] = useState(ownerPhone || '');
  const [name, setName] = useState('');
  const [manual, setManual] = useState(!metaReady);
  const [phoneId, setPhoneId] = useState(connectionDetails?.phoneNumberId || '');
  const [wabaId, setWabaId] = useState(connectionDetails?.wabaId || '');
  const [accessToken, setAccessToken] = useState('');
  const [editingCreds, setEditingCreds] = useState(false);

  useEffect(() => {
    if (connectionDetails?.phoneNumberId && !phoneId) setPhoneId(connectionDetails.phoneNumberId);
    if (connectionDetails?.wabaId && !wabaId) setWabaId(connectionDetails.wabaId);
  }, [connectionDetails]);

  const hasConnection = status === 'connected' || status === 'templates_pending' || status === 'templates_rejected' || status === 'token_expired';
  const connected = hasConnection && !editingCreds;
  const oneClickReady = metaReady;
  const manualValid = /^\d{6,32}$/.test(phoneId.trim()) && /^\d{6,32}$/.test(wabaId.trim()) && accessToken.trim().length > 0;

  return (
    <div className="ob-form">
      {!connected ? (
        <>
          {editingCreds && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Update WhatsApp Credentials</span>
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => setEditingCreds(false)}
              >
                Cancel
              </button>
            </div>
          )}

          {!editingCreds && (
            <div className="ob-seg">
              {oneClickReady && <button type="button" className={!manual ? 'on' : ''} onClick={() => setManual(false)}>One-click</button>}
              <button type="button" className={manual ? 'on' : ''} onClick={() => setManual(true)}>Manual (your keys)</button>
            </div>
          )}

          {!manual && oneClickReady && !editingCreds ? (
            <>
              <p className="ob-note">Opens Meta's signup in a popup. Log into <strong>your</strong> Business account, pick the WhatsApp number customers will message, and grant access. We receive a permanent token — you never share a password.</p>
              <button className="ob-btn" disabled={busy === 'whatsapp'} onClick={onConnect}>{busy === 'whatsapp' ? 'Connecting…' : 'Connect WhatsApp number'}</button>
            </>
          ) : (
            <form className="ob-form" onSubmit={(e) => {
              e.preventDefault();
              onManualConnect(phoneId.trim(), wabaId.trim(), accessToken.trim());
              setEditingCreds(false);
            }}>
              <Field label="Phone number ID"><input className="ob-input" placeholder="123456789012345" autoComplete="off" spellCheck={false} value={phoneId} onChange={(e) => setPhoneId(e.target.value)} required /></Field>
              <Field label="WABA ID (WhatsApp Business Account)"><input className="ob-input" placeholder="987654321098765" autoComplete="off" spellCheck={false} value={wabaId} onChange={(e) => setWabaId(e.target.value)} required /></Field>
              <Field label="Access token">
                <input
                  className="ob-input"
                  type="password" autoComplete="off" spellCheck={false}
                  placeholder="EAAG… (paste fresh temporary token or permanent System User token)"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                />
              </Field>
              <div className="ob-steps">
                <p className="ob-steps__title">How to get a fresh or permanent token:</p>
                <ol className="ob-steps__list">
                  <li><strong>Fastest (Meta App Dashboard):</strong> Open <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">Meta App Dashboard</a> → click your App → <strong>WhatsApp → API Setup</strong>. Copy your <strong>Access token</strong> (valid 24h for testing).</li>
                  <li><strong>Permanent Token (Never Expires):</strong> Open <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer">Business Settings → System Users</a> → Create System User → Assign WhatsApp asset → Generate Token with <code>whatsapp_business_messaging</code>.</li>
                </ol>
              </div>
              <button className="ob-btn" disabled={busy === 'whatsapp' || !manualValid}>
                {busy === 'whatsapp' ? 'Validating…' : editingCreds ? 'Update & Reconnect' : 'Validate & connect'}
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="ob-wa-status" aria-live="polite">
            <span className={`ob-pill ${status === 'connected' ? 'ok' : (status === 'templates_rejected' || status === 'token_expired') ? 'bad' : 'wait'}`}>
              {status === 'connected' ? '● live' : status === 'token_expired' ? '● token expired' : status === 'templates_rejected' ? '● action needed' : '◌ templates pending'}
            </span>
            {templates?.length > 0 && (
              <ul className="ob-tpl">
                {templates.map((t: any) => {
                  const friendlyNames: Record<string, string> = {
                    ndr_reschedule_en: 'Delivery reschedule verification',
                    ndr_address_en: 'Address & GPS location request',
                    ndr_cod_convert_en: 'Doorstep UPI conversion',
                    ndr_retention_en: 'Cancellation & RTO retention',
                    ndr_rescue_en: 'Delivery verification message',
                    cod_confirm_en: 'COD confirmation message',
                    cod_convert_en: 'Prepaid conversion offer',
                    address_pin_en: 'Address location request',
                    rescue_done_en: 'Delivery confirmed update',
                    rs_test_pulse_en: 'Test recovery message',
                    ndr_rescue_v2_en: 'Delivery verification message',
                    cod_confirm_v2_en: 'COD confirmation message',
                    cod_convert_v2_en: 'Prepaid conversion offer',
                    address_pin_v2_en: 'Address location request',
                    rescue_done_v2_en: 'Delivery confirmed update',
                    rs_test_pulse_v2_en: 'Test recovery message',
                  };
                  const label = friendlyNames[t.name] || t.name;
                  return (
                    <li key={t.name}>
                      <span style={{ fontWeight: 500 }}>{label}</span>
                      <span className={`ob-tpl__s ${t.status === 'APPROVED' ? 'ok' : t.status === 'REJECTED' ? 'bad' : 'wait'}`}>
                        {t.status === 'APPROVED' ? 'Ready' : t.status === 'REJECTED' ? 'Needs sync' : 'Pending'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {status === 'token_expired' && (
            <div className="ob-alert--error">
              <h4>Meta Access Token Expired</h4>
              <p>
                Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App Dashboard or use a permanent System User token to resume.
              </p>
              <button type="button" className="ob-btn" onClick={() => setEditingCreds(true)}>
                <KeyRound size={14} aria-hidden="true" /> Update Access Token
              </button>
            </div>
          )}

          {status === 'templates_rejected' && (
            <div className="ob-alert--warn">
              <h4>Templates Ready to Sync</h4>
              <p>
                Click below to sync recovery messages with Meta. If your token expired, click Update Token.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ob-btn ob-btn--primary"
                  disabled={busy === 'resubmit_templates'}
                  onClick={onResubmitTemplates}
                >
                  {busy === 'resubmit_templates' ? (
                    'Syncing…'
                  ) : (
                    <>
                      <RefreshCw size={14} aria-hidden="true" /> Resubmit Templates
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="ob-btn ob-btn--warn"
                  onClick={() => setEditingCreds(true)}
                >
                  <KeyRound size={14} aria-hidden="true" /> Update Access Token
                </button>
              </div>
            </div>
          )}

          {status === 'templates_pending' && (
            <div className="ob-alert--note">
              <h4>Meta Template Review in Progress</h4>
              <p>
                Your WhatsApp credentials are verified. Meta is reviewing your 6 message templates (usually takes 5–30 minutes). You can continue to Courier & Payments setup now — your templates will activate automatically once approved.
              </p>
            </div>
          )}

          <div className="ob-pulse">
            <Field label="Your mobile (for the test message)"><input className="ob-input" placeholder="+91 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Store name (optional)"><input className="ob-input" placeholder="Mamaearth" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button className="ob-btn ob-btn--ghost" disabled={!phone || busy === 'pulse'} onClick={() => onPulse(phone, name)}>
                {busy === 'pulse' ? 'Sending…' : <><Smartphone size={14} aria-hidden="true" /> Send me a test rescue</>}
              </button>
              <button className="ob-btn" type="button" onClick={onNext}>
                Continue to Courier setup →
              </button>
            </div>
            {!phone ? (
              <p className="ob-note" style={{ color: 'var(--text-3)' }}>Enter your mobile number above to enable the test rescue button.</p>
            ) : (
              <p className="ob-note">Fires a real message to your number — the proof that recovery works, before any customer order depends on it.</p>
            )}
          </div>

          <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
            <button
              type="button"
              className="ob-btn ob-btn--ghost"
              style={{ fontSize: '0.78rem', padding: '6px 12px', color: 'var(--text-2)' }}
              onClick={() => setEditingCreds(true)}
            >
              <RefreshCw size={14} aria-hidden="true" /> Reconnect or update WhatsApp credentials
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CarrierForm({ onConnect, onDisconnect, busy, provider, carriers, token, merchantId, onNext }: any) {
  type ProviderType = 'shiprocket' | 'delhivery' | 'bluedart' | 'xpressbees' | 'shadowfax' | 'clickpost' | 'ecomexpress' | 'dtdc' | 'custom';

  interface CarrierDef {
    id: ProviderType;
    name: string;
    badge: string;
    icon: string;
    desc: string;
    apiGuide: string;
    apiInputs: Array<{ field: string; label: string; placeholder: string; type?: string; optional?: boolean }>;
  }

  const CARRIER_DEFS: CarrierDef[] = [
    {
      id: 'shiprocket',
      name: 'Shiprocket',
      badge: 'Aggregator & Direct',
      icon: '🚀',
      desc: 'Pan-India logistics aggregator supporting 25+ courier partners.',
      apiGuide: 'Enter your registered Shiprocket account Email & Password. RescueShip automatically handles API authentication and session refresh.',
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
      apiGuide: 'From your Blue Dart contract welcome email or Account Manager: Login ID, License Key & Customer Account Code.',
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
      desc: 'End-to-end dedicated e-commerce delivery across 27,000+ PIN codes.',
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
      apiGuide: 'From DTDC Corporate Customer Portal → Web API Integration → Copy your X-Access-Token and Customer Code.',
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
      apiGuide: 'Universal webhook integration. Name your shipping provider and configure webhook notifications in their portal.',
      apiInputs: [
        { field: 'carrierName', label: 'Courier / Aggregator Name', placeholder: 'e.g. NimbusPost or India Post' },
        { field: 'apiKey', label: 'API Key / Secret Token (Optional)', placeholder: 'Optional webhook token or secret', optional: true },
      ],
    },
  ];

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
      return Array.from(new Set([...connectedKeys as ProviderType[], 'shiprocket']));
    }
    return ['shiprocket'];
  });

  // Ensure connected carriers remain in selected list
  useEffect(() => {
    if (connectedKeys.length > 0) {
      setSelectedCarriers((prev) => Array.from(new Set([...prev, ...connectedKeys as ProviderType[]])));
    }
  }, [carriers, provider]);

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
  }, [selectedCarriers]);

  // Connection mode toggle for the active carrier: 'api' (Direct API) vs 'webhook' (Zero Keys)
  const [connMode, setConnMode] = useState<'api' | 'webhook'>('api');

  // Input fields state
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [webhookData, setWebhookData] = useState<any[]>([]);

  // Fetch registered webhook URLs from API
  useEffect(() => {
    if (token) {
      connectApi.carrierWebhooks(token)
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
    const base = (import.meta.env.VITE_API_URL || 'https://rescueship.onrender.com').replace(/\/$/, '');
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-1)' }}>
            1. Select Your Delivery Partners ({selectedCarriers.length} selected)
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--indigo-soft)', fontWeight: 600 }}>
            Multi-Select Enabled
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
          Pick every courier or aggregator your store uses. You can select multiple partners (e.g. Shiprocket for North, Blue Dart for South, or Other Aggregators).
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
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleCarrierSelect(c.id); } }}
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
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px' }}>
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
                    <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', padding: '1px 6px', borderRadius: '8px' }}>
                      ✓ Active
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.68rem', background: 'var(--white-06)', color: 'var(--text-3)', padding: '1px 6px', borderRadius: '8px' }}>
                      Setup
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── ACTIVE CARRIER CARD ── */}
          <div style={{ marginTop: '14px', background: 'var(--white-02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>{currentDef.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)' }}>
                    {currentDef.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-3)' }}>
                    {currentDef.desc}
                  </p>
                </div>
              </div>
              {isCurrentConnected && (
                <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
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
                      {currentDef.name} is Connected & Monitoring
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-3)', marginTop: '2px' }}>
                      {currentConnectedData?.mode === 'webhook_only' ? 'Mode: 🔗 Webhook Ingestion Active' : 'Mode: ⚡ Direct 2-Way API Sync Active'}
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
                  Delivery Failure & NDR Webhook URL:
                </div>
                <div className="ob-webhook-box">
                  <span className="ob-webhook-code">{activeWebhookUrl}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeWebhookUrl)}
                    style={{ background: 'none', border: 'none', color: 'var(--emerald)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
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
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '6px' }}>
                    Choose Connection Method:
                  </div>
                  <div className="ob-mode-toggle">
                    <button
                      type="button"
                      className={`ob-mode-btn ${connMode === 'api' ? 'active' : ''}`}
                      onClick={() => setConnMode('api')}
                    >
                      <span>⚡ Direct API Integration</span>
                      <small>Full 2-Way Sync (Reattempt & Address Push)</small>
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
                      Validated directly against {currentDef.name}’s live API before storing. Encrypted at rest (AES-256-GCM).
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
                  <form className="ob-form" onSubmit={handleWebhookSubmit} style={{ maxWidth: '100%' }}>
                    <div className="ob-guide-box" style={{ background: 'var(--emerald-06)', borderColor: 'var(--emerald-20)' }}>
                      <strong style={{ color: 'var(--emerald)' }}>✨ Instant 1-Click Connect — Zero API Keys Needed</strong>
                      Don’t have developer API access or not sure what keys your courier platform uses? Simply paste this Webhook URL into your {currentDef.name} tracking or webhook settings. RescueShip will receive delivery failure events and trigger WhatsApp rescue messages automatically!
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
                          style={{ background: 'none', border: 'none', color: 'var(--emerald)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Copy size={12} />
                          {copiedUrl === activeWebhookUrl ? 'Copied!' : 'Copy URL'}
                        </button>
                      </div>
                    </div>

                    <p className="ob-note">
                      <strong>How to activate:</strong> Copy the URL above, paste it in {currentDef.name} dashboard → <em>Webhooks / NDR Notifications</em>, then click Activate below.
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
        <div style={{ marginTop: '16px', padding: '14px 18px', background: 'var(--emerald-06)', border: '1px solid var(--emerald-20)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--emerald)' }}>
              🎉 {connectedKeys.length} Courier Partner{connectedKeys.length === 1 ? '' : 's'} Active
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-3)', marginTop: '2px' }}>
              Connected: {connectedKeys.map((k) => CARRIER_DEFS.find((d) => d.id === k)?.name || k).join(', ')}
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

function PaymentForm({ onConnect, busy, done, gateway }: any) {
  const [g, setG] = useState<'razorpay' | 'cashfree'>('razorpay');
  const [id, setId] = useState(''); const [sec, setSec] = useState('');
  return done ? <Done provider={`Connected · ${gateway}`} /> : (
    <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onConnect(g, id, sec); }}>
      <div className="ob-seg">{(['razorpay', 'cashfree'] as const).map((x) => <button type="button" key={x} className={g === x ? 'on' : ''} onClick={() => setG(x)}>{x}</button>)}</div>
      <Field label="Key / Client ID"><input className="ob-input" autoComplete="off" spellCheck={false} value={id} onChange={(e) => setId(e.target.value)} required /></Field>
      <Field label="Secret"><input className="ob-input" type="password" autoComplete="off" spellCheck={false} value={sec} onChange={(e) => setSec(e.target.value)} required /></Field>
      <p className="ob-note">Validated with a live read call, then encrypted at rest (AES-256-GCM).</p>
      <button className="ob-btn" disabled={busy}>Validate & connect</button>
    </form>
  );
}

function Done({ provider }: { provider: string }) {
  return <div className="ob-done"><svg viewBox="0 0 24 24" className="ob-done__check"><path d="M5 13l4 4L19 7" /></svg><p>{provider}</p></div>;
}
