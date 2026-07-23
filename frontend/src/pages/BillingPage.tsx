import { useState, useRef } from 'react';
import { CreditCard, Zap, Download, Check, Shield, Star, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function BillingPage() {
  const creditsUsed = 400;
  const creditsTotal = 500;
  const percentageUsed = (creditsUsed / creditsTotal) * 100;
  
  const [isAnnual, setIsAnnual] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<{ type: string, name: string, price: string } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDownload = (id: string) => {
    showToast(`Downloading Invoice PDF for ${id}...`);
  };

  const handleBuy = (type: string, name: string, price: string) => {
    setShowCheckoutModal({ type, name, price });
  };

  const topupPackages = [
    { credits: 500, price: '₹999', popular: false },
    { credits: 2000, price: '₹3,499', popular: true },
    { credits: 5000, price: '₹7,999', popular: false },
  ];

  const subscriptions = [
    {
      name: 'Starter',
      price: isAnnual ? '₹1,599' : '₹1,999',
      period: '/mo',
      features: ['Up to 1,000 orders/mo', 'Basic WhatsApp Templates', 'Email Support'],
      buttonText: 'Current Plan',
      active: true,
      popular: false,
    },
    {
      name: 'Growth',
      price: isAnnual ? '₹3,999' : '₹4,999',
      period: '/mo',
      features: ['Up to 5,000 orders/mo', 'Custom WhatsApp Flows', 'Priority Support', 'COD to Prepaid Conversions'],
      buttonText: 'Upgrade Now',
      active: false,
      popular: true,
    },
    {
      name: 'Scale Enterprise',
      price: 'Custom',
      period: '',
      features: ['Unlimited orders', 'Dedicated Account Manager', 'Custom Integrations', 'SLA Guarantee'],
      buttonText: 'Contact Sales',
      active: false,
      popular: false,
    }
  ];

  const invoices = [
    { id: 'INV-2026-001', date: 'Oct 1, 2026', amount: '₹1,999', status: 'Paid' },
    { id: 'INV-2026-002', date: 'Sep 1, 2026', amount: '₹1,999', status: 'Paid' },
    { id: 'INV-2026-003', date: 'Aug 1, 2026', amount: '₹999', status: 'Paid' },
  ];

  // Circular progress math
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentageUsed / 100) * circumference;

  return (
    <div className="fade-in-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'var(--primary)', opacity: 0.1, filter: 'blur(50px)', borderRadius: '50%' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: '0 0 0.5rem 0' }}>Billing & Credits</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage your subscription and top up your message credits.</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', minWidth: '300px', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px' }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle
                cx="40" cy="40" r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="6"
              />
              <circle
                cx="40" cy="40" r={radius}
                fill="none"
                stroke={percentageUsed > 80 ? 'var(--danger)' : 'var(--primary)'}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {Math.round(percentageUsed)}%
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Credits Remaining</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {creditsTotal - creditsUsed} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'normal' }}>/ {creditsTotal}</span>
            </div>
            {percentageUsed > 80 && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={12} /> Refill needed soon</span>}
          </div>
        </div>
      </div>

      <div ref={containerRef} onMouseMove={handleMouseMove} style={{ position: 'relative' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
          <Zap size={20} color="var(--accent)" />
          Quick Credit Top-Up
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {topupPackages.map((pkg, i) => (
            <motion.div 
              key={i} 
              className="glass-card" 
              whileHover={{ y: -5, scale: 1.02 }}
              style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', border: pkg.popular ? '1px solid var(--primary)' : '1px solid var(--border-color)', position: 'relative', cursor: 'pointer', overflow: 'hidden' }}
            >
              <div 
                style={{
                  position: 'absolute',
                  inset: '-1px',
                  background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.06), transparent 40%)`,
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
              {pkg.popular && <div style={{ position: 'absolute', top: '-12px', background: 'var(--primary)', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.75rem', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: 'var(--shadow-glow)', zIndex: 1 }}>Most Popular</div>}
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0', zIndex: 1 }}>{pkg.credits.toLocaleString()}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', zIndex: 1 }}>Message Credits</p>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '1.5rem', zIndex: 1 }}>{pkg.price}</div>
              <button onClick={() => handleBuy('Top-Up', `${pkg.credits} Credits`, pkg.price)} className={pkg.popular ? "btn btn-primary" : "btn btn-secondary"} style={{ width: '100%', zIndex: 1 }}>
                Buy Now
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
            <Shield size={20} color="var(--success)" />
            Subscription Plans
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
            {['Monthly', 'Annual'].map((planType) => {
              const isActive = (planType === 'Annual') === isAnnual;
              return (
                <button
                  key={planType}
                  onClick={() => setIsAnnual(planType === 'Annual')}
                  style={{
                    position: 'relative', padding: '8px 16px', fontSize: '0.875rem', fontWeight: 500,
                    color: isActive ? '#ffffff' : 'var(--text-muted)', border: 'none', background: 'transparent',
                    cursor: 'pointer', borderRadius: '8px', zIndex: 2
                  }}
                >
                  {planType} {planType === 'Annual' && <span style={{ color: 'var(--success)', marginLeft: '4px', fontSize: '0.75rem' }}>Save 20%</span>}
                  {isActive && (
                    <motion.div
                      layoutId="billingToggle"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{
                        position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', zIndex: -1
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {subscriptions.map((plan, i) => (
            <div key={i} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative', border: plan.popular ? '1px solid var(--accent)' : '1px solid var(--border-color)', background: plan.popular ? 'var(--primary-glow)' : 'var(--bg-card)' }}>
              {plan.popular && <div style={{ position: 'absolute', top: '-12px', right: '1.5rem', background: 'linear-gradient(90deg, var(--accent), var(--primary))', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.75rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: 'var(--shadow-glow)' }}><Star size={12} fill="white" /> Popular Glow</div>}
              
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: plan.popular ? 'var(--accent)' : 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>{plan.name}</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>{plan.price}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{plan.period}</span>
              </div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {plan.features.map((feature, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Check size={18} color={plan.popular ? 'var(--accent)' : 'var(--success)'} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => !plan.active && handleBuy('Subscription', plan.name, plan.price)}
                disabled={plan.active}
                className={plan.active ? "btn" : "btn btn-primary"} 
                style={{ width: '100%', background: plan.active ? 'rgba(255,255,255,0.05)' : plan.popular ? 'var(--accent)' : 'var(--primary)', color: plan.active ? 'var(--text-muted)' : 'white', cursor: plan.active ? 'default' : 'pointer', border: plan.active ? '1px solid var(--border-color)' : 'none' }}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Invoice History</h2>
          <CreditCard size={20} color="var(--text-muted)" />
        </div>
        <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
          <table className="custom-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ background: 'transparent' }}>Invoice ID</th>
                <th style={{ background: 'transparent' }}>Date</th>
                <th style={{ background: 'transparent' }}>Amount</th>
                <th style={{ background: 'transparent' }}>Status</th>
                <th style={{ background: 'transparent', textAlign: 'right' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{inv.id}</td>
                  <td>{inv.date}</td>
                  <td style={{ fontWeight: 500 }}>{inv.amount}</td>
                  <td>
                    <span className="badge badge-success">{inv.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleDownload(inv.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 500 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Download size={16} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCheckoutModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Confirm Purchase</h3>
              <button onClick={() => setShowCheckoutModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Zap size={32} color="var(--primary)" />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{showCheckoutModal.name}</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>You are about to purchase the {showCheckoutModal.type}.</p>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.5rem' }}>{showCheckoutModal.price}</div>
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => { showToast(`Successfully purchased ${showCheckoutModal.name}!`); setShowCheckoutModal(null); }}
                className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}
              >
                Confirm Payment
              </button>
              <button onClick={() => setShowCheckoutModal(null)} className="btn btn-secondary" style={{ width: '100%', padding: '0.75rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--primary-glow)', border: '1px solid var(--primary)', color: 'white', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 2000, boxShadow: 'var(--shadow-glow)', animation: 'fadeInUp 0.3s ease-out' }}>
          <Check size={20} color="var(--primary)" />
          <span style={{ fontWeight: 500 }}>{toast}</span>
        </div>
      )}
    </div>
  );
}
