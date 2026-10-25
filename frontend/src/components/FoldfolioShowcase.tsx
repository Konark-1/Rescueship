import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  useScroll,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import {
  MapPin,
  CheckCheck,
  Navigation,
  Phone,
  RotateCcw,
  Wifi,
  BatteryCharging,
  Camera,
  Mail,
  Clock,
  Settings,
  PackageCheck,
  MessageCircle,
  Compass,
  Sun,
  FileText,
  CheckSquare,
  Folder,
  Music,
  ShoppingBag,
  HeartPulse,
  CreditCard,
} from 'lucide-react';
import { IPhoneDuoViewer, type ScreenFrame } from './iphone-duo/IPhoneDuoViewer';

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
    id: 'msg-pre-1',
    sender: 'bot',
    text: '🚚 *Out for Delivery:* Order *#4023118876* (COD ₹1,240) is arriving today.\n\nPay via UPI now to save ₹50, or keep COD:',
    time: '09:15 AM',
  },
];

function renderWhatsAppFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <React.Fragment key={lineIdx}>
        {parts.map((part, partIdx) => {
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <strong key={partIdx}>{part.slice(1, -1)}</strong>;
          }
          return part;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export const FoldfolioShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [webglReady, setWebglReady] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth spring progress (0 -> 1) driving the entire 4-stage choreography
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 24,
    mass: 0.7,
  });

  // Allow user to also click the stage pills at the top to jump to any stage
  const [manualProgress, setManualProgress] = useState<number | null>(null);
  const [p, setP] = useState(0);
  const manualLockTimeRef = useRef<number>(0);

  useMotionValueEvent(smoothProgress, 'change', (val) => {
    if (manualProgress === null) {
      setP(val);
    }
  });

  // Release manual lock if user scrolls significantly (after at least 1.2s from jump click)
  useMotionValueEvent(scrollYProgress, 'change', (raw) => {
    if (manualProgress !== null) {
      const elapsed = Date.now() - manualLockTimeRef.current;
      if (elapsed > 1200 && Math.abs(raw - manualProgress) > 0.16) {
        setManualProgress(null);
      }
    }
  });

  const activeP = prefersReducedMotion
    ? manualProgress ?? scrollYProgress.get()
    : manualProgress ?? p;

  // =========================================================================
  // THE 4 CONTINUOUS SCROLL PHASES (3D BOOK HINGE KINEMATICS + iOS APP LAUNCH)
  // Reference: https://github.com/akashtdev/iphone-duo-animation
  // =========================================================================
  // Initial (0.00 -> 0.05): Clean cover lockscreen (NO WhatsApp notification yet)
  // Pop-in (0.05 -> 0.16): WhatsApp notification drops in like in iOS
  // Phase 1 (0.16 -> 0.20): Folded Outer Screen + Settled WhatsApp Notification
  // Phase 2 (0.20 -> 0.52): 3D Left leaf swings open from 180deg -> 0deg!
  //                         Reveals right screen & center hinge spine!
  // Phase 3 (0.52 -> 0.74): WhatsApp Card expands into Full-Screen App (iOS Launch)
  // Phase 4 (0.74 -> 1.00): Live WhatsApp Chat + Live RescueShip Telemetry Dashboard active

  // STAGE 1 BUFFER (0.00 -> 0.22): Outer Lock Screen holds completely still BEFORE flipping!
  // STAGE 2A (0.22 -> 0.46): Outer Screen flips open (0 -> 1) while Lock Screen stays visible
  const rawUnfold = Math.max(0, Math.min(1, (activeP - 0.22) / 0.24));
  const unfoldT = rawUnfold * rawUnfold * (3 - 2 * rawUnfold);

  // STAGE 2B BUFFER (0.46 -> 0.54): Unfolded Lock Screen holds flat (100% open)
  // STAGE 3A (0.54 -> 0.66): Bottom-to-Top iPhone Swipe-to-Unlock
  const rawUnlock = Math.max(0, Math.min(1, (activeP - 0.54) / 0.12));
  const unlockT = rawUnlock * rawUnlock * (3 - 2 * rawUnlock);

  // STAGE 3B BUFFER (0.66 -> 0.72): Unlocked Homepage Icons hold
  // STAGE 4A (0.72 -> 0.82): Full-Screen WhatsApp Chat + Live Dashboard Launch
  // STAGE 4B BUFFER (0.82 -> 1.00): 18% End Buffer Hold so user never scrolls past Live Chat!
  const rawAppLaunch = Math.max(0, Math.min(1, (activeP - 0.72) / 0.10));
  const appLaunchT = rawAppLaunch * rawAppLaunch * (3 - 2 * rawAppLaunch);
  const isAppInteractive = appLaunchT > 0.55;

  const chassisShiftX = -(1 - unfoldT) * 235;



  // Drive 3D model kinematics via unfoldT
  const openness = unfoldT;
  const notifPopT = Math.max(0, Math.min(1, (activeP - 0.02) / 0.06));
  const swingArcTiltX = Math.sin(openness * Math.PI) * 7;
  const swingArcTiltY = -7 * (1 - openness);
  const appExpandT = appLaunchT;
  const dashboardLive = isAppInteractive;

  // Sequential WhatsApp flow state
  const [stage, setStage] = useState<FlowStage>('STAGE_1_PRE_DELIVERY');
  const [activePathLabel, setActivePathLabel] = useState<'PRE_DELIVERY' | 'NDR_INTERCEPT'>(
    'PRE_DELIVERY'
  );
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, stage, dashboardLive]);

  // Registers the panoramic HTML overlay with the WebGL phone's projected
  // inner-screen quad so the home screen / WhatsApp app fill the actual display
  // area of the 3D model (no "screen inside a screen" floating box).
  const handleScreenFrame = useCallback(
    (frame: ScreenFrame | null) => {
      const overlay = panoramaRef.current;
      if (!overlay || !frame) return;
      const positioner = positionerRef.current;
      const viewport = viewportRef.current;
      if (!positioner || !viewport) return;
      const pr = positioner.getBoundingClientRect();
      const vr = viewport.getBoundingClientRect();
      const zoom = parseFloat(getComputedStyle(viewport).zoom) || 1;
      overlay.style.left = `${frame.left - (pr.left - vr.left) / zoom}px`;
      overlay.style.top = `${frame.top - (pr.top - vr.top) / zoom}px`;
      overlay.style.width = `${frame.width}px`;
      overlay.style.height = `${frame.height}px`;
      overlay.style.borderRadius = `${frame.radius}px`;
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
    },
    []
  );

  // Non-WebGL fallback: size the overlay to the CSS chassis screens instead.
  useEffect(() => {
    if (webglReady) return;
    const applyFallback = () => {
      const overlay = panoramaRef.current;
      const positioner = positionerRef.current;
      if (!overlay || !positioner) return;
      const pr = positioner.getBoundingClientRect();
      const insetX = pr.width * 0.032;
      const insetY = pr.height * 0.032;
      overlay.style.left = `${insetX}px`;
      overlay.style.top = `${insetY}px`;
      overlay.style.width = `${pr.width - insetX * 2}px`;
      overlay.style.height = `${pr.height - insetY * 2}px`;
      overlay.style.borderRadius = '36px';
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
    };
    applyFallback();
    window.addEventListener('resize', applyFallback);
    return () => window.removeEventListener('resize', applyFallback);
  }, [webglReady]);

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
        text: '✅ *₹1,190 UPI Received!* Order converted to Priority Prepaid.\n\n📍 Share your Location Pin for fast gate delivery, or skip:',
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
        text: '🚚 Keep COD → Test Fake NDR Alert',
        time: '09:16 AM',
      },
      {
        id: `b-ndr-${Date.now()}`,
        sender: 'bot',
        text: '⚠️ *Delivery Alert:* Delhivery marked your order *"Door Locked"*.\n\nAre you home right now for a free priority re-attempt?',
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
        text: "🏠 I'm Home — Re-Deliver Today",
        time: '02:48 PM',
      },
      {
        id: `b-pin-req-${Date.now()}`,
        sender: 'bot',
        text: '🛡️ *Free Re-Attempt Locked!*\n\n📍 Share your WhatsApp Location Pin so the rider finds your gate, or skip:',
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
        text: '❌ Cancel Order (Test ₹100 Save Offer)',
        time: '02:48 PM',
      },
      {
        id: `b-save-${Date.now()}`,
        sender: 'bot',
        text: 'Before cancelling, claim a *₹100 Instant UPI Discount* (Pay *₹1,140* instead of ₹1,240 to deliver today):',
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
        text: '⚡ Pay ₹1,140 via UPI (Save ₹100)',
        time: '02:49 PM',
      },
      {
        id: `b-save-pin-${Date.now()}`,
        sender: 'bot',
        text: '✅ *₹1,140 Paid via UPI!* Cancellation reversed.\n\n📍 Share your Location Pin for priority delivery, or skip:',
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
        text: '📍 Location Pin Shared · Sector 62, Noida',
        time: '02:49 PM',
        isLocationPin: true,
      },
      {
        id: `b-done-pin-${Date.now()}`,
        sender: 'bot',
        text: '✅ *Location Pin Sent to Rider!* Priority delivery is locked for today.',
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
        text: '⏭️ Skip — Use Saved Address',
        time: '02:49 PM',
      },
      {
        id: `b-done-skip-${Date.now()}`,
        sender: 'bot',
        text: '✅ *Re-Delivery Confirmed!* Rider will deliver to your saved address today.',
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
          text: '🚚 Keep COD → Test Fake NDR Alert',
          time: '09:16 AM',
        },
        {
          id: 'b-ndr-jump',
          sender: 'bot',
          text: '⚠️ *Delivery Alert:* Delhivery marked your order *"Door Locked"*.\n\nAre you home right now for a free priority re-attempt?',
          time: '02:47 PM',
        },
      ]);
      setStage('STAGE_2_NDR_HIT');
    }
  };

  const jumpToStage = (targetProgress: number) => {
    manualLockTimeRef.current = Date.now();
    setManualProgress(targetProgress);
    setP(targetProgress);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const currentScroll = window.scrollY;
      const trackHeight = containerRef.current.offsetHeight;
      const viewportHeight = window.innerHeight;
      const scrollableDist = trackHeight - viewportHeight;
      if (scrollableDist > 0) {
        const targetScrollY = currentScroll + rect.top + scrollableDist * targetProgress;
        window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
      }
    }
  };

  return (
    <section
      ref={containerRef}
      id="foldfolio-demo"
      className="rs-duo-scroll-track"
      aria-label="Interactive iPhone Duo Unfold & WhatsApp Live Dashboard Showcase"
    >
      <div className="rs-duo-sticky-stage">
        <div className="rs-duo-header-bar">
          <div className="rs-duo-header-simple">
            <span className="rs-fold-kicker">LIVE DEMO</span>
            <h2 className="rs-fold-title">
              How RescueShip saves failed deliveries on WhatsApp
            </h2>
          </div>
        </div>

        {/* ===============================================================
            AUTHENTIC 3D IPHONE DUO CHASSIS STAGE (akashtdev/iphone-duo-animation)
            Left Leaf physically swings open 180deg -> 0deg around Center Spine!
           =============================================================== */}
        <div className="rs-duo-center-viewport" ref={viewportRef}>
          {/* AUTHENTIC 3D WEBGL IPHONE DUO (akashtdev/iphone-duo-animation) */}
          {!prefersReducedMotion && (
            <IPhoneDuoViewer
              openness={openness}
              notifPop={notifPopT}
              unlock={unlockT}
              onScreenFrame={handleScreenFrame}
              onLoaded={() => setWebglReady(true)}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          )}

          <div
            className="rs-duo-outer-positioner"
            ref={positionerRef}
            style={{
              transform: `translate3d(${chassisShiftX.toFixed(1)}px, 0, 0) rotateX(${swingArcTiltX.toFixed(2)}deg) rotateY(${swingArcTiltY.toFixed(2)}deg)`,
              transformStyle: 'preserve-3d',
              willChange: 'transform',
              zIndex: 5,
            }}
          >
            {/* =========================================================
                SEAMLESS FLAT PANORAMIC OVERLAY
                Renders when phone is flat open
                Contains the dual-page iOS Home Screen, widgets, app grid,
                iOS app-launch morph, WhatsApp chat, and live Dashboard!
               ========================================================= */}
            <div
              className="rs-duo-panoramic-overlay rs-duo-fullbleed-screen"
              ref={panoramaRef}
              style={{
                opacity: unfoldT > 0.92 ? Number(Math.min(1, unlockT * 1.35).toFixed(2)) : 0,
                pointerEvents: unfoldT > 0.92 && unlockT > 0.4 ? 'auto' : 'none',
              }}
              aria-hidden={unfoldT <= 0.92 || unlockT <= 0.1}
              inert={unfoldT <= 0.92 || unlockT <= 0.1 ? true : undefined}
            >
              <div className="rs-duo-panoramic-bezel">
                {/* Continuous Top Status Bar */}
                <div
                  className="rs-duo-continuous-status rs-unified-statusbar"
                  style={{
                    opacity: Number((1 - Math.min(1, appLaunchT * 1.4)).toFixed(2)),
                    visibility: appLaunchT > 0.98 ? 'hidden' : 'visible',
                  }}
                  aria-hidden={appLaunchT > 0.5}
                >
                  <div className="rs-duo-status-left rs-unified-statusbar__left">
                    <span>9:41</span>
                    <span className="rs-duo-carrier-tag">5G</span>
                  </div>
                  <div className="rs-dynamic-island rs-unified-island">
                    <span className="rs-island-cam" />
                  </div>
                  <div className="rs-duo-status-right rs-unified-statusbar__right">
                    <span>98%</span>
                    <Wifi size={12} />
                    <BatteryCharging size={14} />
                  </div>
                </div>

                {/* LAYER 1: AUTHENTIC iPHONE DUO DUAL-PAGE iOS HOME SCREEN */}
                <div
                  className="rs-duo-home-layer rs-duo-home-fullbleed"
                  style={{
                    opacity: Number((unlockT * (1 - appLaunchT * 0.95)).toFixed(2)),
                    transform: `translate3d(0, ${((1 - unlockT) * 28).toFixed(1)}px, 0) scale(${(
                      0.95 +
                      unlockT * 0.05 -
                      appLaunchT * 0.05
                    ).toFixed(3)})`,
                    pointerEvents: unlockT > 0.5 && !isAppInteractive ? 'auto' : 'none',
                  }}
                  aria-hidden={appExpandT > 0.5}
                  inert={appExpandT > 0.5 ? true : undefined}
                >
                  <div className="rs-duo-dual-homescreen">
                    {/* LEFT SCREEN (PAGE 1: WIDGETS + APPS) */}
                    <div className="rs-duo-home-page rs-duo-home-page--left">
                      {/* Top Widgets Row: 2x2 Weather + 2x2 Telemetry */}
                      <div className="rs-duo-widgets-row">
                        {/* iOS Weather Widget (2x2) */}
                        <div className="rs-ios-widget rs-ios-widget--weather">
                          <div className="rs-ios-widget__header">
                            <span className="rs-ios-widget__city">Gurugram</span>
                            <Sun size={18} className="rs-weather-sun-icon" />
                          </div>
                          <div className="rs-ios-widget__temp">28°</div>
                          <div className="rs-ios-widget__condition">Sunny</div>
                          <div className="rs-ios-widget__hi-lo">H:32° L:22° · AQI 84</div>
                        </div>

                        {/* RescueShip Telemetry Widget (2x2) */}
                        <div className="rs-ios-widget rs-ios-widget--telemetry">
                          <div className="rs-ios-widget__header">
                            <span className="rs-ios-widget__brand">RescueShip</span>
                            <span className="rs-widget-pulse-dot" />
                          </div>
                          <div className="rs-telemetry-val">₹430</div>
                          <div className="rs-telemetry-lbl">RTO Bleed Shield</div>
                          <div className="rs-telemetry-meta">AWB #4023118876 · Active</div>
                        </div>
                      </div>

                      {/* 4x2 App Grid Left */}
                      <div className="rs-ios-app-grid">
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--mail">
                            <Mail size={20} />
                          </div>
                          <span>Mail</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--maps">
                            <Navigation size={20} />
                          </div>
                          <span>Maps</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--photos">
                            <Camera size={20} />
                          </div>
                          <span>Photos</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--camera">
                            <Camera size={20} />
                          </div>
                          <span>Camera</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--notes">
                            <FileText size={20} />
                          </div>
                          <span>Notes</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--reminders">
                            <CheckSquare size={20} />
                          </div>
                          <span>Reminders</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--files">
                            <Folder size={20} />
                          </div>
                          <span>Files</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--settings">
                            <Settings size={20} />
                          </div>
                          <span>Settings</span>
                        </div>
                      </div>
                    </div>

                    {/* CENTER HINGE CREASE SEPARATOR */}
                    <div className="rs-duo-inner-crease" aria-hidden="true" />

                    {/* RIGHT SCREEN (PAGE 2: LIVE ACTIVITY NOTIFICATION + WHATSAPP) */}
                    <div className="rs-duo-home-page rs-duo-home-page--right">
                      {/* Live Activity Notification Banner Card */}
                      <div
                        className="rs-duo-home-activity-card"
                        onClick={() => jumpToStage(0.88)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') jumpToStage(0.88);
                        }}
                        aria-label="Launch WhatsApp Rescue Chat"
                      >
                        <div className="rs-activity-card__top">
                          <div className="rs-activity-card__badge">
                            <div className="rs-wa-squircle-sm">
                              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z" />
                              </svg>
                              <span className="rs-notif-badge">1</span>
                            </div>
                            <div>
                              <strong>RescueShip Support ✓</strong>
                              <span className="rs-activity-time">now · Delhivery NDR</span>
                            </div>
                          </div>
                          <span className="rs-activity-cta">Open WhatsApp →</span>
                        </div>
                        <p className="rs-activity-msg">
                          🚚 <strong>AWB #4023118876:</strong> Delhivery logged “Door Locked / Customer Unavailable”. Tap or scroll to confirm re-delivery on WhatsApp.
                        </p>
                      </div>

                      {/* 4x2 App Grid Right */}
                      <div className="rs-ios-app-grid">
                        <button
                          type="button"
                          className="rs-ios-app rs-ios-app--interactive"
                          onClick={() => jumpToStage(0.88)}
                          aria-label="Open WhatsApp with 1 unread message from RescueShip"
                        >
                          <div className="rs-ios-squircle rs-squircle--whatsapp">
                            <MessageCircle size={22} />
                            <span className="rs-ios-badge">1</span>
                          </div>
                          <span className="rs-ios-app__highlight">WhatsApp</span>
                        </button>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--delhivery">
                            <PackageCheck size={20} />
                          </div>
                          <span>Delhivery</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--safari">
                            <Compass size={20} />
                          </div>
                          <span>Safari</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--clock">
                            <Clock size={20} />
                          </div>
                          <span>Clock</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--music">
                            <Music size={20} />
                          </div>
                          <span>Music</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--appstore">
                            <ShoppingBag size={20} />
                          </div>
                          <span>App Store</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--health">
                            <HeartPulse size={20} />
                          </div>
                          <span>Health</span>
                        </div>
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--wallet">
                            <CreditCard size={20} />
                          </div>
                          <span>Wallet</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FLOATING FROSTED GLASS DOCK */}
                  <div className="rs-duo-floating-dock-wrap">
                    <div className="rs-duo-floating-dock">
                      <div className="rs-ios-app">
                        <div className="rs-ios-squircle rs-squircle--phone">
                          <Phone size={21} />
                        </div>
                      </div>
                      <div className="rs-ios-app">
                        <div className="rs-ios-squircle rs-squircle--safari">
                          <Compass size={21} />
                        </div>
                      </div>
                      <div className="rs-ios-app">
                        <div className="rs-ios-squircle rs-squircle--messages">
                          <MessageCircle size={21} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rs-ios-app rs-ios-app--interactive"
                        onClick={() => jumpToStage(0.88)}
                        aria-label="Open WhatsApp from dock"
                      >
                        <div className="rs-ios-squircle rs-squircle--whatsapp">
                          <MessageCircle size={21} />
                          <span className="rs-ios-badge">1</span>
                        </div>
                      </button>
                    </div>
                    <div className="rs-ios-homebar" />
                  </div>
                </div>

              {/* ------------------------------------------------------------
                  LAYER C: SIMPLE, LARGE-TEXT WHATSAPP + 3-STEP LIVE SUMMARY
                 ------------------------------------------------------------ */}
              <div
                className="rs-duo-app-fullbleed"
                style={{
                  opacity: Number(Math.min(1, appLaunchT * 1.35).toFixed(2)),
                  transform: `scale(${(0.92 + appLaunchT * 0.08).toFixed(3)})`,
                  pointerEvents: isAppInteractive ? 'auto' : 'none',
                }}
                aria-hidden={!isAppInteractive}
              >
                {/* LEFT PANE: CLEAN WHATSAPP CHAT */}
                <div className="rs-wa-pane">
                  {/* Simple Header */}
                  <div className="rs-wa-header">
                    <div className="rs-wa-avatar">RS</div>
                    <div className="rs-wa-contact">
                      <div className="rs-wa-contact__name">
                        RescueShip Support <span className="rs-wa-verified">✓</span>
                      </div>
                      <div className="rs-wa-contact__sub">
                        Official WhatsApp Business
                      </div>
                    </div>
                  </div>

                  {/* 2 Clear Scenario Tabs */}
                  <div
                    className="rs-wa-progress-bar"
                    role="group"
                    aria-label="Select Scenario"
                  >
                    <button
                      type="button"
                      className={`rs-wa-step-pill ${
                        activePathLabel === 'PRE_DELIVERY' ? 'is-active' : ''
                      }`}
                      onClick={() => handleResetFlow(false)}
                    >
                      1. Pre-Delivery
                    </button>
                    <button
                      type="button"
                      className={`rs-wa-step-pill ${
                        activePathLabel === 'NDR_INTERCEPT' ? 'is-active' : ''
                      }`}
                      onClick={() => handleResetFlow(true)}
                    >
                      2. Fake NDR Hit
                    </button>
                  </div>

                  {/* Clean Chat Bubbles (No clutter banners) */}
                  <div ref={chatScrollRef} className="rs-wa-messages">
                    {messages.map((m) => {
                      if (m.sender === 'system') return null;
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
                              <MapPin size={16} />
                              <span>GPS Pin Shared · Sector 62, Noida</span>
                            </div>
                          )}
                          <p className="rs-wa-bubble__text">
                            {renderWhatsAppFormattedText(m.text)}
                          </p>
                          <div className="rs-wa-bubble__meta">
                            <span>{m.time}</span>
                            {isUser && (
                              <CheckCheck className="rs-wa-ticks" size={15} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Big, Easy-to-Read Action Buttons */}
                  <div className="rs-wa-tray">
                    {stage === 'STAGE_1_PRE_DELIVERY' && (
                      <div className="rs-wa-btn-group">
                        <button
                          type="button"
                          className="rs-wa-action-btn rs-wa-action-btn--primary"
                          onClick={handlePreDeliveryUpi}
                        >
                          💳 Pay ₹1,190 via UPI (Save ₹50)
                        </button>
                        <button
                          type="button"
                          className="rs-wa-action-btn"
                          onClick={handleContinueToNdr}
                        >
                          🚚 Keep COD → Test Fake NDR Alert
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
                          🏠 I&apos;m Home — Re-Deliver Today
                        </button>
                        <button
                          type="button"
                          className="rs-wa-action-btn rs-wa-action-btn--danger"
                          onClick={handleBuyerCancelOrder}
                        >
                          ❌ Cancel Order (Test ₹100 Save Offer)
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
                          ⚡ Pay ₹1,140 via UPI (Save ₹100)
                        </button>
                        <button
                          type="button"
                          className="rs-wa-action-btn"
                          onClick={handleNdrConfirmAvailable}
                        >
                          🏠 Keep COD &amp; Re-Deliver
                        </button>
                      </div>
                    )}

                    {(stage === 'STAGE_1_PIN_PROMPT' ||
                      stage === 'STAGE_2_PIN_PROMPT') && (
                      <div className="rs-wa-btn-group">
                        <button
                          type="button"
                          className="rs-wa-action-btn rs-wa-action-btn--primary"
                          onClick={handleShareLocationPin}
                        >
                          📍 Share WhatsApp Location Pin
                        </button>
                        <button
                          type="button"
                          className="rs-wa-action-btn"
                          onClick={handleSkipLocationPin}
                        >
                          ⏭️ Skip — Use Saved Address
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
                          <RotateCcw size={15} /> Replay Pre-Delivery
                        </button>
                        <button
                          type="button"
                          className="rs-wa-action-btn"
                          onClick={() => handleResetFlow(true)}
                        >
                          <RotateCcw size={15} /> Replay NDR Hit
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANE: SIMPLE 3-STEP LIVE SUMMARY */}
                <div className="rs-live-dashboard-pane">
                  <div className="rs-dash-topbar">
                    <div className="rs-dash-live-pill">
                      <span className="rs-dash-pulse-dot" />
                      <span>WHAT RESCUESHIP IS DOING LIVE</span>
                    </div>
                  </div>

                  {/* Big Hero Value Card */}
                  <div className="rs-dash-hero-card">
                    <div className="rs-dash-hero-card__left">
                      <small>RTO LOSS PREVENTED</small>
                      <strong>₹430 Saved</strong>
                      <span>₹200 Courier Shipping + ₹230 Ad CAC</span>
                    </div>
                    <span
                      className={`rs-dash-status-badge ${
                        stage.includes('COMPLETED') ||
                        stage.includes('PIN_PROMPT')
                          ? 'is-saved'
                          : 'is-active'
                      }`}
                    >
                      {stage.includes('COMPLETED')
                        ? '✓ Order Rescued'
                        : '⚡ Rescue Active'}
                    </span>
                  </div>

                  {/* 3 Simple, Large, Easy-to-Read Steps */}
                  <div className="rs-dash-pipeline">
                    <div className="rs-dash-pipe-step is-active">
                      <div className="rs-dash-step-num">1</div>
                      <div className="rs-dash-step-text">
                        <strong>
                          {activePathLabel === 'PRE_DELIVERY'
                            ? 'Morning Delivery Alert Sent'
                            : 'Fake "Door Locked" Caught in 38s'}
                        </strong>
                        <p>
                          {activePathLabel === 'PRE_DELIVERY'
                            ? 'Sent WhatsApp message with ₹50 UPI discount.'
                            : 'Courier marked Door Locked with 0 calls. Alerted buyer instantly.'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`rs-dash-pipe-step ${
                        stage.includes('PIN_PROMPT') ||
                        stage.includes('COMPLETED') ||
                        stage === 'STAGE_2_CANCEL_SAVE'
                          ? 'is-active'
                          : ''
                      }`}
                    >
                      <div className="rs-dash-step-num">2</div>
                      <div className="rs-dash-step-text">
                        <strong>Buyer Confirms on WhatsApp</strong>
                        <p>
                          {stage === 'STAGE_2_CANCEL_SAVE'
                            ? 'Offered ₹100 instant UPI discount to prevent cancellation.'
                            : stage.includes('PIN_PROMPT') ||
                                stage.includes('COMPLETED')
                              ? 'Buyer confirmed availability / UPI payment in chat.'
                              : 'Waiting for you to tap an option on the left…'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`rs-dash-pipe-step ${
                        stage.includes('COMPLETED') ? 'is-active' : ''
                      }`}
                    >
                      <div className="rs-dash-step-num">3</div>
                      <div className="rs-dash-step-text">
                        <strong>Rider Gets GPS Pin &amp; Re-Delivers</strong>
                        <p>
                          {stage === 'STAGE_3_COMPLETED_PIN'
                            ? 'Sent Google Maps GPS link to courier rider for gate delivery.'
                            : stage === 'STAGE_3_COMPLETED_SKIP'
                              ? 'Scheduled priority re-attempt using buyer’s saved address.'
                              : 'Sends live GPS location to the courier rider so delivery succeeds.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
