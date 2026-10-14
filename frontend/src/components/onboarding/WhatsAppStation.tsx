import { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, KeyRound, CheckCircle2, AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import { Field } from './Field';
import { TestRescuePanel, type TestRescueStatus, type VerificationInfo } from './TestRescuePanel';

const FRIENDLY_NAMES: Record<string, string> = {
  ndr_rescue_en: 'Delivery verification & rescue',
  ndr_rescue_v2_en: 'Delivery verification & rescue',
  ndr_reschedule_en: 'Delivery reschedule picker',
  ndr_address_en: 'GPS location & address request',
  ndr_cod_convert_en: 'Doorstep UPI conversion offer',
  ndr_retention_en: 'Cancellation & return retention',
  cod_confirm_en: 'Instant COD order confirmation',
  cod_confirm_v2_en: 'Instant COD order confirmation',
  cod_convert_en: 'Prepaid conversion offer',
  cod_convert_v2_en: 'Prepaid conversion offer',
  predelivery_confirm_v2_en: 'Pre-delivery order confirmation',
  cod_reminder_v2_en: 'Out-for-delivery COD alert',
  address_pin_en: 'Interactive map pin request',
  address_pin_v2_en: 'Interactive map pin request',
  rescue_done_en: 'Delivery confirmed receipt',
  rescue_done_v2_en: 'Delivery confirmed receipt',
  rs_test_pulse_en: 'System test pulse message',
  rs_test_pulse_v2_en: 'System test pulse message',
};

function formatTemplateName(rawName: string): string {
  if (FRIENDLY_NAMES[rawName]) return FRIENDLY_NAMES[rawName];
  const clean = rawName
    .replace(/_v\d+/g, '')
    .replace(/_en$/g, '')
    .replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

interface WhatsAppStationProps {
  onConnect: () => void;
  onManualConnect: (phoneId: string, wabaId: string, accessToken: string, appSecret?: string) => void;
  onPulse: () => void;
  onStartVerify: (phone: string, storeName: string) => Promise<VerificationInfo | null>;
  onRefresh: () => Promise<unknown>;
  ownerPhoneVerified?: boolean;
  pendingOwnerPhone?: string | null;
  testRescues?: TestRescueStatus | null;
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
  onStartVerify,
  onRefresh,
  ownerPhoneVerified,
  pendingOwnerPhone,
  testRescues,
}: WhatsAppStationProps) {
  const [manual, setManual] = useState(!metaReady);
  const [phoneId, setPhoneId] = useState(connectionDetails?.phoneNumberId || '');
  const [wabaId, setWabaId] = useState(connectionDetails?.wabaId || '');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [editingCreds, setEditingCreds] = useState(false);

  useEffect(() => {
    if (connectionDetails?.phoneNumberId) setPhoneId((prev) => prev || connectionDetails.phoneNumberId || '');
    if (connectionDetails?.wabaId) setWabaId((prev) => prev || connectionDetails.wabaId || '');
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

  if (connected) {
    return (
      <div className="ob-wa-workspace">
        <div className="ob-wa-status-bar" aria-live="polite">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2-5)' }}>
            <Smartphone size={18} style={{ color: 'var(--emerald)' }} aria-hidden="true" />
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                Official WhatsApp Business Account
              </span>
              {connectionDetails?.phoneNumberId && (
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  Phone Number ID: {connectionDetails.phoneNumberId}
                </span>
              )}
            </div>
          </div>
          <span
            className={`ob-pill ${
              status === 'connected'
                ? 'ok'
                : status === 'templates_rejected' || status === 'token_expired'
                ? 'bad'
                : 'wait'
            }`}
          >
            {status === 'connected' ? (
              <>
                <CheckCircle2 size={13} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }} aria-hidden="true" />
                Connected &amp; Verified
              </>
            ) : status === 'token_expired' ? (
              <>
                <AlertTriangle size={13} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }} aria-hidden="true" />
                Token Expired
              </>
            ) : status === 'templates_rejected' ? (
              'Action Required'
            ) : (
              <>
                <Clock size={13} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }} aria-hidden="true" />
                Templates In Review
              </>
            )}
          </span>
        </div>

        {status === 'token_expired' && (
          <div className="ob-alert--error">
            <h4>Meta Access Token Expired</h4>
            <p>
              Temporary test tokens expire after 24 hours. Paste a fresh token from your Meta App
              Dashboard or use a permanent System User token to resume autonomous order recovery.
            </p>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                className="ob-btn"
                onClick={() => setEditingCreds(true)}
              >
                <KeyRound size={14} aria-hidden="true" /> Update Access Token
              </button>
            </div>
          </div>
        )}

        {status === 'templates_rejected' && (
          <div className="ob-alert--warn">
            <h4>Templates Ready to Sync</h4>
            <p>
              Click below to sync recovery messages with Meta. If your token expired, click Update
              Token.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
              <button
                type="button"
                className="ob-btn"
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
                className="ob-btn ob-btn--ghost"
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
              Your WhatsApp credentials are verified. Meta is reviewing your message templates
              (usually takes 5 to 30 minutes). You can continue to Courier and Payments setup now:
              your templates will activate automatically once approved.
            </p>
          </div>
        )}

        {templates?.length > 0 && (
          <div className="ob-tpl-section">
            <p className="ob-tpl-section__title">
              <MessageSquare size={16} aria-hidden="true" />
              Autonomous Recovery Message Templates ({templates.length})
            </p>
            <ul className="ob-tpl-grid">
              {templates.map((t: any) => {
                const label = formatTemplateName(t.name);
                const isOk = t.status === 'APPROVED';
                const isBad = t.status === 'REJECTED';
                return (
                  <li key={t.name} className="ob-tpl-card">
                    <div className="ob-tpl-card__left">
                      <CheckCircle2
                        size={15}
                        style={{
                          color: isOk ? 'var(--emerald)' : isBad ? 'var(--rose)' : 'var(--amber)',
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                      <span className="ob-tpl-card__name" title={t.name}>{label}</span>
                    </div>
                    <span
                      className={`ob-tpl-card__status ${isOk ? 'ok' : isBad ? 'bad' : 'wait'}`}
                    >
                      {isOk ? 'Approved' : isBad ? 'Needs sync' : 'In review'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <TestRescuePanel
          ownerPhone={ownerPhone}
          ownerPhoneVerified={ownerPhoneVerified}
          pendingOwnerPhone={pendingOwnerPhone}
          status={testRescues}
          busy={busy === 'pulse'}
          onStartVerify={onStartVerify}
          onSend={onPulse}
          onRefresh={onRefresh}
        />

        <div className="ob-test__next">
          <button className="ob-btn ob-btn--ghost" type="button" onClick={onNext}>
            Continue to courier setup
          </button>
        </div>

        <div
          style={{
            marginTop: 'var(--space-2)',
            borderTop: '1px dashed var(--border-color)',
            paddingTop: 'var(--space-3)',
          }}
        >
          <button
            type="button"
            className="ob-btn ob-btn--ghost"
            style={{ fontSize: '0.78rem', padding: '6px 12px', color: 'var(--text-3)' }}
            onClick={() => setEditingCreds(true)}
          >
            <RefreshCw size={13} aria-hidden="true" /> Reconnect or update WhatsApp credentials
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-form">
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
            token: you never share a password.
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
            onManualConnect(phoneId.trim(), wabaId.trim(), accessToken.trim(), appSecret.trim() || undefined);
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
              placeholder="EAAG… permanent System User token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
            />
          </Field>
          <Field label="App secret (only if you use your own Meta app)">
            <input
              className="ob-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="From your app → App settings → Basic"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
            />
          </Field>
          <div className="ob-steps">
            <p className="ob-steps__title">How to get a permanent token:</p>
            <ol className="ob-steps__list">
              <li>
                <strong>Permanent Token (Never Expires):</strong> Open{' '}
                <a
                  href="https://business.facebook.com/settings/system-users"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Business Settings → System Users
                </a>{' '}
                → Create System User → Assign WhatsApp asset → Generate Token (expiry: never) with{' '}
                <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.
              </li>
              <li>
                Temporary tokens from the API Setup page expire in 24 hours and are not accepted.
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
    </div>
  );
}

export default WhatsAppStation;
