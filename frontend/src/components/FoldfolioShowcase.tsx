import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  useScroll,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
  AnimatePresence,
  motion,
} from 'motion/react';
import {
  Phone,
  Navigation,
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

type ScenarioMode = 'ndr' | 'ofd';
type NdrStep = 'initial' | 'im_home' | 'cancel_offer' | 'pin_dropped' | 'saved_via_upi';
type OfdStep = 'initial' | 'prepaid_paid' | 'pin_dropped' | 'skipped_pin';

export const FoldfolioShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Stage 4 Split-View Scenario State
  const [scenario, setScenario] = useState<ScenarioMode>('ndr');
  const [ndrStep, setNdrStep] = useState<NdrStep>('initial');
  const [ofdStep, setOfdStep] = useState<OfdStep>('initial');
  const waStreamRef = useRef<HTMLDivElement>(null);

  const isRescued =
    (scenario === 'ndr' && (ndrStep === 'pin_dropped' || ndrStep === 'saved_via_upi')) ||
    (scenario === 'ofd' && ofdStep !== 'initial');

  const netSavedAmount =
    scenario === 'ndr'
      ? ndrStep === 'saved_via_upi'
        ? '₹330'
        : '₹430'
      : '₹380';

  const activeStage =
    activeP < 0.22
      ? {
          backdropWord: 'INTERCEPT',
          pillTitle: 'Courier marks “Door Locked”',
          pillSub: 'Instant WhatsApp ping lands on the lock screen.',
          accent: 'vermilion',
        }
      : activeP < 0.54
        ? {
            backdropWord: 'CONTINUITY',
            pillTitle: 'Unfold to inspect the order',
            pillSub: 'iOS notification expands seamlessly across the hinge.',
            accent: 'vermilion',
          }
        : activeP < 0.72
          ? {
              backdropWord: 'WORKSPACE',
              pillTitle: 'Swipe up to launch Split-View',
              pillSub: 'Transitioning from Home Screen into live rescue mode.',
              accent: 'emerald',
            }
          : {
              backdropWord: 'AUTONOMOUS',
              pillTitle: 'Interactive Sandbox — Tap inside WhatsApp',
              pillSub: 'Test both rescue flows live inside the unfolded display.',
              accent: 'emerald',
            };

  useEffect(() => {
    if (waStreamRef.current) {
      waStreamRef.current.scrollTop = waStreamRef.current.scrollHeight;
    }
  }, [ndrStep, ofdStep, scenario]);

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
      className="rs-duo-scroll-track rs-duo-master-track"
      aria-label="Interactive iPhone Duo Unfold & WhatsApp Live Dashboard Showcase"
    >
      <div className="rs-duo-sticky-stage rs-duo-sticky-frame">
        {/* 1. VOLUMETRIC STUDIO LIGHTING & 3D PERSPECTIVE PEDESTAL */}
        <div
          className="rs-volumetric-stage"
          style={
            {
              '--unfold-t': unfoldT,
              '--app-t': appLaunchT,
            } as React.CSSProperties
          }
          aria-hidden="true"
        >
          {/* Depth-Parallax Giant Editorial Watermark Behind the Phone */}
          <div className="rs-volumetric-watermark">
            <AnimatePresence mode="wait">
              <motion.span
                key={activeStage.backdropWord}
                initial={{ opacity: 0, scale: 0.94, filter: 'blur(12px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.04, filter: 'blur(12px)' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="rs-volumetric-word"
              >
                {activeStage.backdropWord}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* 3D Tilted Floor Light Ring under the iPhone */}
          <div className="rs-volumetric-pedestal" />
        </div>

        {/* ===============================================================
            AUTHENTIC 3D IPHONE DUO CHASSIS STAGE (akashtdev/iphone-duo-animation)
            Left Leaf physically swings open 180deg -> 0deg around Center Spine!
           =============================================================== */}
        <div className="rs-duo-stage-center rs-duo-center-viewport" ref={viewportRef}>
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
                {/* ==========================================================
                    STAGE 4 — INNER SCREEN iOS FOLDABLE SPLIT-VIEW WORKSPACE
                   ========================================================== */}
                <div className="rs-s4-modern" data-testid="foldfolio-stage4-app">
                  {/* Floating Segmented Switcher Bar */}
                  <header className="rs-s4-header">
                    <div className="rs-s4-segmented" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={scenario === 'ndr'}
                        className={`rs-s4-seg-btn ${scenario === 'ndr' ? 'is-active' : ''}`}
                        onClick={() => {
                          setScenario('ndr');
                          setNdrStep('initial');
                        }}
                      >
                        Fake “Door Locked” Rescue
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={scenario === 'ofd'}
                        className={`rs-s4-seg-btn ${scenario === 'ofd' ? 'is-active' : ''}`}
                        onClick={() => {
                          setScenario('ofd');
                          setOfdStep('initial');
                        }}
                      >
                        Morning COD → Prepaid
                      </button>
                    </div>

                    <button
                      type="button"
                      className="rs-s4-replay"
                      onClick={() => (scenario === 'ndr' ? setNdrStep('initial') : setOfdStep('initial'))}
                    >
                      Replay
                    </button>
                  </header>

                  {/* Split Screen Canvas */}
                  <div className="rs-s4-canvas">
                    {/* LEFT: Clean Native WhatsApp Thread */}
                    <div className="rs-s4-chat-card">
                      <div className="rs-s4-chat-top">
                        <div className="rs-s4-chat-avatar">UV</div>
                        <div className="rs-s4-chat-brand">
                          <strong>UrbanVeda Store ✓</strong>
                          <span>WhatsApp Business · Verified</span>
                        </div>
                      </div>

                      <div className="rs-s4-chat-body" ref={waStreamRef}>
                        {scenario === 'ndr' ? (
                          <>
                            <div className="rs-s4-msg is-bot">
                              <p>
                                Delhivery marked your <strong>₹1,899 order</strong> as{' '}
                                <em>“Door Locked”</em> just now. Are you home at Sector 62, Noida?
                              </p>
                            </div>

                            {ndrStep === 'initial' && (
                              <div className="rs-s4-actions">
                                <button
                                  type="button"
                                  className="rs-s4-action-btn is-green"
                                  onClick={() => setNdrStep('im_home')}
                                >
                                  Yes, I’m Home — Deliver Today
                                </button>
                                <button
                                  type="button"
                                  className="rs-s4-action-btn is-muted"
                                  onClick={() => setNdrStep('cancel_offer')}
                                >
                                  Cancel Order
                                </button>
                              </div>
                            )}

                            {(ndrStep === 'im_home' || ndrStep === 'pin_dropped') && (
                              <>
                                <div className="rs-s4-msg is-user">Yes, I’m Home — Deliver Today</div>
                                <div className="rs-s4-msg is-bot">
                                  <p>
                                    Priority re-attempt locked for free! Drop your <strong>1-tap Gate Pin</strong> so
                                    the rider gets a Google Maps link.
                                  </p>
                                </div>
                                {ndrStep === 'im_home' && (
                                  <div className="rs-s4-actions">
                                    <button
                                      type="button"
                                      className="rs-s4-action-btn is-green"
                                      onClick={() => setNdrStep('pin_dropped')}
                                    >
                                      📍 Share Live Gate Pin
                                    </button>
                                  </div>
                                )}
                              </>
                            )}

                            {(ndrStep === 'cancel_offer' || ndrStep === 'saved_via_upi') && (
                              <>
                                <div className="rs-s4-msg is-user">Cancel Order</div>
                                <div className="rs-s4-msg is-bot">
                                  <p>
                                    Wait! Take an <strong>instant ₹100 OFF</strong> right now via UPI (Pay ₹1,799) for
                                    priority delivery today.
                                  </p>
                                </div>
                                {ndrStep === 'cancel_offer' && (
                                  <div className="rs-s4-actions">
                                    <button
                                      type="button"
                                      className="rs-s4-action-btn is-green"
                                      onClick={() => setNdrStep('saved_via_upi')}
                                    >
                                      ⚡ Pay ₹1,799 via UPI (Save ₹100)
                                    </button>
                                  </div>
                                )}
                              </>
                            )}

                            {isRescued && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="rs-s4-msg is-user is-pin"
                              >
                                📍 Gate #2 near Fortis, Sector 62 Shared
                              </motion.div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="rs-s4-msg is-bot">
                              <p>
                                Your ₹1,899 COD order is out for delivery! Convert to{' '}
                                <strong>Priority Prepaid via UPI</strong> now and get <strong>₹50 OFF</strong> (Pay
                                ₹1,849).
                              </p>
                            </div>

                            {ofdStep === 'initial' && (
                              <div className="rs-s4-actions">
                                <button
                                  type="button"
                                  className="rs-s4-action-btn is-green"
                                  onClick={() => setOfdStep('prepaid_paid')}
                                >
                                  ⚡ Pay ₹1,849 via UPI (Save ₹50)
                                </button>
                              </div>
                            )}

                            {ofdStep !== 'initial' && (
                              <>
                                <div className="rs-s4-msg is-user">Paid ₹1,849 via UPI</div>
                                <div className="rs-s4-msg is-bot">
                                  <p>Prepaid locked! Drop a 1-tap Gate Pin for your delivery rider.</p>
                                </div>
                                {ofdStep === 'prepaid_paid' && (
                                  <div className="rs-s4-actions">
                                    <button
                                      type="button"
                                      className="rs-s4-action-btn is-green"
                                      onClick={() => setOfdStep('pin_dropped')}
                                    >
                                      📍 Drop 1-Tap Gate Pin
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Visual Telemetry & Map Radar Showcase (Zero Monospace Wall) */}
                    <div className="rs-s4-visual-pane">
                      {/* Top Bento Row: Live Radar Map + Giant Savings Card */}
                      <div className="rs-s4-bento-top">
                        {/* Visual Radar Map Card */}
                        <div className={`rs-s4-radar-card ${isRescued ? 'is-locked' : ''}`}>
                          <div className="rs-s4-radar-rings">
                            <span className="rs-radar-ring r1" />
                            <span className="rs-radar-ring r2" />
                            <span className="rs-radar-pin">{isRescued ? '📍' : '•'}</span>
                          </div>
                          <div className="rs-s4-radar-caption">
                            <strong>{isRescued ? 'Gate Pin Synced' : 'Awaiting Buyer Pin'}</strong>
                            <span>{isRescued ? 'Google Maps link sent to rider' : 'Noida Sector 62 Hub'}</span>
                          </div>
                        </div>

                        {/* Giant ₹430 Saved Hero Card */}
                        <div className="rs-s4-savings-card">
                          <span className="rs-s4-savings-label">RTO LOSS PREVENTED</span>
                          <strong className="rs-s4-savings-value">{netSavedAmount}</strong>
                          <div className="rs-s4-savings-bar">
                            <span className="bar-courier" title="₹200 Direct Courier & Pack" />
                            <span className="bar-cac" title="₹230 Sunk Paid Ad CAC" />
                          </div>
                          <div className="rs-s4-savings-legend">
                            <span>₹200 Shipping</span>
                            <span>+ ₹230 Ad CAC</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Visual Step Progression */}
                      <div className="rs-s4-steps-card">
                        <div className="rs-s4-step is-complete">
                          <span className="rs-step-dot">✓</span>
                          <div>
                            <strong>Courier Event Caught Instantly</strong>
                            <span>{scenario === 'ndr' ? 'Delhivery marked “Door Locked”' : 'Order marked Out for Delivery'}</span>
                          </div>
                        </div>

                        <div className={`rs-s4-step ${ndrStep !== 'initial' || ofdStep !== 'initial' ? 'is-complete' : 'is-active'}`}>
                          <span className="rs-step-dot">{ndrStep !== 'initial' || ofdStep !== 'initial' ? '✓' : '2'}</span>
                          <div>
                            <strong>Buyer Verified on WhatsApp</strong>
                            <span>
                              {ndrStep === 'saved_via_upi'
                                ? 'Saved via ₹100 instant UPI offer'
                                : scenario === 'ofd' && ofdStep !== 'initial'
                                  ? 'Converted COD to Prepaid (₹50 off)'
                                  : 'Zero-discount priority re-attempt'}
                            </span>
                          </div>
                        </div>

                        <div className={`rs-s4-step ${isRescued ? 'is-complete' : ''}`}>
                          <span className="rs-step-dot">{isRescued ? '✓' : '3'}</span>
                          <div>
                            <strong>Rider Dispatched with Gate Landmark</strong>
                            <span>Reverse-geocoded landmark pushed to courier API</span>
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
        </div>

        {/* 2. SINGLE FLOATING DYNAMIC ISLAND CAPTION PILL (BOTTOM) */}
        <div className="rs-floating-island-wrap">
          <motion.div layout className="rs-floating-island">
            <span className={`rs-island-pulse is-${activeStage.accent}`} />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStage.pillTitle}
                initial={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="rs-island-copy"
              >
                <strong>{activeStage.pillTitle}</strong>
                <span>{activeStage.pillSub}</span>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
