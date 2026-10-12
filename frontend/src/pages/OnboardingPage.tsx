import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Anchor, ShieldCheck, Phone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { connectApi } from '../lib/connect';
import { billingApi } from '../services/billing.api';
import SetupGuide from '../components/SetupGuide';
import StoreStation from '../components/onboarding/StoreStation';
import WhatsAppStation from '../components/onboarding/WhatsAppStation';
import CourierStation from '../components/onboarding/CourierStation';
import PaymentStation from '../components/onboarding/PaymentStation';
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
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<any>(null);
  const [active, setActive] = useState<Key>(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('station') as Key | null;
      return p && STATIONS.some((s) => s.key === p) ? p : 'shopify';
    } catch {
      return 'shopify';
    }
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [assist, setAssist] = useState<'idle' | 'busy' | 'done'>('idle');
  const [wcManual, setWcManual] = useState<{ webhookUrl: string; webhookSecret: string } | null>(null);
  const [planInfo, setPlanInfo] = useState<any>(null);
  const pollRef = useRef<any>(null);

  const userManuallyNavigatedRef = useRef(false);
  const autoRoutedOnMountRef = useRef(false);
  const advanceTimerRef = useRef<any>(null);
  const connectedHandledRef = useRef(false);

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
  const refresh = useCallback(async () => {
    if (!token) return null;
    try {
      const s = await connectApi.state(token);
      setState(s);
      return s;
    } catch {
      return null;
    }
  }, [token]);

  const goToStation = useCallback((key: Key) => {
    userManuallyNavigatedRef.current = true;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setActive(key);
    setErr(null);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('station', key);
      return next;
    }, { replace: true });
  }, [setParams]);

  const advanceToNext = useCallback((fromStation?: Key) => {
    userManuallyNavigatedRef.current = false;
    setActive((currentActive) => {
      const currentKey = fromStation || currentActive;
      const idx = STATIONS.findIndex((s) => s.key === currentKey);
      if (idx >= 0 && idx < STATIONS.length - 1) {
        const nextKey = STATIONS[idx + 1].key;
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          if (!userManuallyNavigatedRef.current) {
            goToStation(nextKey);
          }
        }, 500);
      }
      return currentActive;
    });
  }, [goToStation]);

  const isStationDone = useCallback((k: Key, conns?: any) => {
    const c = conns || state?.connections;
    if (k === 'shopify') return c?.shopify?.status === 'connected' || c?.woocommerce?.status === 'connected';
    if (k === 'whatsapp') {
      const ws = c?.whatsapp?.status;
      return ws === 'connected' || ws === 'templates_pending';
    }
    return c?.[k]?.status === 'connected';
  }, [state?.connections]);

  // Synchronize active station whenever URL query parameter 'station' changes
  useEffect(() => {
    const stationParam = params.get('station') as Key | null;
    if (stationParam && STATIONS.some((s) => s.key === stationParam)) {
      setActive(stationParam);
      userManuallyNavigatedRef.current = true;
    }
  }, [params]);

  // Initial load and connection state fetch (mount only)
  useEffect(() => {
    if (!token) return;
    refresh().then((s: any) => {
      const currentParam = new URLSearchParams(window.location.search).get('station') as Key | null;
      if (s?.connections && !currentParam && !userManuallyNavigatedRef.current && !autoRoutedOnMountRef.current) {
        const isStoreConnected = s.connections.shopify?.status === 'connected' || s.connections.woocommerce?.status === 'connected';
        if (isStoreConnected) {
          const nextIncomplete = STATIONS.find((st) => {
            if (st.key === 'shopify') return false;
            return !isStationDone(st.key, s.connections);
          });
          if (nextIncomplete) {
            goToStation(nextIncomplete.key);
          }
        }
        autoRoutedOnMountRef.current = true;
      }
    });
    return () => {
      clearInterval(pollRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [token, refresh, isStationDone, goToStation]);

  useEffect(() => {
    if (params.get('connected') === 'shopify' && !connectedHandledRef.current) {
      connectedHandledRef.current = true;
      push('✓ store connected · webhooks registered');
      refresh().then(() => advanceToNext('shopify'));
    }
    if (params.get('subscribed') === 'true') {
      push('✓ plan activated · 90-day money-back guarantee active');
    }
    if (params.get('error')) setErr('Store connection was cancelled or failed.');
  }, [params, refresh, advanceToNext]);

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
  }, [state?.connections?.whatsapp?.status, token, refresh]);

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
    else goToStation(STATIONS[currentIndex + 1].key);
  };

  return (
    <div className="ob">
      <div className="ob-ambient-glow" aria-hidden="true" />

      <header className="ob-top">
        <a href="/" className="ob-brand">
          <span><Anchor size={18} aria-hidden="true" /></span>
          RescueShip
        </a>

        <div className="ob-top-center">
          <div className="ob-topbar">
            <motion.div
              className="ob-topbar__fill"
              style={{ width: `${(STATIONS.filter((s) => done(s.key)).length / STATIONS.length) * 100}%` }}
            />
          </div>
          <span
            className="ob-topbar__pct"
            role="progressbar"
            aria-label="Onboarding setup progress"
            aria-valuenow={Math.round((STATIONS.filter((s) => done(s.key)).length / STATIONS.length) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            Step {currentIndex + 1} of {STATIONS.length}: {STATIONS[currentIndex].label}
          </span>
        </div>

        {user && (
          <div className="ob-topbar__actions">
            <div className="ob-guarantee-badge">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>90-Day Guarantee</span>
            </div>
            {user.onboardingStatus !== 'pending' && (
              <button
                type="button"
                onClick={() => nav('/dashboard')}
                className="ob-btn ob-btn--ghost"
                style={{ padding: '6px 14px', fontSize: '0.84rem' }}
              >
                ← Dashboard
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                logout();
                nav('/login', { replace: true });
              }}
              className="ob-btn ob-btn--ghost"
              style={{ padding: '6px 14px', fontSize: '0.84rem' }}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <div className="ob-shell">
        {/* ── the route / spine ── */}
        <aside className="ob-spine">
          <div className="ob-spine__header">
            <p className="ob-spine__kicker">Setup route: <span className="ob-spine__kicker-sub">Store Integration</span></p>
          </div>
          <div className="ob-spine__track">
            {STATIONS.map((s, i) => {
              const st = statusOf(s.key);
              const isDone = st === 'connected';
              const isActive = s.key === active;
              const pending = st === 'templates_pending' || st === 'connecting';
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`ob-node ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                  onClick={() => goToStation(s.key)}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="ob-node__dot">
                    {isDone ? (
                      <CheckCircle2 size={16} className="ob-check" aria-hidden="true" />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </span>
                  <span className="ob-node__text">
                    <strong>{s.label}</strong>
                    <em>{isDone ? 'Connected' : pending ? (s.key === 'whatsapp' ? 'In review' : 'Connecting') : 'Awaiting setup'}</em>
                  </span>
                </button>
              );
            })}
          </div>

          {log.length > 0 && (
            <div className="ob-status-toast" role="status" aria-live="polite">
              <span>{log[log.length - 1]}</span>
            </div>
          )}

          {/* Data Safety & Guarantee Card */}
          <div className="ob-trust-card">
            <p className="ob-trust-card__title">
              <ShieldCheck size={16} className="ob-trust-card__icon" aria-hidden="true" />
              Data Safety Guarantee
            </p>
            <ul className="ob-trust-card__list">
              <li className="ob-trust-card__item">
                <span className="ob-trust-card__icon">✓</span>
                <span>256-bit bank-grade encryption at rest</span>
              </li>
              <li className="ob-trust-card__item">
                <span className="ob-trust-card__icon">✓</span>
                <span>Read-only order tracking with zero store disruption</span>
              </li>
              <li className="ob-trust-card__item">
                <span className="ob-trust-card__icon">✓</span>
                <span>Instant 1-click disconnect anytime</span>
              </li>
            </ul>
          </div>

          {/* Guided setup card */}
          <div className="ob-assist">
            <p className="ob-assist__title">Prefer hands-off setup?</p>
            <p className="ob-assist__sub">Every step is self-serve, or our team will set it up for you on a complimentary 20-minute call.</p>
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
                {assist === 'done' ? '✓ Request sent' : assist === 'busy' ? 'Sending…' : 'Send me a setup guide'}
              </button>
            </div>
          </div>
        </aside>

        {/* ── active station card ── */}
        <main className="ob-stage">
          <section key={active} className="ob-card">
            <div className="ob-card__header">
                <div className="ob-card__topline">
                  <p className="ob-card__kicker">{STATIONS[currentIndex].hint}</p>
                  <SetupGuide
                    station={active === 'shopify' ? 'store' : active === 'carrier' ? 'courier' : active === 'payment' ? 'payments' : 'whatsapp'}
                    storeUrl={state?.connections?.shopify?.shopDomain}
                  />
                </div>
                <h1 className="ob-card__title">
                  {active === 'shopify' ? 'Connect Your Store' : active === 'whatsapp' ? 'Connect WhatsApp Number' : active === 'carrier' ? 'Link Courier Partners' : 'Enable Payment Recovery'}
                </h1>
              </div>

              {active === 'shopify' && (
                <StoreStation
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
                  onNext={() => goToStation('whatsapp')}
                />
              )}
              {active === 'whatsapp' && (
                <WhatsAppStation
                  onConnect={connectWhatsApp}
                  onManualConnect={connectWhatsAppManual}
                  onPulse={pulse}
                  onResubmitTemplates={handleResubmitTemplates}
                  busy={busy}
                  status={statusOf('whatsapp')}
                  templates={state?.templates}
                  ownerPhone={state?.ownerPhone}
                  metaReady={META_SIGNUP_READY}
                  onNext={() => goToStation('carrier')}
                  connectionDetails={state?.connections?.whatsapp}
                />
              )}
              {active === 'carrier' && (
                <CourierStation
                  onConnect={connectCarrier}
                  onDisconnect={handleDisconnectCarrier}
                  busy={busy === 'carrier'}
                  provider={state?.connections?.carrier?.provider}
                  carriers={state?.connections?.carriers}
                  token={token}
                  merchantId={state?.merchantId}
                  onNext={() => goToStation('payment')}
                />
              )}
              {active === 'payment' && (
                <PaymentStation
                  onConnect={connectPayment}
                  busy={busy === 'payment'}
                  done={done('payment')}
                  gateway={state?.connections?.payment?.gateway}
                />
              )}

              {err && <p className="ob-err" role="alert" aria-live="polite"><AlertTriangle size={14} aria-hidden="true" /> {err}</p>}
            </section>

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
