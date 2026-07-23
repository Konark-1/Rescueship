import { useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import { AnimatedCounter } from '../components/motion/AnimatedCounter';
import PricingComparisonModal from '../components/PricingComparisonModal';
import './landing.css';

export default function LandingPage() {
  const [activeScenario, setActiveScenario] = useState<'fake_remark' | 'cancellation'>('fake_remark');
  const [chatState, setChatState] = useState<'initial' | 'home' | 'reschedule' | 'paid' | 'accept_tomorrow' | 'express_confirm' | 'cancelled_confirm' | 'gps_shared' | 'landmark_updated' | 'both_step1_prompt' | 'both_step2_prompt' | 'both_completed'>('initial');
  const [cancelReason, setCancelReason] = useState<'cheaper' | 'delay' | 'address' | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [orderVolume, setOrderVolume] = useState(10000);
  const [isAnnual, setIsAnnual] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Scroll animations for hero mockup
  const { scrollYProgress } = useScroll();
  const heroTilt = useTransform(scrollYProgress, [0, 0.2], [15, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [0.9, 1]);

  const handleScenarioChange = (scenario: 'fake_remark' | 'cancellation') => {
    setActiveScenario(scenario);
    setChatState('initial');
    setCancelReason(null);
  };

  const resetChat = () => {
    setChatState('initial');
    setCancelReason(null);
  };

  const handlePayment = () => {
    setIsPaying(true);
    setTimeout(() => {
      setIsPaying(false);
      setChatState('paid');
    }, 1500);
  };

  // Calculator values
  const rtoRate = 0.15; // 15% RTO rate
  const lossPerRto = 430;
  const reductionRate = 0.60; // 60% reduction
  const totalRtos = orderVolume * rtoRate;
  const currentLoss = totalRtos * lossPerRto;
  const savedRevenue = currentLoss * reductionRate;
  const roiMultiplier = Math.round(savedRevenue / (isAnnual ? 49990 : 4999));

  return (
    <div className="landing-page">
      {/* 1. Floating Morphic Header Bar */}
      <header className="floating-header">
        <div className="header-logo">
          <span>🚢</span> RescueShip
        </div>
        <nav className="header-nav">
          <a href="#how-it-works">How It Works</a>
          <a href="#calculator">Crisis Calculator</a>
          <a href="#guardrails">Guardrails</a>
          <a href="#pricing">Pricing</a>
          <a href="#docs">Docs</a>
        </nav>
        <div className="header-ctas">
          <Link to="/login" className="btn-login">Log In</Link>
          <Link to="/register" className="btn-trial">Get Started</Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="hero-section">
        <motion.div 
          className="hero-badge"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Enterprise NDR Recovery System
        </motion.div>
        
        <motion.h1 
          className="hero-title chrome-text"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Stop Losing ₹430 Per Failed Delivery
        </motion.h1>
        
        <motion.p 
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Automate NDR resolutions on WhatsApp, intercept fake remarks in real-time, and guarantee next-day delivery using precise GPS location sync.
        </motion.p>
        
        <motion.div 
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link to="/register"><button className="hero-btn-primary">Start Rescuing Revenue</button></Link>
          <button className="hero-btn-secondary">Book Live Demo</button>
        </motion.div>

        <motion.div 
          className="hero-mockup-wrapper"
          style={{ rotateX: heroTilt, scale: heroScale }}
        >
          <div className="hero-mockup">
            <div className="mockup-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem'}}>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <div className="mockup-dot" style={{background: '#ef4444'}}></div>
                <div className="mockup-dot" style={{background: '#f59e0b'}}></div>
                <div className="mockup-dot" style={{background: '#10b981'}}></div>
              </div>
            </div>

            {/* Live Interactive Hero Dashboard Visual */}
            <div style={{padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem'}}>
                <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem', textAlign: 'left'}}>
                  <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>RESCUED TODAY</div>
                  <div style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981'}}>854 Shipments</div>
                </div>
                <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem', textAlign: 'left'}}>
                  <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>RECOVERY RATE</div>
                  <div style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#818cf8'}}>42.3%</div>
                </div>
                <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem', textAlign: 'left'}}>
                  <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>REVENUE RETAINED</div>
                  <div style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#c084fc'}}>₹12.54 Lakhs</div>
                </div>
              </div>

              {/* Real-time Event Feed */}
              <div style={{textAlign: 'left', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.85rem'}}>
                <div style={{fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between'}}>
                  <span>REAL-TIME INTERCEPTION STREAM</span>
                  <span style={{fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#10b981'}}>LATENCY: 42ms</span>
                </div>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', fontSize: '0.8rem'}}>
                    <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <span style={{color: '#10b981'}}>⚡</span>
                      <strong>Order #89421</strong> (Delhivery) — Fake Remark Intercepted
                    </span>
                    <span style={{background: '#10b981', color: 'black', fontWeight: 'bold', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem'}}>Re-Dispatched</span>
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '6px', fontSize: '0.8rem'}}>
                    <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <span style={{color: '#818cf8'}}>💳</span>
                      <strong>Order #89422</strong> (Shiprocket) — COD Converted to UPI
                    </span>
                    <span style={{background: '#6366f1', color: 'white', fontWeight: 'bold', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem'}}>₹1,424 Paid</span>
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '6px', fontSize: '0.8rem'}}>
                    <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <span style={{color: '#c084fc'}}>📍</span>
                      <strong>Order #89423</strong> (BlueDart) — GPS Pin Synced to Driver App
                    </span>
                    <span style={{background: '#a855f7', color: 'white', fontWeight: 'bold', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem'}}>GPS Locked</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. Logo Cloud */}
      <section className="logo-cloud">
        <h4 className="logo-cloud-title">Trusted by 500+ D2C Brands & Logistics Partners</h4>
        <div className="logos">
          {['Shopify', 'Delhivery', 'Shiprocket', 'Razorpay', 'WooCommerce'].map((logo, i) => (
            <motion.div 
              key={logo} 
              className="logo-item"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              {logo}
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. The RTO Crisis (Bento Grid) */}
      <section className="bento-section" id="crisis">
        <h2 className="section-title">The RTO Crisis</h2>
        <p className="section-subtitle">Why traditional NDR management fails your bottom line.</p>
        
        <div className="bento-grid">
          {[
            { icon: '🛑', title: 'Fake Remarks', metric: '60%', desc: 'Of delivery failures are marked as "Door Locked" without attempting.' },
            { icon: '💸', title: '₹430 RTO Drain', metric: '₹430', desc: 'Forward + Reverse + Repackaging + CAC = Massive net loss per RTO.' },
            { icon: '📞', title: 'Call Center Trap', metric: '<15%', desc: 'Pick-up rate when call centers reach out 48hrs after RTO is initiated.' },
            { icon: '🔁', title: 'Blind Re-attempts', metric: '0%', desc: 'Re-attempting delivery next day without fixing the address guarantees failure.' }
          ].map((item, i) => (
            <motion.div 
              key={i} 
              className="bento-card"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.1 }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
              }}
            >
              <div className="bento-icon">{item.icon}</div>
              <div className="bento-metric">{item.metric}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. Autonomous NDR Lifecycle */}
      <section className="lifecycle-section" id="how-it-works">
        <h2 className="section-title">Autonomous NDR Lifecycle</h2>
        <p className="section-subtitle">How RescueShip turns failures into successful deliveries instantly.</p>
        
        <div className="lifecycle-container">
          <div className="lifecycle-steps">
            <motion.div 
              className="lifecycle-step"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="step-icon-container">🕵️</div>
              <div className="step-content">
                <h3>1. DETECT</h3>
                <p>Instantly detects NDR alerts via deep integrations with Delhivery and Shiprocket within seconds of driver remarks.</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="lifecycle-step reverse"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="step-icon-container">💬</div>
              <div className="step-content">
                <h3>2. ENGAGE</h3>
                <p>Engages the customer on WhatsApp while the driver is still in their neighborhood, requesting GPS pin or clarifying intent.</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="lifecycle-step"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="step-icon-container">🛡️</div>
              <div className="step-content">
                <h3>3. RESCUE</h3>
                <p>Pushes precise GPS coordinates directly into the driver's app or intercepts cancellations with UPI retention discounts.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. Live WhatsApp Playground */}
      <section className="playground-section" id="playground">
        <div className="playground-container">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title" style={{textAlign: 'left'}}>Live WhatsApp Playground</h2>
            <p className="section-subtitle" style={{textAlign: 'left', marginBottom: '2rem'}}>
              Test our autonomous bots in real-world failure scenarios.
            </p>
            
            <div className="scenario-tabs">
              <button 
                className={`scenario-tab ${activeScenario === 'fake_remark' ? 'active' : ''}`}
                onClick={() => handleScenarioChange('fake_remark')}
              >
                Fake Remark
              </button>
              <button 
                className={`scenario-tab ${activeScenario === 'cancellation' ? 'active' : ''}`}
                onClick={() => handleScenarioChange('cancellation')}
              >
                Cancellation Retention
              </button>
            </div>
            
            <button className="chat-btn" onClick={resetChat}>
              🔄 Reset Conversation
            </button>
          </motion.div>

          <motion.div 
            className="phone-frame"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="phone-screen">
              <div className="phone-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <div style={{width: 32, height: 32, background: 'white', color: '#075e54', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>RS</div>
                  <strong>RescueBot</strong>
                </div>
              </div>
              
              <div className="chat-area">
                <AnimatePresence mode="wait">
                  {isPaying && (
                    <motion.div 
                      className="chat-banner"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{background: '#d1fae5', color: '#065f46'}}
                    >
                      Processing secure UPI payment...
                    </motion.div>
                  )}

                  {activeScenario === 'fake_remark' && (
                    <motion.div key="fr" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%'}}>
                      <div className="chat-banner">🔴 CARRIER EXCEPTION: Agent marked "Door Locked" (8:14 PM)</div>
                      <div className="chat-bubble bot">
                        Hi! Delivery agent marked order #89421 as "Door Locked". Our system flagged this. Were you at home?
                      </div>
                      
                      {chatState === 'initial' && (
                        <div className="chat-actions">
                          <button className="chat-btn" onClick={() => setChatState('home')}>Yes, I am home</button>
                          <button className="chat-btn" onClick={() => setChatState('reschedule')}>Reschedule for Tomorrow</button>
                        </div>
                      )}
                      
                      {chatState === 'home' && (
                        <>
                          <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                            Yes, I am home. Nobody came!
                          </motion.div>
                          <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                            ⚡ FAKE REMARK ESCALATED TO HUB SUPERVISOR
                          </motion.div>
                          <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                            Thanks for confirming! We flagged this fake remark to the Delhivery Hub Supervisor. A priority first-slot re-attempt is scheduled for tomorrow morning (9 AM - 12 PM), with hub supervisor GPS tracking enabled.
                          </motion.div>
                        </>
                      )}

                      {chatState === 'reschedule' && (
                        <>
                          <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                            Reschedule for Tomorrow
                          </motion.div>
                          <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                            ⚡ CARRIER SYNC: RE-ATTEMPT SCHEDULED FOR TOMORROW
                          </motion.div>
                          <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                            Got it! We have updated your delivery schedule with Delhivery. The agent will re-attempt delivery tomorrow between 10 AM - 2 PM.
                          </motion.div>
                        </>
                      )}
                    </motion.div>
                  )}

                  {activeScenario === 'cancellation' && (
                    <motion.div key="ca" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%'}}>
                      <div className="chat-banner">🔴 CARRIER EXCEPTION: Buyer Requested Cancellation</div>
                      <div className="chat-bubble bot">
                        Hi! You requested cancellation for order #89422. Please select a reason below:
                      </div>

                      {cancelReason === null && (
                        <div className="chat-actions">
                          <button className="chat-btn" onClick={() => setCancelReason('cheaper')}>🏷️ Found it cheaper elsewhere</button>
                          <button className="chat-btn" onClick={() => setCancelReason('delay')}>⏰ Delivery is taking too long</button>
                          <button className="chat-btn" onClick={() => setCancelReason('address')}>📍 Want to change delivery location</button>
                        </div>
                      )}

                      {/* BRANCH A: Cheaper Elsewhere */}
                      {cancelReason === 'cheaper' && (
                        <>
                          <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                            Found it cheaper elsewhere.
                          </motion.div>
                          <motion.div className="chat-banner" style={{background: '#fef3c7', color: '#b45309'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                            ⚡ CALCULATING RETENTION INCENTIVE
                          </motion.div>
                          <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                            Wait! Get an instant ₹75 discount (Total: ₹1,424) if you convert to Prepaid via UPI right now. Guaranteed priority delivery tomorrow!
                          </motion.div>
                          
                          {chatState === 'initial' && (
                            <div className="chat-actions">
                              <button className="chat-btn primary" onClick={handlePayment}>Pay ₹1,424 via UPI (Save ₹75)</button>
                              <button className="chat-btn" onClick={() => setChatState('accept_tomorrow')}>I will accept delivery tomorrow</button>
                            </div>
                          )}
                          
                          {chatState === 'paid' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                Paid ₹1,424 via UPI
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                ✅ TXN_98412 • RESCUED_PREPAID
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                Payment received! We have upgraded your shipment to Priority Delivery for tomorrow morning.
                              </motion.div>
                            </>
                          )}

                          {chatState === 'accept_tomorrow' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                I will accept delivery tomorrow
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                ⚡ DELIVERY CONFIRMED FOR TOMORROW
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                Perfect! Your order has been held for delivery tomorrow morning. The courier agent will call you before arriving. Please keep cash ready!
                              </motion.div>
                            </>
                          )}
                        </>
                      )}

                      {/* BRANCH B: Delivery Delay */}
                      {cancelReason === 'delay' && (
                        <>
                          <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                            Delivery is taking too long.
                          </motion.div>
                          <motion.div className="chat-banner" style={{background: '#fef3c7', color: '#b45309'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                            ⚡ AIR EXPRESS DISPATCH UPGRADE APPLIED
                          </motion.div>
                          <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                            We apologize for the delay! We've upgraded your package to Delhivery Air Express Priority at zero extra charge. It will be delivered tomorrow morning before 12 PM.
                          </motion.div>
                          
                          {chatState === 'initial' && (
                            <div className="chat-actions">
                              <button className="chat-btn primary" onClick={() => setChatState('express_confirm')}>Confirm Air Express Tomorrow (Before 12 PM)</button>
                              <button className="chat-btn" onClick={() => setChatState('cancelled_confirm')}>Proceed with Cancellation</button>
                            </div>
                          )}
                          
                          {chatState === 'express_confirm' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                Confirm Air Express Tomorrow
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                ⚡ AIR EXPRESS LOCKED • SLOT: 9 AM - 12 PM
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                Confirmed! Your order has been prioritized in tomorrow's morning delivery slot. Tracking updates will be sent via SMS.
                              </motion.div>
                            </>
                          )}

                          {chatState === 'cancelled_confirm' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                Proceed with Cancellation
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#fee2e2', color: '#991b1b'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                🔴 ORDER CANCELLED — RTO RETURN INITIATED
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                Understood. Your cancellation request has been processed. We hope to serve you again soon!
                              </motion.div>
                            </>
                          )}
                        </>
                      )}

                      {/* BRANCH C: Change Location */}
                      {cancelReason === 'address' && (
                        <>
                          <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                            Want to change delivery location.
                          </motion.div>
                          <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                            ⚡ SMART ADDRESS CORRECTION INITIATED
                          </motion.div>
                          <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                            No problem! Share your Google Maps location pin or type your full address & landmark so the driver reaches you directly.
                          </motion.div>
                          
                          {chatState === 'initial' && (
                            <div className="chat-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <button className="chat-btn primary" onClick={() => setChatState('both_step1_prompt')}>
                                ⭐ 📍+✏️ Both Location Pin & Text Address (Recommended)
                              </button>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button className="chat-btn" style={{ flex: 1 }} onClick={() => setChatState('gps_shared')}>📍 Location Pin Only</button>
                                <button className="chat-btn" style={{ flex: 1 }} onClick={() => setChatState('landmark_updated')}>✏️ Text Address Only</button>
                              </div>
                            </div>
                          )}

                          {chatState === 'both_step1_prompt' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                Selected Option: 📍+✏️ Both Location Pin & Text Address
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                📍 <strong>Step 1 of 2:</strong> First, please tap below to share your Google Maps Location Pin.
                              </motion.div>
                              <div className="chat-actions" style={{ marginTop: '0.5rem' }}>
                                <button className="chat-btn primary" onClick={() => setChatState('both_step2_prompt')}>
                                  📍 Send Location Pin (28.5355° N, 77.3910° E)
                                </button>
                              </div>
                            </>
                          )}

                          {chatState === 'both_step2_prompt' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                📍 Shared Location Pin (28.5355° N, 77.3910° E)
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                📍 STEP 1/2: GPS PIN LOCKED (Green Park, Sector 12)
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                ✏️ <strong>Step 2 of 2:</strong> Location pin received! Now, please type your floor, tower, room number, or landmark so the driver knows your exact door.
                              </motion.div>
                              <div className="chat-actions" style={{ marginTop: '0.5rem' }}>
                                <button className="chat-btn primary" onClick={() => setChatState('both_completed')}>
                                  ✏️ Type Text: "4th Floor, A Tower, Room 401"
                                </button>
                              </div>
                            </>
                          )}

                          {chatState === 'both_completed' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                📍 Shared Pin + 🏢 4th Floor, A Tower, Room 401
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                ✅ BOTH GPS PIN & ENRICHED TEXT ADDRESS SYNCED TO DRIVER APP
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                Awesome! Both your Google Maps GPS pin and specific building details (4th Floor, A Tower, Room 401) have been pushed to the driver app for tomorrow's delivery re-attempt.
                              </motion.div>
                            </>
                          )}

                          {chatState === 'gps_shared' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                📍 Shared Live GPS Location (28.5355° N, 77.3910° E)
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                ✅ GPS PIN SYNCED TO DRIVER APP (5km Radius Verified)
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                Location locked! Your GPS pin has been pushed directly into the Delhivery Last-Mile Driver App for tomorrow morning's re-attempt.
                              </motion.div>
                            </>
                          )}

                          {chatState === 'landmark_updated' && (
                            <>
                              <motion.div className="chat-bubble user" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}}>
                                Updated Landmark: 4th Floor, A Tower, Room 401
                              </motion.div>
                              <motion.div className="chat-banner" style={{background: '#d1fae5', color: '#065f46'}} initial={{opacity: 0}} animate={{opacity: 1}}>
                                ✅ DESTINATION ADDRESS UPDATED ON WAYBILL
                              </motion.div>
                              <motion.div className="chat-bubble bot" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}}>
                                Address updated! The courier waybill has been updated for tomorrow morning's re-attempt.
                              </motion.div>
                            </>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 7. Dynamic Volume Scale Calculator */}
      <section className="calc-section" id="calculator">
        <h2 className="section-title">Calculate Your Savings</h2>
        <p className="section-subtitle">See how much revenue you can rescue every month.</p>
        
        <motion.div 
          className="calc-box"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center'}}>
            <span style={{fontSize: '1rem', color: 'var(--text-secondary)'}}>Monthly Order Volume</span>
            <strong style={{fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-mono)'}}>
              <AnimatedCounter value={orderVolume} suffix=" Orders" />
            </strong>
          </div>
          <div className="slider-container">
            <input 
              type="range" 
              className="volume-slider"
              min="1000" 
              max="100000" 
              step="1000"
              value={orderVolume} 
              onChange={(e) => setOrderVolume(Number(e.target.value))} 
            />
          </div>
          
          <div className="calc-results">
            <motion.div 
              className="result-item"
              whileHover={{ scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="result-value">
                <AnimatedCounter value={Math.round(savedRevenue)} prefix="₹" />
              </div>
              <div className="result-label">Monthly Revenue Rescued</div>
            </motion.div>

            <motion.div 
              className="result-item"
              whileHover={{ scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="result-value">
                <AnimatedCounter value={roiMultiplier} suffix="x" />
              </div>
              <div className="result-label">Estimated ROI</div>
            </motion.div>

            <motion.div 
              className="result-item"
              whileHover={{ scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="result-value">
                <AnimatedCounter value={60} suffix="%" />
              </div>
              <div className="result-label">RTO Reduction Rate</div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* 8. Technical & Anti-Misuse Guardrails */}
      <section className="guardrails-section" id="guardrails">
        <h2 className="section-title">Enterprise Guardrails</h2>
        <p className="section-subtitle">Built for reliability and anti-exploitation.</p>
        
        <div className="guardrails-grid">
          {[
            {icon: '🔗', title: 'Direct API Sync', desc: 'Push precise Lat/Long to courier apps directly.'},
            {icon: '📍', title: 'Pincode Locking', desc: 'Updates locked within a 5km radius to prevent fraud.'},
            {icon: '🚫', title: '1-Update Cap', desc: 'Prevents spamming the delivery agent with location changes.'},
            {icon: '🔐', title: 'Encrypted Tokens', desc: 'Secure WhatsApp verification via Meta Cloud API.'}
          ].map((item, i) => (
            <motion.div 
              key={i}
              className="guardrail-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="guardrail-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p style={{color: 'var(--text-secondary)'}}>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 9. Testimonials */}
      <section className="testimonials-section">
        <h2 className="section-title">What Founders Say</h2>
        
        <div className="testimonials-grid">
          {[
            {quote: "RescueShip dropped our RTO from 18% to 6%. It practically pays for itself on day 2 of the month.", author: "Neha S.", role: "Founder, D2C Apparel"},
            {quote: "The UPI retention bot is magical. We are recovering 20% of cancelled orders effortlessly.", author: "Rahul M.", role: "Head of Ops, Electronics Brand"},
            {quote: "Intercepting fake remarks in real-time changed the game for our last-mile logistics.", author: "Anjali K.", role: "CEO, Wellness Brand"}
          ].map((item, i) => (
            <motion.div 
              key={i}
              className="testimonial-card"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="quote">"{item.quote}"</p>
              <div className="author">
                <div className="author-avatar"></div>
                <div>
                  <strong>{item.author}</strong>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{item.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 10. Transparent Pricing Section */}
      <section className="pricing-section" id="pricing">
        <h2 className="section-title">Transparent Pricing</h2>
        <p className="section-subtitle">No hidden fees. Scale as you grow.</p>
        
        <div className="pricing-toggle">
          <span style={{color: !isAnnual ? '#fff' : 'var(--text-secondary)'}}>Monthly</span>
          <div 
            style={{
              width: '50px', height: '26px', background: 'var(--primary)', 
              borderRadius: '13px', position: 'relative', cursor: 'pointer'
            }}
            onClick={() => setIsAnnual(!isAnnual)}
          >
            <motion.div 
              style={{
                width: '22px', height: '22px', background: '#fff', borderRadius: '50%',
                position: 'absolute', top: '2px'
              }}
              animate={{ left: isAnnual ? '26px' : '2px' }}
            />
          </div>
          <span style={{color: isAnnual ? '#fff' : 'var(--text-secondary)'}}>Annual (Save 30%)</span>
        </div>

        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Starter</h3>
            <div className="price">₹{isAnnual ? '1,119' : '1,599'}<span>/mo</span></div>
            <p style={{color: 'var(--text-secondary)'}}>Perfect for early-stage D2C brands</p>
            <Link to="/register"><button className="hero-btn-secondary" style={{width: '100%', marginTop: '1rem'}}>Get Started</button></Link>
            <ul className="features-list">
              <li>Up to 2,000 orders/mo</li>
              <li>Smart Address Correction (Text, Pin, Both)</li>
              <li>Fake Remark Detection</li>
              <li>Shiprocket & Delhivery Integrations</li>
              <li>Email Support (24h SLA)</li>
            </ul>
          </div>
          
          <div className="pricing-card popular">
            <div className="pricing-badge">MOST POPULAR</div>
            <h3>Growth</h3>
            <div className="price">₹{isAnnual ? '2,799' : '3,999'}<span>/mo</span></div>
            <p style={{color: 'var(--text-secondary)'}}>For scaling D2C brands</p>
            <Link to="/register"><button className="hero-btn-primary" style={{width: '100%', marginTop: '1rem'}}>Get Started</button></Link>
            <ul className="features-list">
              <li>Up to 10,000 orders/mo</li>
              <li>UPI QR Payment Link Generation</li>
              <li>Seller Payment WhatsApp Alerts</li>
              <li>ClickPost Integration</li>
              <li>Priority Support (12h SLA)</li>
            </ul>
          </div>
          
          <div className="pricing-card">
            <h3>Scale</h3>
            <div className="price">₹{isAnnual ? '6,999' : '9,999'}<span>/mo</span></div>
            <p style={{color: 'var(--text-secondary)'}}>High-volume logistics operations</p>
            <Link to="/register"><button className="hero-btn-secondary" style={{width: '100%', marginTop: '1rem'}}>Get Started</button></Link>
            <ul className="features-list">
              <li>Up to 50,000 orders/mo</li>
              <li>Custom Carrier API Integration</li>
              <li>CSV Data Exports</li>
              <li>99.5% Uptime SLA Guarantee</li>
            </ul>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            Compare All Features in Detail →
          </button>
        </div>
      </section>

      {/* 11. CTA Banner & Footer */}
      <section className="cta-banner">
        <h2 className="section-title">Protect Your Profit Margins Today</h2>
        <p className="section-subtitle">Join 500+ D2C brands successfully reducing RTOs.</p>
        <Link to="/register"><button className="hero-btn-primary">Start Rescuing Revenue</button></Link>
      </section>
      
      <footer className="footer">
        <div className="footer-links">
          <a href="#">Terms of Service</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Help Center</a>
          <a href="mailto:support@rescueship.io">Contact Support</a>
        </div>
        <div>© 2026 RescueShip Inc. All rights reserved.</div>
      </footer>

      <PricingComparisonModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
