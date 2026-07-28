import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { connectApi } from '../lib/connect';
import SetupGuide from '../components/SetupGuide';
import './onboarding.css';

type Key = 'shopify' | 'whatsapp' | 'carrier' | 'payment';
const STATIONS: { key: Key; label: string; verb: string; hint: string }[] = [
  { key: 'shopify',  label: 'Your store',     verb: 'connect',   hint: 'Shopify or WooCommerce — read-only order access.' },
  { key: 'whatsapp', label: 'WhatsApp number', verb: 'verify',    hint: 'Your own Business number. Customers message the brand, not us.' },
  { key: 'carrier',  label: 'Courier',         verb: 'link',      hint: 'Shiprocket, Delhivery or ClickPost — your existing API key.' },
  { key: 'payment',  label: 'Payments',        verb: 'enable',    hint: 'Razorpay or Cashfree — for COD → prepaid links.' },
];

declare global { interface Window { FB: any; fbAsyncInit?: () => void; } }
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID || '';

export default function OnboardingPage() {
  const { token } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<any>(null);
  const [active, setActive] = useState<Key>('shopify');
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

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
    try { const { url } = await connectApi.shopifyUrl(token!, shop); push('› redirecting to Shopify…'); window.location.href = url; }
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
  const goLive = async () => { setBusy('finalize'); try { await connectApi.finalize(token!); nav('/dashboard'); } catch (e: any) { setErr(e.message); setBusy(null); } };

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
                <button key={s.key} className={`ob-node ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`} onClick={() => setActive(s.key)} style={{ ['--i' as any]: i }}>
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
              {active === 'whatsapp' && <WhatsAppPanel onConnect={connectWhatsApp} onPulse={pulse} busy={busy} status={statusOf('whatsapp')} templates={state?.templates} ownerPhone={state?.ownerPhone} onSetPhone={(p: string, n: string) => connectApi.ownerPhone(token!, p, n).then(refresh)} />}
              {active === 'carrier' && <CarrierForm onConnect={connectCarrier} busy={busy === 'carrier'} done={done('carrier')} provider={state?.connections?.carrier?.provider} />}
              {active === 'payment' && <PaymentForm onConnect={connectPayment} busy={busy === 'payment'} done={done('payment')} gateway={state?.connections?.payment?.gateway} />}

              {err && <p className="ob-err">⚠ {err}</p>}
            </motion.section>
          </AnimatePresence>

          <footer className="ob-foot">
            <button className="ob-foot__skip" onClick={() => setActive(STATIONS[Math.min(currentIndex + 1, 3)].key)}>Skip for now</button>
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
      <p className="ob-note">We request read-only order + fulfillment access. You can revoke anytime from your Shopify admin.</p>
      <button className="ob-btn" disabled={busy || !v.includes('.myshopify.com')}>{busy ? 'Redirecting…' : 'Connect Shopify'}</button>
    </form>
  );
}

function WhatsAppPanel({ onConnect, onPulse, busy, status, templates, ownerPhone, onSetPhone }: any) {
  const [phone, setPhone] = useState(ownerPhone || '');
  const [name, setName] = useState('');
  const connected = status === 'connected' || status === 'templates_pending' || status === 'templates_rejected';
  return (
    <div className="ob-form">
      {!connected ? (
        <>
          <p className="ob-note">Opens Meta's signup in a popup. Log into <strong>your</strong> Business account, pick the WhatsApp number customers will message, and grant access. We receive a permanent token — you never share a password.</p>
          <button className="ob-btn" disabled={busy === 'whatsapp'} onClick={onConnect}>{busy === 'whatsapp' ? 'Connecting…' : 'Connect WhatsApp number'}</button>
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
