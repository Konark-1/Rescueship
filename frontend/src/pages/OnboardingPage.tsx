import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { connectApi } from '../lib/connect';
import SetupGuide from '../components/SetupGuide';
import './onboarding.css';

type Key = 'shopify' | 'whatsapp' | 'carrier' | 'payment';
const STATIONS: { key: Key; label: string; verb: string; hint: string }[] = [
  { key: 'shopify',  label: 'Your store',     verb: 'connect',   hint: 'One click — RescueShip\'s app connects YOUR store only. No keys, no Partner account needed from you.' },
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

  useEffect(() => { refresh(); return () => clearInterval(pollRef.current); }, [token]);
  useEffect(() => { if (params.get('connected') === 'shopify') { push('✓ store connected · webhooks registered'); refresh(); } if (params.get('error')) setErr('Store connection was cancelled or failed.'); }, [params]);

  // poll template approval while pending
  useEffect(() => {
    if (state?.connections?.whatsapp?.status === 'templates_pending') {
      push('› templates submitted · awaiting Meta approval');
      pollRef.current = setInterval(async () => { const s = await connectApi.whatsappTemplates(token!); if (s.status === 'connected') { push('✓ all templates approved'); clearInterval(pollRef.current); refresh(); } else if (s.status === 'templates_rejected') { push('⚠ a template was rejected — see reasons below'); clearInterval(pollRef.current); refresh(); } }, 4000);
    }
  }, [state?.connections?.whatsapp?.status]);

  const done = (k: Key) => state?.connections?.[k]?.status === 'connected';
  const statusOf = (k: Key) => state?.connections?.[k]?.status || 'disconnected';
  const currentIndex = STATIONS.findIndex((s) => s.key === active);
  const allGreen = !!state?.ready;

  // ── actions ──
  const connectShopify = async (shop: string) => {
    setBusy('shopify'); setErr(null); push(`› building install link for ${shop}…`);
    try {
      const r = await connectApi.shopifyUrl(token!, shop);
      if (r?.demo) {
        // Dev sandbox: no Partner app configured locally, so we simulate the connection
        push('› demo mode: connecting store locally (no Shopify app needed on localhost)…');
        await connectApi.shopifyDemoConnect(token!, shop);
        push(`✓ ${shop} connected (demo) — on production this goes through Shopify's consent screen`);
        refresh(); setBusy(null);
        return;
      }
      push('› redirecting to Shopify…');
      window.location.href = r.url;
    }
    catch (e: any) { setErr(e.message); setBusy(null); }
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
        connectApi.whatsappSignup(token!, code, resp?.authResponse?.business_id).then(() => { push('✓ WhatsApp connected · submitting templates'); refresh(); setBusy(null); }).catch((e: any) => { setErr(e.message); setBusy(null); });
      }, { config_id: META_CONFIG_ID, response_type: 'code', override_default_response_type: true });
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };
  const connectCarrier = async (provider: string, email: string, password: string, apiToken: string, apiKey: string) => {
    setBusy('carrier'); setErr(null); push(`› validating ${provider} credentials…`);
    try { await connectApi.carrier(token!, { provider, email, password, apiToken, apiKey }); push(`✓ ${provider} validated`); refresh(); setBusy(null); }
    catch (e: any) { setErr(e.message); push('✗ credentials rejected — nothing saved'); setBusy(null); }
  };
  const connectPayment = async (gateway: string, keyId: string, keySecret: string) => {
    setBusy('payment'); setErr(null); push(`› validating ${gateway} keys…`);
    try { await connectApi.payment(token!, gateway, keyId, keySecret); push(`✓ ${gateway} validated`); refresh(); setBusy(null); }
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
            <p className="ob-assist__sub">Every step above is self-serve — or let us do it with you on a free 20-minute call.</p>
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
                {assist === 'done' ? '✓ We\'ll reach out to you' : assist === 'busy' ? 'Sending…' : 'Set it up for me'}
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
                <SetupGuide station={active === 'shopify' ? 'store' : active === 'carrier' ? 'courier' : active === 'payment' ? 'payments' : 'whatsapp'} />
              </div>
              <h1 className="ob-card__title">{STATIONS[currentIndex].verb === 'connect' ? 'Connect' : STATIONS[currentIndex].verb === 'verify' ? 'Verify' : STATIONS[currentIndex].verb === 'link' ? 'Link' : 'Enable'} <em>{STATIONS[currentIndex].label.toLowerCase()}</em></h1>

              {active === 'shopify' && <ShopifyForm onConnect={connectShopify} busy={busy === 'shopify'} done={done('shopify')} shop={state?.connections?.shopify?.shopDomain} />}
              {active === 'whatsapp' && <WhatsAppPanel onConnect={connectWhatsApp} onPulse={pulse} busy={busy} status={statusOf('whatsapp')} templates={state?.templates} ownerPhone={state?.ownerPhone} metaReady={META_SIGNUP_READY} onSetPhone={(p: string, n: string) => connectApi.ownerPhone(token!, p, n).then(refresh)} />}
              {active === 'carrier' && <CarrierForm onConnect={connectCarrier} busy={busy === 'carrier'} done={done('carrier')} provider={state?.connections?.carrier?.provider} />}
              {active === 'payment' && <PaymentForm onConnect={connectPayment} busy={busy === 'payment'} done={done('payment')} gateway={state?.connections?.payment?.gateway} />}

              {err && <p className="ob-err">⚠ {err}</p>}
            </motion.section>
          </AnimatePresence>

          <footer className="ob-foot">
            <button className="ob-foot__skip" onClick={handleSkip} disabled={busy === 'skip'}>
              {busy === 'skip' ? 'Opening dashboard…' : currentIndex >= STATIONS.length - 1 ? 'Finish later → dashboard' : 'Skip for now'}
            </button>
            <button className="ob-foot__go" disabled={!allGreen || busy === 'finalize'} onClick={() => allGreen && !state?.paid ? nav('/billing') : goLive()}>
              {allGreen ? (!state?.paid ? 'Subscribe to go live →' : 'Go live →') : `${STATIONS.filter((s) => !done(s.key)).length} station${STATIONS.filter((s) => !done(s.key)).length === 1 ? '' : 's'} to go`}
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ── station forms (compact, real) ── */
function Field({ label, children }: any) { return <label className="ob-field"><span>{label}</span>{children}</label>; }

function ShopifyForm({ onConnect, busy, done, shop }: any) {
  const [v, setV] = useState('');
  return done ? <Done provider={`Connected · ${shop}`} /> : (
    <form className="ob-form" onSubmit={(e) => { e.preventDefault(); onConnect(v.trim()); }}>
      <Field label="Store address"><input className="ob-input" placeholder="your-brand.myshopify.com" value={v} onChange={(e) => setV(e.target.value)} required /></Field>
      <p className="ob-note">Type your store name and we'll redirect you to Shopify's own consent screen. You'll see <strong>RescueShip</strong> requesting order access — approve it there. Our single Partner app serves every merchant, but each store is fully isolated: your token, your orders, your data. A merchant never touches API keys, and can't see any other store.</p>
      <p className="ob-note" style={{ color: 'var(--text-3)', fontSize: '0.74rem' }}>WooCommerce or custom platform? <strong>Skip this station</strong> and use Settings → Platform once you're in the dashboard.</p>
      <button className="ob-btn" disabled={busy || !v.includes('.myshopify.com')}>{busy ? 'Redirecting…' : 'Connect Shopify'}</button>
    </form>
  );
}

function WhatsAppPanel({ onConnect, onPulse, busy, status, templates, ownerPhone, metaReady, onSetPhone }: any) {
  const [phone, setPhone] = useState(ownerPhone || '');
  const [name, setName] = useState('');
  const connected = status === 'connected' || status === 'templates_pending' || status === 'templates_rejected';
  return (
    <div className="ob-form">
      {!connected ? (
        <>
          <p className="ob-note">Opens Meta's signup in a popup. Log into <strong>your</strong> Business account, pick the WhatsApp number customers will message, and grant access. We receive a permanent token — you never share a password.</p>
          {metaReady ? (
            <button className="ob-btn" disabled={busy === 'whatsapp'} onClick={onConnect}>{busy === 'whatsapp' ? 'Connecting…' : 'Connect WhatsApp number'}</button>
          ) : (
            <>
              <button className="ob-btn" disabled title="One-click WhatsApp connect is being enabled on this deployment">Connect WhatsApp number</button>
              <p className="ob-note" style={{ color: 'var(--amber)' }}>One-click connect is being enabled on this deployment right now. Use <strong>Set it up for me</strong> on the left and we'll connect your number with you on a short call — nothing else on this page is blocked.</p>
            </>
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
