import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field, Done } from './Field';

const paymentFormSchema = z.object({
  keyId: z.string().min(1, 'Key ID / Client ID is required'),
  keySecret: z.string().min(1, 'Key Secret is required'),
  webhookSecret: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentSetup {
  gateway?: string;
  webhookVerified?: boolean;
  webhook?: { url: string; events: string[]; secret?: string };
}

interface PaymentStationProps {
  onConnect: (gateway: 'razorpay' | 'cashfree', keyId: string, keySecret: string, webhookSecret?: string) => void;
  busy: any;
  done: boolean;
  gateway: string;
  setup?: PaymentSetup | null;
  onTestLink?: () => Promise<{ shortUrl: string }>;
}

/** Webhook setup + ₹1 self-test: payments only confirm through the gateway's signed webhook. */
function WebhookSetup({ setup, onTestLink }: { setup?: PaymentSetup | null; onTestLink?: () => Promise<{ shortUrl: string }> }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (setup?.webhookVerified) return null;
  return (
    <div className="ob-steps" style={{ marginTop: 'var(--space-3)' }}>
      <p className="ob-steps__title">Finish payment setup (required before customers get pay links)</p>
      {setup?.webhook && (
        <ol className="ob-steps__list">
          <li>
            In your {setup.gateway === 'cashfree' ? 'Cashfree' : 'Razorpay'} dashboard add a webhook with URL{' '}
            <code style={{ wordBreak: 'break-all' }}>{setup.webhook.url}</code> and event{' '}
            <code>{setup.webhook.events.join(', ')}</code>.
          </li>
          {setup.webhook.secret && (
            <li>
              Use this webhook secret (shown only once): <code style={{ wordBreak: 'break-all' }}>{setup.webhook.secret}</code>
            </li>
          )}
          <li>Then create the ₹1 test link below and pay it. It goes to your own account.</li>
        </ol>
      )}
      {onTestLink && (
        <button
          type="button"
          className="ob-btn ob-btn--ghost"
          onClick={() => {
            setError(null);
            onTestLink().then((r) => setLink(r.shortUrl)).catch((e: any) => setError(e.message));
          }}
        >
          Create ₹1 test link
        </button>
      )}
      {link && (
        <p className="ob-note">
          Pay this link, then refresh: <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
        </p>
      )}
      {error && <p className="ob-err" role="alert">{error}</p>}
    </div>
  );
}

export function PaymentStation({ onConnect, busy, done, gateway, setup, onTestLink }: PaymentStationProps) {
  const [g, setG] = useState<'razorpay' | 'cashfree'>('razorpay');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { keyId: '', keySecret: '', webhookSecret: '' },
  });

  const onSubmit = (data: PaymentFormValues) => {
    onConnect(g, data.keyId, data.keySecret, data.webhookSecret?.trim() || undefined);
  };

  return done ? (
    <>
      <Done provider={`Connected · ${gateway}`} subtitle="Payment recovery gateway active" />
      <WebhookSetup setup={setup} onTestLink={onTestLink} />
    </>
  ) : (
    <form className="ob-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="ob-seg">
        {(['razorpay', 'cashfree'] as const).map((x) => (
          <button
            type="button"
            key={x}
            className={g === x ? 'on' : ''}
            onClick={() => {
              setG(x);
              reset({ keyId: '', keySecret: '', webhookSecret: '' });
            }}
          >
            {x === 'razorpay' ? 'Razorpay' : 'Cashfree'}
          </button>
        ))}
      </div>
      <Field label={g === 'cashfree' ? 'Cashfree App ID (Key / Client ID)' : 'Razorpay Key ID (Key / Client ID)'}>
        <input
          className="ob-input"
          autoComplete="off"
          spellCheck={false}
          placeholder={g === 'cashfree' ? 'e.g. 123456789abcdef...' : 'e.g. rzp_live_...'}
          {...register('keyId')}
          required
        />
        {errors.keyId && (
          <span style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
            {errors.keyId.message}
          </span>
        )}
      </Field>
      <Field
        label={
          g === 'cashfree' ? 'Cashfree Secret Key (Secret)' : 'Razorpay Key Secret (Secret)'
        }
      >
        <input
          className="ob-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={g === 'cashfree' ? 'Enter Cashfree Secret Key' : 'Enter Razorpay Key Secret'}
          {...register('keySecret')}
          required
        />
        {errors.keySecret && (
          <span style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
            {errors.keySecret.message}
          </span>
        )}
      </Field>
      {g === 'razorpay' && (
        <Field label="Webhook secret (optional — leave empty and we'll generate one)">
          <input
            className="ob-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Secret you set on the Razorpay webhook"
            {...register('webhookSecret')}
          />
        </Field>
      )}
      <p className="ob-note">
        {g === 'cashfree'
          ? 'Secure Cashfree credentials to generate instant 1-click UPI payment links on WhatsApp when customers hesitate on Cash on Delivery orders. Validated via live read and encrypted with bank-grade security.'
          : 'Secure Razorpay credentials to generate instant 1-click UPI payment links on WhatsApp when customers hesitate on Cash on Delivery orders. Validated via live read and encrypted with bank-grade security.'}
      </p>
      <button className="ob-btn" disabled={busy}>
        {busy ? 'Validating…' : 'Validate & connect'}
      </button>
    </form>
  );
}

export default PaymentStation;
