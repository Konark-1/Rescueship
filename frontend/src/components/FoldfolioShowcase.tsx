import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import {
  MapPin,
  CheckCheck,
  ShieldCheck,
  Navigation,
  Phone,
  Video,
  ChevronLeft,
  RotateCcw,
  Lock,
  Wifi,
  BatteryCharging,
  Search,
  Calendar,
  Camera,
  Mail,
  Clock,
  Settings,
  PackageCheck,
  MessageCircle,
  Compass,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "bot" | "user" | "system";
  text: string;
  time: string;
  isLocationPin?: boolean;
}

type FlowStage =
  | "STAGE_1_PRE_DELIVERY"
  | "STAGE_1_PIN_PROMPT"
  | "STAGE_2_NDR_HIT"
  | "STAGE_2_CANCEL_SAVE"
  | "STAGE_2_PIN_PROMPT"
  | "STAGE_3_COMPLETED_PIN"
  | "STAGE_3_COMPLETED_SKIP";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "sys-1",
    sender: "system",
    text: "Today · Official WhatsApp Business Account",
    time: "09:15 AM",
  },
  {
    id: "msg-pre-1",
    sender: "bot",
    text: "🚚 *Out for Delivery:* Your order *AWB #4023118876* (COD ₹1,240) is out with Delhivery today.\n\nConfirm availability or convert to Prepaid UPI now for ₹50 instant off:",
    time: "09:15 AM",
  },
];

export const FoldfolioShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // 1. Notification pops up as soon as user enters the section
  const [notifVisible, setNotifVisible] = useState(true);

  // 2. Manual override angle (null = smoothly driven by scroll wheel!)
  const [manualAngle, setManualAngle] = useState<number | null>(null);

  // 3. WhatsApp app launch state — ONLY opens when user clicks WhatsApp (1) or notification!
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  // Sequential WhatsApp flow state
  const [stage, setStage] = useState<FlowStage>("STAGE_1_PRE_DELIVERY");
  const [activePathLabel, setActivePathLabel] = useState<
    "PRE_DELIVERY" | "NDR_INTERCEPT"
  >("PRE_DELIVERY");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  // --- CONTINUOUS SCROLL-DRIVEN 3D BOOK HINGE ---
  // 0.00 -> 0.18: Closed Cover (180deg) with Notification Pop-up
  // 0.18 -> 0.58: Physically swings open degree-by-degree from 180deg -> 0deg like a book!
  // 0.58 -> 1.00: Stays open at 0deg on the iPhone Duo Home Screen so user can click WhatsApp (1)
  const scrollHingeRaw = useTransform(
    scrollYProgress,
    [0, 0.18, 0.58, 1],
    [180, 180, 0, 0],
  );

  const scrollHingeSpring = useSpring(scrollHingeRaw, {
    stiffness: 110,
    damping: 22,
    mass: 0.75,
  });

  const [scrollDeg, setScrollDeg] = useState(180);

  useMotionValueEvent(scrollHingeSpring, "change", (v) => {
    setScrollDeg(v);
  });

  // Release manual override if user scrolls significantly at top or middle
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (p > 0.02) setNotifVisible(true);
    if (manualAngle !== null && (p < 0.1 || p > 0.65)) {
      setManualAngle(null);
    }
  });

  const currentAngle = prefersReducedMotion
    ? (manualAngle ?? (scrollDeg < 90 ? 0 : 180))
    : (manualAngle ?? scrollDeg);

  // Derived progress (0 = fully closed at 180deg, 1 = fully open at 0deg)
  const openRatio = Math.max(0, Math.min(1, (180 - currentAngle) / 180));
  const isMostlyOpen = currentAngle < 90;

  // Center the 310px closed phone by shifting -155px when closed, 0px when fully open
  const shiftX = -155 * (1 - openRatio);

  // Subtle 3D perspective tilt during the mid-swing (peaks at 90deg so the 3D book arc is visible!)
  const swingArcTiltX =
    Math.sin(openRatio * Math.PI) * 10 + (1 - openRatio) * 4;
  const swingArcTiltY = -(1 - openRatio) * 8;

  // Crease shadow across the right page fades smoothly from 0.9 -> 0 as the book opens
  const rightPageShadowOpacity = Math.max(
    0,
    Math.min(0.92, (currentAngle / 180) * 1.1),
  );

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, stage, whatsappOpen]);

  const appendMessages = (newMsgs: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMsgs]);
  };

  // --- SEQUENTIAL LIFECYCLE HANDLERS ---
  const handlePreDeliveryUpi = () => {
    setActivePathLabel("PRE_DELIVERY");
    appendMessages([
      {
        id: `u-upi-${Date.now()}`,
        sender: "user",
        text: "💳 Pay ₹1,190 via UPI (Save ₹50)",
        time: "09:16 AM",
      },
      {
        id: `b-upi-${Date.now()}`,
        sender: "bot",
        text: "✅ *UPI Payment Received (₹1,190).* Parcel converted to Priority Prepaid.\n\n📍 *Final Step:* Drop your WhatsApp Location Pin so the rider reaches your exact gate on the first attempt, or skip to use your saved address:",
        time: "09:16 AM",
      },
    ]);
    setStage("STAGE_1_PIN_PROMPT");
  };

  const handleContinueToNdr = () => {
    setActivePathLabel("NDR_INTERCEPT");
    appendMessages([
      {
        id: `u-cod-${Date.now()}`,
        sender: "user",
        text: "🚚 Keep COD — Deliver Today",
        time: "09:16 AM",
      },
      {
        id: `sys-ndr-${Date.now()}`,
        sender: "system",
        text: '⚡ 02:47 PM · Delhivery Rider Logged "Door Locked" (1.42 km from gate)',
        time: "02:47 PM",
      },
      {
        id: `b-ndr-${Date.now()}`,
        sender: "bot",
        text: '⚠️ *Fake Attempt Intercepted (38s):* Our courier agent just marked *AWB #4023118876* as *"Customer Unavailable / Door Locked"* from 1.42 km away with 0 calls.\n\nAre you available to receive your parcel?',
        time: "02:47 PM",
      },
    ]);
    setStage("STAGE_2_NDR_HIT");
  };

  const handleNdrConfirmAvailable = () => {
    setActivePathLabel("NDR_INTERCEPT");
    appendMessages([
      {
        id: `u-here-${Date.now()}`,
        sender: "user",
        text: "🏠 I'm Home — Rider Never Knocked",
        time: "02:48 PM",
      },
      {
        id: `b-pin-req-${Date.now()}`,
        sender: "bot",
        text: "🛡️ *Free Priority Re-Attempt Unlocked.* (Zero extra cost).\n\n📍 *Final Step:* Share your live WhatsApp Location Pin so we inject your gate landmark into the courier NDR API & text the Google Maps link directly to the rider—or skip to keep your existing address:",
        time: "02:48 PM",
      },
    ]);
    setStage("STAGE_2_PIN_PROMPT");
  };

  const handleBuyerCancelOrder = () => {
    setActivePathLabel("NDR_INTERCEPT");
    appendMessages([
      {
        id: `u-cancel-${Date.now()}`,
        sender: "user",
        text: "❌ Cancel Order",
        time: "02:48 PM",
      },
      {
        id: `b-save-${Date.now()}`,
        sender: "bot",
        text: "We understand! Before we release the parcel back to warehouse, claim a *1-Shot ₹100 Instant UPI Discount* (Pay *₹1,140* instead of ₹1,240 within 2 hrs to hold your parcel for priority delivery):",
        time: "02:48 PM",
      },
    ]);
    setStage("STAGE_2_CANCEL_SAVE");
  };

  const handleAcceptCancelUpiSave = () => {
    appendMessages([
      {
        id: `u-save-upi-${Date.now()}`,
        sender: "user",
        text: "⚡ Claim ₹100 Off via Instant UPI (₹1,140)",
        time: "02:49 PM",
      },
      {
        id: `b-save-pin-${Date.now()}`,
        sender: "bot",
        text: "✅ *₹1,140 UPI Verified!* Cancellation reversed & ₹430 RTO bleed prevented.\n\n📍 *Final Step:* Share your WhatsApp Location Pin for the priority re-attempt, or skip to use your saved address:",
        time: "02:49 PM",
      },
    ]);
    setStage("STAGE_2_PIN_PROMPT");
  };

  const handleShareLocationPin = () => {
    appendMessages([
      {
        id: `u-pin-${Date.now()}`,
        sender: "user",
        text: "📍 Shared Live Location Pin\n28.5355° N, 77.3910° E · Gate 2, Sector 62, Noida",
        time: "02:49 PM",
        isLocationPin: true,
      },
      {
        id: `b-done-pin-${Date.now()}`,
        sender: "bot",
        text: "✓ *Re-Delivery Locked & GPS Pin Dispatched!*\n• Reverse-geocoded gate note injected into Delhivery NDR API\n• Google Maps link (maps.google.com/?q=28.5355,77.3910) sent via SMS to field agent\n• *₹430 RTO Bleed Saved*",
        time: "02:49 PM",
      },
    ]);
    setStage("STAGE_3_COMPLETED_PIN");
  };

  const handleSkipLocationPin = () => {
    appendMessages([
      {
        id: `u-skip-${Date.now()}`,
        sender: "user",
        text: "⏭️ Skip — Use Existing Saved Address",
        time: "02:49 PM",
      },
      {
        id: `b-done-skip-${Date.now()}`,
        sender: "bot",
        text: "✓ *Re-Delivery Locked with Saved Address!*\n• Buyer confirmation logged in courier NDR API\n• Priority re-attempt scheduled without requiring GPS pin\n• *₹430 RTO Bleed Saved*",
        time: "02:49 PM",
      },
    ]);
    setStage("STAGE_3_COMPLETED_SKIP");
  };

  const handleResetFlow = (startAtNdr = false) => {
    if (!startAtNdr) {
      setMessages(INITIAL_MESSAGES);
      setActivePathLabel("PRE_DELIVERY");
      setStage("STAGE_1_PRE_DELIVERY");
    } else {
      setActivePathLabel("NDR_INTERCEPT");
      setMessages([
        ...INITIAL_MESSAGES,
        {
          id: "u-cod-jump",
          sender: "user",
          text: "🚚 Keep COD — Deliver Today",
          time: "09:16 AM",
        },
        {
          id: "sys-ndr-jump",
          sender: "system",
          text: '⚡ 02:47 PM · Delhivery Rider Logged "Door Locked" (1.42 km from gate)',
          time: "02:47 PM",
        },
        {
          id: "b-ndr-jump",
          sender: "bot",
          text: '⚠️ *Fake Attempt Intercepted (38s):* Our courier agent just marked *AWB #4023118876* as *"Customer Unavailable / Door Locked"* from 1.42 km away with 0 calls.\n\nAre you available to receive your parcel?',
          time: "02:47 PM",
        },
      ]);
      setStage("STAGE_2_NDR_HIT");
    }
  };

  // Helper to smoothly animate manual button clicks
  const animateToAngle = (targetDeg: number, openWa = false) => {
    setWhatsappOpen(openWa);
    setManualAngle(targetDeg);
  };

  const lastMsg = messages[messages.length - 1];

  return (
    <section
      ref={containerRef}
      id="foldfolio-demo"
      className="rs-book-track"
      aria-label="Interactive iPhone Duo Foldable WhatsApp Rescue Showcase"
    >
      {/* 4 Scroll-Snap Waypoints so scrolling never skips past the phone */}
      <div className="rs-book-waypoints" aria-hidden="true">
        <div className="rs-book-waypoint" />
        <div className="rs-book-waypoint" />
        <div className="rs-book-waypoint" />
        <div className="rs-book-waypoint" />
      </div>

      <div className="rs-book-sticky">
        {/* Centered Header (Never Clipped on Left Edge) */}
        <div className="rs-book-header">
          <div className="rs-book-header__titles">
            <span className="rs-fold-kicker">
              NATURAL TITANIUM · BOOK-FOLD iPHONE DUO
            </span>
            <h2 className="rs-fold-title">
              Opens like a book on scroll. <em>Tap WhatsApp (1) to rescue.</em>
            </h2>
          </div>

          <div
            className="rs-fold-controls"
            role="tablist"
            aria-label="iPhone Duo Posture"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isMostlyOpen}
              className={`rs-fold-chip ${!isMostlyOpen ? "is-active" : ""}`}
              onClick={() => animateToAngle(180, false)}
            >
              1. Folded Cover
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isMostlyOpen && !whatsappOpen}
              className={`rs-fold-chip ${isMostlyOpen && !whatsappOpen ? "is-active" : ""}`}
              onClick={() => animateToAngle(0, false)}
            >
              2. Unfolded Home (1)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isMostlyOpen && whatsappOpen}
              className={`rs-fold-chip ${isMostlyOpen && whatsappOpen ? "is-active" : ""}`}
              onClick={() => animateToAngle(0, true)}
            >
              3. Live WhatsApp Chat
            </button>
          </div>
        </div>

        {/* ===============================================================
            CONTINUOUS 3D NATURAL TITANIUM BOOK-FOLD STAGE (310px -> 620px)
            Zero `visibility: hidden` pop-in! Left page physically uncovers Right page!
           =============================================================== */}
        <div className="rs-book-stage">
          <motion.div
            className="rs-titanium-book"
            animate={{
              x: shiftX,
              rotateX: swingArcTiltX,
              rotateY: swingArcTiltY,
            }}
            transition={{ type: "spring", stiffness: 140, damping: 24 }}
          >
            {/* Dynamic Floor Shadow */}
            <div
              className="rs-book-floor-shadow"
              style={{
                transform: `translateX(${-shiftX}px) scaleX(${0.52 + openRatio * 0.48})`,
              }}
              aria-hidden="true"
            />

            {/* ===========================================================
                LEFT PAGE OF THE BOOK (310px × 490px)
                Sits at translateZ(3px) so when folded at 180deg it physically
                covers the right page without needing `visibility: hidden`!
               =========================================================== */}
            <motion.div
              className="rs-book-leaf rs-book-leaf--left"
              style={{ z: 3 }}
              animate={{
                rotateY: currentAngle,
                z: 3,
              }}
              transition={
                manualAngle !== null
                  ? { type: "spring", stiffness: 120, damping: 22 }
                  : { duration: 0.04, ease: "linear" }
              }
            >
              {/* 3D Brushed Titanium Edge Wall Along the Swinging Door */}
              <div className="rs-titanium-edge-wall" aria-hidden="true" />

              {/* ---------------------------------------------------------
                  OUTER COVER FACE (Visible when closed: currentAngle > 90deg)
                 --------------------------------------------------------- */}
              <div
                className="rs-leaf-face rs-leaf-face--cover"
                aria-hidden={isMostlyOpen}
                inert={isMostlyOpen ? true : undefined}
              >
                <span
                  className="rs-ti-side-btn rs-ti-side-btn--right"
                  aria-hidden="true"
                />

                <div className="rs-ios-display rs-ios-display--cover">
                  <div className="rs-ios-statusbar">
                    <span className="rs-ios-time">02:47</span>
                    <div className="rs-dynamic-island">
                      <span className="rs-island-cam" />
                    </div>
                    <div className="rs-ios-StatusIcons">
                      <Wifi size={12} />
                      <BatteryCharging size={14} />
                    </div>
                  </div>

                  <div className="rs-lockscreen-body">
                    <div className="rs-lockscreen-clock">
                      <div className="rs-lockscreen-date">
                        <Lock size={11} /> Wednesday, 21 October
                      </div>
                      <div className="rs-lockscreen-digits">02:47</div>
                    </div>

                    {notifVisible && (
                      <button
                        type="button"
                        className="rs-solid-notif-card"
                        onClick={() => animateToAngle(0, false)}
                      >
                        <div className="rs-wa-squircle-sm">
                          <svg
                            viewBox="0 0 24 24"
                            width="22"
                            height="22"
                            fill="currentColor"
                          >
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z" />
                          </svg>
                          <span className="rs-notif-badge">1</span>
                        </div>
                        <div className="rs-ios-notif__body">
                          <div className="rs-ios-notif__row">
                            <strong>RescueShip Delivery Support ✓</strong>
                            <span>now</span>
                          </div>
                          <p>
                            🚚 AWB #4023118876: Fake “Door Locked” scan
                            intercepted. Scroll or tap to open phone.
                          </p>
                        </div>
                      </button>
                    )}

                    <div className="rs-lockscreen-bottom">
                      <span className="rs-scroll-pill">
                        Keep scrolling to open book →
                      </span>
                      <div className="rs-ios-homebar" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------------
                  LEFT INNER FACE (Visible when book swings open < 90deg)
                 --------------------------------------------------------- */}
              <div
                className="rs-leaf-face rs-leaf-face--inner-left"
                aria-hidden={!isMostlyOpen}
                inert={!isMostlyOpen ? true : undefined}
              >
                <span
                  className="rs-ti-side-btn rs-ti-side-btn--left-top"
                  aria-hidden="true"
                />
                <span
                  className="rs-ti-side-btn rs-ti-side-btn--left-bot"
                  aria-hidden="true"
                />

                <div className="rs-ios-display rs-ios-display--inner-left">
                  <AnimatePresence mode="wait">
                    {!whatsappOpen ? (
                      /* ===================================================
                         AUTHENTIC iOS HOME SCREEN (LEFT PAGE)
                         =================================================== */
                      <motion.div
                        key="home-left"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.04 }}
                        transition={{
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="rs-ios-homescreen"
                      >
                        <div className="rs-ios-statusbar">
                          <span className="rs-ios-time">02:48 · 5G</span>
                          <span className="rs-ios-carrier">Jio True5G</span>
                        </div>

                        <div className="rs-ios-widget-row">
                          <div className="rs-solid-widget">
                            <div className="rs-ios-widget__top">
                              <PackageCheck
                                size={13}
                                className="rs-emerald-icon"
                              />
                              <span>DELHIVERY</span>
                            </div>
                            <strong>AWB #4023118876</strong>
                            <small>COD ₹1,240 · NDR Alert</small>
                          </div>

                          <div className="rs-solid-widget">
                            <div className="rs-ios-widget__top">
                              <Calendar
                                size={13}
                                className="rs-vermilion-icon"
                              />
                              <span>WEDNESDAY</span>
                            </div>
                            <strong className="rs-widget-big-num">21</strong>
                            <small>1 Unread Alert</small>
                          </div>
                        </div>

                        {/* 4x2 iOS App Grid — Tapping WhatsApp (1) Launches Chat! */}
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
                          <button
                            type="button"
                            className="rs-ios-app rs-ios-app--interactive"
                            onClick={() => setWhatsappOpen(true)}
                            aria-label="Open WhatsApp with 1 unread message from RescueShip"
                          >
                            <div className="rs-ios-squircle rs-squircle--whatsapp">
                              <svg
                                viewBox="0 0 24 24"
                                width="25"
                                height="25"
                                fill="currentColor"
                              >
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                              </svg>
                              <span className="rs-ios-badge">1</span>
                            </div>
                            <span className="rs-ios-app__highlight">
                              WhatsApp
                            </span>
                          </button>
                          <div className="rs-ios-app">
                            <div className="rs-ios-squircle rs-squircle--clock">
                              <Clock size={20} />
                            </div>
                            <span>Clock</span>
                          </div>
                          <div className="rs-ios-app">
                            <div className="rs-ios-squircle rs-squircle--delhivery">
                              <ShieldCheck size={20} />
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
                            <div className="rs-ios-squircle rs-squircle--settings">
                              <Settings size={20} />
                            </div>
                            <span>Settings</span>
                          </div>
                        </div>

                        <div className="rs-ios-homebar" />
                      </motion.div>
                    ) : (
                      /* ===================================================
                         WHATSAPP LEFT PAGE: OFFICIAL CHATS LIST SIDEBAR
                         =================================================== */
                      <motion.div
                        key="wa-left"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="rs-wa-sidebar"
                      >
                        <div className="rs-wa-sidebar__top">
                          <button
                            type="button"
                            className="rs-wa-back-home"
                            onClick={() => setWhatsappOpen(false)}
                          >
                            <ChevronLeft size={15} /> Home
                          </button>
                          <strong>Chats</strong>
                          <span className="rs-wa-unread-pill">1 Unread</span>
                        </div>

                        <div className="rs-wa-search">
                          <Search size={13} />
                          <span>Search or Ask Meta AI</span>
                        </div>

                        <div className="rs-wa-filters">
                          <span className="is-active">All</span>
                          <span>Unread (1)</span>
                          <span>Business</span>
                        </div>

                        <div className="rs-wa-chat-list">
                          <div className="rs-wa-chat-row is-selected">
                            <div className="rs-wa-avatar">RS</div>
                            <div className="rs-wa-chat-row__body">
                              <div className="rs-wa-chat-row__head">
                                <strong>RescueShip Delivery Support ✓</strong>
                                <span className="rs-wa-chat-row__time">
                                  {lastMsg.time}
                                </span>
                              </div>
                              <p className="rs-wa-chat-row__preview">
                                {lastMsg.text.replace(/\*/g, "").slice(0, 40)}
                                ...
                              </p>
                            </div>
                          </div>

                          <div className="rs-wa-chat-row is-muted">
                            <div className="rs-wa-avatar rs-wa-avatar--neutral">
                              DL
                            </div>
                            <div className="rs-wa-chat-row__body">
                              <div className="rs-wa-chat-row__head">
                                <strong>Delhivery Express</strong>
                                <span>09:14 AM</span>
                              </div>
                              <p className="rs-wa-chat-row__preview">
                                AWB #4023118876 is out for delivery today
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rs-wa-sidebar__telemetry">
                          <div className="rs-wa-sidebar__telemetry-head">
                            <span>● LIVE COURIER API</span>
                            <strong>₹430 RTO Saved</strong>
                          </div>
                          <p>
                            {stage === "STAGE_1_PRE_DELIVERY" &&
                              "Stage 1: Morning Pre-Delivery Check active."}
                            {stage === "STAGE_1_PIN_PROMPT" &&
                              "Prepaid UPI locked · Requesting final GPS Pin or Skip."}
                            {stage === "STAGE_2_NDR_HIT" &&
                              'Stage 2: Fake "Door Locked" scan intercepted in 38s.'}
                            {stage === "STAGE_2_CANCEL_SAVE" &&
                              "1-Shot ₹100 UPI Cancellation Save offered (2-hr gate)."}
                            {stage === "STAGE_2_PIN_PROMPT" &&
                              "Priority Re-Attempt unlocked · Requesting GPS Pin or Skip."}
                            {stage === "STAGE_3_COMPLETED_PIN" &&
                              "✓ Landmark injected in NDR API + Google Maps SMS sent to rider."}
                            {stage === "STAGE_3_COMPLETED_SKIP" &&
                              "✓ Priority Re-Attempt locked using existing saved address."}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* ===========================================================
                RIGHT PAGE OF THE BOOK (310px × 490px)
                Always rendered in 3D space (NO `visibility: hidden` pop-in!).
                Naturally covered by the left page when closed at 180deg, and
                smoothly uncovered as the left page swings open!
               =========================================================== */}
            <motion.div
              className="rs-book-leaf rs-book-leaf--right"
              style={{ z: 0, pointerEvents: isMostlyOpen ? "auto" : "none" }}
              aria-hidden={!isMostlyOpen}
              inert={!isMostlyOpen ? true : undefined}
            >
              {/* Center Book Crease Line */}
              <div className="rs-book-crease-line" aria-hidden="true" />

              {/* Dynamic Crease Shadow Cast by the Left Page as It Opens */}
              <div
                className="rs-book-crease-shadow"
                style={{ opacity: rightPageShadowOpacity }}
                aria-hidden="true"
              />

              <span
                className="rs-ti-side-btn rs-ti-side-btn--right"
                aria-hidden="true"
              />

              <div className="rs-ios-display rs-ios-display--inner-right">
                <AnimatePresence mode="wait">
                  {!whatsappOpen ? (
                    /* =====================================================
                       AUTHENTIC iOS HOME SCREEN (RIGHT PAGE)
                       ===================================================== */
                    <motion.div
                      key="home-right"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.04 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="rs-ios-homescreen"
                    >
                      <div className="rs-ios-statusbar">
                        <span className="rs-ios-carrier">RescueShip OS</span>
                        <div className="rs-ios-StatusIcons">
                          <span>98%</span>
                          <Wifi size={12} />
                          <BatteryCharging size={14} />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="rs-solid-notif-card"
                        onClick={() => setWhatsappOpen(true)}
                      >
                        <div className="rs-wa-squircle-sm">
                          <svg
                            viewBox="0 0 24 24"
                            width="22"
                            height="22"
                            fill="currentColor"
                          >
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z" />
                          </svg>
                          <span className="rs-notif-badge">1</span>
                        </div>
                        <div className="rs-ios-notif__body">
                          <div className="rs-ios-notif__row">
                            <strong>RescueShip Delivery Support ✓</strong>
                            <span>Tap to Open</span>
                          </div>
                          <p>
                            Tap here or click the WhatsApp (1) icon to launch
                            the live rescue chat.
                          </p>
                        </div>
                      </button>

                      <div className="rs-solid-info-card">
                        <div className="rs-ios-glass-card__row">
                          <span>STEP 2 · HOME SCREEN</span>
                          <strong>CLICK WHATSAPP (1)</strong>
                        </div>
                        <p>
                          Your phone is now unfolded. Click the pulsing{" "}
                          <strong>WhatsApp (1)</strong> icon on the left screen
                          or bottom dock to open the sequential Pre-Delivery &
                          NDR chat.
                        </p>
                      </div>

                      <div className="rs-solid-dock">
                        <div className="rs-ios-squircle rs-squircle--phone">
                          <Phone size={20} />
                        </div>
                        <div className="rs-ios-squircle rs-squircle--safari">
                          <Compass size={20} />
                        </div>
                        <div className="rs-ios-squircle rs-squircle--messages">
                          <MessageCircle size={20} />
                        </div>
                        <button
                          type="button"
                          className="rs-dock-wa-btn"
                          onClick={() => setWhatsappOpen(true)}
                          aria-label="Launch WhatsApp from iOS Dock"
                        >
                          <div className="rs-ios-squircle rs-squircle--whatsapp">
                            <svg
                              viewBox="0 0 24 24"
                              width="24"
                              height="24"
                              fill="currentColor"
                            >
                              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z" />
                            </svg>
                            <span className="rs-ios-badge">1</span>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    /* =====================================================
                       WHATSAPP RIGHT PAGE: LIVE SEQUENTIAL CONVERSATION
                       ===================================================== */
                    <motion.div
                      key="wa-right"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="rs-wa-pane"
                    >
                      <div className="rs-wa-header">
                        <div className="rs-wa-avatar">RS</div>
                        <div className="rs-wa-contact">
                          <div className="rs-wa-contact__name">
                            RescueShip Delivery Support{" "}
                            <span className="rs-wa-verified">✓</span>
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
                            activePathLabel === "PRE_DELIVERY"
                              ? "is-active"
                              : ""
                          }`}
                          onClick={() => handleResetFlow(false)}
                        >
                          1. Pre-Delivery
                        </button>
                        <span>→</span>
                        <button
                          type="button"
                          className={`rs-wa-step-pill ${
                            activePathLabel === "NDR_INTERCEPT"
                              ? "is-active"
                              : ""
                          }`}
                          onClick={() => handleResetFlow(true)}
                        >
                          2. NDR Hit
                        </button>
                        <span>→</span>
                        <span
                          className={`rs-wa-step-pill ${
                            stage.includes("PIN_PROMPT") ||
                            stage.includes("COMPLETED")
                              ? "is-active"
                              : ""
                          }`}
                        >
                          3. Pin / Skip
                        </span>
                      </div>

                      <div ref={chatScrollRef} className="rs-wa-messages">
                        {messages.map((m) => {
                          if (m.sender === "system") {
                            return (
                              <div key={m.id} className="rs-wa-sys-pill">
                                {m.text}
                              </div>
                            );
                          }
                          const isUser = m.sender === "user";
                          return (
                            <div
                              key={m.id}
                              className={`rs-wa-bubble ${
                                isUser
                                  ? "rs-wa-bubble--user"
                                  : "rs-wa-bubble--bot"
                              }`}
                            >
                              {m.isLocationPin && (
                                <div className="rs-wa-map-card">
                                  <MapPin size={13} />
                                  <span>
                                    Live GPS Pin · 28.5355° N, 77.3910° E (Gate
                                    2)
                                  </span>
                                </div>
                              )}
                              <p className="rs-wa-bubble__text">{m.text}</p>
                              <div className="rs-wa-bubble__meta">
                                <span>{m.time}</span>
                                {isUser && (
                                  <CheckCheck
                                    size={13}
                                    className="rs-wa-ticks"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rs-wa-tray">
                        {stage === "STAGE_1_PRE_DELIVERY" && (
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

                        {stage === "STAGE_2_NDR_HIT" && (
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

                        {stage === "STAGE_2_CANCEL_SAVE" && (
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

                        {(stage === "STAGE_1_PIN_PROMPT" ||
                          stage === "STAGE_2_PIN_PROMPT") && (
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

                        {(stage === "STAGE_3_COMPLETED_PIN" ||
                          stage === "STAGE_3_COMPLETED_SKIP") && (
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
