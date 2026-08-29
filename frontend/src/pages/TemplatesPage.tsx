import { useState } from 'react';
import { CheckCircle, Clock, Edit2, Send, Smartphone, MessageSquare, X, Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface Template {
  id: string;
  name: string;
  category: 'COD-to-Prepaid' | 'NDR Address Fix' | 'Delivery Re-attempt' | 'Pre-RTO Offer';
  status: 'Approved' | 'In Review' | 'Draft';
  content: string;
}

const templates: Template[] = [
  {
    id: '1',
    name: 'cod_to_prepaid_discount',
    category: 'COD-to-Prepaid',
    status: 'Approved',
    content: 'Hi {{customer_name}}, your order {{order_id}} is confirmed as Cash on Delivery. Get ₹50 OFF if you pay online now! Click here: {{prepay_discount_link}}',
  },
  {
    id: '2',
    name: 'ndr_address_confirmation',
    category: 'NDR Address Fix',
    status: 'In Review',
    content: 'Hi {{customer_name}}, we could not deliver order {{order_id}} due to an incomplete address. Please update your address here to ensure delivery today: {{address_update_link}}',
  },
  {
    id: '3',
    name: 'delivery_reattempt_notice',
    category: 'Delivery Re-attempt',
    status: 'Approved',
    content: 'Hi {{customer_name}}, our executive tried to deliver order {{order_id}} but you were unavailable. We will re-attempt tomorrow. Let us know if you want to reschedule.',
  },
  {
    id: '4',
    name: 'pre_rto_final_offer',
    category: 'Pre-RTO Offer',
    status: 'Draft',
    content: 'Hi {{customer_name}}, your order {{order_id}} is about to be returned. Claim a special 10% discount and accept delivery today!',
  },
];

export default function TemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(templates[0]);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const getStatusBadge = (status: Template['status']) => {
    switch (status) {
      case 'Approved':
        return <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Approved</span>;
      case 'In Review':
        return <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> In Review</span>;
      case 'Draft':
        return <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Edit2 size={12} /> Draft</span>;
    }
  };

  const categories = Array.from(new Set(templates.map(t => t.category)));

  return (
    <div className="fade-in-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>WhatsApp Templates</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Manage and preview your Meta-approved WhatsApp messages.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> New Template
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Template Library</h2>
          </div>
          <div tabIndex={0} aria-label="Template categories list" style={{ height: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {categories.map(category => (
              <div key={category} style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>{category}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {templates.filter(t => t.category === category).map(template => (
                    <motion.div 
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      whileHover={{ scale: 1.02 }}
                      style={{
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: selectedTemplate.id === template.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        background: selectedTemplate.id === template.id ? 'var(--primary-glow)' : 'rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{template.name}</span>
                        {getStatusBadge(template.status)}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{template.content}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            <Smartphone size={20} color="var(--primary)" />
            Live Preview
          </h2>
          
          <div style={{ position: 'relative', margin: '0 auto', width: '280px', height: '580px', backgroundColor: '#111b21', borderRadius: '2.5rem', border: '4px solid #222e35', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#202c33', color: 'white', padding: '1.5rem 1rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 10 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={16} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Rescueship Updates</div>
                <div style={{ fontSize: '0.75rem', color: '#d4d4d8' }}>Business Account</div>
              </div>
            </div>
            
            <div style={{ flex: 1, backgroundColor: '#0b141a', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', zIndex: 0 }}>
              <div 
                key={selectedTemplate.id} 
                style={{ backgroundColor: '#202c33', borderRadius: '0.5rem', borderTopLeftRadius: 0, padding: '0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '90%', fontSize: '0.85rem', color: '#f8fafc', marginTop: '1rem' }}
              >
                {selectedTemplate.content.split(/(\{\{[^}]+\}\})/).map((part, i) => {
                  if (part.startsWith('{{') && part.endsWith('}}')) {
                    return <span key={i} style={{ color: '#38bdf8', fontWeight: '600', padding: '0 2px' }}>{part}</span>;
                  }
                  return <span key={i}>{part}</span>;
                })}
                <div style={{ fontSize: '0.65rem', color: '#cbd5e1', textAlign: 'right', marginTop: '0.25rem' }}>12:00 PM</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#202c33', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', zIndex: 10 }}>
              <div style={{ flex: 1, backgroundColor: '#2a3942', borderRadius: '9999px', height: '36px', display: 'flex', alignItems: 'center', padding: '0 1rem', fontSize: '0.8rem', color: '#d4d4d8' }}>Type a message...</div>
            </div>
          </div>

          <button 
            onClick={() => setShowTestModal(true)}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Send size={18} />
            Test Send WhatsApp
          </button>
        </div>
      </div>

      {showTestModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Send Test Message</h3>
              <button onClick={() => setShowTestModal(false)} aria-label="Close test modal" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="test-phone-input">Phone Number</label>
                <input 
                  id="test-phone-input"
                  type="text" 
                  placeholder="+91 9999999999" 
                  className="form-control"
                  aria-label="Phone Number"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Selected Template:</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>{selectedTemplate.name}</span>
              </div>
            </div>
            <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowTestModal(false)} className="btn btn-secondary">Cancel</button>
              <button 
                onClick={() => { showToast('Test sent successfully!'); setShowTestModal(false); }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Send size={16} />
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Create New Template</h3>
              <button onClick={() => setShowCreateModal(false)} aria-label="Close create template modal" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="template-name-input">Template Name</label>
                <input id="template-name-input" aria-label="Template Name" type="text" className="form-control" placeholder="e.g. abandoned_cart_01" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="template-category-select">Category</label>
                <select id="template-category-select" aria-label="Category" className="form-control">
                  <option>COD-to-Prepaid</option>
                  <option>NDR Address Fix</option>
                  <option>Delivery Re-attempt</option>
                  <option>Pre-RTO Offer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="template-content-area">Message Content</label>
                <textarea id="template-content-area" aria-label="Message Content" className="form-control" rows={4} placeholder="Hi {{name}}, your order..."></textarea>
              </div>
            </div>
            <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => { showToast('Template created and sent for review!'); setShowCreateModal(false); }} className="btn btn-primary">Create Template</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--success-glow)', border: '1px solid var(--success)', color: 'var(--success)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 2000, boxShadow: 'var(--shadow-glow)', animation: 'fadeInUp 0.3s ease-out' }}>
          <CheckCircle size={20} />
          <span style={{ fontWeight: 500 }}>{toast}</span>
        </div>
      )}
    </div>
  );
}
