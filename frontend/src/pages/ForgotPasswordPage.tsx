import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { Mail } from 'lucide-react';
import { motion } from 'motion/react';
import './auth.css';

const ForgotPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your"
      accent=" password."
      subtitle="We will email you a single-use link that expires in 15 minutes."
    >
      <h2>Forgot password</h2>
      <p className="auth-sub">Also used to set a password on a Google-registered account</p>
      {error && <div className="error-message">{error}</div>}

      {sent ? (
        <div className="google-warning-card">
          <p className="google-warning-desc">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam folder.
          </p>
          <div className="auth-links"><Link to="/login">Back to sign in</Link></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group input-with-icon">
            <label>Email</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your account email"
              />
            </div>
          </div>
          <motion.button type="submit" className="auth-button" disabled={loading} whileTap={{ scale: 0.98 }}>
            {loading ? 'Sending…' : 'Send reset link'}
          </motion.button>
          <div className="auth-links"><Link to="/login">Back to sign in</Link></div>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
