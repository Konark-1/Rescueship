import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { Zap, Bot, ShieldCheck, Mail, Lock, User } from 'lucide-react';
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
  let strengthColor = '#ef4444';
  if (strength > 25) strengthColor = '#eab308';
  if (strength > 75) strengthColor = '#22c55e';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', { name, email, password });
      const { token, merchant } = response.data;
      login(token, merchant);
      navigate('/onboarding');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to register');
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
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <motion.div className="feature-item" variants={itemVariants}>
        <span className="feature-icon"><Zap size={18} className="text-[#818cf8]" /></span>
        <span className="feature-text">Instant Shopify & WooCommerce webhooks</span>
      </motion.div>
      <motion.div className="feature-item" variants={itemVariants}>
        <span className="feature-icon"><Bot size={18} className="text-[#a855f7]" /></span>
        <span className="feature-text">Automated WhatsApp Cloud API NDR recovery</span>
      </motion.div>
      <motion.div className="feature-item" variants={itemVariants}>
        <span className="feature-icon"><ShieldCheck size={18} className="text-[#10b981]" /></span>
        <span className="feature-text">Prevent ₹4L+/month in RTO losses</span>
      </motion.div>
    </motion.div>
  );

  return (
    <AuthLayout 
      title="Automate Your NDR Recovery" 
      subtitle="Set up in under 5 minutes. Protect your margins today."
      features={features}
    >
      <h2>Create Account</h2>
      {error && <div className="error-message">{error}</div>}
      
      <div className="google-btn-wrapper">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Registration Failed')}
          text="signup_with"
          theme="filled_black"
          shape="pill"
        />
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '24px', color: '#94a3b8', fontSize: '14px', position: 'relative' }}>
        <span style={{ background: 'var(--glass-bg)', padding: '0 10px', position: 'relative', zIndex: 1 }}>or sign up with email</span>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
      </div>

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
