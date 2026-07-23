import { useState } from 'react';
import { Terminal, Copy, Play, CheckCircle, Code as CodeIcon, Key, Book, ExternalLink } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Developer API & Integration
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          Connect RescueShip to your custom stack using our REST API or official SDKs.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* API Key Box */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Key size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontWeight: 600 }}>API Authentication</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Use this token to authenticate your API requests. Keep it secure and do not expose it in client-side code.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <input 
              type={revealed ? "text" : "password"} 
              value="rs_live_8f7d6a5b4c3e2d1f0a9b8c7d6e5f4a3b" 
              readOnly 
              style={{ flex: 1, background: 'transparent', border: 'none', padding: '0.75rem 1rem', color: 'var(--text-secondary)', outline: 'none', fontFamily: 'monospace' }} 
            />
            <button 
              onClick={() => setRevealed(!revealed)}
              style={{ background: 'transparent', border: 'none', borderLeft: '1px solid var(--border-color)', padding: '0 1rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
              {revealed ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </div>

        {/* SDK Box */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <CodeIcon size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontWeight: 600 }}>Official SDKs</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Install our Node.js SDK for a typed, seamless integration experience.
          </p>
          <div style={{ position: 'relative' }}>
            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 'var(--radius-sm)', padding: '1rem', fontFamily: 'monospace', color: '#e6edf3', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Terminal size={16} color="#7ee787" />
              <span>npm install @rescueship/sdk</span>
            </div>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); showToast('Redirecting to SDK Documentation...'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.9rem', marginTop: '1rem', textDecoration: 'none', fontWeight: 500 }}>
            View SDK Documentation <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Interactive API Sandbox */}
      <motion.div layout style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Terminal size={20} color="var(--primary)" />
              <h3 style={{ margin: 0, fontWeight: 600 }}>API Sandbox</h3>
            </div>
            <TabPill tabs={codeTabs} activeTab={activeCodeTab} onChange={setActiveCodeTab} layoutId="code-tab-pill" />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={handleCopy}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {copied ? <CheckCircle size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
            <button 
              onClick={handleTest}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'black', border: 'none', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <Play size={14} fill="black" /> Test Request
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            <motion.pre
              key={activeCodeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ margin: 0, padding: '1.5rem', background: '#0d1117', color: '#e6edf3', fontSize: '0.9rem', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.5 }}
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
                <div style={{ borderTop: '1px solid #30363d', background: '#0a0d12', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '0.5rem', fontWeight: 600 }}>RESPONSE (200 OK)</div>
                  <pre style={{ margin: 0, color: '#a5d6ff', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                    {JSON.stringify({ success: true, message_id: "msg_9f8e7d6c", status: "queued" }, null, 2)}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Webhook Guide */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Book size={20} color="var(--primary)" />
          <h3 style={{ margin: 0, fontWeight: 600 }}>Webhook Setup Guide</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {['Shopify', 'WooCommerce', 'Custom API'].map(platform => (
            <div key={platform} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>{platform}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure real-time event syncing for {platform}.</p>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--primary-glow)', border: '1px solid var(--primary)', color: 'white', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 2000, boxShadow: 'var(--shadow-glow)', animation: 'fadeInUp 0.3s ease-out' }}>
          <CheckCircle size={20} color="var(--primary)" />
          <span style={{ fontWeight: 500 }}>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default DocsPage;
