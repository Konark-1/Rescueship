import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { Mail, Lock, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import './auth.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [googlePrompt, setGooglePrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password,
        rememberMe,
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
        const errorData = err.response?.data;
        if (errorData?.code === 'GOOGLE_ACCOUNT_NO_PASSWORD' || errorData?.hasGoogleAuth) {
          setGooglePrompt(true);
          setError(errorData.error || 'This account was registered with Google. Try logging in with Google or set a password.');
        } else {
          setError(errorData?.error || errorData?.message || 'Failed to login');
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
      title="Back on deck."
      accent=" Rescues resumed."
      subtitle="Real-time NDR monitoring and autonomous revenue recovery, right where you left it."
    >
      <h2>Sign in</h2>
      <p className="auth-sub">Access your command deck</p>
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
            This account was registered using Google and doesn't have a password yet. Sign in with Google directly, or set a password through the emailed reset link.
          </p>
          <div className="google-warning-actions">
            <Link
              to={`/forgot-password?email=${encodeURIComponent(email)}`}
              className="google-warning-setup-btn"
            >
              Email me a password setup link
            </Link>
          </div>
        </motion.div>
      )}

      <div className="google-btn-wrapper">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Login Failed')}
          theme="filled_black"
          shape="pill"
        />
      </div>

      <div className="auth-divider"><span>or sign in with email</span></div>

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
          {loading ? 'Authenticating…' : 'Enter command deck'}
        </motion.button>
      </form>
      <div className="auth-links">
        Don't have an account? <Link to="/register">Sign up here</Link>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
