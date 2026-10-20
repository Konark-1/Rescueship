import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from 'motion/react';
import {
  MapPin,
  CheckCheck,
  ShieldCheck,
  Navigation,
  Phone,
  Video,
  ChevronLeft,
  Sparkles,
  RotateCcw,
  Lock,
  Wifi,
  BatteryCharging,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user' | 'system';
  text: string;
  time: string;
  isLocationPin?: boolean;
}

type FlowStage =
  | 'STAGE_1_PRE_DELIVERY'
  | 'STAGE_1_PIN_PROMPT'
  | 'STAGE_2_NDR_HIT'
  | 'STAGE_2_CANCEL_SAVE'
  | 'STAGE_2_PIN_PROMPT'
  | 'STAGE_3_COMPLETED_PIN'
  | 'STAGE_3_COMPLETED_SKIP';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'sys-1',
    sender: 'system',
    text: 'Today · Automated E2E Parcel Lifecycle',
    time: '09:15 AM',
  },
  {
    id: 'msg-pre-1',
    sender: 'bot',
    text: '🚚 *Out for Delivery:* Your order *AWB #4023118876* (COD ₹1,240) is out with Delhivery today.\n\nConfirm availability or convert to Prepaid UPI now for ₹50 instant off:',
    time: '09:15 AM',
  },
];

export const FoldfolioShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Scroll-driven states
  const [notifVisible, setNotifVisible] = useState(false);
  const [isUnfolded, setIsUnfolded] = useState(false);
  const [appOpened, setAppOpened] = useState(false);

  // Sequential lifecycle state
  const [stage, setStage] = useState<FlowStage>('STAGE_1_PRE_DELIVERY');
  const [activePathLabel, setActivePathLabel] = useState<'PRE_DELIVERY' | 'NDR_INTERCEPT'>('PRE_DELIVERY');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  // Smooth 3D transforms for unfolding cover
  const coverRotateY = useTransform(scrollYProgress, [0.22, 0.55], [0, -180]);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (latest >= 0.06) {
      setNotifVisible(true);
    } else {
      setNotifVisible(false);
    }

    if (latest >= 0.36) {
      setIsUnfolded(true);
    } else {
      setIsUnfolded(false);
      setAppOpened(false);
    }
  });

  // Auto-scroll WhatsApp messages container cleanly without page jump
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, stage, appOpened]);

  const appendMessages = (newMsgs: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMsgs]);
  };

  // --- SEQUENTIAL FLOW HANDLERS ---

  // Path A: Pre-Delivery UPI Paid -> Ask for Address Pin + Skip
  const handlePreDeliveryUpi = () => {
    setActivePathLabel('PRE_DELIVERY');
    appendMessages([
      {
        id: `u-upi-${Date.now()}`,
        sender: 'user',
        text: '💳 Pay ₹1,190 via UPI (Save ₹50)',
        time: '09:16 AM',
      },
      {
        id: `b-upi-${Date.now()}`,
        sender: 'bot',
        text: '✅ *UPI Payment Received (₹1,190).* Parcel converted to Priority Prepaid.\n\n📍 *Final Step:* Drop your WhatsApp Location Pin so the rider reaches your exact gate on the first attempt, or skip to use your saved address:',
        time: '09:16 AM',
      },
    ]);
    setStage('STAGE_1_PIN_PROMPT');
  };

  // Path B: Buyer keeps COD -> Advances sequentially to Afternoon NDR Hit
  const handleContinueToNdr = () => {
    setActivePathLabel('NDR_INTERCEPT');
    appendMessages([
      {
        id: `u-cod-${Date.now()}`,
        sender: 'user',
        text: '🚚 Keep COD — Deliver Today',
        time: '09:16 AM',
      },
      {
        id: `sys-ndr-${Date.now()}`,
        sender: 'system',
        text: '⚡ 02:47 PM · Delhivery Rider Logged "Door Locked" (1.42 km from gate)',
        time: '02:47 PM',
      },
      {
        id: `b-ndr-${Date.now()}`,
        sender: 'bot',
        text: '⚠️ *Fake Attempt Intercepted (38s):* Our courier agent just marked *AWB #4023118876* as *"Customer Unavailable / Door Locked"* from 1.42 km away with 0 calls.\n\nAre you available to receive your parcel?',
        time: '02:47 PM',
      },
    ]);
    setStage('STAGE_2_NDR_HIT');
  };

  // In NDR Hit: Buyer confirms availability -> Ask for Address Pin + Skip
  const handleNdrConfirmAvailable = () => {
    setActivePathLabel('NDR_INTERCEPT');
    appendMessages([
      {
        id: `u-here-${Date.now()}`,
        sender: 'user',
        text: "🏠 I'm Home — Rider Never Knocked",
        time: '02:48 PM',
      },
      {
        id: `b-pin-req-${Date.now()}`,
        sender: 'bot',
        text: '🛡️ *Free Priority Re-Attempt Unlocked.* (Zero extra cost).\n\n📍 *Final Step:* Share your live WhatsApp Location Pin so we inject your gate landmark into the courier NDR API & text the Google Maps link directly to the rider—or skip to keep your existing address:',
        time: '02:48 PM',
      },
    ]);
    setStage('STAGE_2_PIN_PROMPT');
  };

  // In NDR Hit: Buyer clicks Cancel Order -> 1-Shot ₹100 UPI Payment-Gated Save
  const handleBuyerCancelOrder = () => {
    setActivePathLabel('NDR_INTERCEPT');
    appendMessages([
      {
        id: `u-cancel-${Date.now()}`,
        sender: 'user',
        text: '❌ Cancel Order',
        time: '02:48 PM',
      },
      {
        id: `b-save-${Date.now()}`,
        sender: 'bot',
        text: 'We understand! Before we release the parcel back to warehouse, claim a *1-Shot ₹100 Instant UPI Discount* (Pay *₹1,140* instead of ₹1,240 within 2 hrs to hold your parcel for priority delivery):',
        time: '02:48 PM',
      },
    ]);
    setStage('STAGE_2_CANCEL_SAVE');
  };

  // Buyer accepts 1-shot UPI Save -> Ask for Final Address Pin + Skip
  const handleAcceptCancelUpiSave = () => {
    appendMessages([
      {
        id: `u-save-upi-${Date.now()}`,
        sender: 'user',
        text: '⚡ Claim ₹100 Off via Instant UPI (₹1,140)',
        time: '02:49 PM',
      },
      {
        id: `b-save-pin-${Date.now()}`,
        sender: 'bot',
        text: '✅ *₹1,140 UPI Verified!* Cancellation reversed & ₹430 RTO bleed prevented.\n\n📍 *Final Step:* Share your WhatsApp Location Pin for the priority re-attempt, or skip to use your saved address:',
        time: '02:49 PM',
      },
    ]);
    setStage('STAGE_2_PIN_PROMPT');
  };

  // Final Step Option 1 (Both Pre-Delivery & NDR): Share WhatsApp Location Pin
  const handleShareLocationPin = () => {
    appendMessages([
      {
        id: `u-pin-${Date.now()}`,
        sender: 'user',
        text: '📍 Shared Live Location Pin\n28.5355° N, 77.3910° E · Gate 2, Sector 62, Noida',
        time: '02:49 PM',
        isLocationPin: true,
      },
      {
        id: `b-done-pin-${Date.now()}`,
        sender: 'bot',
        text: '✓ *Re-Delivery Locked & GPS Pin Dispatched!*\n• Reverse-geocoded gate note injected into Delhivery NDR API\n• Google Maps link (maps.google.com/?q=28.5355,77.3910) sent via SMS to field agent\n• *₹430 RTO Bleed Saved*',
        time: '02:49 PM',
      },
    ]);
    setStage('STAGE_3_COMPLETED_PIN');
  };

  // Final Step Option 2 (Both Pre-Delivery & NDR): Skip Pin
  const handleSkipLocationPin = () => {
    appendMessages([
      {
        id: `u-skip-${Date.now()}`,
        sender: 'user',
        text: '⏭️ Skip — Use Existing Saved Address',
        time: '02:49 PM',
      },
      {
        id: `b-done-skip-${Date.now()}`,
        sender: 'bot',
        text: '✓ *Re-Delivery Locked with Saved Address!*\n• Buyer confirmation logged in courier NDR API\n• Priority re-attempt scheduled without requiring GPS pin\n• *₹430 RTO Bleed Saved*',
        time: '02:49 PM',
      },
    ]);
    setStage('STAGE_3_COMPLETED_SKIP');
  };

  // Quick Reset / Jump helper so visitors can test both branches anytime
  const handleResetFlow = (startAtNdr = false) => {
    if (!startAtNdr) {
      setMessages(INITIAL_MESSAGES);
      setActivePathLabel('PRE_DELIVERY');
      setStage('STAGE_1_PRE_DELIVERY');
    } else {
      setActivePathLabel('NDR_INTERCEPT');
      setMessages([
        ...INITIAL_MESSAGES,
        {
          id: 'u-cod-jump',
          sender: 'user',
          text: '🚚 Keep COD — Deliver Today',
          time: '09:16 AM',
        },
        {
          id: 'sys-ndr-jump',
          sender: 'system',
          text: '⚡ 02:47 PM · Delhivery Rider Logged "Door Locked" (1.42 km from gate)',
          time: '02:47 PM',
        },
        {
          id: 'b-ndr-jump',
          sender: 'bot',
          text: '⚠️ *Fake Attempt Intercepted (38s):* Our courier agent just marked *AWB #4023118876* as *"Customer Unavailable / Door Locked"* from 1.42 km away with 0 calls.\n\nAre you available to receive your parcel?',
          time: '02:47 PM',
        },
      ]);
      setStage('STAGE_2_NDR_HIT');
    }
  };

  return (
    <section
      ref={containerRef}
      id="foldfolio-demo"
      className="rs-fold-track"
      aria-label="Interactive Foldable iPhone WhatsApp Rescue Demo"
    >
      <div className="rs-fold-sticky">
        {/* Top Section Header */}
        <div className="rs-fold-header">
          <div className="rs-fold-header__meta">
            <span className="rs-fold-kicker">INTERACTIVE DEVICE DEMO · iOS DUO</span>
            <h2 className="rs-fold-title">
              Scroll to unfold. <em>Tap WhatsApp to rescue the order.</em>
            </h2>
          </div>

          {/* Interactive Stage Switcher Pills */}
          <div className="rs-fold-controls">
            <button
              type="button"
              className={`rs-fold-chip ${!isUnfolded ? 'is-active' : ''}`}
              onClick={() => {
                setIsUnfolded(false);
                setAppOpened(false);
                setNotifVisible(true);
              }}
            >
              1. Cover Notification
            </button>
            <button
              type="button"
              className={`rs-fold-chip ${isUnfolded && !appOpened ? 'is-active' : ''}`}
              onClick={() => {
                setIsUnfolded(true);
                setAppOpened(false);
              }}
            >
              2. Unfolded Home (1)
            </button>
            <button
              type="button"
              className={`rs-fold-chip ${appOpened ? 'is-active' : ''}`}
              onClick={() => {
                setIsUnfolded(true);
                setAppOpened(true);
              }}
            >
              3. Live WhatsApp Chat
            </button>
          </div>
        </div>

        {/* Center 3D Hardware Stage */}
        <div className="rs-fold-stage">
          <AnimatePresence mode="wait">
            {!isUnfolded ? (
              /* =========================================================
                 STATE 1: CLOSED FOLDABLE IPHONE COVER SCREEN + NOTIFICATION
                 ========================================================= */
              <motion.div
                key="closed-cover"
                className="rs-iphone-cover"
                initial={{ opacity: 0, scale: 0.94, rotateY: -12 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.96, rotateY: -65 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{ rotateY: coverRotateY }}
              >
                {/* iOS Dynamic Island & Status Bar */}
                <div className="rs-ios-statusbar">
                  <span className="rs-ios-time">14:47</span>
                  <div className="rs-dynamic-island">
                    <span className="rs-island-cam" />
                  </div>
                  <div className="rs-ios-StatusIcons">
                    <Wifi size={13} />
                    <BatteryCharging size={14} />
                  </div>
                </div>

                {/* iOS Lock Screen Clock */}
                <div className="rs-lockscreen-clock">
                  <div className="rs-lockscreen-date">
                    <Lock size={12} /> Tuesday, 20 October
                  </div>
                  <div className="rs-lockscreen-digits">02:47</div>
                </div>

                {/* Scroll-Triggered iOS WhatsApp Push Notification */}
                <AnimatePresence>
                  {notifVisible && (
                    <motion.button
                      type="button"
                      className="rs-ios-notif"
                      initial={{ opacity: 0, y: -28, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                      onClick={() => {
                        setIsUnfolded(true);
                        setAppOpened(true);
                      }}
                    >
                      <div className="rs-ios-notif__icon">
                        <span>WA</span>
                        <span className="rs-ios-notif__badge">1</span>
                      </div>
                      <div className="rs-ios-notif__body">
                        <div className="rs-ios-notif__row">
                          <strong>RescueShip Delivery Support ✓</strong>
                          <span>now</span>
                        </div>
                        <p>
                          🚚 AWB #4023118876: Pre-delivery & NDR protection active. Tap to open chat.
                        </p>
                      </div>
                    </motion.button>
                  )}
                </AnimatePresence>

                <div className="rs-cover-footer">
                  <span>Keep scrolling to unfold iPhone Duo →</span>
                  <div className="rs-ios-homebar" />
                </div>
              </motion.div>
            ) : (
              /* =========================================================
                 STATE 2 & 3: UNFOLDED IPHONE DUO (HOME SCREEN -> WHATSAPP)
                 ========================================================= */
              <motion.div
                key="unfolded-duo"
                className="rs-iphone-duo"
                initial={{ opacity: 0, scale: 0.92, rotateX: 8 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Center Foldable Hinge Crease */}
                <div className="rs-duo-hinge" aria-hidden="true" />

                {/* Top Unfolded Status Bar */}
                <div className="rs-ios-statusbar rs-ios-statusbar--duo">
                  <span className="rs-ios-time">14:48 · 5G</span>
                  <div className="rs-dynamic-island">
                    <span className="rs-island-cam" />
                  </div>
                  <div className="rs-ios-StatusIcons">
                    <span>98%</span>
                    <Wifi size={13} />
                    <BatteryCharging size={15} />
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {!appOpened ? (
                    /* -----------------------------------------------------
                       SUB-STATE 2A: UNFOLDED iOS HOME SCREEN WITH WA (1)
                       ----------------------------------------------------- */
                    <motion.div
                      key="duo-homescreen"
                      className="rs-duo-homescreen"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.08, filter: 'blur(4px)' }}
                      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {/* Top Notification Banner on Unfolded Home Screen */}
                      <motion.div
                        className="rs-home-banner"
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.12 }}
                        onClick={() => setAppOpened(true)}
                      >
                        <div className="rs-home-banner__left">
                          <span className="rs-wa-mini-icon">WA</span>
                          <div>
                            <strong>RescueShip Delivery Support ✓</strong>
                            <p>1 unread message · Tap WhatsApp icon below to launch live chat</p>
                          </div>
                        </div>
                        <span className="rs-home-banner__cta">Open →</span>
                      </motion.div>

                      {/* Center Interactive WhatsApp App Icon with Red (1) Badge */}
                      <div className="rs-home-grid">
                        <div className="rs-app-tile rs-app-tile--muted">
                          <div className="rs-app-icon rs-app-icon--maps">
                            <Navigation size={24} />
                          </div>
                          <span>Maps</span>
                        </div>

                        <motion.button
                          type="button"
                          className="rs-app-tile rs-app-tile--whatsapp"
                          whileHover={{ scale: 1.06 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => setAppOpened(true)}
                          aria-label="Open WhatsApp with 1 unread notification from RescueShip"
                        >
                          <div className="rs-app-icon rs-app-icon--wa">
                            <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                            </svg>
                            <span className="rs-app-badge">1</span>
                          </div>
                          <span className="rs-app-label">WhatsApp</span>
                        </motion.button>

                        <div className="rs-app-tile rs-app-tile--muted">
                          <div className="rs-app-icon rs-app-icon--shield">
                            <ShieldCheck size={24} />
                          </div>
                          <span>Delhivery</span>
                        </div>
                      </div>

                      <div className="rs-home-prompt">
                        <Sparkles size={14} /> Click the <strong>WhatsApp (1)</strong> icon to launch the sequential rescue chat
                      </div>
                    </motion.div>
                  ) : (
                    /* -----------------------------------------------------
                       SUB-STATE 2B: AUTHENTIC DUAL-PANE WHATSAPP + TELEMETRY
                       ----------------------------------------------------- */
                    <motion.div
                      key="duo-whatsapp-open"
                      className="rs-duo-split"
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {/* LEFT PANE: Authentic iOS WhatsApp Chat Interface */}
                      <div className="rs-wa-pane">
                        {/* WhatsApp Top Bar */}
                        <div className="rs-wa-header">
                          <button
                            type="button"
                            className="rs-wa-back"
                            onClick={() => setAppOpened(false)}
                            title="Back to iOS Home Screen"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <div className="rs-wa-avatar">RS</div>
                          <div className="rs-wa-contact">
                            <div className="rs-wa-contact__name">
                              RescueShip Delivery Support <span className="rs-wa-verified">✓</span>
                            </div>
                            <div className="rs-wa-contact__sub">
                              Official Business Account · Automated 90s SLA
                            </div>
                          </div>
                          <div className="rs-wa-actions">
                            <Video size={16} />
                            <Phone size={15} />
                          </div>
                        </div>

                        {/* Quick Jump Bar inside Chat Header (Sequential Progress) */}
                        <div className="rs-wa-progress-bar">
                          <button
                            type="button"
                            className={`rs-wa-step-pill ${activePathLabel === 'PRE_DELIVERY' ? 'is-active' : ''}`}
                            onClick={() => handleResetFlow(false)}
                          >
                            1. Pre-Delivery
                          </button>
                          <span className="rs-wa-step-arrow">→</span>
                          <button
                            type="button"
                            className={`rs-wa-step-pill ${activePathLabel === 'NDR_INTERCEPT' ? 'is-active' : ''}`}
                            onClick={() => handleResetFlow(true)}
                          >
                            2. NDR Hit
                          </button>
                          <span className="rs-wa-step-arrow">→</span>
                          <span
                            className={`rs-wa-step-pill ${
                              stage.includes('PIN_PROMPT') || stage.includes('COMPLETED')
                                ? 'is-active'
                                : ''
                            }`}
                          >
                            3. GPS Pin / Skip
                          </span>
                        </div>

                        {/* Scrollable Chat Wallpaper Area */}
                        <div ref={chatScrollRef} className="rs-wa-messages">
                          {messages.map((m) => {
                            if (m.sender === 'system') {
                              return (
                                <div key={m.id} className="rs-wa-sys-pill">
                                  {m.text}
                                </div>
                              );
                            }
                            const isUser = m.sender === 'user';
                            return (
                              <motion.div
                                key={m.id}
                                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.22 }}
                                className={`rs-wa-bubble ${
                                  isUser ? 'rs-wa-bubble--user' : 'rs-wa-bubble--bot'
                                }`}
                              >
                                {m.isLocationPin && (
                                  <div className="rs-wa-map-card">
                                    <MapPin size={16} />
                                    <span>Live GPS Pin · 28.5355° N, 77.3910° E (Gate 2)</span>
                                  </div>
                                )}
                                <p className="rs-wa-bubble__text">{m.text}</p>
                                <div className="rs-wa-bubble__meta">
                                  <span>{m.time}</span>
                                  {isUser && <CheckCheck size={14} className="rs-wa-ticks" />}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        {/* Interactive Bottom Action Tray (Sequential Choices + Final Pin/Skip) */}
                        <div className="rs-wa-tray">
                          {stage === 'STAGE_1_PRE_DELIVERY' && (
                            <div className="rs-wa-btn-group">
                              <button
                                type="button"
                                className="rs-wa-action-btn rs-wa-action-btn--primary"
                                onClick={handlePreDeliveryUpi}
                              >
                                💳 Pay ₹1,190 via UPI (Pre-Delivery Path)
                              </button>
                              <button
                                type="button"
                                className="rs-wa-action-btn"
                                onClick={handleContinueToNdr}
                              >
                                🚚 Keep COD → Simulate Afternoon NDR Hit
                              </button>
                            </div>
                          )}

                          {stage === 'STAGE_2_NDR_HIT' && (
                            <div className="rs-wa-btn-group">
                              <button
                                type="button"
                                className="rs-wa-action-btn rs-wa-action-btn--primary"
                                onClick={handleNdrConfirmAvailable}
                              >
                                🏠 I'm Home — Lock Free Priority Re-Attempt
                              </button>
                              <button
                                type="button"
                                className="rs-wa-action-btn rs-wa-action-btn--danger"
                                onClick={handleBuyerCancelOrder}
                              >
                                ❌ Cancel Order (Triggers ₹100 UPI Save)
                              </button>
                            </div>
                          )}

                          {stage === 'STAGE_2_CANCEL_SAVE' && (
                            <div className="rs-wa-btn-group">
                              <button
                                type="button"
                                className="rs-wa-action-btn rs-wa-action-btn--primary"
                                onClick={handleAcceptCancelUpiSave}
                              >
                                ⚡ Pay ₹1,140 via Instant UPI (Save ₹100 Now)
                              </button>
                              <button
                                type="button"
                                className="rs-wa-action-btn"
                                onClick={handleNdrConfirmAvailable}
                              >
                                🏠 Or Keep COD & Confirm Re-Attempt
                              </button>
                            </div>
                          )}

                          {(stage === 'STAGE_1_PIN_PROMPT' || stage === 'STAGE_2_PIN_PROMPT') && (
                            <div className="rs-wa-btn-group">
                              <button
                                type="button"
                                className="rs-wa-action-btn rs-wa-action-btn--emerald"
                                onClick={handleShareLocationPin}
                              >
                                📍 Share WhatsApp Location Pin
                              </button>
                              <button
                                type="button"
                                className="rs-wa-action-btn"
                                onClick={handleSkipLocationPin}
                              >
                                ⏭️ Skip — Use Existing Address
                              </button>
                            </div>
                          )}

                          {(stage === 'STAGE_3_COMPLETED_PIN' ||
                            stage === 'STAGE_3_COMPLETED_SKIP') && (
                            <div className="rs-wa-btn-group rs-wa-btn-group--row">
                              <button
                                type="button"
                                className="rs-wa-action-btn"
                                onClick={() => handleResetFlow(false)}
                              >
                                <RotateCcw size={13} /> Replay from Pre-Delivery
                              </button>
                              <button
                                type="button"
                                className="rs-wa-action-btn"
                                onClick={() => handleResetFlow(true)}
                              >
                                <RotateCcw size={13} /> Replay from NDR Hit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RIGHT PANE: Real-Time Courier API & Field-Agent Dispatch Telemetry */}
                      <div className="rs-telemetry-pane">
                        <div className="rs-telemetry-card">
                          <div className="rs-telemetry-card__top">
                            <span className="rs-telemetry-tag">LIVE COURIER API STATE</span>
                            <span className="rs-telemetry-awb">AWB #4023118876</span>
                          </div>

                          <h3 className="rs-telemetry-heading">
                            {stage === 'STAGE_1_PRE_DELIVERY' && 'Morning Pre-Delivery Check Dispatched'}
                            {stage === 'STAGE_1_PIN_PROMPT' && 'Prepaid Converted · Awaiting Gate Pin or Skip'}
                            {stage === 'STAGE_2_NDR_HIT' && 'Fake "Door Locked" Scan Intercepted (1.42 km)'}
                            {stage === 'STAGE_2_CANCEL_SAVE' && '1-Shot ₹100 UPI Cancellation Rescue Active'}
                            {stage === 'STAGE_2_PIN_PROMPT' && 'Re-Attempt Unlocked · Requesting Location Pin'}
                            {stage === 'STAGE_3_COMPLETED_PIN' && '✓ GPS Pin Injected & Dispatched to Field Agent'}
                            {stage === 'STAGE_3_COMPLETED_SKIP' && '✓ Re-Delivery Locked with Saved Address'}
                          </h3>

                          <div className="rs-telemetry-steps">
                            <div className="rs-t-step is-done">
                              <span className="rs-t-dot" />
                              <div>
                                <strong>1. Pre-Delivery & NDR Webhook</strong>
                                <p>
                                  {activePathLabel === 'PRE_DELIVERY'
                                    ? 'Pre-delivery UPI conversion completed before rider dispatch.'
                                    : 'Delhivery NDR scan intercepted in 38s (1.42 km drift, 0 IVR calls).'}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`rs-t-step ${
                                stage.includes('PIN_PROMPT') || stage.includes('COMPLETED')
                                  ? 'is-done'
                                  : ''
                              }`}
                            >
                              <span className="rs-t-dot" />
                              <div>
                                <strong>2. Buyer Decision Captured</strong>
                                <p>
                                  {stage.includes('PIN_PROMPT') || stage.includes('COMPLETED')
                                    ? 'Buyer verified availability inside native WhatsApp chat.'
                                    : 'Waiting for buyer tap inside WhatsApp conversation...'}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`rs-t-step ${
                                stage.includes('COMPLETED') ? 'is-done' : ''
                              }`}
                            >
                              <span className="rs-t-dot" />
                              <div>
                                <strong>3. Final Address Pin / Skip Resolution</strong>
                                <p>
                                  {stage === 'STAGE_3_COMPLETED_PIN' &&
                                    'Landmark injected into Shiprocket/Delhivery NDR API + Google Maps SMS sent to rider.'}
                                  {stage === 'STAGE_3_COMPLETED_SKIP' &&
                                    'Buyer skipped GPS pin; priority re-attempt locked using verified address on file.'}
                                  {!stage.includes('COMPLETED') &&
                                    'Final step asks buyer for live GPS Pin alongside a Skip button.'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rs-telemetry-footer">
                            <div>
                              <span>BLEED PREVENTED</span>
                              <strong>₹430 / Parcel</strong>
                            </div>
                            <div>
                              <span>COURIER SYNC</span>
                              <strong>&lt; 90s SLA</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="rs-ios-homebar rs-ios-homebar--duo" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
