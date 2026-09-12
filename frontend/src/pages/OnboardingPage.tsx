import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { connectApi } from '../lib/connect';
import './onboarding.css';

type Key = 'shopify' | 'whatsapp' | 'carrier' | 'payment';
const STATIONS: { key: Key; label: string; verb: string; hint: string }[] = [
  { key: 'shopify',  label: 'Your store',     verb: 'connect',   hint: 'Shopify — paste the key + secret from your own admin app. WooCommerce — paste your REST API keys. Either way, your store stays fully isolated.' },
  { key: 'whatsapp', label: 'WhatsApp number', verb: 'verify',    hint: 'Your own Business number. Customers message the brand, not us.' },
  { key: 'carrier',  label: 'Courier',         verb: 'link',      hint: 'Shiprocket, Delhivery or ClickPost — your existing API key.' },
  { key: 'payment',  label: 'Payments',        verb: 'enable',    hint: 'Razorpay or Cashfree — for COD → prepaid links.' },
];

declare global { interface Window { FB: any; fbAsyncInit?: () => void; } }
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID || '';
const META_APP_ID = import.meta.env.VITE_META_APP_ID || '';
// Embedded Signup UI must never fire without both — an undefined appId fails
// silently inside Meta's SDK and the merchant sees "nothing happened".
const META_SIGNUP_READY = Boolean(META_APP_ID && META_CONFIG_ID);

export default function OnboardingPage() {
  const { token } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<any>(null);
  const [active, setActive] = useState<Key>('shopify');
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [assist, setAssist] = useState<'idle' | 'busy' | 'done'>('idle');
  const [wcManual, setWcManual] = useState<{ webhookUrl: string; webhookSecret: string } | null>(null);
  const pollRef = useRef<any>(null);

  const requestAssist = async () => {
    setAssist('busy'); setErr(null);
    try {
      const r = await connectApi.requestAssistedSetup(token!);
      setAssist('done');
      push('✓ guided setup requested — the rescue team will reach out');
      if (r?.setupCallUrl) window.open(r.setupCallUrl, '_blank', 'noopener');
    } catch (e: any) { setErr(e.message); setAssist('idle'); }
  };

  const push = (line: string) => setLog((l) => [...l.slice(-5), line]);
  const refresh = async () => { const s = await connectApi.state(token!); setState(s); return s; };

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

  useEffect(() => {
    refresh().then((s: any) => {
      if (s?.connections) {
        const isStoreConnected = s.connections.shopify?.status === 'connected' || s.connections.woocommerce?.status === 'connected';
        if (isStoreConnected) {
          const nextIncomplete = STATIONS.find((st) => {
            if (st.key === 'shopify') return false;
            return s.connections[st.key]?.status !== 'connected';
          });
          if (nextIncomplete) {
            setActive(nextIncomplete.key);
          }
        }
      }
    });
    return () => clearInterval(pollRef.current);
  }, [token]);

  useEffect(() => {
    if (params.get('connected') === 'shopify') {
      push('✓ store connected · webhooks registered');
      refresh().then(() => advanceToNext('shopify'));
    }
    if (params.get('error')) setErr('Store connection was cancelled or failed.');
  }, [params]);

  // poll template approval while pending
  useEffect(() => {
    if (state?.connections?.whatsapp?.status === 'templates_pending') {
      push('› templates submitted · awaiting Meta approval');
      pollRef.current = setInterval(async () => { const s = await connectApi.whatsappTemplates(token!); if (s.status === 'connected') { push('✓ all templates approved'); clearInterval(pollRef.current); refresh(); } else if (s.status === 'templates_rejected') { push('⚠ a template was rejected — see reasons below'); clearInterval(pollRef.current); refresh(); } }, 4000);
    }
  }, [state?.connections?.whatsapp?.status]);

  const storeDone = () => state?.connections?.shopify?.status === 'connected' || state?.connections?.woocommerce?.status === 'connected';
  const done = (k: Key) => k === 'shopify' ? storeDone() : state?.connections?.[k]?.status === 'connected';
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
  const connectCarrier = async (provider: string, email: string, password: string, apiToken: string, apiKey: string) => {
    setBusy('carrier'); setErr(null); push(`› validating ${provider} credentials…`);
    try {
      await connectApi.carrier(token!, { provider, email, password, apiToken, apiKey });
      push(`✓ ${provider} validated`);
      await refresh();
      advanceToNext('carrier');
      setBusy(null);
    }
    catch (e: any) { setErr(e.message); push('✗ credentials rejected — nothing saved'); setBusy(null); }
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
  const pulse = async () => { setBusy('pulse'); setErr(null); push('› sending test rescue to your number…'); try { await connectApi.testPulse(token!); push('✓ test rescue sent — check your phone'); refresh(); setBusy(null); } catch (e: any) { setErr(e.message); setBusy(null); } };
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
        <a href="/" className="ob-brand"><span>⚓</span> RescueShip</a>
        <div className="ob-topbar"><motion.div className="ob-topbar__fill" style={{ width: `${(STATIONS.filter((s) => done(s.key)).length / STATIONS.length) * 100}%` }} /></div>
        <span className="ob-topbar__pct">{Math.round((STATIONS.filter((s) => done(s.key)).length / STATIONS.length) * 100)}% ready</span>
      </header>

      <div className="ob-shell">
        {/* ── the route / spine ── */}
        <aside className="ob-spine">
          <p className="ob-spine__kicker">Setup route</p>
          <div className="ob-spine__track">
            {STATIONS.map((s, i) => {
              const st = statusOf(s.key);
              const isDone = st === 'connected';
              const isActive = s.key === active;
              const pending = st === 'templates_pending' || st === 'connecting';
              return (
                <button key={s.key} className={`ob-node ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`} onClick={() => { setActive(s.key); setErr(null); }} style={{ ['--i' as any]: i }}>
                  <span className="ob-node__line" data-fill={i < currentIndex || isDone ? '1' : '0'} />
                  <span className="ob-node__dot">
                    {isDone ? <svg viewBox="0 0 24 24" className="ob-check"><path d="M5 13l4 4L19 7" /></svg>
                      : pending ? <span className="ob-spin" /> : <span className="ob-node__n">{i + 1}</span>}
                    {isActive && <span className="ob-marker" aria-hidden="true">🛵</span>}
                  </span>
                  <span className="ob-node__text">
                    <strong>{s.label}</strong>
                    <em>{isDone ? 'connected' : pending ? 'in progress' : 'awaiting'}</em>
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
                  📞 Book free setup call
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="ob-card__kicker">{STATIONS[currentIndex].hint}</p>
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
              {active === 'whatsapp' && <WhatsAppPanel onConnect={connectWhatsApp} onManualConnect={connectWhatsAppManual} onPulse={pulse} busy={busy} status={statusOf('whatsapp')} templates={state?.templates} ownerPhone={state?.ownerPhone} metaReady={META_SIGNUP_READY} onSetPhone={(p: string, n: string) => connectApi.ownerPhone(token!, p, n).then(refresh)} />}
              {active === 'carrier' && <CarrierForm onConnect={connectCarrier} busy={busy === 'carrier'} done={done('carrier')} provider={state?.connections?.carrier?.provider} />}
              {active === 'payment' && <PaymentForm onConnect={connectPayment} busy={busy === 'payment'} done={done('payment')} gateway={state?.connections?.payment?.gateway} />}

              {err && <p className="ob-err">⚠ {err}</p>}
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
                if (allGreen && !state?.paid) {
                  nav('/billing?from=onboarding');
                } else if (allGreen && state?.paid) {
                  goLive();
                }
              }}
            >
              {allGreen
                ? (!state?.paid ? 'Next: Calculate savings & select plan →' : 'Go live →')
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
          🔄 Reconnect or change store
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
      <Field label="Consumer key"><input className="ob-input" placeholder="ck_…" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} required /></Field>
      <Field label="Consumer secret"><input className="ob-input" type="password" placeholder="cs_…" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} required /></Field>
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
          ⚡ One-click connect (Recommended)
        </button>
        <button type="button" className={method === 'manual' ? 'on' : ''} onClick={() => setMethod('manual')}>
          🔑 Manual app keys
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
            <input className="ob-input" type="password" placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} required />
          </Field>
          <Field label="Consumer secret (API secret key)">
            <input className="ob-input" type="password" placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxx" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} required />
          </Field>
          <div className="ob-steps">
            <p className="ob-steps__title">How to get these in modern Shopify (2026):</p>
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

function WhatsAppPanel({ onConnect, onManualConnect, onPulse, busy, status, templates, ownerPhone, metaReady, onSetPhone }: any) {
  const [phone, setPhone] = useState(ownerPhone || '');
  const [name, setName] = useState('');
  const [manual, setManual] = useState(!metaReady);
  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const connected = status === 'connected' || status === 'templates_pending' || status === 'templates_rejected';
  const oneClickReady = metaReady;
  const manualValid = /^\d{6,32}$/.test(phoneId.trim()) && /^\d{6,32}$/.test(wabaId.trim()) && accessToken.trim().length > 0;
  return (
    <div className="ob-form">
      {!connected ? (
        <>
          <div className="ob-seg">
            {oneClickReady && <button type="button" className={!manual ? 'on' : ''} onClick={() => setManual(false)}>One-click</button>}
            <button type="button" className={manual ? 'on' : ''} onClick={() => setManual(true)}>Manual (your keys)</button>
          </div>

          {!manual && oneClickReady ? (
            <>
              <p className="ob-note">Opens Meta's signup in a popup. Log into <strong>your</strong> Business account, pick the WhatsApp number customers will message, and grant access. We receive a permanent token — you never share a password.</p>
              <button className="ob-btn" disabled={busy === 'whatsapp'} onClick={onConnect}>{busy === 'whatsapp' ? 'Connecting…' : 'Connect WhatsApp number'}</button>
            </>
          ) : (
            <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onManualConnect(phoneId.trim(), wabaId.trim(), accessToken.trim()); }}>
              <Field label="Phone number ID"><input className="ob-input" placeholder="123456789012345" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} required /></Field>
              <Field label="WABA ID (WhatsApp Business Account)"><input className="ob-input" placeholder="987654321098765" value={wabaId} onChange={(e) => setWabaId(e.target.value)} required /></Field>
              <Field label="Access token"><input className="ob-input" type="password" placeholder="EAAG…" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required /></Field>
              <div className="ob-steps">
                <p className="ob-steps__title">How to find these (3 min):</p>
                <ol className="ob-steps__list">
                  <li><strong>Fastest (All-in-one):</strong> Open <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">Meta App Dashboard</a> → WhatsApp → API Setup to find your Phone number ID, WABA ID, and access token together.</li>
                  <li>Or via Meta Business Suite:
                    <ul style={{ marginTop: '4px', paddingLeft: '16px', listStyleType: 'circle' }}>
                      <li><a href="https://business.facebook.com/latest/whatsapp_manager/phone-numbers/" target="_blank" rel="noopener noreferrer">WhatsApp Manager → Phone numbers</a> — copy the <strong>Phone number ID</strong></li>
                      <li><a href="https://business.facebook.com/latest/whatsapp_manager/overview/" target="_blank" rel="noopener noreferrer">Account overview</a> — copy the <strong>WABA ID</strong></li>
                      <li><a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer">Business Settings → System users</a> — generate a permanent token with <code>whatsapp_business_messaging</code></li>
                    </ul>
                  </li>
                </ol>
              </div>
              <button className="ob-btn" disabled={busy === 'whatsapp' || !manualValid}>{busy === 'whatsapp' ? 'Validating…' : 'Validate & connect'}</button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="ob-wa-status">
            <span className={`ob-pill ${status === 'connected' ? 'ok' : status === 'templates_rejected' ? 'bad' : 'wait'}`}>{status === 'connected' ? '● live' : status === 'templates_rejected' ? '● template issue' : '◌ templates pending'}</span>
            {templates?.length > 0 && <ul className="ob-tpl">{templates.map((t: any) => <li key={t.name}><code>{t.name}</code><span className={`ob-tpl__s ${t.status === 'APPROVED' ? 'ok' : t.status === 'REJECTED' ? 'bad' : 'wait'}`}>{t.status}</span>{t.rejectedReason && <em>{t.rejectedReason}</em>}</li>)}</ul>}
          </div>
          <div className="ob-pulse">
            <Field label="Your mobile (for the test)"><input className="ob-input" placeholder="+91 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Store name (optional)"><input className="ob-input" placeholder="Mamaearth" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <button className="ob-btn ob-btn--ghost" disabled={!phone || busy === 'pulse'} onClick={() => { onSetPhone(phone, name); onPulse(); }}>{busy === 'pulse' ? 'Sending…' : '📲 Send me a test rescue'}</button>
            <p className="ob-note">Fires a real message to your number — the proof that recovery works, before any customer order depends on it.</p>
          </div>
        </>
      )}
    </div>
  );
}

function CarrierForm({ onConnect, busy, done, provider }: any) {
  const [p, setP] = useState<'shiprocket' | 'delhivery' | 'clickpost'>('shiprocket');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [apiToken, setApiToken] = useState(''); const [apiKey, setApiKey] = useState('');
  return done ? <Done provider={`Connected · ${provider}`} /> : (
    <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onConnect(p, email, password, apiToken, apiKey); }}>
      <div className="ob-seg">{(['shiprocket', 'delhivery', 'clickpost'] as const).map((x) => <button type="button" key={x} className={p === x ? 'on' : ''} onClick={() => setP(x)}>{x}</button>)}</div>
      {p === 'shiprocket' ? (<><Field label="Email"><input className="ob-input" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Field label="Password"><input className="ob-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field></>)
        : p === 'delhivery' ? <Field label="API token"><input className="ob-input" value={apiToken} onChange={(e) => setApiToken(e.target.value)} required /></Field>
        : <Field label="API key"><input className="ob-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required /></Field>}
      <p className="ob-note">We validate these against the carrier before saving — dead keys are rejected, never stored.</p>
      <button className="ob-btn" disabled={busy}>Validate & connect</button>
    </form>
  );
}

function PaymentForm({ onConnect, busy, done, gateway }: any) {
  const [g, setG] = useState<'razorpay' | 'cashfree'>('razorpay');
  const [id, setId] = useState(''); const [sec, setSec] = useState('');
  return done ? <Done provider={`Connected · ${gateway}`} /> : (
    <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onConnect(g, id, sec); }}>
      <div className="ob-seg">{(['razorpay', 'cashfree'] as const).map((x) => <button type="button" key={x} className={g === x ? 'on' : ''} onClick={() => setG(x)}>{x}</button>)}</div>
      <Field label="Key / Client ID"><input className="ob-input" value={id} onChange={(e) => setId(e.target.value)} required /></Field>
      <Field label="Secret"><input className="ob-input" type="password" value={sec} onChange={(e) => setSec(e.target.value)} required /></Field>
      <p className="ob-note">Validated with a live read call, then encrypted at rest (AES-256-GCM).</p>
      <button className="ob-btn" disabled={busy}>Validate & connect</button>
    </form>
  );
}

function Done({ provider }: { provider: string }) {
  return <div className="ob-done"><svg viewBox="0 0 24 24" className="ob-done__check"><path d="M5 13l4 4L19 7" /></svg><p>{provider}</p></div>;
}
