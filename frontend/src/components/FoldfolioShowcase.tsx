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
  Video,
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
  ChevronLeft,
  Lock,
  Plus,
  Mic,
  Terminal,
  ArrowUpRight,
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
    id: 'sys-1',
    sender: 'system',
    text: 'Today · Official WhatsApp Business Account',
    time: '09:15 AM',
  },
  {
    id: 'msg-pre-1',
    sender: 'bot',
    text: '🚚 *Out for Delivery:* Your order *AWB #4023118876* (COD ₹1,240) is out with Delhivery today.\n\nConfirm availability or convert to Prepaid UPI now for ₹50 instant off:',
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
  const [liveSlaTimer, setLiveSlaTimer] = useState(38);

  // Live Dashboard pulse counter once Stage 4 starts
  useEffect(() => {
    if (!dashboardLive) return;
    const id = window.setInterval(() => {
      setLiveSlaTimer((prev) => (prev < 44 ? prev + 1 : 38));
    }, 1800);
    return () => window.clearInterval(id);
  }, [dashboardLive]);

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
        text: '⚡ 02:47 PM · Delhivery Logged "Door Locked / Customer Unavailable"',
        time: '02:47 PM',
      },
      {
        id: `b-ndr-${Date.now()}`,
        sender: 'bot',
        text: '⚠️ *Fake Attempt Intercepted (38s):* Our courier partner just marked *AWB #4023118876* as *"Customer Unavailable / Door Locked"* with 0 calls.\n\nAre you available to receive your parcel?',
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
        text: '✓ *Location Pin Received!*\nWe have shared your exact gate landmark with the courier rider for priority re-delivery.',
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
        text: '✓ *Re-Attempt Scheduled!*\nYour delivery is confirmed for priority re-attempt with your saved delivery address.',
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
          text: '⚡ 02:47 PM · Delhivery Logged "Door Locked / Customer Unavailable"',
          time: '02:47 PM',
        },
        {
          id: 'b-ndr-jump',
          sender: 'bot',
          text: '⚠️ *Fake Attempt Intercepted (38s):* Our courier partner just marked *AWB #4023118876* as *"Customer Unavailable / Door Locked"* with 0 calls.\n\nAre you available to receive your parcel?',
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
        {/* Clean Product Header */}
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
                  LAYER C: AUTHENTIC iOS WABA THREAD + SWISS TELEMETRY INSPECTOR
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
                {/* ==========================================================
                    LEFT PANE: AUTHENTIC iOS WHATSAPP BUSINESS API (WABA) CHAT
                   ========================================================== */}
                <div className="rs-wa-pane">
                  {/* Native iOS WhatsApp Top Navigation Bar */}
                  <div className="rs-wa-header">
                    <button
                      type="button"
                      className="rs-wa-back-btn"
                      onClick={() => jumpToStage(0.68)}
                      aria-label="Back to Home Screen"
                    >
                      <ChevronLeft size={22} strokeWidth={2.5} />
                      <span className="rs-wa-unread-count">12</span>
                    </button>

                    <div className="rs-wa-avatar">
                      <span>RS</span>
                    </div>

                    <div className="rs-wa-contact">
                      <div className="rs-wa-contact__name">
                        <span>RescueShip Logistics</span>
                        {/* Official Meta Verified Badge SVG */}
                        <svg
                          className="rs-wa-meta-badge"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          aria-label="Verified Business"
                        >
                          <path
                            fill="#25D366"
                            d="M12 2l2.4 2.1 3.1-.4 1.3 2.9 2.9 1.3-.4 3.1L23.4 13l-2.1 2.4.4 3.1-2.9 1.3-1.3 2.9-3.1-.4L12 24.4l-2.4-2.1-3.1.4-1.3-2.9-2.9-1.3.4-3.1L.6 13l2.1-2.4-.4-3.1 2.9-1.3 1.3-2.9 3.1.4L12 2z"
                          />
                          <path
                            fill="#FFFFFF"
                            d="M10.4 15.8l-3.6-3.6 1.4-1.4 2.2 2.2 5.4-5.4 1.4 1.4-6.8 6.8z"
                          />
                        </svg>
                      </div>
                      <div className="rs-wa-contact__sub">
                        Official Business Account · Delhivery Partner
                      </div>
                    </div>

                    <div className="rs-wa-actions">
                      <Video size={19} strokeWidth={1.8} />
                      <Phone size={17} strokeWidth={1.8} />
                    </div>
                  </div>

                  {/* Sleek Inspector Scenario Segmented Bar */}
                  <div
                    className="rs-wa-progress-bar"
                    role="group"
                    aria-label="Select Rescue Scenario"
                  >
                    <span className="rs-wa-bar-label">FLOW:</span>
                    <div className="rs-wa-segmented-track">
                      <button
                        type="button"
                        className={`rs-wa-step-pill ${
                          activePathLabel === 'PRE_DELIVERY' ? 'is-active' : ''
                        }`}
                        onClick={() => handleResetFlow(false)}
                      >
                        01 · Morning OFD Convert
                      </button>
                      <button
                        type="button"
                        className={`rs-wa-step-pill ${
                          activePathLabel === 'NDR_INTERCEPT' ? 'is-active' : ''
                        }`}
                        onClick={() => handleResetFlow(true)}
                      >
                        02 · Fake NDR Intercept
                      </button>
                    </div>
                  </div>

                  {/* Authentic WhatsApp Chat Thread */}
                  <div ref={chatScrollRef} className="rs-wa-messages">
                    <div className="rs-wa-encryption-banner">
                      <Lock size={11} />
                      <span>
                        This business uses a secure service from Meta to manage
                        this chat.
                      </span>
                    </div>

                    {messages.map((m, idx) => {
                      if (m.sender === 'system') {
                        return (
                          <div key={m.id} className="rs-wa-sys-pill">
                            {m.text}
                          </div>
                        );
                      }
                      const isUser = m.sender === 'user';
                      const isFirstBotMsg = idx === 1 && m.sender === 'bot';
                      const isLatestBotMsg =
                        m.sender === 'bot' && idx === messages.length - 1;

                      return (
                        <div
                          key={m.id}
                          className={`rs-wa-bubble-wrap ${
                            isUser
                              ? 'rs-wa-bubble-wrap--user'
                              : 'rs-wa-bubble-wrap--bot'
                          }`}
                        >
                          <div
                            className={`rs-wa-bubble ${
                              isUser
                                ? 'rs-wa-bubble--user'
                                : 'rs-wa-bubble--bot'
                            }`}
                          >
                            {/* Embedded WABA Order Summary Card on initial message */}
                            {isFirstBotMsg && (
                              <div className="rs-waba-order-card">
                                <div className="rs-waba-order-card__icon">
                                  <PackageCheck size={18} />
                                </div>
                                <div className="rs-waba-order-card__info">
                                  <strong>AWB #4023118876 · Delhivery</strong>
                                  <span>
                                    Surface Parcel · COD Collectible: ₹1,240
                                  </span>
                                </div>
                                <span className="rs-waba-order-card__tag">
                                  OFD
                                </span>
                              </div>
                            )}

                            {/* Authentic WhatsApp Location Pin Map Preview */}
                            {m.isLocationPin && (
                              <div className="rs-wa-map-card">
                                <div className="rs-wa-map-card__pin">
                                  <MapPin size={16} />
                                </div>
                                <div className="rs-wa-map-card__meta">
                                  <strong>Live GPS Location Shared</strong>
                                  <span>
                                    28.5355° N, 77.3910° E · Gate 2, Sector 62
                                  </span>
                                </div>
                              </div>
                            )}

                            <p className="rs-wa-bubble__text">
                              {renderWhatsAppFormattedText(m.text)}
                            </p>

                            {!isUser && (
                              <div className="rs-waba-footer-line">
                                RescueShip Automated Dispatch · {m.time}
                              </div>
                            )}

                            {isUser && (
                              <div className="rs-wa-bubble__meta">
                                <span>{m.time}</span>
                                <CheckCheck className="rs-wa-ticks" size={14} />
                              </div>
                            )}

                            {/* WABA Interactive Buttons Attached Directly to Latest Bot Bubble */}
                            {isLatestBotMsg && (
                              <div className="rs-waba-attached-actions">
                                {stage === 'STAGE_1_PRE_DELIVERY' && (
                                  <>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn rs-wa-action-btn--primary"
                                      onClick={handlePreDeliveryUpi}
                                    >
                                      <ArrowUpRight size={15} />
                                      <span>
                                        Pay ₹1,190 via UPI (Save ₹50 Now)
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn"
                                      onClick={handleContinueToNdr}
                                    >
                                      <span>
                                        Keep COD → Simulate Afternoon NDR Hit
                                      </span>
                                    </button>
                                  </>
                                )}

                                {stage === 'STAGE_2_NDR_HIT' && (
                                  <>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn rs-wa-action-btn--primary"
                                      onClick={handleNdrConfirmAvailable}
                                    >
                                      <span>
                                        I&apos;m Home — Lock Free Priority
                                        Re-Attempt
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn rs-wa-action-btn--danger"
                                      onClick={handleBuyerCancelOrder}
                                    >
                                      <span>
                                        Cancel Order (Triggers ₹100 UPI Save)
                                      </span>
                                    </button>
                                  </>
                                )}

                                {stage === 'STAGE_2_CANCEL_SAVE' && (
                                  <>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn rs-wa-action-btn--primary"
                                      onClick={handleAcceptCancelUpiSave}
                                    >
                                      <ArrowUpRight size={15} />
                                      <span>
                                        Pay ₹1,140 via Instant UPI (Save ₹100)
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn"
                                      onClick={handleNdrConfirmAvailable}
                                    >
                                      <span>
                                        Keep COD &amp; Confirm Re-Attempt
                                      </span>
                                    </button>
                                  </>
                                )}

                                {(stage === 'STAGE_1_PIN_PROMPT' ||
                                  stage === 'STAGE_2_PIN_PROMPT') && (
                                  <>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn rs-wa-action-btn--emerald"
                                      onClick={handleShareLocationPin}
                                    >
                                      <MapPin size={15} />
                                      <span>Share WhatsApp Location Pin</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn"
                                      onClick={handleSkipLocationPin}
                                    >
                                      <span>Skip — Use Saved Address</span>
                                    </button>
                                  </>
                                )}

                                {(stage === 'STAGE_3_COMPLETED_PIN' ||
                                  stage === 'STAGE_3_COMPLETED_SKIP') && (
                                  <div className="rs-waba-replay-row">
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn"
                                      onClick={() => handleResetFlow(false)}
                                    >
                                      <RotateCcw size={13} />
                                      <span>Replay Pre-Delivery</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-wa-action-btn"
                                      onClick={() => handleResetFlow(true)}
                                    >
                                      <RotateCcw size={13} />
                                      <span>Replay NDR Hit</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Native iOS WhatsApp Bottom Composer Bar */}
                  <div className="rs-wa-ios-composer">
                    <span className="rs-wa-composer-icon">
                      <Plus size={20} />
                    </span>
                    <div className="rs-wa-composer-pill">
                      <span>
                        {stage.includes('COMPLETED')
                          ? 'Order rescue locked · AWB #4023118876'
                          : 'Tap a quick-reply button above…'}
                      </span>
                    </div>
                    <span className="rs-wa-composer-icon">
                      <Camera size={19} />
                    </span>
                    <span className="rs-wa-composer-icon">
                      <Mic size={19} />
                    </span>
                  </div>
                </div>

                {/* ==========================================================
                    RIGHT PANE: SWISS ARCHITECTURAL TELEMETRY & RTO LEDGER
                   ========================================================== */}
                <div className="rs-live-dashboard-pane">
                  {/* Top Architectural Header */}
                  <div className="rs-dash-topbar">
                    <div className="rs-dash-topbar__title">
                      <span className="rs-dash-status-dot" />
                      <span>RESCUESHIP TELEMETRY // AWB #4023118876</span>
                    </div>
                    <span className="rs-dash-sla">
                      INTERCEPT: {liveSlaTimer}s
                    </span>
                  </div>

                  {/* Swiss Grid Row 1: Two-Part ₹430 Indian D2C RTO Bleed Ledger */}
                  <div className="rs-dash-ledger-grid">
                    <div className="rs-dash-ledger-cell">
                      <small>01 · FREIGHT &amp; QC BURN</small>
                      <strong>₹200</strong>
                      <span>₹80 Fwd + ₹80 Rev + ₹40 Pack</span>
                    </div>
                    <div className="rs-dash-ledger-cell">
                      <small>02 · SUNK AD CAC</small>
                      <strong>₹230</strong>
                      <span>Meta / Google Paid Acquisition</span>
                    </div>
                    <div
                      className={`rs-dash-ledger-cell rs-dash-ledger-cell--total ${
                        stage.includes('COMPLETED') ||
                        stage.includes('PIN_PROMPT')
                          ? 'is-saved'
                          : 'is-at-risk'
                      }`}
                    >
                      <small>
                        {stage.includes('COMPLETED') ||
                        stage.includes('PIN_PROMPT')
                          ? '✓ TOTAL BLEED SAVED'
                          : '⚠ TOTAL BLEED AT RISK'}
                      </small>
                      <strong>₹430 / RTO</strong>
                      <span>
                        {stage.includes('COMPLETED')
                          ? 'Margin Locked in Courier API'
                          : 'Active Rescue Gate Open'}
                      </span>
                    </div>
                  </div>

                  {/* Swiss Grid Row 2: Autonomous Execution State Machine */}
                  <div className="rs-dash-section-label">
                    <span>EXECUTION STATE PIPELINE</span>
                    <span>
                      {activePathLabel === 'PRE_DELIVERY'
                        ? 'MODE: OFD_PREPAID_CONVERT'
                        : 'MODE: NDR_ARREST_ENGINE'}
                    </span>
                  </div>

                  <div className="rs-dash-pipeline">
                    <div className="rs-dash-pipe-step is-active">
                      <div className="rs-dash-step-index">01</div>
                      <div className="rs-dash-step-body">
                        <div className="rs-dash-step-head">
                          <strong>
                            {activePathLabel === 'PRE_DELIVERY'
                              ? 'Out-for-Delivery Webhook Ingested'
                              : 'Fake NDR Scan Intercepted ("Door Locked")'}
                          </strong>
                          <span className="rs-dash-step-tag is-done">
                            38s SLA
                          </span>
                        </div>
                        <p>
                          {activePathLabel === 'PRE_DELIVERY'
                            ? 'Delhivery OFD scan detected at 09:15 IST. Dispatched WABA template with ₹50 UPI incentive.'
                            : 'Courier logged "Customer Unavailable". Triggered instant buyer WhatsApp verification within 90s.'}
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
                      <div className="rs-dash-step-index">02</div>
                      <div className="rs-dash-step-body">
                        <div className="rs-dash-step-head">
                          <strong>
                            Buyer Intent &amp; UPI Payment Gate
                          </strong>
                          <span
                            className={`rs-dash-step-tag ${
                              stage.includes('PIN_PROMPT') ||
                              stage.includes('COMPLETED')
                                ? 'is-done'
                                : 'is-wait'
                            }`}
                          >
                            {stage.includes('PIN_PROMPT') ||
                            stage.includes('COMPLETED')
                              ? 'VERIFIED'
                              : 'AWAITING TAP'}
                          </span>
                        </div>
                        <p>
                          {stage === 'STAGE_2_CANCEL_SAVE'
                            ? 'Buyer tapped Cancel — deployed 1-shot ₹100 instant UPI discount with 2-hour payment gate.'
                            : stage.includes('PIN_PROMPT') ||
                                stage.includes('COMPLETED')
                              ? 'Buyer availability / UPI settlement verified inside WhatsApp thread.'
                              : 'Waiting for buyer interaction inside the WhatsApp Business thread on the left.'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`rs-dash-pipe-step ${
                        stage.includes('COMPLETED') ? 'is-active' : ''
                      }`}
                    >
                      <div className="rs-dash-step-index">03</div>
                      <div className="rs-dash-step-body">
                        <div className="rs-dash-step-head">
                          <strong>
                            Courier NDR API &amp; Field Rider Dispatch
                          </strong>
                          <span
                            className={`rs-dash-step-tag ${
                              stage.includes('COMPLETED')
                                ? 'is-done'
                                : 'is-wait'
                            }`}
                          >
                            {stage === 'STAGE_3_COMPLETED_PIN'
                              ? 'GPS PIN SYNCED'
                              : stage === 'STAGE_3_COMPLETED_SKIP'
                                ? 'ADDRESS LOCKED'
                                : 'STANDBY'}
                          </span>
                        </div>
                        <p>
                          {stage === 'STAGE_3_COMPLETED_PIN' &&
                            'Reverse-geocoded gate landmark injected into Delhivery NDR API + Google Maps SMS dispatched to rider.'}
                          {stage === 'STAGE_3_COMPLETED_SKIP' &&
                            'Priority re-attempt locked in Delhivery NDR API using buyer’s verified saved address.'}
                          {!stage.includes('COMPLETED') &&
                            'Captures live WhatsApp GPS pin (or saved address) and pushes re-attempt mandate to carrier API.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Swiss Grid Row 3: Live Carrier Webhook & Rider SMS Inspector */}
                  <div className="rs-dash-webhook-box">
                    <div className="rs-dash-webhook-head">
                      <span>
                        <Terminal size={12} style={{ verticalAlign: '-1px', marginRight: '6px' }} />
                        CARRIER API PAYLOAD // DELHIVERY_NDR_V2
                      </span>
                      <span className="rs-dash-http-status">HTTP 200 OK</span>
                    </div>
                    <pre className="rs-dash-code-block">
                      {stage === 'STAGE_3_COMPLETED_PIN'
                        ? `POST /api/v2/ndr/4023118876/reattempt
{ "action": "REATTEMPT_PRIORITY", "lat": 28.5355, "lng": 77.3910,
  "rider_sms": "maps.google.com/?q=28.5355,77.3910 (Gate 2, Sec 62)" }`
                        : stage === 'STAGE_3_COMPLETED_SKIP'
                          ? `POST /api/v2/ndr/4023118876/reattempt
{ "action": "REATTEMPT_PRIORITY", "address_mode": "SAVED_VERIFIED",
  "rto_arrest_credit": "INR_430_PROTECTED" }`
                          : `STREAM /webhooks/delhivery/awb-4023118876
{ "awb": "4023118876", "cod_amount": 1240, "sla_window_sec": 90,
  "status": "${stage}" }`}
                    </pre>
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
