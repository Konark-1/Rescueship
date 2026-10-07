import { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, KeyRound } from 'lucide-react';
import { Field } from './Field';

interface WhatsAppStationProps {
  onConnect: () => void;
  onManualConnect: (phoneId: string, wabaId: string, accessToken: string) => void;
  onPulse: (phone: string, storeName: string) => void;
  onResubmitTemplates: () => void;
  busy: any;
  status: string;
  templates: any[];
  ownerPhone?: string;
  metaReady: boolean;
  onNext: () => void;
  connectionDetails?: {
    phoneNumberId?: string;
    wabaId?: string;
  };
}

export function WhatsAppStation({
  onConnect,
  onManualConnect,
  onPulse,
  onResubmitTemplates,
  busy,
  status,
  templates,
  ownerPhone,
  metaReady,
  onNext,
  connectionDetails,
}: WhatsAppStationProps) {
  const [phone, setPhone] = useState(ownerPhone || '');
  const [name, setName] = useState('');
  const [manual, setManual] = useState(!metaReady);
  const [phoneId, setPhoneId] = useState(connectionDetails?.phoneNumberId || '');
  const [wabaId, setWabaId] = useState(connectionDetails?.wabaId || '');
  const [accessToken, setAccessToken] = useState('');
  const [editingCreds, setEditingCreds] = useState(false);

  useEffect(() => {
    if (connectionDetails?.phoneNumberId && !phoneId) setPhoneId(connectionDetails.phoneNumberId);
    if (connectionDetails?.wabaId && !wabaId) setWabaId(connectionDetails.wabaId);
  }, [connectionDetails]);

  const hasConnection =
    status === 'connected' ||
    status === 'templates_pending' ||
    status === 'templates_rejected' ||
    status === 'token_expired';
  const connected = hasConnection && !editingCreds;
  const oneClickReady = metaReady;
  const manualValid =
    /^\d{6,32}$/.test(phoneId.trim()) &&
    /^\d{6,32}$/.test(wabaId.trim()) &&
    accessToken.trim().length > 0;

  return (
    <div className="ob-form">
      {!connected ? (
        <>
          {editingCreds && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Update WhatsApp Credentials
              </span>
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => setEditingCreds(false)}
              >
                Cancel
              </button>
            </div>
          )}

          {!editingCreds && (
            <div className="ob-seg">
              {oneClickReady && (
                <button
                  type="button"
                  className={!manual ? 'on' : ''}
                  onClick={() => setManual(false)}
                >
                  One-click
                </button>
              )}
              <button
                type="button"
                className={manual ? 'on' : ''}
                onClick={() => setManual(true)}
              >
                Manual (your keys)
              </button>
            </div>
          )}

          {!manual && oneClickReady && !editingCreds ? (
            <>
              <p className="ob-note">
                Opens Meta's signup in a popup. Log into <strong>your</strong> Business account, pick
                the WhatsApp number customers will message, and grant access. We receive a permanent
                token — you never share a password.
              </p>
              <button
                className="ob-btn"
                disabled={busy === 'whatsapp'}
                onClick={onConnect}
              >
                {busy === 'whatsapp' ? 'Connecting…' : 'Connect WhatsApp number'}
              </button>
            </>
          ) : (
            <form
              className="ob-form"
              onSubmit={(e) => {
                e.preventDefault();
                onManualConnect(phoneId.trim(), wabaId.trim(), accessToken.trim());
                setEditingCreds(false);
              }}
            >
              <Field label="Phone number ID">
                <input
                  className="ob-input"
                  placeholder="123456789012345"
                  autoComplete="off"
                  spellCheck={false}
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  required
                />
              </Field>
              <Field label="WABA ID (WhatsApp Business Account)">
                <input
                  className="ob-input"
                  placeholder="987654321098765"
                  autoComplete="off"
                  spellCheck={false}
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  required
                />
              </Field>
              <Field label="Access token">
                <input
                  className="ob-input"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="EAAG… (paste fresh temporary token or permanent System User token)"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                />
              </Field>
              <div className="ob-steps">
                <p className="ob-steps__title">How to get a fresh or permanent token:</p>
                <ol className="ob-steps__list">
                  <li>
                    <strong>Fastest (Meta App Dashboard):</strong> Open{' '}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Meta App Dashboard
                    </a>{' '}
                    → click your App → <strong>WhatsApp → API Setup</strong>. Copy your{' '}
                    <strong>Access token</strong> (valid 24h for testing).
                  </li>
                  <li>
                    <strong>Permanent Token (Never Expires):</strong> Open{' '}
                    <a
                      href="https://business.facebook.com/settings/system-users"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Business Settings → System Users
                    </a>{' '}
                    → Create System User → Assign WhatsApp asset → Generate Token with{' '}
                    <code>whatsapp_business_messaging</code>.
                  </li>
                </ol>
              </div>
              <button
                className="ob-btn"
                disabled={busy === 'whatsapp' || !manualValid}
              >
                {busy === 'whatsapp'
                  ? 'Validating…'
                  : editingCreds
                  ? 'Update & Reconnect'
                  : 'Validate & connect'}
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="ob-wa-status" aria-live="polite">
            <span
              className={`ob-pill ${
                status === 'connected'
                  ? 'ok'
                  : status === 'templates_rejected' || status === 'token_expired'
                  ? 'bad'
                  : 'wait'
              }`}
            >
              {status === 'connected'
                ? '● live'
                : status === 'token_expired'
                ? '● token expired'
                : status === 'templates_rejected'
                ? '● action needed'
                : '◌ templates pending'}
            </span>
            {templates?.length > 0 && (
              <ul className="ob-tpl">
                {templates.map((t: any) => {
                  const friendlyNames: Record<string, string> = {
                    ndr_reschedule_en: 'Delivery reschedule verification',
                    ndr_address_en: 'Address & GPS location request',
                    ndr_cod_convert_en: 'Doorstep UPI conversion',
                    ndr_retention_en: 'Cancellation & RTO retention',
                    ndr_rescue_en: 'Delivery verification message',
                    cod_confirm_en: 'COD confirmation message',
                    cod_convert_en: 'Prepaid conversion offer',
                    address_pin_en: 'Address location request',
                    rescue_done_en: 'Delivery confirmed update',
                    rs_test_pulse_en: 'Test recovery message',
                    ndr_rescue_v2_en: 'Delivery verification message',
                    cod_confirm_v2_en: 'COD confirmation message',
                    cod_convert_v2_en: 'Prepaid conversion offer',
                    address_pin_v2_en: 'Address location request',
                    rescue_done_v2_en: 'Delivery confirmed update',
                    rs_test_pulse_v2_en: 'Test recovery message',
                  };
                  const label = friendlyNames[t.name] || t.name;
                  return (
                    <li key={t.name}>
                      <span style={{ fontWeight: 500 }}>{label}</span>
                      <span
                        className={`ob-tpl__s ${
                          t.status === 'APPROVED' ? 'ok' : t.status === 'REJECTED' ? 'bad' : 'wait'
                        }`}
                      >
                        {t.status === 'APPROVED' ? 'Ready' : t.status === 'REJECTED' ? 'Needs sync' : 'Pending'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {status === 'token_expired' && (
            <div className="ob-alert--error">
              <h4>Meta Access Token Expired</h4>
              <p>
                Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App
                Dashboard or use a permanent System User token to resume.
              </p>
              <button
                type="button"
                className="ob-btn"
                onClick={() => setEditingCreds(true)}
              >
                <KeyRound size={14} aria-hidden="true" /> Update Access Token
              </button>
            </div>
          )}

          {status === 'templates_rejected' && (
            <div className="ob-alert--warn">
              <h4>Templates Ready to Sync</h4>
              <p>
                Click below to sync recovery messages with Meta. If your token expired, click Update
                Token.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ob-btn ob-btn--primary"
                  disabled={busy === 'resubmit_templates'}
                  onClick={onResubmitTemplates}
                >
                  {busy === 'resubmit_templates' ? (
                    'Syncing…'
                  ) : (
                    <>
                      <RefreshCw size={14} aria-hidden="true" /> Resubmit Templates
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="ob-btn ob-btn--warn"
                  onClick={() => setEditingCreds(true)}
                >
                  <KeyRound size={14} aria-hidden="true" /> Update Access Token
                </button>
              </div>
            </div>
          )}

          {status === 'templates_pending' && (
            <div className="ob-alert--note">
              <h4>Meta Template Review in Progress</h4>
              <p>
                Your WhatsApp credentials are verified. Meta is reviewing your 6 message templates
                (usually takes 5–30 minutes). You can continue to Courier &amp; Payments setup now —
                your templates will activate automatically once approved.
              </p>
            </div>
          )}

          <div className="ob-pulse">
            <Field label="Your mobile (for the test message)">
              <input
                className="ob-input"
                placeholder="+91 9XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="Store name (optional)">
              <input
                className="ob-input"
                placeholder="Mamaearth"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button
                className="ob-btn ob-btn--ghost"
                disabled={!phone || busy === 'pulse'}
                onClick={() => onPulse(phone, name)}
              >
                {busy === 'pulse' ? (
                  'Sending…'
                ) : (
                  <>
                    <Smartphone size={14} aria-hidden="true" /> Send me a test rescue
                  </>
                )}
              </button>
              <button className="ob-btn" type="button" onClick={onNext}>
                Continue to Courier setup →
              </button>
            </div>
            {!phone ? (
              <p className="ob-note" style={{ color: 'var(--text-3)' }}>
                Enter your mobile number above to enable the test rescue button.
              </p>
            ) : (
              <p className="ob-note">
                Fires a real message to your number — the proof that recovery works, before any
                customer order depends on it.
              </p>
            )}
          </div>

          <div
            style={{
              marginTop: '14px',
              borderTop: '1px dashed var(--border)',
              paddingTop: '10px',
            }}
          >
            <button
              type="button"
              className="ob-btn ob-btn--ghost"
              style={{ fontSize: '0.78rem', padding: '6px 12px', color: 'var(--text-2)' }}
              onClick={() => setEditingCreds(true)}
            >
              <RefreshCw size={14} aria-hidden="true" /> Reconnect or update WhatsApp credentials
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default WhatsAppStation;
