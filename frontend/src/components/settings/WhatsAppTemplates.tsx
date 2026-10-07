import React, { useState } from 'react';
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

const DEFAULT_TEMPLATES: WhatsAppTemplateItem[] = [
  {
    id: 'rs_ndr_rescue_v1',
    name: 'rs_ndr_rescue_v1',
    category: 'UTILITY',
    metaStatus: 'APPROVED',
    isLive: true,
    body: 'Hi {{1}}, delivery attempt for your order #{{2}} failed: {{3}}. Confirm address or reschedule delivery: {{4}}',
  },
  {
    id: 'rs_cod_convert_v1',
    name: 'rs_cod_convert_v1',
    category: 'MARKETING',
    metaStatus: 'PENDING',
    isLive: false,
    body: 'Convert your COD order #{{1}} to prepaid via UPI and get 5% instant cashback: {{2}}',
  },
  {
    id: 'rs_rto_alert_v1',
    name: 'rs_rto_alert_v1',
    category: 'UTILITY',
    metaStatus: 'REJECTED',
    isLive: false,
    body: 'Urgent: Package returning to origin. Pay via UPI immediately to prevent return.',
  },
];

export const WhatsAppTemplates: React.FC<WhatsAppTemplatesProps> = ({
  templates: initialTemplates,
  onToggleLive,
}) => {
  const [items, setItems] = useState<WhatsAppTemplateItem[]>(
    initialTemplates && initialTemplates.length > 0 ? initialTemplates : DEFAULT_TEMPLATES
  );

  const handleToggle = (id: string, newChecked: boolean) => {
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isLive: newChecked } : t))
    );
    if (onToggleLive) {
      onToggleLive(id, newChecked);
    }
  };

  const renderStatusBadge = (metaStatus: WhatsAppTemplateItem['metaStatus']) => {
    switch (metaStatus) {
      case 'APPROVED':
        return (
          <span className="badge badge-success">
            <CheckCircle size={12} /> Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="badge badge-warning">
            <Clock size={12} /> ⏳ Pending Meta Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge badge-danger">
            <XCircle size={12} /> Rejected by Meta
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="whatsapp-templates-container" style={{ width: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--text-1)' }}>
          Meta WABA Templates & Live Automation Guard
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: 0 }}>
          Templates must be reviewed and approved by Meta before they can be activated live.
          Enforcing approval prevents Meta Cloud API <code style={{ fontSize: '0.75rem' }}>132000</code> rejection crashes.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((template) => {
          const isApproved = template.metaStatus === 'APPROVED';
          return (
            <div
              key={template.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
                    {template.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-2)',
                    }}
                  >
                    {template.category}
                  </span>
                  {renderStatusBadge(template.metaStatus)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: isApproved ? 'var(--text-1)' : 'var(--text-3)' }}>
                      Go Live:
                    </span>
                    <Toggle
                      id={`toggle-live-${template.id}`}
                      label="Go Live"
                      aria-label={`Go live with template ${template.name}`}
                      checked={template.isLive}
                      disabled={template.metaStatus !== 'APPROVED'}
                      onChange={(checked) => handleToggle(template.id, checked)}
                    />
                  </div>
                </div>
              </div>

              {template.body && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontStyle: 'italic' }}>
                  "{template.body}"
                </div>
              )}

              {template.metaStatus !== 'APPROVED' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    color: template.metaStatus === 'PENDING' ? 'var(--amber, #f59e0b)' : 'var(--crimson, #f87171)',
                    background:
                      template.metaStatus === 'PENDING'
                        ? 'var(--amber-06, rgba(245, 158, 11, 0.08))'
                        : 'var(--crimson-06, rgba(239, 68, 68, 0.08))',
                    border:
                      template.metaStatus === 'PENDING'
                        ? '1px solid var(--amber-15, rgba(245, 158, 11, 0.15))'
                        : '1px solid var(--crimson-15, rgba(239, 68, 68, 0.15))',
                    padding: '6px 10px',
                    borderRadius: '4px',
                  }}
                >
                  <AlertTriangle size={12} />
                  <span>
                    {template.metaStatus === 'PENDING'
                      ? 'Go Live toggle is disabled while Meta processes template review (typically 1-6 hours).'
                      : 'Template was rejected by Meta. Fix guidelines violation and resubmit before going live.'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
