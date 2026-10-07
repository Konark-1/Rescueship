import { useState } from 'react';
import { Field, Done } from './Field';

interface PaymentStationProps {
  onConnect: (gateway: 'razorpay' | 'cashfree', keyId: string, keySecret: string) => void;
  busy: any;
  done: boolean;
  gateway: string;
}

export function PaymentStation({ onConnect, busy, done, gateway }: PaymentStationProps) {
  const [g, setG] = useState<'razorpay' | 'cashfree'>('razorpay');
  const [id, setId] = useState('');
  const [sec, setSec] = useState('');

  return done ? (
    <Done provider={`Connected · ${gateway}`} />
  ) : (
    <form
      className="ob-form"
      onSubmit={(e) => {
        e.preventDefault();
        onConnect(g, id, sec);
      }}
    >
      <div className="ob-seg">
        {(['razorpay', 'cashfree'] as const).map((x) => (
          <button
            type="button"
            key={x}
            className={g === x ? 'on' : ''}
            onClick={() => {
              setG(x);
              setId('');
              setSec('');
            }}
          >
            {x === 'razorpay' ? 'Razorpay' : 'Cashfree'}
          </button>
        ))}
      </div>
      <Field label={g === 'cashfree' ? 'CASHFREE_APP_ID (App / Client ID)' : 'RAZORPAY_KEY_ID (Key / Client ID)'}>
        <input
          className="ob-input"
          autoComplete="off"
          spellCheck={false}
          placeholder={g === 'cashfree' ? 'e.g. 123456789abcdef...' : 'e.g. rzp_live_...'}
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        />
      </Field>
      <Field
        label={
          g === 'cashfree' ? 'CASHFREE_SECRET_KEY (Secret Key)' : 'RAZORPAY_KEY_SECRET (Key Secret)'
        }
      >
        <input
          className="ob-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={g === 'cashfree' ? 'Enter Cashfree Secret Key' : 'Enter Razorpay Key Secret'}
          value={sec}
          onChange={(e) => setSec(e.target.value)}
          required
        />
      </Field>
      <p className="ob-note">
        {g === 'cashfree'
          ? 'Cashfree API credentials for autonomous COD→UPI link generation. Validated with a live read call, then encrypted at rest (AES-256-GCM).'
          : 'Razorpay API credentials for autonomous COD→UPI link generation. Validated with a live read call, then encrypted at rest (AES-256-GCM).'}
      </p>
      <button className="ob-btn" disabled={busy}>
        {busy ? 'Validating…' : 'Validate & connect'}
      </button>
    </form>
  );
}

export default PaymentStation;
