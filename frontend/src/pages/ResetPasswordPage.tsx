import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { Lock } from 'lucide-react';
import { motion } from 'motion/react';
import './auth.css';

const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/api/auth/reset-password', { token, email, newPassword: password });
      const { token: jwt, merchant } = response.data;
      login(jwt, merchant);
      navigate(merchant?.onboardingStatus === 'pending' ? '/onboarding' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthLayout title="Invalid" accent=" reset link." subtitle="This link is missing its token.">
        <h2>Reset password</h2>
        <div className="error-message">This reset link is incomplete. Request a new one.</div>
        <div className="auth-links"><Link to="/forgot-password">Request a new link</Link></div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new"
      accent=" password."
      subtitle="All existing sessions will be signed out once you reset."
    >
      <h2>Reset password</h2>
      <p className="auth-sub">for {email}</p>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group input-with-icon">
          <label>New password</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
        </div>
        <div className="form-group input-with-icon">
          <label>Confirm password</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              placeholder="Repeat your new password"
            />
          </div>
        </div>
        <motion.button type="submit" className="auth-button" disabled={loading} whileTap={{ scale: 0.98 }}>
          {loading ? 'Resetting…' : 'Set new password'}
        </motion.button>
        <div className="auth-links"><Link to="/login">Back to sign in</Link></div>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
