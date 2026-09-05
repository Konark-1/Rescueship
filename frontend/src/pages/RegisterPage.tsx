import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { Zap, Bot, ShieldCheck, Mail, Lock, User, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import './auth.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
};

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [googlePrompt, setGooglePrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0) return 0;
    let strength = 0;
    if (pass.length >= 8) strength += 25;
    if (pass.match(/[A-Z]/)) strength += 25;
    if (pass.match(/[0-9]/)) strength += 25;
    if (pass.match(/[^A-Za-z0-9]/)) strength += 25;
    return strength;
  };

  const strength = getPasswordStrength(password);
  let strengthColor = 'var(--rose)';
  if (strength > 25) strengthColor = 'var(--amber)';
  if (strength > 75) strengthColor = 'var(--emerald)';

  const handleSubmit = async (e: React.FormEvent, forceSetupPassword = false) => {
    e.preventDefault();
    if (forceSetupPassword && (!password || password.length < 8)) {
      setError('Please enter a password with at least 8 characters in the password field first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', {
        name,
        email,
        password,
        setupPassword: forceSetupPassword,
      });
      const { token, merchant } = response.data;
      login(token, merchant);
      if (merchant?.onboardingStatus === 'pending') {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const d = err.response?.data;
        if (d?.code === 'GOOGLE_ACCOUNT_EXISTS' || d?.hasGoogleAuth) {
          setGooglePrompt(true);
          setError(d?.error || 'An account with this email was registered using Google. Try logging in with Google, or set up a password.');
        } else {
          setGooglePrompt(false);
          setError(d?.error || d?.message || 'Failed to register');
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const response = await api.post('/api/auth/google', { credential: credentialResponse.credential });
      const { token, merchant } = response.data;
      login(token, merchant);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google registration failed');
    }
  };

  const features = (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <motion.div className="feature-item" variants={itemVariants}>
        <span className="feature-icon"><Zap size={16} /></span>
        <span className="feature-text">Instant Shopify &amp; WooCommerce webhooks</span>
      </motion.div>
      <motion.div className="feature-item" variants={itemVariants}>
        <span className="feature-icon feature-icon--amber"><Bot size={16} /></span>
        <span className="feature-text">Automated WhatsApp Cloud API NDR recovery</span>
      </motion.div>
      <motion.div className="feature-item" variants={itemVariants}>
        <span className="feature-icon feature-icon--emerald"><ShieldCheck size={16} /></span>
        <span className="feature-text">Prevent ₹4L+/month in RTO losses</span>
      </motion.div>
    </motion.div>
  );

  return (
    <AuthLayout
      title="Stop losing orders to"
      accent=" failed deliveries."
      subtitle="Set up in under 5 minutes. Protect your margins from tonight's dispatches."
      features={features}
    >
      <h2>Create account</h2>
      <p className="auth-sub">Spin up your rescue engine</p>
      {error && !googlePrompt && <div className="error-message">{error}</div>}

      {googlePrompt && (
        <motion.div
          className="google-warning-card"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="google-warning-badge">
            <AlertTriangle size={15} />
            <span>Google Account Found</span>
          </div>
          <p className="google-warning-desc">
            An account with <strong>{email}</strong> already exists via Google. You can sign in with Google directly, or set up this password to enable password sign-in.
          </p>
          <div className="google-warning-actions">
            <button
              type="button"
              className="google-warning-setup-btn"
              disabled={loading}
              onClick={(e) => handleSubmit(e, true)}
            >
              {loading ? 'Setting password…' : 'Set up password & Sign in'}
            </button>
            <Link to="/login" className="google-warning-link">
              Sign in with Google instead →
            </Link>
          </div>
        </motion.div>
      )}

      <div className="google-btn-wrapper">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Registration Failed')}
          text="signup_with"
          theme="filled_black"
          shape="pill"
        />
      </div>

      <div className="auth-divider"><span>or sign up with email</span></div>

      <form onSubmit={handleSubmit}>
        <div className="form-group input-with-icon">
          <label>Name</label>
          <div className="input-wrapper">
            <User size={18} className="input-icon" />
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              placeholder="Your full name"
            />
          </div>
        </div>
        <div className="form-group input-with-icon">
          <label>Email</label>
          <div className="input-wrapper">
            <Mail size={18} className="input-icon" />
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="Your email address"
            />
          </div>
        </div>
        <div className="form-group input-with-icon">
          <label>Password</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" />
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Create a strong password"
            />
          </div>
          {password.length > 0 && (
            <div className="password-strength">
              <div className="strength-bar" style={{ width: `${strength}%`, backgroundColor: strengthColor }}></div>
              <span className="strength-text" style={{ color: strengthColor }}>
                {strength <= 25 ? 'Weak' : strength <= 75 ? 'Good' : 'Strong'}
              </span>
            </div>
          )}
        </div>

        <div className="form-options terms-checkbox">
          <label className="checkbox-label">
            <input type="checkbox" required checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            <span>I agree to the <Link to="/terms">Terms</Link> & <Link to="/privacy">Privacy Policy</Link></span>
          </label>
        </div>

        <motion.button 
          type="submit" 
          className="auth-button" 
          disabled={loading || !termsAccepted}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Creating account...' : 'Start Free Trial'}
        </motion.button>
      </form>
      <div className="auth-links">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
