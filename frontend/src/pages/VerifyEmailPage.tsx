import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';
import './auth.css';

const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [state, setState] = useState<'checking' | 'done' | 'error'>(token && email ? 'checking' : 'error');
  const [error, setError] = useState(token && email ? '' : 'This link is incomplete.');

  useEffect(() => {
    if (!token || !email) return;
    api
      .post('/api/auth/verify-email', { token, email })
      .then(() => setState('done'))
      .catch((err: any) => {
        setError(err.response?.data?.error || 'This link is invalid or has expired.');
        setState('error');
      });
  }, [token, email]);

  return (
    <AuthLayout title="Confirm" accent=" your email." subtitle="One quick check so only you can use this account.">
      <h2>Email confirmation</h2>
      {state === 'checking' && <p>Confirming…</p>}
      {state === 'done' && <p>Your email is confirmed. You can close this tab or continue to your dashboard.</p>}
      {state === 'error' && <div className="error-message">{error}</div>}
      <div className="auth-links">
        <Link to="/dashboard">Go to dashboard</Link>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
