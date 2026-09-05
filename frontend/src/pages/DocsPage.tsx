import { useState } from 'react';
import { Terminal, Copy, Play, CheckCircle, Key, Book, ExternalLink, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TabPill } from '../components/motion/TabPill';

const DocsPage = () => {
  const [copied, setCopied] = useState(false);
  const [tested, setTested] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState('curl');

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const codeExamples: Record<string, string> = {
    curl: `curl -X POST https://api.rescueship.io/v1/messages \\
  -H "Authorization: Bearer rs_live_xxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+1234567890",
    "template_id": "rto_warning_01",
    "variables": {
      "customer_name": "Jane",
      "order_number": "#1042"
    }
  }'`,
    node: `import { RescueShip } from '@rescueship/sdk';

const rs = new RescueShip('rs_live_xxxxxxxxxxxxx');

await rs.messages.send({
  to: '+1234567890',
  templateId: 'rto_warning_01',
  variables: {
    customer_name: 'Jane',
    order_number: '#1042'
  }
});`,
    python: `from rescueship import RescueShip

rs = RescueShip('rs_live_xxxxxxxxxxxxx')

rs.messages.send(
    to='+1234567890',
    template_id='rto_warning_01',
    variables={
        'customer_name': 'Jane',
        'order_number': '#1042'
    }
)`
  };

  const codeTabs = [
    { id: 'curl', label: 'cURL' },
    { id: 'node', label: 'Node.js' },
    { id: 'python', label: 'Python' }
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[activeCodeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = () => {
    setTested(true);
    setTimeout(() => setTested(false), 3000);
  };

  return (
    <div className="page" style={{ maxWidth: 1000 }}>

      <header className="page-head">
        <div>
          <p className="page-head__kicker">07 · Integrations</p>
          <h1 className="page-head__title">Developer <em>API</em></h1>
          <p className="page-head__sub">Wire RescueShip into your stack — REST API, webhooks and SDKs.</p>
        </div>
      </header>

      {/* Credentials + SDK cards */}
      <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>

        <div className="panel panel--accent">
          <div className="panel__head">
            <span className="panel__title"><Key size={12} aria-hidden="true" /> API authentication</span>
          </div>
          <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.82rem', lineHeight: 1.6 }}>
              Bearer token for all requests. Keep it server-side — never expose it in client code.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--black-30)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <input
                type={revealed ? 'text' : 'password'}
                value="rs_live_8f7d6a5b4c3e2d1f0a9b8c7d6e5f4a3b"
                readOnly
                aria-label="API authentication token"
                style={{ flex: 1, background: 'transparent', border: 'none', padding: 'var(--space-2-5) var(--space-3)', color: 'var(--text-2)', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}
              />
              <button
                type="button"
                onClick={() => setRevealed(!revealed)}
                aria-label={revealed ? 'Hide API token' : 'Reveal API token'}
                style={{ background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', padding: '0 var(--space-3)', color: 'var(--indigo-soft)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', alignSelf: 'stretch' }}
              >
                {revealed ? 'Hide' : 'Reveal'}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText('rs_live_8f7d6a5b4c3e2d1f0a9b8c7d6e5f4a3b'); showToast('API key copied to clipboard.'); }}
                aria-label="Copy API key"
                style={{ background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', padding: '0 var(--space-3)', color: 'var(--text-2)', cursor: 'pointer', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="panel panel--accent">
          <div className="panel__head">
            <span className="panel__title"><Package size={12} aria-hidden="true" /> Official SDKs</span>
          </div>
          <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.82rem', lineHeight: 1.6 }}>
              Typed clients for Node.js and Python — first-class errors and retries built in.
            </p>
            <div className="code" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2-5)', padding: 'var(--space-3) var(--space-4)' }}>
              <Terminal size={14} color="var(--emerald)" />
              <span>npm install @rescueship/sdk</span>
            </div>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); showToast('Opening SDK documentation…'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--indigo-soft)', fontSize: '0.82rem', fontWeight: 600 }}
            >
              SDK documentation <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      {/* Interactive API sandbox */}
      <motion.div layout className="panel">
        <div className="panel__head" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span className="panel__title"><Terminal size={12} aria-hidden="true" /> API sandbox</span>
            <TabPill tabs={codeTabs} activeTab={activeCodeTab} onChange={setActiveCodeTab} layoutId="code-tab-pill" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={handleCopy} className="btn btn-ghost btn-sm">
              {copied ? <CheckCircle size={13} color="var(--emerald)" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={handleTest} className="btn btn-primary btn-sm">
              <Play size={12} /> Test request
            </button>
          </div>
        </div>
        <div>
          <AnimatePresence mode="wait">
            <motion.pre
              key={activeCodeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              tabIndex={0}
              aria-label="Code example"
              className="code"
              style={{ margin: 0, border: 'none', borderRadius: 0, background: 'var(--black-30)', padding: 'var(--space-5)' }}
            >
              {codeExamples[activeCodeTab]}
            </motion.pre>
          </AnimatePresence>
          <AnimatePresence>
            {tested && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--emerald-06)', padding: 'var(--space-5)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--emerald)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
                    200 OK · RESPONSE
                  </div>
                  <pre tabIndex={0} aria-label="API response" className="code" style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, color: 'var(--text-2)' }}>
                    {JSON.stringify({ success: true, message_id: 'msg_9f8e7d6c', status: 'queued' }, null, 2)}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Webhook setup */}
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title"><Book size={12} aria-hidden="true" /> Webhook setup</span>
          <span className="panel__aside">auto-registered on connect</span>
        </div>
        <div className="panel__body">
          <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            {['Shopify', 'WooCommerce', 'Custom API'].map(platform => (
              <div key={platform} className="panel" style={{ padding: 'var(--space-4)' }}>
                <h4 style={{ margin: '0 0 var(--space-1) 0', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-1)' }}>{platform}</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.5 }}>Real-time order, fulfillment and NDR events, delivered as signed webhooks.</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast-notification" role="status">
          <CheckCircle size={18} color="var(--indigo)" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default DocsPage;
