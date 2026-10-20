import React, { useState, useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useMotionValueEvent,
  AnimatePresence,
} from 'motion/react';
import {
  MapPin,
  CheckCheck,
  ShieldCheck,
  Navigation,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Video,
  ChevronLeft,
  Sparkles,
  RotateCcw,
  Lock,
  Wifi,
  BatteryCharging,
  Layers,
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

type DevicePosture = 'cover' | 'unfolded-home' | 'whatsapp-duo' | 'rider-call';
type HardwareFinish = 'titanium' | 'graphite' | 'vermilion' | 'emerald';

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

  // Single source of truth for device posture -> NEVER allows 2 buttons active at once!
  const [posture, setPosture] = useState<DevicePosture>('cover');
  const [userLockedPosture, setUserLockedPosture] = useState(false);
  const [finish, setFinish] = useState<HardwareFinish>('titanium');

  // Subtle 3D tilt (max ±4deg so text is NEVER squished or foreshortened)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 30 });

  // Sequential lifecycle state
  const [stage, setStage] = useState<FlowStage>('STAGE_1_PRE_DELIVERY');
  const [activePathLabel, setActivePathLabel] = useState<'PRE_DELIVERY' | 'NDR_INTERCEPT'>(
    'PRE_DELIVERY'
  );
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  // Scroll progression cleanly steps through the postures unless user clicked into interactive WhatsApp
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (userLockedPosture && posture === 'whatsapp-duo') return;

    if (p < 0.26) {
      setPosture('cover');
    } else if (p < 0.62) {
      setPosture('unfolded-home');
    } else if (p < 0.88) {
      setPosture('whatsapp-duo');
    } else {
      setPosture('rider-call');
    }
  });

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-ny * 5).toFixed(2)),
      ry: Number((nx * 6).toFixed(2)),
      gx: Math.round((nx + 0.5) * 100),
      gy: Math.round((ny + 0.5) * 100),
    });
  };

  const handleStageMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 30 });
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, stage, posture]);

  const appendMessages = (newMsgs: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMsgs]);
  };

  // --- SEQUENTIAL LIFECYCLE HANDLERS ---
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

  const isDualScreen = posture === 'unfolded-home' || posture === 'whatsapp-duo';

  return (
    <section
      ref={containerRef}
      id="foldfolio-demo"
      className="rs-duo-track"
      aria-label="Interactive iPhone Duo Foldable WhatsApp Rescue Showcase"
    >
      <div
        className="rs-duo-sticky"
        onMouseMove={handleStageMouseMove}
        onMouseLeave={handleStageMouseLeave}
      >
        {/* Ambient Foldfolio Orbit Rings */}
        <div className="rs-duo-orbit" aria-hidden="true">
          <div className="rs-duo-orbit__ring rs-duo-orbit__ring--1" />
          <div className="rs-duo-orbit__ring rs-duo-orbit__ring--2" />
          <div className="rs-duo-orbit__glow" />
        </div>

        {/* Top Header + Exclusive 4-State Switcher (Never highlights 2 buttons at once) */}
        <div className="rs-duo-header">
          <div>
            <span className="rs-fold-kicker">FOLDFOLIO × iPHONE DUO · INTERACTIVE SHOWCASE</span>
            <h2 className="rs-fold-title">
              Scroll to unfold iPhone Duo. <em>Tap WhatsApp (1) to rescue.</em>
            </h2>
          </div>

          <div className="rs-duo-toolbar">
            <div className="rs-finish-picker" role="group" aria-label="Hardware Finish">
              {(['titanium', 'graphite', 'vermilion', 'emerald'] as HardwareFinish[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFinish(f)}
                  className={`rs-finish-dot rs-finish-dot--${f} ${finish === f ? 'is-selected' : ''}`}
                  title={`Finish: ${f}`}
                  aria-label={`Select ${f} finish`}
                />
              ))}
            </div>

            <div className="rs-fold-controls" role="tablist" aria-label="iPhone Duo Posture">
              <button
                type="button"
                role="tab"
                aria-selected={posture === 'cover'}
                className={`rs-fold-chip ${posture === 'cover' ? 'is-active' : ''}`}
                onClick={() => {
                  setUserLockedPosture(true);
                  setPosture('cover');
                }}
              >
                1. Folded Cover
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={posture === 'unfolded-home'}
                className={`rs-fold-chip ${posture === 'unfolded-home' ? 'is-active' : ''}`}
                onClick={() => {
                  setUserLockedPosture(true);
                  setPosture('unfolded-home');
                }}
              >
                2. Unfolded Home (1)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={posture === 'whatsapp-duo'}
                className={`rs-fold-chip ${posture === 'whatsapp-duo' ? 'is-active' : ''}`}
                onClick={() => {
                  setUserLockedPosture(true);
                  setPosture('whatsapp-duo');
                }}
              >
                3. Live WhatsApp Duo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={posture === 'rider-call'}
                className={`rs-fold-chip ${posture === 'rider-call' ? 'is-active' : ''}`}
                onClick={() => {
                  setUserLockedPosture(true);
                  setPosture('rider-call');
                }}
              >
                4. Fold Shut · Rider Call
              </button>
            </div>
          </div>
        </div>

        {/* ===============================================================
            21ST.DEV + FOLDFOLIO HARDWARE STAGE (ZERO SQUISHING / DISTORTION)
           =============================================================== */}
        <div className="rs-duo-stage">
          <motion.div
            layout
            transition={{
              layout: { type: 'spring', stiffness: 180, damping: 24 },
            }}
            style={{
              transform: `perspective(1800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            }}
            className={`rs-hardware-chassis rs-hardware-chassis--${finish} ${
              isDualScreen ? 'is-unfolded-duo' : 'is-folded-single'
            }`}
          >
            {/* Physical Side Buttons on Titanium Frame */}
            <span className="rs-hw-btn rs-hw-btn--action" aria-hidden="true" />
            <span className="rs-hw-btn rs-hw-btn--vol-up" aria-hidden="true" />
            <span className="rs-hw-btn rs-hw-btn--vol-dn" aria-hidden="true" />
            <span className="rs-hw-btn rs-hw-btn--power" aria-hidden="true" />

            {/* Specular Glass Sheen that moves with cursor */}
            <div
              className="rs-hw-glare"
              aria-hidden="true"
              style={{
                background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgb(255 255 255 / 10%) 0%, transparent 58%)`,
              }}
            />

            <AnimatePresence mode="wait">
              {!isDualScreen ? (
                /* =========================================================
                   FOLDED SINGLE IPHONE SCREEN (STATE 1: COVER OR STATE 4: CALL)
                   ========================================================= */
                <motion.div
                  key={posture}
                  initial={{ opacity: 0, scale: 0.96, rotateY: -22 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.97, rotateY: 18 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="rs-single-screen rs-luminous-wallpaper"
                >
                  {/* iOS Status Bar + Dynamic Island */}
                  <div className="rs-ios-statusbar">
                    <span className="rs-ios-time">14:47</span>
                    <div className="rs-dynamic-island">
                      <span className="rs-island-lens" />
                      <span className="rs-island-sensor" />
                    </div>
                    <div className="rs-ios-StatusIcons">
                      <Wifi size={13} />
                      <BatteryCharging size={15} />
                    </div>
                  </div>

                  {posture === 'cover' ? (
                    <div className="rs-cover-lock">
                      <div className="rs-lockscreen-clock">
                        <div className="rs-lockscreen-date">
                          <Lock size={12} /> Wednesday, 21 October
                        </div>
                        <div className="rs-lockscreen-digits">02:47</div>
                      </div>

                      {/* Real Translucent Frosted Glass iOS Notification */}
                      <motion.button
                        type="button"
                        className="rs-translucent-notif"
                        initial={{ y: 16, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setUserLockedPosture(true);
                          setPosture('unfolded-home');
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
                            ⚠️ Delhivery logged “Door Locked” on AWB #4023118876. Tap or scroll to unfold iPhone Duo.
                          </p>
                        </div>
                      </motion.button>

                      <div className="rs-cover-bottom">
                        <button
                          type="button"
                          className="rs-unfold-cta-pill"
                          onClick={() => {
                            setUserLockedPosture(true);
                            setPosture('unfolded-home');
                          }}
                        >
                          <Layers size={13} /> Click or scroll to unfold iPhone Duo 180° →
                        </button>
                        <div className="rs-ios-homebar" />
                      </div>
                    </div>
                  ) : (
                    /* STATE 4: FOLD SHUT RIDER INCOMING CALL */
                    <div className="rs-incoming-call">
                      <div className="rs-incoming-call__top">
                        <span className="rs-incoming-badge">✓ GPS PIN INJECTED · LIVE DISPATCH</span>
                        <h4>Delhivery Field Agent (Noida Hub)</h4>
                        <p>Calling regarding AWB #4023118876 · Gate 2</p>
                      </div>

                      <div className="rs-incoming-call__actions">
                        <button
                          type="button"
                          className="rs-call-btn rs-call-btn--decline"
                          onClick={() => {
                            setUserLockedPosture(true);
                            setPosture('unfolded-home');
                          }}
                        >
                          <PhoneOff size={20} />
                          <span>Unfold Home</span>
                        </button>
                        <button
                          type="button"
                          className="rs-call-btn rs-call-btn--accept"
                          onClick={() => {
                            setUserLockedPosture(true);
                            setPosture('whatsapp-duo');
                          }}
                        >
                          <PhoneIncoming size={20} />
                          <span>Open Live Chat</span>
                        </button>
                      </div>
                      <div className="rs-ios-homebar" />
                    </div>
                  )}
                </motion.div>
              ) : (
                /* =========================================================
                   UNFOLDED DUAL-SCREEN IPHONE DUO (100% FLAT & CRISP — ZERO SQUISH)
                   ========================================================= */
                <motion.div
                  key="unfolded-duo-screen"
                  initial={{ opacity: 0, scale: 0.94, rotateY: 16 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="rs-duo-screens-grid"
                >
                  {/* Center Brushed Titanium Hinge Seam */}
                  <div className="rs-duo-center-hinge" aria-hidden="true">
                    <span className="rs-duo-center-hinge__cap" />
                    <span className="rs-duo-center-hinge__line" />
                    <span className="rs-duo-center-hinge__cap" />
                  </div>

                  {/* =======================================================
                      LEFT DISPLAY: TRANSLUCENT iOS HOME SCREEN OR WHATSAPP
                     ======================================================= */}
                  <div className="rs-duo-pane rs-duo-pane--left rs-luminous-wallpaper">
                    <div className="rs-duo-statusbar">
                      <span className="rs-ios-time">14:48 · Jio 5G</span>
                      <div className="rs-dynamic-island rs-dynamic-island--sm">
                        <span className="rs-island-lens" />
                      </div>
                      <span className="rs-duo-pane-tag">LEFT DISPLAY</span>
                    </div>

                    {posture === 'unfolded-home' ? (
                      /* TRANSLUCENT iOS 18 HOME SCREEN WITH WHATSAPP (1) */
                      <div className="rs-translucent-home">
                        {/* Top Frosted Glass Notification Banner */}
                        <motion.button
                          type="button"
                          className="rs-translucent-banner"
                          initial={{ y: -14, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          onClick={() => {
                            setUserLockedPosture(true);
                            setPosture('whatsapp-duo');
                          }}
                        >
                          <div className="rs-home-banner__left">
                            <span className="rs-wa-mini-icon">WA</span>
                            <div>
                              <strong>RescueShip Delivery Support ✓</strong>
                              <p>1 unread message · Tap to launch WhatsApp chat</p>
                            </div>
                          </div>
                          <span className="rs-home-banner__cta">Open →</span>
                        </motion.button>

                        {/* Translucent iOS Glass Widget */}
                        <div className="rs-ios-glass-widget">
                          <div className="rs-ios-glass-widget__head">
                            <span>LIVE SHIPMENT WIDGET</span>
                            <strong>AWB #4023118876</strong>
                          </div>
                          <div className="rs-ios-glass-widget__body">
                            <div>
                              <small>STATUS</small>
                              <p>NDR Intercepted (38s)</p>
                            </div>
                            <div>
                              <small>RTO BLEED AT RISK</small>
                              <p className="rs-text-vermilion">₹430.00</p>
                            </div>
                          </div>
                        </div>

                        {/* Translucent Frosted iOS Dock with WhatsApp (1) */}
                        <div className="rs-translucent-dock">
                          <div className="rs-app-tile rs-app-tile--muted">
                            <div className="rs-app-icon rs-app-icon--frosted">
                              <Navigation size={24} />
                            </div>
                            <span>Maps</span>
                          </div>

                          <motion.button
                            type="button"
                            className="rs-app-tile rs-app-tile--whatsapp"
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => {
                              setUserLockedPosture(true);
                              setPosture('whatsapp-duo');
                            }}
                            aria-label="Open WhatsApp with 1 unread notification from RescueShip"
                          >
                            <div className="rs-app-icon rs-app-icon--wa">
                              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                              </svg>
                              <span className="rs-app-badge">1</span>
                            </div>
                            <span className="rs-app-label">WhatsApp</span>
                          </motion.button>

                          <div className="rs-app-tile rs-app-tile--muted">
                            <div className="rs-app-icon rs-app-icon--frosted">
                              <ShieldCheck size={24} />
                            </div>
                            <span>Delhivery</span>
                          </div>
                        </div>

                        <div className="rs-translucent-caption">
                          <Sparkles size={13} /> Click <strong>WhatsApp (1)</strong> to open the sequential rescue chat
                        </div>
                      </div>
                    ) : (
                      /* AUTHENTIC iOS WHATSAPP SEQUENTIAL INTERFACE */
                      <div className="rs-wa-pane">
                        <div className="rs-wa-header">
                          <button
                            type="button"
                            className="rs-wa-back"
                            onClick={() => {
                              setUserLockedPosture(true);
                              setPosture('unfolded-home');
                            }}
                            title="Back to Unfolded Home Screen"
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
                            <Video size={15} />
                            <Phone size={14} />
                          </div>
                        </div>

                        <div className="rs-wa-progress-bar">
                          <button
                            type="button"
                            className={`rs-wa-step-pill ${
                              activePathLabel === 'PRE_DELIVERY' ? 'is-active' : ''
                            }`}
                            onClick={() => handleResetFlow(false)}
                          >
                            1. Pre-Delivery
                          </button>
                          <span>→</span>
                          <button
                            type="button"
                            className={`rs-wa-step-pill ${
                              activePathLabel === 'NDR_INTERCEPT' ? 'is-active' : ''
                            }`}
                            onClick={() => handleResetFlow(true)}
                          >
                            2. NDR Hit
                          </button>
                          <span>→</span>
                          <span
                            className={`rs-wa-step-pill ${
                              stage.includes('PIN_PROMPT') || stage.includes('COMPLETED')
                                ? 'is-active'
                                : ''
                            }`}
                          >
                            3. Pin / Skip
                          </span>
                        </div>

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
                              <div
                                key={m.id}
                                className={`rs-wa-bubble ${
                                  isUser ? 'rs-wa-bubble--user' : 'rs-wa-bubble--bot'
                                }`}
                              >
                                {m.isLocationPin && (
                                  <div className="rs-wa-map-card">
                                    <MapPin size={14} />
                                    <span>Live GPS Pin · 28.5355° N, 77.3910° E (Gate 2)</span>
                                  </div>
                                )}
                                <p className="rs-wa-bubble__text">{m.text}</p>
                                <div className="rs-wa-bubble__meta">
                                  <span>{m.time}</span>
                                  {isUser && <CheckCheck size={13} className="rs-wa-ticks" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>

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
                                <RotateCcw size={12} /> Pre-Delivery
                              </button>
                              <button
                                type="button"
                                className="rs-wa-action-btn"
                                onClick={() => handleResetFlow(true)}
                              >
                                <RotateCcw size={12} /> NDR Hit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* =======================================================
                      RIGHT DISPLAY: TRANSLUCENT iOS TELEMETRY & COURIER SYNC
                     ======================================================= */}
                  <div className="rs-duo-pane rs-duo-pane--right rs-luminous-wallpaper">
                    <div className="rs-duo-statusbar">
                      <span className="rs-duo-pane-tag">RIGHT DISPLAY · LIVE COURIER OS</span>
                      <div className="rs-ios-StatusIcons">
                        <span>98%</span>
                        <Wifi size={12} />
                        <BatteryCharging size={14} />
                      </div>
                    </div>

                    <div className="rs-telemetry-pane">
                      <div className="rs-telemetry-card rs-translucent-dark-card">
                        <div className="rs-telemetry-card__top">
                          <span className="rs-telemetry-tag">● LIVE WEBHOOK SYNC</span>
                          <span className="rs-telemetry-awb">AWB #4023118876</span>
                        </div>

                        <h3 className="rs-telemetry-heading">
                          {stage === 'STAGE_1_PRE_DELIVERY' && 'Morning Pre-Delivery Check Active'}
                          {stage === 'STAGE_1_PIN_PROMPT' &&
                            'Prepaid Converted · Awaiting Gate Pin or Skip'}
                          {stage === 'STAGE_2_NDR_HIT' &&
                            'Fake "Door Locked" Scan Intercepted (1.42 km)'}
                          {stage === 'STAGE_2_CANCEL_SAVE' &&
                            '1-Shot ₹100 UPI Cancellation Rescue Active'}
                          {stage === 'STAGE_2_PIN_PROMPT' &&
                            'Re-Attempt Unlocked · Requesting Location Pin'}
                          {stage === 'STAGE_3_COMPLETED_PIN' &&
                            '✓ GPS Pin Injected & Sent to Field Agent'}
                          {stage === 'STAGE_3_COMPLETED_SKIP' &&
                            '✓ Re-Delivery Locked with Saved Address'}
                        </h3>

                        <div className="rs-telemetry-steps">
                          <div className="rs-t-step is-done">
                            <span className="rs-t-dot" />
                            <div>
                              <strong>1. Pre-Delivery & NDR Webhook</strong>
                              <p>
                                {activePathLabel === 'PRE_DELIVERY'
                                  ? 'Morning out-for-delivery ping offers ₹50 instant UPI conversion.'
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
                                  : 'Tap WhatsApp on the left screen to interact with the buyer flow.'}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`rs-t-step ${stage.includes('COMPLETED') ? 'is-done' : ''}`}
                          >
                            <span className="rs-t-dot" />
                            <div>
                              <strong>3. Final Address Pin + Skip Resolution</strong>
                              <p>
                                {stage === 'STAGE_3_COMPLETED_PIN' &&
                                  'Landmark injected into Delhivery NDR API + Google Maps SMS sent to rider.'}
                                {stage === 'STAGE_3_COMPLETED_SKIP' &&
                                  'Buyer clicked Skip; priority re-attempt locked with existing address.'}
                                {!stage.includes('COMPLETED') &&
                                  'Final step in both Pre-Delivery & NDR asks for GPS Pin + Skip.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rs-telemetry-footer">
                          <div>
                            <span>TOTAL BLEED SAVED</span>
                            <strong>₹430 / RTO</strong>
                          </div>
                          <div>
                            <span>BREAKDOWN</span>
                            <strong>₹200 Freight + ₹230 CAC</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
