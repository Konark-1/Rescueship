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
  Activity,
  CheckCircle2,
  Sparkles,
  Sun,
  FileText,
  CheckSquare,
  Folder,
  Music,
  ShoppingBag,
  HeartPulse,
  CreditCard,
} from 'lucide-react';
import { IPhoneDuoViewer, RIG_SCALE, type ScreenFrame } from './iphone-duo/IPhoneDuoViewer';

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

  // Notification pop-in transition (0 = absent, 1 = fully popped in)
  const notifPopT = Math.max(0, Math.min(1, (activeP - 0.05) / 0.11));

  // Openness: 0 (closed at 180deg) -> 1 (flat open at 0deg)
  const openness = Math.max(0, Math.min(1, (activeP - 0.18) / 0.26));

  // Current hinge angle in degrees: 180deg (closed) -> 0deg (flat open)
  const currentAngle = (1 - openness) * 180;
  const isCoverFacing = currentAngle > 90;

  // Center the phone horizontally: -239px when closed -> 0px when flat open (leaf width 478px)
  // Center the folded phone horizontally (scaled 25% down along with the whole rig)
  const shiftX = -239 * RIG_SCALE * (1 - openness);

  // Subtle 3D perspective pitch & yaw during swing (peaks around 90deg like in reference)
  const swingArcTiltX = Math.sin(openness * Math.PI) * 7;
  const swingArcTiltY = -7 * (1 - openness);

  // Crease shadow cast over the right leaf dissolves from 0.92 -> 0 as phone opens
  const creaseShadowAlpha = (1 - openness) * 0.92;

  // App launch expansion (Phase 3: 0.54 -> 0.74)
  const appExpandT = Math.max(0, Math.min(1, (activeP - 0.54) / 0.20));
  const dashboardLive = activeP >= 0.70;

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
      // The positioner is scaled by RIG_SCALE, so CSS geometry must be divided
      // back up for the rendered overlay to register with the projected screen.
      overlay.style.left = `${(frame.left - (pr.left - vr.left)) / RIG_SCALE}px`;
      overlay.style.top = `${(frame.top - (pr.top - vr.top)) / RIG_SCALE}px`;
      overlay.style.width = `${frame.width / RIG_SCALE}px`;
      overlay.style.height = `${frame.height / RIG_SCALE}px`;
      overlay.style.borderRadius = `${frame.radius / RIG_SCALE}px`;
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
        {/* Top Header + 4-Stage Scroll Progress Chips */}
        <div className="rs-duo-top-header">
          <div>
            <span className="rs-fold-kicker">APPLE iPHONE DUO UNFOLD · SCROLL-DRIVEN FLOW</span>
            <h2 className="rs-fold-title">
              Unfolds like a book on scroll. <em>Expands into live WhatsApp & Dashboard.</em>
            </h2>
          </div>

          <div className="rs-fold-controls" role="tablist" aria-label="iPhone Duo Scroll Stages">
            <button
              type="button"
              role="tab"
              aria-selected={activeP < 0.22}
              className={`rs-fold-chip ${activeP < 0.22 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(activeP < 0.08 ? 0.14 : 0.02)}
            >
              1. Outer Lock Screen
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeP >= 0.22 && activeP < 0.54}
              className={`rs-fold-chip ${activeP >= 0.22 && activeP < 0.54 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(0.48)}
            >
              2. Unfolded Home
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeP >= 0.54 && activeP < 0.74}
              className={`rs-fold-chip ${activeP >= 0.54 && activeP < 0.74 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(0.64)}
            >
              3. iOS App Launch
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeP >= 0.74}
              className={`rs-fold-chip ${activeP >= 0.74 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(0.88)}
            >
              4. Live Chat + Dashboard
            </button>
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
              transform: `translateX(${shiftX.toFixed(2)}px) rotateX(${swingArcTiltX.toFixed(2)}deg) rotateY(${swingArcTiltY.toFixed(2)}deg) scale(${RIG_SCALE})`,
              transformStyle: 'preserve-3d',
              willChange: 'transform',
              zIndex: 5,
            }}
          >
            {/* Dynamic Floor Contact Shadow */}
            <div
              className="rs-duo-floor-shadow"
              style={{
                transform: `translateX(${(-shiftX).toFixed(1)}px) scaleX(${(
                  0.52 +
                  openness * 0.48
                ).toFixed(2)})`,
                opacity: webglReady ? 0 : 1,
              }}
              aria-hidden="true"
            />

            {/* =========================================================
                THE DUAL-LEAF 3D RIG (Fallback & Overlay Layer)
               ========================================================= */}
            <div className={`rs-duo-3d-chassis ${webglReady ? 'is-webgl-active' : ''}`}>
              {/* -------------------------------------------------------
                  RIGHT LEAF (Stationary Base: 330px × 490px at Z=0)
                  Naturally covered when Left Leaf is folded at 180deg!
                 ------------------------------------------------------- */}
              <div className="rs-duo-leaf rs-duo-leaf--right">
                {/* Machined Natural Titanium Frame Backing */}
                <div className="rs-duo-leaf-chassis rs-duo-leaf-chassis--right">
                  <div className="rs-duo-leaf-display rs-duo-leaf-display--right">
                    {/* Continuous Wallpaper & Right Status Bar */}
                    <div className="rs-duo-leaf-statusbar">
                      <span className="rs-duo-carrier-tag">RescueShip OS</span>
                      <div className="rs-duo-status-right">
                        <span>98%</span>
                        <Wifi size={12} />
                        <BatteryCharging size={14} />
                      </div>
                    </div>

                    {/* Right Screen Ambient Content (Wallpaper landscape) */}
                    <div className="rs-duo-right-screen-art">
                      <div className="rs-duo-wallpaper-glow" />
                    </div>
                  </div>
                </div>

                {/* Center Crease Shadow Cast by the Left Leaf as it Unfolds */}
                <div
                  className="rs-duo-crease-shadow"
                  style={{ opacity: Number(creaseShadowAlpha.toFixed(2)) }}
                  aria-hidden="true"
                />
              </div>

              {/* -------------------------------------------------------
                  CENTER HINGE SPINE (Precision Machined Titanium Tube)
                 ------------------------------------------------------- */}
              <div className="rs-duo-center-spine" aria-hidden="true">
                <span className="rs-duo-spine-cap rs-duo-spine-cap--top" />
                <span className="rs-duo-spine-cap rs-duo-spine-cap--bottom" />
              </div>

              {/* -------------------------------------------------------
                  LEFT LEAF (Swinging Door: 330px × 490px)
                  Swings from 180deg (folded shut) -> 0deg (flat open)
                  Rotates around its RIGHT edge (transform-origin: right center)!
                 ------------------------------------------------------- */}
              <div
                className="rs-duo-leaf rs-duo-leaf--left"
                style={{
                  transformOrigin: 'right center',
                  transform: `rotateY(${currentAngle.toFixed(2)}deg) translateZ(${currentAngle > 90 ? 4 : 0}px)`,
                  transformStyle: 'preserve-3d',
                  willChange: 'transform',
                  zIndex: 10,
                }}
              >
                {/* 3D Titanium Edge Wall along the opening door edge */}
                <div className="rs-duo-door-edge-wall" aria-hidden="true" />

                {/* Machined Natural Titanium Side Buttons */}
                <span className="rs-duo-side-btn rs-duo-side-btn--vol-up" aria-hidden="true" />
                <span className="rs-duo-side-btn rs-duo-side-btn--vol-down" aria-hidden="true" />

                {/* 1. COVER FACE: Visible when closed (currentAngle > 90deg) */}
                <div
                  className="rs-duo-face rs-duo-face--cover"
                  aria-hidden={!isCoverFacing}
                  inert={!isCoverFacing ? true : undefined}
                  style={{
                    opacity: isCoverFacing ? 1 : 0,
                    visibility: isCoverFacing ? 'visible' : 'hidden',
                    pointerEvents: isCoverFacing ? 'auto' : 'none',
                  }}
                >
                  <div className="rs-duo-leaf-chassis rs-duo-leaf-chassis--cover">
                    <div className="rs-duo-leaf-display rs-duo-leaf-display--cover">
                      {/* Top Status Bar + Dynamic Island */}
                      <div className="rs-duo-leaf-statusbar">
                        <span className="rs-ios-time">9:41</span>
                        <div className="rs-dynamic-island">
                          <span className="rs-island-cam" />
                        </div>
                        <div className="rs-duo-status-right">
                          <Wifi size={12} />
                          <BatteryCharging size={14} />
                        </div>
                      </div>

                      {/* Lock Screen Body (native 9:41 clock is rendered by 3D model texture) */}
                      <div className="rs-lockscreen-body">
                        {/* WhatsApp Notification: WebGL paints it on the 9:41 clock plane; this HTML
                            copy only renders for the reduced-motion CSS fallback chassis */}
                        {notifPopT > 0.02 && isCoverFacing && !webglReady && (
                          <div
                            className="rs-duo-cover-notif"
                            style={{
                              transform: `translate3d(0, ${((1 - notifPopT) * -36).toFixed(
                                1
                              )}px, 0) scale(${(0.88 + notifPopT * 0.12).toFixed(3)})`,
                              opacity: Number(notifPopT.toFixed(2)),
                            }}
                            onClick={() => jumpToStage(0.88)}
                          >
                            <div className="rs-wa-squircle-sm">
                              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z" />
                              </svg>
                              <span className="rs-notif-badge">1</span>
                            </div>
                            <div className="rs-duo-notif-copy">
                              <div className="rs-duo-notif-head">
                                <strong>RescueShip Delivery Support ✓</strong>
                                <span className="rs-duo-notif-time">now</span>
                              </div>
                              <p>
                                🚚 AWB #4023118876: Fake “Door Locked” scan intercepted. Scroll to
                                unfold.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="rs-lockscreen-bottom">
                          <span className="rs-scroll-pill">Keep scrolling to unfold phone →</span>
                          <div className="rs-ios-homebar" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. INNER LEFT FACE: Visible when open (currentAngle <= 90deg) */}
                <div
                  className="rs-duo-face rs-duo-face--inner-left"
                  aria-hidden={isCoverFacing}
                  inert={isCoverFacing ? true : undefined}
                  style={{
                    opacity: !isCoverFacing ? 1 : 0,
                    visibility: !isCoverFacing ? 'hidden' : 'visible',
                    pointerEvents: !isCoverFacing ? 'none' : 'auto',
                  }}
                >
                  <div className="rs-duo-leaf-chassis rs-duo-leaf-chassis--inner-left">
                    <div className="rs-duo-leaf-display rs-duo-leaf-display--inner-left">
                      <div className="rs-duo-leaf-statusbar">
                        <span className="rs-ios-time">9:41 · 5G</span>
                        <span className="rs-duo-carrier-tag">5G</span>
                      </div>
                      <div className="rs-duo-wallpaper-glow" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================================================
                SEAMLESS FLAT PANORAMIC OVERLAY
                Renders when phone is flat open
                Contains the dual-page iOS Home Screen, widgets, app grid,
                iOS app-launch morph, WhatsApp chat, and live Dashboard!
               ========================================================= */}
            <div
              className="rs-duo-panoramic-overlay"
              ref={panoramaRef}
              style={{
                opacity: Number(Math.max(0, Math.min(1, (openness - 0.84) / 0.14)).toFixed(2)),
                pointerEvents: openness > 0.94 ? 'auto' : 'none',
              }}
              aria-hidden={openness <= 0.94}
              inert={openness <= 0.94 ? true : undefined}
            >
              <div className="rs-duo-panoramic-bezel">
                {/* Continuous Top Status Bar */}
                <div
                  className="rs-duo-continuous-status"
                  style={{
                    opacity: Number((1 - Math.min(1, appExpandT * 1.4)).toFixed(2)),
                    visibility: appExpandT > 0.98 ? 'hidden' : 'visible',
                  }}
                  aria-hidden={appExpandT > 0.5}
                >
                  <div className="rs-duo-status-left">
                    <span>9:41</span>
                    <span className="rs-duo-carrier-tag">5G</span>
                  </div>
                  <div className="rs-dynamic-island">
                    <span className="rs-island-cam" />
                  </div>
                  <div className="rs-duo-status-right">
                    <span>98%</span>
                    <Wifi size={12} />
                    <BatteryCharging size={14} />
                  </div>
                </div>

                {/* LAYER 1: AUTHENTIC iPHONE DUO DUAL-PAGE iOS HOME SCREEN */}
                <div
                  className="rs-duo-home-layer"
                  style={{
                    opacity: Number((1 - appExpandT * 0.95).toFixed(2)),
                    transform: `scale(${(1 - appExpandT * 0.06).toFixed(3)})`,
                    pointerEvents: appExpandT > 0.5 ? 'none' : 'auto',
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
                          🚚 <strong>AWB #4023118876:</strong> Fake “Door Locked” scan intercepted (1.42 km away). Tap to resolve via WhatsApp.
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

                {/* LAYER 2: iOS APP-LAUNCH EXPANSION -> FULL-SCREEN WHATSAPP + LIVE DASHBOARD */}
                <div
                  className="rs-duo-app-launch-layer"
                  style={{
                    opacity: Number(Math.min(1, appExpandT * 1.35).toFixed(2)),
                    transform: `translate3d(0, ${((1 - appExpandT) * -28).toFixed(
                      1
                    )}px, 0) scale(${(0.32 + appExpandT * 0.68).toFixed(3)})`,
                    borderRadius: `${((1 - appExpandT) * 28).toFixed(0)}px`,
                    pointerEvents: appExpandT > 0.6 ? 'auto' : 'none',
                  }}
                  aria-hidden={appExpandT <= 0.6}
                  inert={appExpandT <= 0.6 ? true : undefined}
                >
                  <div className="rs-duo-fullscreen-split">
                    {/* LEFT HALF: OFFICIAL iOS WHATSAPP RESCUE CHAT */}
                    <div className="rs-wa-pane">
                      <div className="rs-wa-header">
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
                          <Video size={14} />
                          <Phone size={13} />
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
                                  <MapPin size={13} />
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
                              <RotateCcw size={12} /> Replay Pre-Delivery
                            </button>
                            <button
                              type="button"
                              className="rs-wa-action-btn"
                              onClick={() => handleResetFlow(true)}
                            >
                              <RotateCcw size={12} /> Replay NDR Hit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT HALF: LIVE RESCUESHIP TELEMETRY COMMAND DASHBOARD */}
                    <div className="rs-live-dashboard-pane">
                      <div className="rs-dash-topbar">
                        <div className="rs-dash-live-pill">
                          <span className="rs-dash-pulse-dot" />
                          <span>LIVE RESCUESHIP DASHBOARD</span>
                        </div>
                        <span className="rs-dash-sla">{liveSlaTimer}s SLA</span>
                      </div>

                      {/* Top KPI Strip */}
                      <div className="rs-dash-kpi-grid">
                        <div className="rs-dash-kpi">
                          <small>PARCEL AWB</small>
                          <strong>#4023118876</strong>
                          <span>Delhivery Surface</span>
                        </div>
                        <div className="rs-dash-kpi">
                          <small>RTO BLEED PROTECTED</small>
                          <strong className="rs-dash-emerald">₹430 / Order</strong>
                          <span>₹200 Freight + ₹230 CAC</span>
                        </div>
                      </div>

                      {/* Live Sequential Lifecycle Pipeline inside Dashboard */}
                      <div className="rs-dash-pipeline">
                        <div className="rs-dash-pipe-step is-active">
                          <CheckCircle2 size={15} className="rs-dash-step-icon" />
                          <div>
                            <strong>
                              {activePathLabel === 'PRE_DELIVERY'
                                ? '1. Pre-Delivery Out-for-Delivery Trigger'
                                : '1. Fake NDR Scan Intercepted (1.42 km drift)'}
                            </strong>
                            <p>
                              {activePathLabel === 'PRE_DELIVERY'
                                ? 'Dispatched morning WhatsApp with ₹50 UPI incentive.'
                                : 'Rider logged "Door Locked" with 0 IVR calls — intercepted in 38s.'}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`rs-dash-pipe-step ${
                            stage.includes('PIN_PROMPT') || stage.includes('COMPLETED')
                              ? 'is-active'
                              : ''
                          }`}
                        >
                          <Activity size={15} className="rs-dash-step-icon" />
                          <div>
                            <strong>2. Buyer Action & Payment Gate</strong>
                            <p>
                              {stage.includes('PIN_PROMPT') || stage.includes('COMPLETED')
                                ? 'Buyer confirmed availability inside WhatsApp.'
                                : 'Waiting for buyer tap in the WhatsApp chat on the left...'}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`rs-dash-pipe-step ${
                            stage.includes('COMPLETED') ? 'is-active' : ''
                          }`}
                        >
                          <Sparkles size={15} className="rs-dash-step-icon" />
                          <div>
                            <strong>3. Final GPS Pin / Skip Sync to Courier API</strong>
                            <p>
                              {stage === 'STAGE_3_COMPLETED_PIN' &&
                                '✓ Gate landmark injected into Delhivery NDR API + Google Maps SMS sent to rider.'}
                              {stage === 'STAGE_3_COMPLETED_SKIP' &&
                                '✓ Buyer skipped pin; priority re-attempt locked using saved address.'}
                              {!stage.includes('COMPLETED') &&
                                'Final step asks for WhatsApp Location Pin alongside Skip button.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Live Webhook Event Ticker */}
                      <div className="rs-dash-webhook-box">
                        <div className="rs-dash-webhook-head">
                          <span>COURIER WEBHOOK STREAM</span>
                          <span>200 OK</span>
                        </div>
                        <code>
                          {stage === 'STAGE_3_COMPLETED_PIN'
                            ? 'POST /ndr/reattempt { lat: 28.5355, lng: 77.3910, sms_rider: true }'
                            : stage === 'STAGE_3_COMPLETED_SKIP'
                            ? 'POST /ndr/reattempt { use_saved_address: true, priority: "HIGH" }'
                            : stage === 'STAGE_2_CANCEL_SAVE'
                            ? 'POST /retention/upi-hold { status: "UPI_DISCOUNT_OFFERED", window_sec: 7200 }'
                            : stage === 'STAGE_2_NDR_HIT'
                            ? 'STREAM /webhooks/delhivery/ndr-fake-scan { code: "DOOR_LOCKED", distance_km: 1.42 }'
                            : 'STREAM /webhooks/delhivery/awb-4023118876 -> LISTENING'}
                        </code>
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
