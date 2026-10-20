import React, { useState, useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
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

type HardwareFinish = 'graphite' | 'titanium' | 'vermilion' | 'emerald';

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

  // Hardware finish (inspired by Mahmud Azimov's Foldfolio: Graphite, Titanium, Coral/Vermilion, Sage/Emerald)
  const [finish, setFinish] = useState<HardwareFinish>('graphite');

  // Interactive override vs scroll-driven state
  const [manualAngle, setManualAngle] = useState<number | null>(null);
  const [notifVisible, setNotifVisible] = useState(true);
  const [appOpened, setAppOpened] = useState(false);
  const [incomingCallMode, setIncomingCallMode] = useState(false);

  // Sequential lifecycle state
  const [stage, setStage] = useState<FlowStage>('STAGE_1_PRE_DELIVERY');
  const [activePathLabel, setActivePathLabel] = useState<'PRE_DELIVERY' | 'NDR_INTERCEPT'>(
    'PRE_DELIVERY'
  );
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  // --- 3D HINGE PHYSICS ---
  // 180deg = Folded Shut (Left wing folded completely over Right wing, showing Cover Screen)
  // 0deg   = Fully Unfolded Flat (180-degree open dual-screen tablet)
  const rawScrollHingeAngle = useTransform(
    scrollYProgress,
    [0, 0.16, 0.52, 0.86, 0.98],
    [176, 172, 0, 0, 174]
  );
  const smoothScrollHinge = useSpring(rawScrollHingeAngle, {
    stiffness: 120,
    damping: 22,
    mass: 0.7,
  });

  const [currentHingeDeg, setCurrentHingeDeg] = useState(174);

  useMotionValueEvent(smoothScrollHinge, 'change', (deg) => {
    if (manualAngle === null) {
      setCurrentHingeDeg(deg);
    }
  });

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (p > 0.03) setNotifVisible(true);
    if (manualAngle === null) {
      if (p >= 0.9) {
        setIncomingCallMode(true);
      } else {
        setIncomingCallMode(false);
      }
    }
  });

  const effectiveHingeDeg = manualAngle !== null ? manualAngle : currentHingeDeg;
  const isUnfoldedEnough = effectiveHingeDeg < 75;

  // --- 3D MOUSE PARALLAX & SPECULAR GLARE ---
  const mouseRx = useMotionValue(12);
  const mouseRy = useMotionValue(-16);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(35);

  const springRx = useSpring(mouseRx, { stiffness: 150, damping: 20 });
  const springRy = useSpring(mouseRy, { stiffness: 150, damping: 20 });

  const glareBackground = useTransform(
    [glareX, glareY],
    ([gx, gy]) =>
      `radial-gradient(circle at ${gx}% ${gy}%, rgb(255 255 255 / 16%) 0%, transparent 62%)`
  );

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    // When folded shut, give a stronger 3D isometric angle so chassis depth & spine pop
    const baseRy = effectiveHingeDeg > 90 ? -18 : 0;
    const baseRx = effectiveHingeDeg > 90 ? 11 : 6;
    mouseRx.set(baseRx - ny * 14);
    mouseRy.set(baseRy + nx * 22);
    glareX.set(Math.round((nx + 0.5) * 100));
    glareY.set(Math.round((ny + 0.5) * 100));
  };

  const handleStageMouseLeave = () => {
    mouseRx.set(effectiveHingeDeg > 90 ? 11 : 6);
    mouseRy.set(effectiveHingeDeg > 90 ? -18 : 0);
  };

  // Auto-scroll WhatsApp messages cleanly
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, stage, appOpened]);

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

  // Unfold phone smoothly & open WhatsApp
  const unfoldAndOpenWhatsApp = () => {
    setIncomingCallMode(false);
    setManualAngle(0);
    setAppOpened(true);
    mouseRx.set(5);
    mouseRy.set(0);
  };

  return (
    <section
      ref={containerRef}
      id="foldfolio-demo"
      className="rs-fold3d-track"
      aria-label="Interactive 3D Foldable iPhone WhatsApp Rescue Demo"
    >
      <div
        className="rs-fold3d-sticky"
        onMouseMove={handleStageMouseMove}
        onMouseLeave={handleStageMouseLeave}
      >
        {/* Orbit Backdrop Rings (from Mahmud Azimov's Foldfolio Orbit mood) */}
        <div className="rs-fold3d-orbit" aria-hidden="true">
          <div className="rs-fold3d-orbit__ring rs-fold3d-orbit__ring--1" />
          <div className="rs-fold3d-orbit__ring rs-fold3d-orbit__ring--2" />
          <div className="rs-fold3d-orbit__glow" />
        </div>

        {/* Top Bar: Title + Foldfolio State & Finish Switchers */}
        <div className="rs-fold3d-header">
          <div>
            <span className="rs-fold-kicker">3D FOLDFOLIO RIG · SCROLL OR DRAG CURSOR TO TILT</span>
            <h2 className="rs-fold-title">
              Watch it unfold in 3D. <em>Tap WhatsApp (1) to intercept.</em>
            </h2>
          </div>

          <div className="rs-fold3d-toolbar">
            {/* Hardware Finish Dots */}
            <div className="rs-finish-picker" role="group" aria-label="Phone Frame Finish">
              {(['graphite', 'titanium', 'vermilion', 'emerald'] as HardwareFinish[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFinish(f)}
                  className={`rs-finish-dot rs-finish-dot--${f} ${finish === f ? 'is-selected' : ''}`}
                  title={`Finish: ${f}`}
                  aria-label={`Select ${f} frame finish`}
                />
              ))}
            </div>

            {/* 4-Stage Posture Switcher */}
            <div className="rs-fold-controls">
              <button
                type="button"
                className={`rs-fold-chip ${!isUnfoldedEnough && !incomingCallMode ? 'is-active' : ''}`}
                onClick={() => {
                  setIncomingCallMode(false);
                  setAppOpened(false);
                  setNotifVisible(true);
                  setManualAngle(168);
                  mouseRx.set(12);
                  mouseRy.set(-20);
                }}
              >
                1. Folded Cover
              </button>
              <button
                type="button"
                className={`rs-fold-chip ${isUnfoldedEnough && !appOpened ? 'is-active' : ''}`}
                onClick={() => {
                  setIncomingCallMode(false);
                  setAppOpened(false);
                  setManualAngle(0);
                  mouseRx.set(6);
                  mouseRy.set(0);
                }}
              >
                2. Unfolded Home (1)
              </button>
              <button
                type="button"
                className={`rs-fold-chip ${isUnfoldedEnough && appOpened ? 'is-active' : ''}`}
                onClick={unfoldAndOpenWhatsApp}
              >
                3. Live WhatsApp Duo
              </button>
              <button
                type="button"
                className={`rs-fold-chip ${incomingCallMode ? 'is-active' : ''}`}
                onClick={() => {
                  setAppOpened(false);
                  setIncomingCallMode(true);
                  setManualAngle(170);
                  mouseRx.set(12);
                  mouseRy.set(-18);
                }}
              >
                4. Fold Shut · Rider Call
              </button>
            </div>
          </div>
        </div>

        {/* ===============================================================
            TRUE 3D BOOK-FOLD HARDWARE STAGE (CONTINUOUS PRESERVE-3D RIG)
           =============================================================== */}
        <div className="rs-fold3d-viewport">
          <motion.div
            className={`rs-fold3d-rig rs-fold3d-rig--${finish}`}
            style={{
              rotateX: springRx,
              rotateY: springRy,
              // When folded shut (effectiveHingeDeg ~ 174), shift rig left by -25% so the closed right-half phone sits dead-center
              x: `${-(effectiveHingeDeg / 180) * 230}px`,
            }}
          >
            {/* Dynamic Specular Glass Glare Layer across entire 3D rig */}
            <motion.div
              className="rs-3d-glare"
              style={{ background: glareBackground }}
              aria-hidden="true"
            />

            {/* Dynamic Floor Drop Shadow */}
            <div
              className="rs-fold3d-floor-shadow"
              style={{
                transform: `translateZ(-70px) rotateX(82deg) scaleX(${
                  1 - (effectiveHingeDeg / 180) * 0.42
                })`,
              }}
            />

            {/* ===========================================================
                LEFT ROTATING 3D LEAF (Hinges around right edge at center spine)
                - RotateY = 180deg -> Closed over the right wing (Cover faces viewer)
                - RotateY = 0deg   -> Unfolded flat (Left Inner Screen faces viewer)
               =========================================================== */}
            <motion.div
              className="rs-3d-wing rs-3d-wing--left"
              style={{
                rotateY: effectiveHingeDeg,
              }}
            >
              <div className="rs-3d-edge-wall rs-3d-edge-wall--left" />

              {/* ---------------------------------------------------------
                  FACE A (OUTER COVER SCREEN): Visible when folded (rotateY > 90deg)
                 --------------------------------------------------------- */}
              <div className="rs-wing-face rs-wing-face--cover">
                <div className="rs-bezel-frame">
                  {/* iOS Dynamic Island & Status Bar */}
                  <div className="rs-ios-statusbar">
                    <span className="rs-ios-time">14:47</span>
                    <div className="rs-dynamic-island">
                      <span className="rs-island-cam" />
                      <span className="rs-island-sensor" />
                    </div>
                    <div className="rs-ios-StatusIcons">
                      <Wifi size={12} />
                      <BatteryCharging size={14} />
                    </div>
                  </div>

                  {!incomingCallMode ? (
                    /* NORMAL COVER LOCK SCREEN + WHATSAPP NOTIFICATION */
                    <div className="rs-cover-content">
                      <div className="rs-lockscreen-clock">
                        <div className="rs-lockscreen-date">
                          <Lock size={11} /> Tuesday, 20 October
                        </div>
                        <div className="rs-lockscreen-digits">02:47</div>
                      </div>

                      <AnimatePresence>
                        {notifVisible && (
                          <motion.button
                            type="button"
                            className="rs-ios-notif"
                            initial={{ opacity: 0, y: -24, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                            onClick={unfoldAndOpenWhatsApp}
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
                                ⚠️ Delhivery logged “Door Locked” on AWB #4023118876. Tap or scroll to unfold &amp; rescue.
                              </p>
                            </div>
                          </motion.button>
                        )}
                      </AnimatePresence>

                      <div className="rs-cover-footer">
                        <span className="rs-cover-hint">Scroll down or click to unfold 180° →</span>
                        <div className="rs-ios-homebar" />
                      </div>
                    </div>
                  ) : (
                    /* FOLDFOLIO FINALE: FOLD SHUT INTO INCOMING FIELD AGENT CALL */
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
                            setIncomingCallMode(false);
                            setManualAngle(0);
                          }}
                        >
                          <PhoneOff size={20} />
                          <span>Re-Open Duo</span>
                        </button>
                        <button
                          type="button"
                          className="rs-call-btn rs-call-btn--accept"
                          onClick={unfoldAndOpenWhatsApp}
                        >
                          <PhoneIncoming size={20} />
                          <span>Answer &amp; Inspect</span>
                        </button>
                      </div>
                      <div className="rs-ios-homebar" />
                    </div>
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------------
                  FACE B (LEFT INNER DISPLAY): Visible when unfolded (rotateY < 90deg)
                 --------------------------------------------------------- */}
              <div className="rs-wing-face rs-wing-face--inner-left">
                <div className="rs-inner-screen rs-inner-screen--left">
                  {/* Left Half of Unfolded Status Bar */}
                  <div className="rs-duo-topbar">
                    <span className="rs-ios-time">14:48 · Jio 5G</span>
                    <span className="rs-duo-topbar__tag">INNER DISPLAY · LEFT</span>
                  </div>

                  {!appOpened ? (
                    /* LEFT HALF OF iOS HOME SCREEN WITH WHATSAPP (1) ICON */
                    <div className="rs-inner-home-pane">
                      <div className="rs-home-banner" onClick={() => setAppOpened(true)}>
                        <div className="rs-home-banner__left">
                          <span className="rs-wa-mini-icon">WA</span>
                          <div>
                            <strong>RescueShip Delivery Support ✓</strong>
                            <p>1 unread message · Tap WhatsApp (1) below</p>
                          </div>
                        </div>
                        <span className="rs-home-banner__cta">Open →</span>
                      </div>

                      <div className="rs-home-grid">
                        <div className="rs-app-tile rs-app-tile--muted">
                          <div className="rs-app-icon">
                            <Navigation size={24} />
                          </div>
                          <span>Maps</span>
                        </div>

                        <motion.button
                          type="button"
                          className="rs-app-tile rs-app-tile--whatsapp"
                          whileHover={{ scale: 1.07 }}
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
                          <div className="rs-app-icon">
                            <ShieldCheck size={24} />
                          </div>
                          <span>Delhivery</span>
                        </div>
                      </div>

                      <div className="rs-home-prompt">
                        <Sparkles size={13} /> Tap <strong>WhatsApp (1)</strong> to launch live sequential rescue
                      </div>
                    </div>
                  ) : (
                    /* AUTHENTIC iOS WHATSAPP SEQUENTIAL INTERFACE */
                    <div className="rs-wa-pane">
                      <div className="rs-wa-header">
                        <button
                          type="button"
                          className="rs-wa-back"
                          onClick={() => setAppOpened(false)}
                          title="Back to Home Screen"
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
                              🏠 Or Keep COD &amp; Confirm Re-Attempt
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
              </div>
            </motion.div>

            {/* ===========================================================
                CENTER 3D CYLINDRICAL METALLIC HINGE SPINE
               =========================================================== */}
            <div className="rs-3d-spine" aria-hidden="true">
              <div className="rs-3d-spine__cap rs-3d-spine__cap--top" />
              <div className="rs-3d-spine__crease" />
              <div className="rs-3d-spine__cap rs-3d-spine__cap--bottom" />
            </div>

            {/* ===========================================================
                RIGHT BASE 3D WING (Fixed Anchor holding Right Inner Display)
               =========================================================== */}
            <div className="rs-3d-wing rs-3d-wing--right">
              {/* 3D Extruded Titanium/Graphite Backplate & Side Volume/Power Rockers */}
              <div className="rs-3d-rim-layer rs-3d-rim-layer--1" />
              <div className="rs-3d-rim-layer rs-3d-rim-layer--2" />
              <div className="rs-3d-rim-layer rs-3d-rim-layer--3" />
              <div className="rs-3d-edge-wall rs-3d-edge-wall--right">
                <span className="rs-side-btn rs-side-btn--vol-up" />
                <span className="rs-side-btn rs-side-btn--vol-dn" />
                <span className="rs-side-btn rs-side-btn--power" />
              </div>

              <div className="rs-wing-face rs-wing-face--inner-right">
                <div className="rs-inner-screen rs-inner-screen--right">
                  {/* Right Half of Unfolded Status Bar */}
                  <div className="rs-duo-topbar">
                    <span className="rs-duo-topbar__tag">COURIER NDR API · TELEMETRY</span>
                    <div className="rs-ios-StatusIcons">
                      <span>98%</span>
                      <Wifi size={12} />
                      <BatteryCharging size={14} />
                    </div>
                  </div>

                  {/* LIVE COURIER API & FIELD AGENT DISPATCH PANE */}
                  <div className="rs-telemetry-pane">
                    <div className="rs-telemetry-card">
                      <div className="rs-telemetry-card__top">
                        <span className="rs-telemetry-tag">● LIVE WEBHOOK SYNC</span>
                        <span className="rs-telemetry-awb">AWB #4023118876</span>
                      </div>

                      <h3 className="rs-telemetry-heading">
                        {stage === 'STAGE_1_PRE_DELIVERY' && 'Morning Pre-Delivery Check Active'}
                        {stage === 'STAGE_1_PIN_PROMPT' && 'Prepaid Converted · Awaiting Gate Pin or Skip'}
                        {stage === 'STAGE_2_NDR_HIT' && 'Fake "Door Locked" Scan Intercepted (1.42 km)'}
                        {stage === 'STAGE_2_CANCEL_SAVE' && '1-Shot ₹100 UPI Cancellation Rescue Active'}
                        {stage === 'STAGE_2_PIN_PROMPT' && 'Re-Attempt Unlocked · Requesting Location Pin'}
                        {stage === 'STAGE_3_COMPLETED_PIN' && '✓ GPS Pin Injected & Sent to Field Agent'}
                        {stage === 'STAGE_3_COMPLETED_SKIP' && '✓ Re-Delivery Locked with Saved Address'}
                      </h3>

                      <div className="rs-telemetry-steps">
                        <div className="rs-t-step is-done">
                          <span className="rs-t-dot" />
                          <div>
                            <strong>1. Pre-Delivery &amp; NDR Webhook</strong>
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
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
