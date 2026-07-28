import React, { useState } from 'react';
import './landing.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@')) {
      setError('Enter a valid email');
      return;
    }

    try {
      const res = await fetch(`${API}/api/plg/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, storeUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (err: any) {
      setError('Network error. Try again.');
    }
  };

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="hero-badge">⚓ RescueShip</div>
        <h1>
          Your failed deliveries are<br />
          <span className="hero-highlight">₹4,83,750/month</span> in lost revenue.
        </h1>
        <p className="hero-sub">
          RescueShip intercepts every NDR (failed delivery attempt) and sends an automated
          WhatsApp rescue message to your customer — recovering 30%+ of would-be returns.
        </p>

        {!submitted ? (
          <form className="signup-form" onSubmit={handleSignup}>
            <input
              type="email"
              placeholder="you@yourstore.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="signup-input"
            />
            <input
              type="text"
              placeholder="yourstore.myshopify.com (optional)"
              value={storeUrl}
              onChange={e => setStoreUrl(e.target.value)}
              className="signup-input"
            />
            <button type="submit" className="signup-btn">
              Start Free → Connect in 4 Minutes
            </button>
            {error && <div className="signup-error">{error}</div>}
          </form>
        ) : (
          <div className="signup-success">
            ✓ You're in. Check <strong>{email}</strong> for your onboarding link.
            <br />
            <span className="success-sub">No sales call. No demo. Just connect and go.</span>
          </div>
        )}

        <div className="hero-proof">
          <div className="proof-item">
            <span className="proof-number">4 min</span>
            <span className="proof-label">Setup time</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">30%+</span>
            <span className="proof-label">Rescue rate</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">₹0</span>
            <span className="proof-label">Until you rescue</span>
          </div>
        </div>
      </div>

      <div className="landing-how">
        <h2>How it works</h2>
        <div className="how-steps">
          <div className="how-step">
            <div className="how-num">1</div>
            <h3>Connect</h3>
            <p>Shopify + WhatsApp + Carrier. Four stations, four minutes, zero code.</p>
          </div>
          <div className="how-step">
            <div className="how-num">2</div>
            <h3>Test</h3>
            <p>Sandbox mode sends rescues to YOUR phone. Graduate when you're confident.</p>
          </div>
          <div className="how-step">
            <div className="how-num">3</div>
            <h3>Rescue</h3>
            <p>Every NDR triggers an automated WhatsApp message. You watch the dashboard.</p>
          </div>
        </div>
      </div>

      <footer className="landing-footer">
        <p>RescueShip · Built for Indian D2C · Shopify + WhatsApp + Shiprocket/Delhivery</p>
      </footer>
    </div>
  );
};

export default LandingPage;
