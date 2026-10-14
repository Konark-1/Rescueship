import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';

export interface WhatsAppTemplateItem {
  id: string;
  name: string;
  category: string;
  metaStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  isLive: boolean;
  body?: string;
}

interface ToggleProps {
  id?: string;
  label?: string;
  'aria-label'?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ id, label, 'aria-label': ariaLabel, checked, onChange, disabled }) => {
  const accessibleName = ariaLabel || label || 'Toggle automation live status';
  return (
    <label
      htmlFor={id}
      className={`toggle-control ${disabled ? 'toggle-control--disabled opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      title={disabled ? 'Template must be approved by Meta before going live' : undefined}
    >
      {label && <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{label}</span>}
      <div style={{ position: 'relative', width: 38, height: 20, flexShrink: 0 }}>
        <input
          id={id}
          type="checkbox"
          aria-label={accessibleName}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
        />
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: checked ? 'var(--emerald, #10b981)' : 'var(--border, #4b5563)',
            borderRadius: 20,
            transition: 'background-color 0.2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              height: 14,
              width: 14,
              left: checked ? 20 : 3,
              bottom: 3,
              backgroundColor: '#fff',
              borderRadius: '50%',
              transition: 'left 0.2s',
            }}
          />
        </span>
      </div>
    </label>
  );
};

export interface WhatsAppTemplatesProps {
  templates?: WhatsAppTemplateItem[];
  onToggleLive?: (id: string, isLive: boolean) => void;
}

/**
 * Shows the merchant's real WhatsApp templates and their Meta review status
 * (from /api/connect/state). No sample templates: an empty list says so.
 */
export const WhatsAppTemplates: React.FC<WhatsAppTemplatesProps> = ({ templates: provided }) => {
  const [items, setItems] = useState<WhatsAppTemplateItem[] | null>(provided && provided.length ? provided : null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (provided && provided.length) return;
    let cancelled = false;
    api.get('/api/connect/state')
      .then((r) => {
        if (cancelled) return;
        const list: any[] = Array.isArray(r.data?.templates) ? r.data.templates : [];
        setItems(list.map((t) => ({
          id: t.name,
          name: t.name,
          category: t.category || 'UTILITY',
          metaStatus: t.status === 'APPROVED' ? 'APPROVED' : t.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
          isLive: t.status === 'APPROVED',
        })));
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [provided]);

  const renderStatusBadge = (metaStatus: WhatsAppTemplateItem['metaStatus']) => {
    switch (metaStatus) {
      case 'APPROVED':
        return <span className="badge badge-success"><CheckCircle size={12} /> Approved by Meta</span>;
      case 'PENDING':
        return <span className="badge badge-warning"><Clock size={12} /> In Meta review</span>;
      case 'REJECTED':
        return <span className="badge badge-danger"><XCircle size={12} /> Rejected by Meta</span>;
      default:
        return null;
    }
  };

  return (
    <div className="whatsapp-templates-container" style={{ width: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--text-1)' }}>
          WhatsApp message templates
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: 0 }}>
          Meta must approve each message before RescueShip can send it to buyers. Approved messages are used automatically.
        </p>
      </div>

      {error && <p style={{ color: 'var(--rose)', fontSize: '0.85rem' }}>Could not load your templates. Refresh to try again.</p>}
      {!error && items === null && <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Loading templates…</p>}
      {!error && items !== null && items.length === 0 && (
        <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
          No templates submitted yet. They are submitted to Meta when you connect your WhatsApp number in setup.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(items || []).map((template) => (
          <div
            key={template.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>{template.name}</span>
              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--white-08)', color: 'var(--text-2)' }}>
                {template.category}
              </span>
              {renderStatusBadge(template.metaStatus)}
            </div>
            {template.body && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontStyle: 'italic' }}>"{template.body}"</div>
            )}
            {template.metaStatus === 'REJECTED' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--rose)' }}>
                <AlertTriangle size={12} />
                <span>Meta rejected this message. Resubmit it from the WhatsApp step in setup.</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
