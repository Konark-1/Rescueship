import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, Edit2, Send, Smartphone, MessageSquare, Plus, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';
import { Toggle } from '../components/settings/WhatsAppTemplates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

interface TemplateComponent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface Template {
  _id: string;
  templateName: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
  buttons: unknown[];
}

const extractBody = (t: Template): string => {
  const body = t.components?.find(c => c.type === 'BODY');
  return body?.text || '(no body text set)';
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newLanguage, setNewLanguage] = useState('en');
  const [newCategory, setNewCategory] = useState('UTILITY');
  const [newBody, setNewBody] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleFireTestRescue = async () => {
    if (!selectedTemplate) return;
    setSendingTest(true);
    try {
      const res = await api.post('/api/templates/test-send', {
        templateName: selectedTemplate.templateName,
        phone: testPhone,
      });
      showToast(res.data?.message || `✓ Test rescue sent for ${selectedTemplate.templateName}`);
      setShowTestModal(false);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to dispatch test message');
    } finally {
      setSendingTest(false);
    }
  };

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/templates');
      const list: Template[] = res.data || [];
      setTemplates(list);
      setSelectedTemplate(prev => {
        if (prev) {
          const stillThere = list.find(t => t._id === prev._id);
          if (stillThere) return stillThere;
        }
        return list[0] ?? null;
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to load templates.');
      } else {
        setError('Failed to load templates.');
      }
      setTemplates([]);
      setSelectedTemplate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async () => {
    const finalName = (newName.trim() || 'order_update_template').toLowerCase().replace(/\s+/g, '_');
    const finalBody = newBody.trim() || 'Hi {{customer_name}}, your order {{order_id}} could not be delivered. Please confirm your delivery address.';
    try {
      setSaving(true);
      await api.post('/api/templates', {
        templateName: finalName,
        language: newLanguage,
        category: newCategory,
        components: [{ type: 'BODY', text: finalBody }],
        buttons: [],
      });
      showToast('Template submitted and sent for review.');
      setShowCreateModal(false);
      setNewName('');
      setNewBody('');
      await fetchTemplates();
    } catch (err) {
      showToast(axios.isAxiosError(err) ? (err.response?.data?.error || 'Failed to create template.') : 'Failed to create template.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <span className="badge badge-success"><CheckCircle size={11} /> Approved</span>;
      case 'pending':
        return <span className="badge badge-warning" style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', border: '1px solid rgba(234, 179, 8, 0.3)' }}><Clock size={11} /> ⏳ Pending Meta Review</span>;
      case 'rejected':
        return <span className="badge badge-danger"><XCircle size={11} /> Rejected</span>;
      default:
        return <span className="badge badge-secondary"><Edit2 size={11} /> Draft</span>;
    }
  };

  const categories = Array.from(new Set(templates.map(t => t.category)));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-head__title">WhatsApp Templates</h1>
          <p className="page-head__sub">Meta-approved message templates used for automated delivery recovery.</p>
        </div>
        <div className="page-head__actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" onClick={fetchTemplates} disabled={loading} aria-label="Refresh templates">
            <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} /> New template
          </button>
        </div>
      </header>

      <div className="tpl-grid">
        {/* Template library */}
        <div className="panel">
          <div className="panel__head">
            <span className="panel__title"><MessageSquare size={12} aria-hidden="true" /> Template library</span>
            <span className="panel__aside">{templates.length} registered</span>
          </div>
          <div tabIndex={0} aria-label="Template categories list" style={{ maxHeight: 640, overflowY: 'auto' }}>
            {loading && (
              <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                <p className="empty__title">Loading templates…</p>
              </div>
            )}
            {!loading && error && (
              <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                <p className="empty__title">Could not load templates</p>
                <p className="empty__sub">{error}</p>
              </div>
            )}
            {!loading && !error && templates.length === 0 && (
              <div className="empty" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                <p className="empty__title">No templates yet</p>
                <p className="empty__sub">Templates are provisioned automatically when WhatsApp is connected, or create one above.</p>
              </div>
            )}
            {!loading && !error && categories.map(category => (
              <div key={category}>
                <p className="tpl-category">{category}</p>
                {templates.filter(t => t.category === category).map(template => (
                  <button
                    key={template._id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`tpl-row ${selectedTemplate?._id === template._id ? 'is-selected' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1-5)' }}>
                      <span className="mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>{template.templateName}</span>
                      {getStatusBadge(template.status)}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{extractBody(template)}</p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="panel" style={{ position: 'sticky', top: 90, alignSelf: 'start' }}>
          <div className="panel__head">
            <span className="panel__title"><Smartphone size={12} aria-hidden="true" /> Live preview</span>
            <span className="panel__aside mono">{selectedTemplate?.templateName ?? '—'}</span>
          </div>
          <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {selectedTemplate ? (
              <>
                <div className="wa-preview">
                  <div className="wa-preview__head">
                    <div className="wa-preview__avatar"><MessageSquare size={14} color="#fff" /></div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#fff' }}>RescueShip Updates</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--emerald)' }}>● business account</div>
                    </div>
                  </div>

                  <div className="wa-preview__body">
                    <div key={selectedTemplate._id} className="wa-preview__bubble fade-in-up">
                      {extractBody(selectedTemplate).split(/(\{\{[^}]+\}\})/).map((part, i) => {
                        if (part.startsWith('{{') && part.endsWith('}}')) {
                          return <span key={i} className="wa-preview__var">{part}</span>;
                        }
                        return <span key={i}>{part}</span>;
                      })}
                      <div className="wa-preview__time">12:00 ✓✓</div>
                    </div>
                  </div>

                  <div className="wa-preview__input">Type a message…</div>
                </div>

                <div style={{ marginTop: 'var(--space-4)', width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--white-02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Automation "Go Live" Status</span>
                    <Toggle
                      id={`live-toggle-${selectedTemplate._id}`}
                      label="Automation Go Live Status"
                      aria-label={`Automation Go Live Status for ${selectedTemplate.templateName}`}
                      checked={selectedTemplate.status?.toLowerCase() === 'approved'}
                      disabled={selectedTemplate.status?.toLowerCase() !== 'approved'}
                      onChange={() => {}}
                    />
                  </div>
                  {selectedTemplate.status?.toLowerCase() !== 'approved' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--amber, #f59e0b)' }}>
                      <AlertTriangle size={12} />
                      <span>{selectedTemplate.status?.toLowerCase() === 'pending' ? '⏳ Pending Meta Review — Go Live is locked until Meta approves.' : 'Template must be approved by Meta before going live.'}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowTestModal(true)}
                  className="btn btn-primary"
                  style={{ marginTop: 'var(--space-5)', alignSelf: 'stretch' }}
                >
                  <Send size={14} /> Fire test rescue
                </button>
              </>
            ) : (
              <div className="empty" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                <p className="empty__title">Nothing to preview</p>
                <p className="empty__sub">Select a template from the library.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accessible Radix Test send dialog */}
      <Dialog open={showTestModal && !!selectedTemplate} onOpenChange={(open) => !open && setShowTestModal(false)}>
        {selectedTemplate && (
          <DialogContent style={{ maxWidth: 440 }} showCloseX={false}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
                fire test rescue
              </DialogTitle>
              <DialogDescription>
                Send an immediate test rescue using this template.
              </DialogDescription>
            </DialogHeader>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 0 }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-2)' }}>
                Test the customer experience for this template. Dispatches directly to your phone if WhatsApp is connected, or verifies a simulation in your audit log.
              </p>
              <dl className="dl">
                <div><dt>Template</dt><dd className="mono" style={{ fontSize: '0.78rem' }}>{selectedTemplate.templateName}</dd></div>
                <div><dt>Status</dt><dd>{getStatusBadge(selectedTemplate.status)}</dd></div>
              </dl>
              <div className="form-group">
                <label className="form-label" htmlFor="test-phone-input">Recipient Mobile Number</label>
                <input
                  id="test-phone-input"
                  type="text"
                  placeholder="+91 98765 43210"
                  className="form-control"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>
            <div className="modal__foot" style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowTestModal(false)} className="btn btn-ghost" disabled={sendingTest}>Close</button>
              <button
                onClick={handleFireTestRescue}
                disabled={sendingTest}
                className="btn btn-primary"
              >
                <Send size={14} /> {sendingTest ? 'Sending…' : 'Send test rescue'}
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Accessible Radix Create template dialog */}
      <Dialog open={showCreateModal} onOpenChange={(open) => !open && setShowCreateModal(false)}>
        <DialogContent style={{ maxWidth: 520 }} showCloseX={false}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
              Create Template / new template
            </DialogTitle>
            <DialogDescription>
              Submit a new WhatsApp message template to Meta for review and approval.
            </DialogDescription>
          </DialogHeader>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 0 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="template-name-input">Template name</label>
              <input
                id="template-name-input"
                type="text"
                className="form-control"
                placeholder="e.g. abandoned_cart_01"
                style={{ fontFamily: 'var(--font-mono)' }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="template-language-select">Language</label>
              <select id="template-language-select" className="form-control" value={newLanguage} onChange={e => setNewLanguage(e.target.value)}>
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="template-category-select">Meta category</label>
              <select id="template-category-select" className="form-control" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                <option value="UTILITY">UTILITY</option>
                <option value="MARKETING">MARKETING</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="template-content-area">Message body</label>
              <textarea
                id="template-content-area"
                className="form-control"
                rows={4}
                placeholder="Hi {{customer_name}}, your order {{order_id}}…"
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
              />
            </div>
          </div>
          <div className="modal__foot" style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : 'Create template'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="toast-notification" role="status">
          <CheckCircle size={18} color="var(--emerald)" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
