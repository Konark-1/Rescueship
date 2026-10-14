import { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, Smartphone } from 'lucide-react';
import { Field } from './Field';

export interface TestRescueStatus {
  paying: boolean;
  enabled: boolean;
  limit: number;
  used: number;
  remaining: number;
}

export interface VerificationInfo {
  code: string;
  sendTo: string | null;
  waLink: string | null;
}

interface Props {
  ownerPhone?: string | null;
  ownerPhoneVerified?: boolean;
  pendingOwnerPhone?: string | null;
  status?: TestRescueStatus | null;
  busy: boolean;
  onStartVerify: (phone: string, storeName: string) => Promise<VerificationInfo | null>;
  onSend: () => void;
  onRefresh: () => Promise<unknown>;
}

const pretty = (p?: string | null) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return p || '';
};

/**
 * Test rescues go only to the owner's own phone, proved by a WhatsApp message sent FROM
 * that phone TO the business number. Free tests are capped on the server.
 */
export function TestRescuePanel({ ownerPhone, ownerPhoneVerified, pendingOwnerPhone, status, busy, onStartVerify, onSend, onRefresh }: Props) {
  const [phone, setPhone] = useState(pendingOwnerPhone || (ownerPhoneVerified ? '' : ownerPhone || '') || '');
  const [storeName, setStoreName] = useState('');
  const [verification, setVerification] = useState<VerificationInfo | null>(null);
  const [changing, setChanging] = useState(false);
  const [starting, setStarting] = useState(false);

  const verified = Boolean(ownerPhoneVerified && ownerPhone) && !changing;
  const waiting = !verified && Boolean(pendingOwnerPhone);

  // While waiting for the code to arrive on WhatsApp, re-check every few seconds.
  useEffect(() => {
    if (!waiting) return;
    const iv = setInterval(() => { void onRefresh(); }, 4000);
    return () => clearInterval(iv);
  }, [waiting, onRefresh]);

  useEffect(() => {
    if (ownerPhoneVerified) { setVerification(null); setChanging(false); }
  }, [ownerPhoneVerified, ownerPhone]);

  const start = async () => {
    setStarting(true);
    try {
      const v = await onStartVerify(phone.trim().replace(/\s+/g, ''), storeName.trim());
      setVerification(v);
    } finally {
      setStarting(false);
    }
  };

  const allowance = status && !status.paying
    ? status.enabled
      ? `${status.remaining} of ${status.limit} free test rescues left`
      : 'Free test rescues are paused right now'
    : null;

  return (
    <div className="ob-test">
      <div className="ob-test__head">
        <p className="ob-test__title">Try it on your own phone</p>
        <p className="ob-test__sub">
          Send yourself the message a buyer gets when a delivery fails. It goes from your WhatsApp Business
          number to your personal mobile, and Meta bills your WhatsApp account for it as usual.
        </p>
      </div>

      {verified ? (
        <div className="ob-test__verified">
          <p>
            <CheckCircle2 size={16} aria-hidden="true" /> Test messages go to <strong>{pretty(ownerPhone)}</strong>
            <button type="button" className="ob-test__link" onClick={() => { setChanging(true); setPhone(''); }}>
              Change number
            </button>
          </p>
          <div className="ob-test__actions">
            <button
              type="button"
              className="ob-btn"
              disabled={busy || (status ? status.remaining <= 0 : false)}
              onClick={onSend}
            >
              <Smartphone size={15} aria-hidden="true" /> {busy ? 'Sending…' : 'Send me a test rescue'}
            </button>
            {allowance && <span className="ob-test__allowance">{allowance}</span>}
          </div>
        </div>
      ) : waiting ? (
        <div className="ob-test__verify">
          <p>
            To prove <strong>{pretty(pendingOwnerPhone)}</strong> is yours, send this message <em>from that phone</em> to
            your WhatsApp Business number:
          </p>
          {verification ? (
            <>
              <p className="ob-test__code">RescueShip verify {verification.code}</p>
              <div className="ob-test__actions">
                {verification.waLink && (
                  <a className="ob-btn" href={verification.waLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={15} aria-hidden="true" /> Open WhatsApp with the message
                  </a>
                )}
                {!verification.waLink && <span className="ob-test__allowance">Send it to the business number you just connected.</span>}
              </div>
              <p className="ob-test__hint">This page updates by itself when the message arrives. The code works for 30 minutes.</p>
            </>
          ) : (
            <div className="ob-test__actions">
              <button type="button" className="ob-btn ob-btn--ghost" disabled={starting} onClick={() => void onStartVerify(pendingOwnerPhone || '', '').then(setVerification)}>
                Show my code again
              </button>
            </div>
          )}
          <button type="button" className="ob-test__link" onClick={() => { setChanging(true); setVerification(null); }}>
            Use a different number
          </button>
        </div>
      ) : (
        <div className="ob-test__form">
          <Field label="Your own mobile number">
            <input
              className="ob-input"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="Store name shown in the test (optional)">
            <input className="ob-input" placeholder="Kurta Co." value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Field>
          <div className="ob-test__actions">
            <button
              type="button"
              className="ob-btn"
              disabled={starting || !/^\+?\d[\d\s]{9,15}$/.test(phone.trim())}
              onClick={() => void start().then(() => setChanging(false))}
            >
              {starting ? 'Getting a code…' : 'Verify this number'}
            </button>
            {changing && (
              <button type="button" className="ob-btn ob-btn--ghost" onClick={() => setChanging(false)}>Cancel</button>
            )}
          </div>
          <p className="ob-test__hint">Use the full number with country code, e.g. +919876543210.</p>
        </div>
      )}
    </div>
  );
}

export default TestRescuePanel;
