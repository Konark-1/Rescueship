import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Anchor, ShieldCheck, Phone, AlertTriangle, CheckCircle2, Scissors } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { connectApi } from '../lib/connect';
import { billingApi } from '../services/billing.api';
import { takePendingShop } from '../lib/shopify-launch';
import SetupGuide from '../components/SetupGuide';
import StoreStation from '../components/onboarding/StoreStation';
import CourierStation from '../components/onboarding/CourierStation';
import PaymentStation from '../components/onboarding/PaymentStation';
import { WhatsAppStation } from '../components/onboarding/WhatsAppStation';
import './onboarding.css';

type Key = 'shopify' | 'whatsapp' | 'carrier' | 'payment';
const STATIONS: { key: Key; label: string; verb: string; title: string; hint: string }[] = [
  { key: 'shopify',  label: 'Your store', verb: 'connect', title: 'Connect your store',  hint: 'So RescueShip sees each order, its buyer and its courier.' },
  { key: 'whatsapp', label: 'WhatsApp',   verb: 'connect', title: 'Connect WhatsApp number', hint: 'Connect your WhatsApp Cloud API or use RescueShip autonomous delivery gateway.' },
  { key: 'carrier',  label: 'Courier',    verb: 'link',    title: 'Connect your courier', hint: 'So RescueShip hears about failed deliveries and can send the buyer’s answer back.' },
  { key: 'payment',  label: 'Payments',   verb: 'enable',  title: 'Set up payments',      hint: 'Choose how you collect online payments when buyers convert COD orders.' },
];

export default function OnboardingPage() {
  const { token, user, logout } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<any>(null);
  const [active, setActive] = useState<Key>(() => {
    try {
      const p = params.get('station') as Key | null;
      return p && STATIONS.some((s) => s.key === p) ? p : 'shopify';
    } catch {
      return 'shopify';
    }
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentSetup, setPaymentSetup] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [assist, setAssist] = useState<'idle' | 'busy' | 'done'>('idle');
  const [wcManual, setWcManual] = useState<{ webhookUrl: string; webhookSecret: string } | null>(null);
  const [planInfo, setPlanInfo] = useState<any>(null);

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

  // Resume a Shopify install that started from the Shopify admin (/shopify?shop=…).
  const pendingShopHandledRef = useRef(false);
  useEffect(() => {
    if (pendingShopHandledRef.current || !state || !token) return;
    pendingShopHandledRef.current = true;
    const pendingShop = takePendingShop();
    if (!pendingShop) return;
    if (state?.connections?.shopify?.status === 'connected' && state.connections.shopify.shopDomain === pendingShop) {
      if (user?.onboardingStatus === 'completed') nav('/dashboard', { replace: true });
      return;
    }
    setActive('shopify');
    void handleOAuthConnect(pendingShop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, token]);

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
  const connectWhatsAppManual = async (phoneId: string, wabaId: string, accessToken: string, appSecret?: string) => {
    setBusy('whatsapp'); setErr(null); push('› validating WhatsApp credentials…');
    try {
      await connectApi.whatsappManual(token!, phoneId, wabaId, accessToken, appSecret);
      push('✓ WhatsApp credentials verified');
      await refresh();
      advanceToNext('whatsapp');
      setBusy(null);
    } catch (e: any) { setErr(e.message); push('✗ credentials rejected'); setBusy(null); }
  };
  const pulse = async () => {
    setBusy('pulse'); setErr(null); push('Sending test rescue to your phone…');
    try {
      await connectApi.testPulse(token!);
      push('Test rescue sent. Check WhatsApp on your phone.');
      await refresh();
      setBusy(null);
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };
  const startVerify = async (rawPhone: string, storeName: string) => {
    setErr(null);
    let phone = rawPhone.replace(/[^\d+]/g, '');
    if (/^\d{10}$/.test(phone)) phone = `+91${phone}`;
    else if (/^\d{11,15}$/.test(phone)) phone = `+${phone}`;
    try {
      const r = await connectApi.ownerPhone(token!, phone, storeName || undefined);
      await refresh();
      return r?.verification || null;
    } catch (e: any) { setErr(e.message); return null; }
  };
  const connectPayment = async (gateway: string, keyId: string, keySecret: string, webhookSecret?: string) => {
    setBusy('payment'); setErr(null); push(`› validating ${gateway} keys…`);
    try {
      const result: any = await connectApi.payment(token!, gateway, keyId, keySecret, webhookSecret);
      push(`✓ ${gateway} validated`);
      setPaymentSetup(result);
      await refresh();
      // Stay on this step until the signed webhook is verified (₹1 self-test).
      if (result?.webhookVerified) advanceToNext('payment');
      else push('› add the webhook in your gateway dashboard, then run the ₹1 test');
      setBusy(null);
    }
    catch (e: any) { setErr(e.message); push('✗ keys rejected — nothing saved'); setBusy(null); }
  };
  const connectPaymentManaged = async (payout: {
    type: 'upi' | 'bank_account';
    upiId?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  }) => {
    setBusy('payment');
    setErr(null);
    push(`› saving managed settlement details (${payout.type === 'upi' ? 'UPI' : 'Bank A/C'})…`);
    try {
      const result: any = await connectApi.paymentManaged(token!, payout);
      push(`✓ managed settlement configured (${result.destination})`);
      setPaymentSetup(result);
      await refresh();
      advanceToNext('payment');
      setBusy(null);
    } catch (e: any) {
      setErr(e.message);
      push('✗ settlement details rejected');
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
            <p className="ob-spine__kicker">Setup</p>
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
                    <em>{isDone ? 'Connected' : pending ? 'Connecting' : 'Not connected yet'}</em>
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

          {/* Data Safety & Guarantee Card with SEC/SAFE.01 Security Stub */}
          <div className="ob-trust-card ob-trust-card--waybill">
            <div className="ob-waybill-stub" aria-hidden="true">
              <span className="ob-waybill-stub__serial">SEC/SAFE.01 // ENCRYPTION SPEC</span>
              <span className="ob-waybill-stub__tear">
                <Scissors size={10} className="waybill-scissors" />
                VERIFIED ISOLATION
              </span>
            </div>
            <p className="ob-trust-card__title">
              <ShieldCheck size={16} className="ob-trust-card__icon" aria-hidden="true" />
              Nothing goes live yet
            </p>
            <ul className="ob-trust-card__list">
              <li className="ob-trust-card__item">
                <span className="ob-trust-card__icon">✓</span>
                <span>Buyers get no messages until you switch rescues on.</span>
              </li>
              <li className="ob-trust-card__item">
                <span className="ob-trust-card__icon">✓</span>
                <span>Store, courier and payment keys are stored encrypted.</span>
              </li>
              <li className="ob-trust-card__item">
                <span className="ob-trust-card__icon">✓</span>
                <span>Test rescues go only to your own verified phone.</span>
              </li>
            </ul>
          </div>

          {/* Guided setup card */}
          <div className="ob-assist">
            <p className="ob-assist__title">Stuck on a step?</p>
            <p className="ob-assist__sub">We can walk you through it on a free 20-minute call.</p>
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
          {/* Autonomous WhatsApp Delivery Desk Active Banner */}
          <div className="ob-wa-banner">
            <div className="ob-wa-banner__badge">
              <CheckCircle2 size={16} /> Autonomous WhatsApp Delivery Desk: Active (Included)
            </div>
            <p className="ob-wa-banner__desc">
              Automatic NDR rescues and COD confirmations dispatch instantly via RescueShip's verified logistics gateway on behalf of{' '}
              <strong>{state?.storeName || 'your store'}</strong>. Zero Meta developer setup or WABA approvals required.
            </p>
          </div>

          <section key={active} className="ob-card">
            {/* Station OS Window Chrome */}
            <div className="ob-window-head" aria-hidden="true">
              <div className="ob-window-dots">
                <span className="ob-window-dot ob-window-dot--r" />
                <span className="ob-window-dot ob-window-dot--a" />
                <span className="ob-window-dot ob-window-dot--g" />
              </div>
              <span className="ob-window-file">
                {active === 'shopify'
                  ? 'station_01_store.cfg'
                  : active === 'whatsapp'
                  ? 'station_02_whatsapp.cfg'
                  : active === 'carrier'
                  ? 'station_03_carrier.cfg'
                  : 'station_04_payments.cfg'}
              </span>
              <span className="ob-window-badge">AUTONOMOUS SYS.v2</span>
            </div>

            <div className="ob-card__header">
                <div className="ob-card__topline">
                  <h1 className="ob-card__title">{STATIONS[currentIndex].title}</h1>
                  <SetupGuide
                    station={active === 'shopify' ? 'store' : active === 'whatsapp' ? 'whatsapp' : active === 'carrier' ? 'courier' : 'payments'}
                    storeUrl={state?.connections?.shopify?.shopDomain}
                  />
                </div>
                <p className="ob-card__kicker">{STATIONS[currentIndex].hint}</p>
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
                  onConnect={() => {}}
                  onManualConnect={connectWhatsAppManual}
                  onPulse={pulse}
                  onStartVerify={startVerify}
                  onRefresh={refresh}
                  onResubmitTemplates={async () => {
                    setBusy('resubmit_templates');
                    try {
                      await connectApi.resubmitWhatsAppTemplates(token!);
                      push('✓ Templates resubmitted to Meta');
                      await refresh();
                    } catch (e: any) { setErr(e.message); }
                    setBusy(null);
                  }}
                  busy={busy}
                  status={statusOf('whatsapp')}
                  templates={state?.templates}
                  ownerPhone={state?.ownerPhone}
                  metaReady={false}
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
                  onConnectManaged={connectPaymentManaged}
                  setup={paymentSetup}
                  onTestLink={() => connectApi.paymentTestLink(token!)}
                  busy={busy === 'payment'}
                  done={done('payment')}
                  gateway={state?.connections?.payment?.gateway}
                  paymentDetails={state?.connections?.payment}
                />
              )}

              {err && <p className="ob-err" role="alert" aria-live="polite"><AlertTriangle size={14} aria-hidden="true" /> {err}</p>}
            </section>

          <footer className="ob-foot">
            <button className="ob-foot__skip" onClick={handleSkip} disabled={busy === 'skip'}>
              {busy === 'skip' ? 'Opening dashboard…' : currentIndex >= STATIONS.length - 1 ? 'Finish later' : 'Skip for now'}
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
                ? (busy === 'finalize'
                    ? 'Switching on…'
                    : (!state?.paid && !planInfo?.active) ? 'Choose a plan and go live' : 'Switch on rescues for buyers')
                : `${STATIONS.filter((s) => !done(s.key)).length} ${STATIONS.filter((s) => !done(s.key)).length === 1 ? 'step' : 'steps'} left`}
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}
