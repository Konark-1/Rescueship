import React, { useState, useRef, useEffect } from 'react';
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
  Flashlight,
  Music,
  Heart,
  Wallet,
  Folder,
  FileText,
  ListTodo,
  ShoppingBag,
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

const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export const FoldfolioShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 105,
    damping: 24,
    mass: 0.65,
  });

  const [manualProgress, setManualProgress] = useState<number | null>(null);
  const [p, setP] = useState(0);

  useMotionValueEvent(smoothProgress, 'change', (val) => {
    if (manualProgress === null) setP(val);
  });

  useMotionValueEvent(scrollYProgress, 'change', (raw) => {
    if (manualProgress !== null && Math.abs(raw - manualProgress) > 0.12) {
      setManualProgress(null);
    }
  });

  const activeP = prefersReducedMotion
    ? (manualProgress ?? scrollYProgress.get())
    : (manualProgress ?? p);

  // Phase 1 -> 2: 3D Book Unfold (0.06 to 0.48)
  const rawUnfold = Math.max(0, Math.min(1, (activeP - 0.06) / 0.42));
  const unfoldT = easeInOutCubic(rawUnfold);

  // Subtle Homescreen supplemental widget reveal on the left plane as it finishes unfolding
  const homeWidgetsT = Math.max(0, Math.min(1, (activeP - 0.28) / 0.20));

  // Phase 3 -> 4: WhatsApp App Launch from the notification/icon plane (0.54 to 0.78)
  const rawAppLaunch = Math.max(0, Math.min(1, (activeP - 0.54) / 0.24));
  const appLaunchT = easeInOutCubic(rawAppLaunch);
  const isAppInteractive = appLaunchT > 0.55;

  // Center the folded 470px phone (-235px offset) -> smoothly glide to 0px for the 940px unfolded spread
  const chassisShiftX = -(1 - unfoldT) * 235;
  // Left Translucent Glass Wing rotates from 180deg (folded over right wing) -> 0deg (open flat)
  const leftWingDeg = (1 - unfoldT) * 180;
  // Dynamic specular light sweep across the glass wing as it rotates through 3D space
  const glassSweepPercent = Math.round(unfoldT * 100);
  // Shadow cast by the folding glass wing onto the right homescreen underneath
  const rightCoverShadow = Math.max(0, (1 - unfoldT) * 0.68);
  // Inner glass translucency transitions from frosted see-through (when folded) to unified panoramic wallpaper (when open)
  const innerWallpaperSolidT = Math.max(0, Math.min(1, (unfoldT - 0.35) / 0.65));

  const [stage, setStage] = useState<FlowStage>('STAGE_1_PRE_DELIVERY');
  const [activePathLabel, setActivePathLabel] = useState<'PRE_DELIVERY' | 'NDR_INTERCEPT'>('PRE_DELIVERY');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [liveSlaTimer, setLiveSlaTimer] = useState(38);

  useEffect(() => {
    if (!isAppInteractive) return;
    const id = window.setInterval(() => {
      setLiveSlaTimer((prev) => (prev < 44 ? prev + 1 : 38));
    }, 1800);
    return () => window.clearInterval(id);
  }, [isAppInteractive]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, stage, isAppInteractive]);

  const appendMessages = (newMsgs: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMsgs]);
  };

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
    setManualProgress(targetProgress);
    setP(targetProgress);
  };

  return (
    <section
      ref={containerRef}
      id="foldfolio-demo"
      className="rs-duo-master-track"
      aria-label="Interactive Apple iPhone Duo Unfold"
    >
      <div className="rs-duo-waypoints" aria-hidden="true">
        <div className="rs-duo-waypoint" />
        <div className="rs-duo-waypoint" />
        <div className="rs-duo-waypoint" />
        <div className="rs-duo-waypoint" />
      </div>

      <div className="rs-duo-sticky-frame">
        <div className="rs-duo-header-bar">
          <div>
            <span className="rs-fold-kicker">
              APPLE iPHONE DUO UNFOLD · SCROLL-DRIVEN FLOW
            </span>
            <h2 className="rs-fold-title">
              Unfolds like a book on scroll.{' '}
              <em>Expands into live WhatsApp &amp; Dashboard.</em>
            </h2>
          </div>
          <div className="rs-fold-controls" role="tablist" aria-label="Stages">
            <button
              type="button"
              role="tab"
              aria-selected={activeP < 0.25}
              className={`rs-fold-chip ${activeP < 0.25 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(0.02)}
            >
              1. Outer Lock
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeP >= 0.25 && activeP < 0.54}
              className={`rs-fold-chip ${activeP >= 0.25 && activeP < 0.54 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(0.48)}
            >
              2. Unfolded Home
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeP >= 0.54 && activeP < 0.74}
              className={`rs-fold-chip ${activeP >= 0.54 && activeP < 0.74 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(0.72)}
            >
              3. iOS App Launch
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeP >= 0.74}
              className={`rs-fold-chip ${activeP >= 0.74 ? 'is-active' : ''}`}
              onClick={() => jumpToStage(0.9)}
            >
              4. Live Chat
            </button>
          </div>
        </div>

        <div className="rs-duo-stage-center">
          <div
            className="rs-duo-rig-wrapper"
            style={{
              transform: `translate3d(${chassisShiftX.toFixed(1)}px, 0, 0)`,
            }}
          >
            {/* ==============================================================
                LEFT WING: TRANSLUCENT GLASS FOLDING LEAF (180deg -> 0deg)
                Uses the EXACT SAME PLANE for the Clock (9:41) and WhatsApp
                Notification Popup on both the Front Cover and Left Homescreen!
               ============================================================== */}
            <div
              className="rs-duo-wing rs-duo-wing--left"
              style={{
                transform: `translate3d(0, 0, 2px) rotateY(${leftWingDeg.toFixed(2)}deg)`,
              }}
            >
              {/* Machined Titanium Hinge Barrel on the Folding Spine */}
              <div
                className="rs-duo-hinge-spine"
                style={{ opacity: Number((1 - unfoldT * 0.85).toFixed(2)) }}
                aria-hidden="true"
              />

              {/* 1. OUTER FRONT COVER FACE (Visible when folded: 180deg -> 90deg) */}
              <div
                className="rs-duo-wing-face rs-duo-wing-face--front"
                aria-hidden={unfoldT > 0.5}
              >
                <div className="rs-translucent-cover-glass">
                  {/* Dynamic Specular Glass Glare that sweeps as the phone unfolds */}
                  <div
                    className="rs-glass-specular-sheen"
                    style={{
                      backgroundPosition: `${glassSweepPercent}% 50%`,
                    }}
                    aria-hidden="true"
                  />

                  {/* Top Outer Sensors (Camera Lens + Dashed Signal Ring from akashtdev) */}
                  <div className="rs-cover-top-sensors">
                    <span className="rs-cover-lens" />
                    <span className="rs-cover-signal-ring">
                      <Wifi size={16} />
                    </span>
                  </div>

                  {/* SHARED LOCK/HOME PLANE: Clock (9:41) + Translucent WhatsApp Notification */}
                  <div className="rs-shared-lockscreen-layer">
                    <div className="rs-big-lock-clock">
                      <div className="rs-big-lock-date">Wed Apr 1</div>
                      <div className="rs-big-lock-time">9:41</div>
                    </div>

                    <button
                      type="button"
                      className="rs-glass-lock-notif"
                      onClick={() => jumpToStage(0.48)}
                    >
                      <div className="rs-wa-squircle-sm">
                        <MessageCircle size={22} />
                        <span className="rs-notif-badge">1</span>
                      </div>
                      <div className="rs-glass-lock-notif__copy">
                        <div className="rs-glass-lock-notif__row">
                          <strong>RescueShip Delivery Support ✓</strong>
                          <span>now</span>
                        </div>
                        <p>
                          🚚 AWB #4023118876: Fake “Door Locked” scan
                          intercepted (1.42 km away). Scroll to unfold.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Bottom Translucent Glass Shortcuts */}
                  <div className="rs-cover-bottom-shortcuts">
                    <span className="rs-shortcut-circle">
                      <Flashlight size={16} />
                    </span>
                    <span className="rs-shortcut-circle">
                      <Camera size={16} />
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. INNER LEFT HOMESCREEN FACE (Visible as wing opens: 90deg -> 0deg)
                  Keeps the Clock (9:41) and WhatsApp Notification on the EXACT SAME PLANE! */}
              <div
                className="rs-duo-wing-face rs-duo-wing-face--back"
                aria-hidden={unfoldT <= 0.5}
              >
                <div
                  className="rs-desert-wallpaper rs-desert-wallpaper--inner-left"
                  style={{
                    backgroundColor: `rgb(184 196 204 / ${Math.round(
                      (0.45 + innerWallpaperSolidT * 0.55) * 100
                    )}%)`,
                  }}
                >
                  {/* Glass Specular Finish */}
                  <div
                    className="rs-glass-specular-sheen"
                    style={{
                      backgroundPosition: `${100 - glassSweepPercent}% 50%`,
                    }}
                    aria-hidden="true"
                  />

                  {/* Left Half of Unified iOS Status Bar */}
                  <div
                    className="rs-wing-statusbar rs-wing-statusbar--left"
                    style={{ opacity: Number((1 - appLaunchT).toFixed(2)) }}
                  >
                    <span>9:41</span>
                    <span>5G</span>
                  </div>

                  {/* SAME PLANE ON HOMESCREEN: Clock (9:41) + WhatsApp Notification Popup */}
                  <div
                    className="rs-left-homescreen-plane"
                    style={{
                      opacity: Number((1 - appLaunchT * 0.95).toFixed(2)),
                      transform: `scale(${(1 - appLaunchT * 0.05).toFixed(3)})`,
                    }}
                  >
                    <div className="rs-shared-lockscreen-layer rs-shared-lockscreen-layer--home">
                      <div className="rs-big-lock-clock">
                        <div className="rs-big-lock-date">Wed Apr 1</div>
                        <div className="rs-big-lock-time">9:41</div>
                      </div>

                      <button
                        type="button"
                        className="rs-glass-lock-notif rs-glass-lock-notif--home-active"
                        onClick={() => jumpToStage(0.9)}
                      >
                        <div className="rs-wa-squircle-sm">
                          <MessageCircle size={22} />
                          <span className="rs-notif-badge">1</span>
                        </div>
                        <div className="rs-glass-lock-notif__copy">
                          <div className="rs-glass-lock-notif__row">
                            <strong>RescueShip Delivery Support ✓</strong>
                            <span className="rs-open-chat-badge">
                              Tap to Open →
                            </span>
                          </div>
                          <p>
                            🚚 AWB #4023118876: Fake “Door Locked” scan
                            intercepted (1.42 km away). Confirm availability or
                            pay via UPI.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Supplemental Frosted Glass Widgets below the Notification on the Left Homescreen */}
                    <div
                      className="rs-left-home-widgets-row"
                      style={{
                        opacity: Number(homeWidgetsT.toFixed(2)),
                        transform: `translateY(${((1 - homeWidgetsT) * 12).toFixed(1)}px)`,
                      }}
                    >
                      <div className="rs-frosted-widget">
                        <div className="rs-frosted-widget__head">
                          <span>Gurugram</span>
                          <Sun size={15} className="rs-sun-icon" />
                        </div>
                        <div className="rs-frosted-widget__temp">28°</div>
                        <div className="rs-frosted-widget__foot">
                          <strong>Sunny · AQI 84</strong>
                          <span>Delhivery North Hub</span>
                        </div>
                      </div>

                      <div className="rs-frosted-widget">
                        <div className="rs-frosted-widget__head">
                          <span>RTO SHIELD</span>
                          <span className="rs-emerald-dot" />
                        </div>
                        <div className="rs-frosted-widget__temp rs-emerald-text">
                          ₹430
                        </div>
                        <div className="rs-frosted-widget__foot">
                          <strong>Bleed Protected</strong>
                          <span>₹200 Freight + ₹230 CAC</span>
                        </div>
                      </div>
                    </div>

                    {/* Left Half of Translucent Frosted Glass Dock */}
                    <div className="rs-wing-dock-row rs-wing-dock-row--left">
                      <div className="rs-frosted-ios-dock rs-frosted-ios-dock--left">
                        <div className="rs-squircle-52 rs-sq--green">
                          <Phone size={24} />
                        </div>
                        <div className="rs-squircle-52 rs-sq--blue">
                          <Compass size={24} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ==============================================================
                RIGHT WING: BASE TITANIUM CHASSIS & RIGHT HOMESCREEN
                Sits underneath the Translucent Glass Left Wing when folded,
                so its wallpaper & icons blur through the front cover!
               ============================================================== */}
            <div className="rs-duo-wing rs-duo-wing--right">
              <div className="rs-duo-wing-face rs-duo-wing-face--right">
                <div className="rs-desert-wallpaper rs-desert-wallpaper--inner-right">
                  {/* Glass Specular Finish */}
                  <div className="rs-glass-specular-sheen" aria-hidden="true" />

                  {/* Right Half of Unified iOS Status Bar */}
                  <div
                    className="rs-wing-statusbar rs-wing-statusbar--right"
                    style={{ opacity: Number((1 - appLaunchT).toFixed(2)) }}
                  >
                    <div className="rs-unified-island" />
                    <div className="rs-wing-statusbar__right">
                      <span>98%</span>
                      <Wifi size={14} />
                      <BatteryCharging size={16} />
                    </div>
                  </div>

                  {/* Right Homescreen App Icon Grid + Translucent Dock */}
                  <div
                    className="rs-right-homescreen-plane"
                    style={{
                      opacity: Number((1 - appLaunchT * 0.95).toFixed(2)),
                      transform: `scale(${(1 - appLaunchT * 0.05).toFixed(3)})`,
                    }}
                  >
                    <div className="rs-duo-icon-grid">
                      <button
                        type="button"
                        className="rs-duo-app-item rs-duo-app-item--btn"
                        onClick={() => jumpToStage(0.9)}
                      >
                        <div className="rs-squircle-60 rs-sq--whatsapp">
                          <MessageCircle size={28} />
                          <span className="rs-notif-badge">1</span>
                        </div>
                        <span className="rs-wa-label-glow">WhatsApp</span>
                      </button>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--dark">
                          <PackageCheck size={26} />
                        </div>
                        <span>Delhivery</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--blue">
                          <Mail size={26} />
                        </div>
                        <span>Mail</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--green">
                          <Navigation size={26} />
                        </div>
                        <span>Maps</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--orange">
                          <Sun size={26} />
                        </div>
                        <span>Photos</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--slate">
                          <Camera size={26} />
                        </div>
                        <span>Camera</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--blue">
                          <Compass size={26} />
                        </div>
                        <span>Safari</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--black">
                          <Clock size={26} />
                        </div>
                        <span>Clock</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--amber">
                          <FileText size={26} />
                        </div>
                        <span>Notes</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--sky">
                          <ListTodo size={26} />
                        </div>
                        <span>Reminders</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--rose">
                          <Music size={26} />
                        </div>
                        <span>Music</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--sky">
                          <ShoppingBag size={26} />
                        </div>
                        <span>App Store</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--red">
                          <Heart size={26} />
                        </div>
                        <span>Health</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--black">
                          <Wallet size={26} />
                        </div>
                        <span>Wallet</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--cyan">
                          <Folder size={26} />
                        </div>
                        <span>Files</span>
                      </div>
                      <div className="rs-duo-app-item">
                        <div className="rs-squircle-60 rs-sq--zinc">
                          <Settings size={26} />
                        </div>
                        <span>Settings</span>
                      </div>
                    </div>

                    {/* Right Half of Translucent Frosted Glass Dock */}
                    <div className="rs-wing-dock-row rs-wing-dock-row--right">
                      <div className="rs-frosted-ios-dock rs-frosted-ios-dock--right">
                        <div className="rs-squircle-52 rs-sq--green">
                          <MessageCircle size={24} />
                        </div>
                        <button
                          type="button"
                          className="rs-dock-wa-trigger"
                          onClick={() => jumpToStage(0.9)}
                          aria-label="Open WhatsApp"
                        >
                          <div className="rs-squircle-52 rs-sq--whatsapp">
                            <MessageCircle size={24} />
                            <span className="rs-notif-badge">1</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Soft 3D Ambient Shadow cast by the Translucent Left Wing when folded */}
                  <div
                    className="rs-right-wing-fold-shadow"
                    style={{ opacity: Number(rightCoverShadow.toFixed(2)) }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* ==============================================================
                STAGE 3 & 4: WHATSAPP APP LAUNCH & LIVE CHAT DISPLAY
                Expands inside the Titanium & Glass Bezel (inset: 12px)
               ============================================================== */}
            <div
              className="rs-duo-app-fullbleed"
              style={{
                opacity: Number(Math.min(1, appLaunchT * 1.35).toFixed(2)),
                transform: `translate3d(0, 0, 4px) scale(${Math.min(
                  1,
                  0.32 + appLaunchT * 0.68
                ).toFixed(3)})`,
                borderRadius: `${(38 + (1 - appLaunchT) * 16).toFixed(0)}px`,
                pointerEvents: isAppInteractive ? 'auto' : 'none',
              }}
              aria-hidden={!isAppInteractive}
            >
              {/* Glass Specular Sheen over the active display */}
              <div className="rs-glass-specular-sheen" aria-hidden="true" />

              {/* Persistent iOS Status Bar + Dynamic Island (stays intact inside the bezel) */}
              <div className="rs-app-ios-statusbar">
                <div className="rs-app-ios-statusbar__side">
                  <span>9:41</span>
                  <span>5G</span>
                </div>
                <div className="rs-app-ios-island" />
                <div className="rs-app-ios-statusbar__side">
                  <span>98%</span>
                  <Wifi size={13} />
                  <BatteryCharging size={15} />
                </div>
              </div>

              <div className="rs-duo-app-split-workspace">
                <div className="rs-wa-pane">
                <div className="rs-wa-header">
                  <div className="rs-wa-avatar">RS</div>
                  <div className="rs-wa-contact">
                    <div className="rs-wa-contact__name">
                      RescueShip Delivery Support{' '}
                      <span className="rs-wa-verified">✓</span>
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
                      stage.includes('PIN_PROMPT') ||
                      stage.includes('COMPLETED')
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
                            <span>
                              Live GPS Pin · 28.5355° N, 77.3910° E (Gate 2)
                            </span>
                          </div>
                        )}
                        <p className="rs-wa-bubble__text">{m.text}</p>
                        <div className="rs-wa-bubble__meta">
                          <span>{m.time}</span>
                          {isUser && (
                            <CheckCheck size={14} className="rs-wa-ticks" />
                          )}
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
                        🏠 I&apos;m Home — Lock Free Priority Re-Attempt
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
                  {(stage === 'STAGE_1_PIN_PROMPT' ||
                    stage === 'STAGE_2_PIN_PROMPT') && (
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
                        <RotateCcw size={13} /> Replay Pre-Delivery
                      </button>
                      <button
                        type="button"
                        className="rs-wa-action-btn"
                        onClick={() => handleResetFlow(true)}
                      >
                        <RotateCcw size={13} /> Replay NDR Hit
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rs-live-dashboard-pane">
                <div className="rs-dash-topbar">
                  <div className="rs-dash-live-pill">
                    <span className="rs-dash-pulse-dot" />
                    <span>LIVE RESCUESHIP DASHBOARD</span>
                  </div>
                  <span className="rs-dash-sla">{liveSlaTimer}s SLA</span>
                </div>
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
                <div className="rs-dash-pipeline">
                  <div className="rs-dash-pipe-step is-active">
                    <CheckCircle2 size={16} className="rs-dash-step-icon" />
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
                      stage.includes('PIN_PROMPT') ||
                      stage.includes('COMPLETED')
                        ? 'is-active'
                        : ''
                    }`}
                  >
                    <Activity size={16} className="rs-dash-step-icon" />
                    <div>
                      <strong>2. Buyer Action &amp; Payment Gate</strong>
                      <p>
                        {stage.includes('PIN_PROMPT') ||
                        stage.includes('COMPLETED')
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
                    <Sparkles size={16} className="rs-dash-step-icon" />
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
                        : 'STREAM /webhooks/delhivery/awb-4023118876 -> LISTENING'}
                  </code>
                </div>
              </div>
              </div>

              {/* Persistent iOS Home Bar inside the bezel */}
              <div className="rs-app-ios-homebar">
                <div className="rs-app-ios-homebar__pill" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
