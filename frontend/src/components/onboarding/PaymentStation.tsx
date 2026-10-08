import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field, Done } from './Field';

const paymentFormSchema = z.object({
  keyId: z.string().min(1, 'Key ID / Client ID is required'),
  keySecret: z.string().min(1, 'Key Secret is required'),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentStationProps {
  onConnect: (gateway: 'razorpay' | 'cashfree', keyId: string, keySecret: string) => void;
  busy: any;
  done: boolean;
  gateway: string;
}

export function PaymentStation({ onConnect, busy, done, gateway }: PaymentStationProps) {
  const [g, setG] = useState<'razorpay' | 'cashfree'>('razorpay');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { keyId: '', keySecret: '' },
  });

  const onSubmit = (data: PaymentFormValues) => {
    onConnect(g, data.keyId, data.keySecret);
  };

  return done ? (
    <Done provider={`Connected · ${gateway}`} />
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
              reset({ keyId: '', keySecret: '' });
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
          g === 'cashfree' ? 'CASHFREE_SECRET_KEY (Secret Key)' : 'RAZORPAY_KEY_SECRET (Key Secret)'
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
