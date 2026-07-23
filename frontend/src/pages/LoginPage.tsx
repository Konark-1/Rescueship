import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { Mail, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import './auth.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password, rememberMe });
      const { token, merchant } = response.data;
      login(token, merchant);
      if (merchant?.onboardingStatus === 'pending') {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to login');
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
      if (merchant.onboardingStatus === 'pending') {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google login failed');
    }
  };

  return (
    <AuthLayout 
      title="Operations Command Center" 
      subtitle="Real-time NDR monitoring & autonomous revenue recovery."
    >
      <h2>Sign In</h2>
      {error && <div className="error-message">{error}</div>}
      
      <div className="google-btn-wrapper">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Login Failed')}
          theme="filled_black"
          shape="pill"
        />
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '24px', color: '#94a3b8', fontSize: '14px', position: 'relative' }}>
        <span style={{ background: 'var(--glass-bg)', padding: '0 10px', position: 'relative', zIndex: 1 }}>or sign in with email</span>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
      </div>

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
              placeholder="Enter your email"
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
              placeholder="Enter your password"
            />
          </div>
        </div>
        
        <div className="form-options">
          <label className="checkbox-label">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Remember Me
          </label>
          <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
        </div>

        <motion.button 
          type="submit" 
          className="auth-button" 
          disabled={loading}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Logging in...' : 'Log In to Command Center'}
        </motion.button>
      </form>
      <div className="auth-links">
        Don't have an account? <Link to="/register">Sign up here</Link>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
