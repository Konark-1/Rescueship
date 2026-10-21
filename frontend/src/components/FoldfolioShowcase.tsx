import React, { useState, useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useMotionValueEvent,
  useReducedMotion,
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
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const [posture, setPosture] = useState<DevicePosture>('cover');
  const [lastScrollBand, setLastScrollBand] = useState<number>(0);
  const [userInteracted, setUserInteracted] = useState(false);

  // Sequential WhatsApp flow state
  const [stage, setStage] = useState<FlowStage>('STAGE_1_PRE_DELIVERY');
  const [activePathLabel, setActivePathLabel] = useState<'PRE_DELIVERY' | 'NDR_INTERCEPT'>(
    'PRE_DELIVERY'
  );
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  // Scroll steps cleanly through the book-open sequence
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (userInteracted) return;
    const band = p < 0.25 ? 0 : p < 0.64 ? 1 : p < 0.86 ? 2 : 3;
    if (band !== lastScrollBand) {
      setLastScrollBand(band);
      if (band === 0) setPosture('cover');
      else if (band === 1) {
        setPosture((prev) => (prev === 'whatsapp-duo' ? 'whatsapp-duo' : 'unfolded-home'));
      } else if (band === 2) {
        setPosture('whatsapp-duo');
      } else {
        setPosture('rider-call');
      }
    }
  });

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

  const isFolded = posture === 'cover' || posture === 'rider-call';
  const lastMsg = messages[messages.length - 1];

  const bookHingeTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 125, damping: 22, mass: 0.85 };

  return (
    <section
      ref={containerRef}
      id="foldfolio-demo"
      className="rs-book-track"
      aria-label="Interactive iPhone Duo Foldable WhatsApp Rescue Showcase"
    >
      <div className="rs-book-sticky">
        {/* Top Header + Exclusive 4-State Switcher (Zero Multi-Color Dots) */}
        <div className="rs-book-header">
          <div>
            <span className="rs-fold-kicker">NATURAL TITANIUM · BOOK-FOLD iPHONE DUO</span>
            <h2 className="rs-fold-title">
              Opens like a book on scroll. <em>Tap WhatsApp (1) to rescue.</em>
            </h2>
          </div>

          <div className="rs-fold-controls" role="tablist" aria-label="iPhone Duo Posture">
            <button
              type="button"
              role="tab"
              aria-selected={posture === 'cover'}
              className={`rs-fold-chip ${posture === 'cover' ? 'is-active' : ''}`}
              onClick={() => {
                setUserInteracted(true);
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
                setUserInteracted(true);
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
                setUserInteracted(true);
                setPosture('whatsapp-duo');
              }}
            >
              3. Live WhatsApp Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={posture === 'rider-call'}
              className={`rs-fold-chip ${posture === 'rider-call' ? 'is-active' : ''}`}
              onClick={() => {
                setUserInteracted(true);
                setPosture('rider-call');
              }}
            >
              4. Fold Shut · Rider Call
            </button>
          </div>
        </div>

        {/* ===============================================================
            SEAMLESS NATURAL TITANIUM BOOK-FOLD STAGE (330px -> 660px)
            Zero Detached Stick on Left, Zero Orange Side Tab
           =============================================================== */}
        <div className="rs-book-stage">
          <motion.div
            className="rs-titanium-book"
            animate={{
              // When folded, shift left by -165px so the 330px closed phone sits dead-center
              x: isFolded ? -165 : 0,
              rotateX: isFolded ? 6 : 2,
              rotateY: isFolded ? -8 : 0,
            }}
            transition={bookHingeTransition}
          >
            {/* Contact Shadow on Floor */}
            <motion.div
              className="rs-book-floor-shadow"
              animate={{
                scaleX: isFolded ? 0.5 : 1,
                x: isFolded ? 165 : 0,
              }}
              transition={bookHingeTransition}
              aria-hidden="true"
            />

            {/* ===========================================================
                LEFT PAGE OF THE BOOK (330px × 560px)
                Hinges around its right edge (`transform-origin: right center`)
               =========================================================== */}
            <motion.div
              className="rs-book-leaf rs-book-leaf--left"
              animate={{
                rotateY: isFolded ? 180 : 0,
              }}
              transition={bookHingeTransition}
            >
              {/* Machined Titanium Outer Edge Thickness */}
              <div className="rs-titanium-edge-wall" aria-hidden="true" />

              {/* ---------------------------------------------------------
                  OUTER COVER SCREEN (Visible when closed: rotateY === 180deg)
                 --------------------------------------------------------- */}
              <div
                className="rs-leaf-face rs-leaf-face--cover"
                aria-hidden={!isFolded}
                inert={!isFolded ? true : undefined}
              >
                {/* Brushed Titanium Side Power Button (Matches body, NOT orange!) */}
                <span className="rs-ti-side-btn rs-ti-side-btn--right" aria-hidden="true" />

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

                  {posture !== 'rider-call' ? (
                    <div className="rs-lockscreen-body">
                      <div className="rs-lockscreen-clock">
                        <div className="rs-lockscreen-date">
                          <Lock size={11} /> Wednesday, 21 October
                        </div>
                        <div className="rs-lockscreen-digits">02:47</div>
                      </div>

                      {/* Clean iOS Notification Card */}
                      <button
                        type="button"
                        className="rs-solid-notif-card"
                        onClick={() => {
                          setUserInteracted(true);
                          setPosture('unfolded-home');
                        }}
                      >
                        <div className="rs-wa-squircle-sm">
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
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
                            🚚 AWB #4023118876: Fake “Door Locked” scan intercepted. Tap or scroll to open phone.
                          </p>
                        </div>
                      </button>

                      <div className="rs-lockscreen-bottom">
                        <span className="rs-scroll-pill">Scroll or tap to open book →</span>
                        <div className="rs-ios-homebar" />
                      </div>
                    </div>
                  ) : (
                    <div className="rs-incoming-call">
                      <div className="rs-incoming-call__top">
                        <span className="rs-incoming-badge">✓ GPS PIN DISPATCHED TO RIDER</span>
                        <h4>Delhivery Field Agent</h4>
                        <p>Noida Sector 62 Hub · AWB #4023118876</p>
                      </div>

                      <div className="rs-incoming-call__actions">
                        <button
                          type="button"
                          className="rs-call-btn rs-call-btn--decline"
                          onClick={() => {
                            setUserInteracted(true);
                            setPosture('unfolded-home');
                          }}
                        >
                          <PhoneOff size={20} />
                          <span>Home Screen</span>
                        </button>
                        <button
                          type="button"
                          className="rs-call-btn rs-call-btn--accept"
                          onClick={() => {
                            setUserInteracted(true);
                            setPosture('whatsapp-duo');
                          }}
                        >
                          <PhoneIncoming size={20} />
                          <span>View Chat</span>
                        </button>
                      </div>
                      <div className="rs-ios-homebar" />
                    </div>
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------------
                  LEFT INNER SCREEN (Visible when book opens: rotateY === 0deg)
                 --------------------------------------------------------- */}
              <div
                className="rs-leaf-face rs-leaf-face--inner-left"
                aria-hidden={isFolded}
                inert={isFolded ? true : undefined}
              >
                <span className="rs-ti-side-btn rs-ti-side-btn--left-top" aria-hidden="true" />
                <span className="rs-ti-side-btn rs-ti-side-btn--left-bot" aria-hidden="true" />

                <div className="rs-ios-display rs-ios-display--inner-left">
                  {posture !== 'whatsapp-duo' ? (
                    <div className="rs-ios-homescreen">
                      <div className="rs-ios-statusbar">
                        <span className="rs-ios-time">02:48 · 5G</span>
                        <span className="rs-ios-carrier">Jio True5G</span>
                      </div>

                      {/* Solid iOS Widgets */}
                      <div className="rs-ios-widget-row">
                        <div className="rs-solid-widget">
                          <div className="rs-ios-widget__top">
                            <PackageCheck size={14} className="rs-emerald-icon" />
                            <span>DELHIVERY</span>
                          </div>
                          <strong>AWB #4023118876</strong>
                          <small>COD ₹1,240 · NDR Hit</small>
                        </div>

                        <div className="rs-solid-widget">
                          <div className="rs-ios-widget__top">
                            <Calendar size={14} className="rs-vermilion-icon" />
                            <span>WEDNESDAY</span>
                          </div>
                          <strong className="rs-widget-big-num">21</strong>
                          <small>1 Unread Alert</small>
                        </div>
                      </div>

                      {/* 4x2 iOS App Icon Grid with WhatsApp (1) */}
                      <div className="rs-ios-app-grid">
                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--mail">
                            <Mail size={21} />
                          </div>
                          <span>Mail</span>
                        </div>

                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--maps">
                            <Navigation size={21} />
                          </div>
                          <span>Maps</span>
                        </div>

                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--photos">
                            <Camera size={21} />
                          </div>
                          <span>Photos</span>
                        </div>

                        <button
                          type="button"
                          className="rs-ios-app rs-ios-app--interactive"
                          onClick={() => {
                            setUserInteracted(true);
                            setPosture('whatsapp-duo');
                          }}
                          aria-label="Open WhatsApp with 1 unread message from RescueShip"
                        >
                          <div className="rs-ios-squircle rs-squircle--whatsapp">
                            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                            </svg>
                            <span className="rs-ios-badge">1</span>
                          </div>
                          <span className="rs-ios-app__highlight">WhatsApp</span>
                        </button>

                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--clock">
                            <Clock size={21} />
                          </div>
                          <span>Clock</span>
                        </div>

                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--delhivery">
                            <ShieldCheck size={21} />
                          </div>
                          <span>Delhivery</span>
                        </div>

                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--safari">
                            <Compass size={21} />
                          </div>
                          <span>Safari</span>
                        </div>

                        <div className="rs-ios-app">
                          <div className="rs-ios-squircle rs-squircle--settings">
                            <Settings size={21} />
                          </div>
                          <span>Settings</span>
                        </div>
                      </div>

                      <div className="rs-ios-homebar" />
                    </div>
                  ) : (
                    /* LEFT PAGE OF WHATSAPP: OFFICIAL CHATS LIST SIDEBAR */
                    <div className="rs-wa-sidebar">
                      <div className="rs-wa-sidebar__top">
                        <button
                          type="button"
                          className="rs-wa-back-home"
                          onClick={() => {
                            setUserInteracted(true);
                            setPosture('unfolded-home');
                          }}
                        >
                          <ChevronLeft size={16} /> Home
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
                              <span className="rs-wa-chat-row__time">{lastMsg.time}</span>
                            </div>
                            <p className="rs-wa-chat-row__preview">
                              {lastMsg.text.replace(/\*/g, '').slice(0, 44)}...
                            </p>
                          </div>
                        </div>

                        <div className="rs-wa-chat-row is-muted">
                          <div className="rs-wa-avatar rs-wa-avatar--neutral">DL</div>
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
                          {stage === 'STAGE_1_PRE_DELIVERY' &&
                            'Stage 1: Morning Pre-Delivery Check active.'}
                          {stage === 'STAGE_1_PIN_PROMPT' &&
                            'Prepaid UPI locked · Requesting final GPS Pin or Skip.'}
                          {stage === 'STAGE_2_NDR_HIT' &&
                            'Stage 2: Fake "Door Locked" scan intercepted in 38s.'}
                          {stage === 'STAGE_2_CANCEL_SAVE' &&
                            '1-Shot ₹100 UPI Cancellation Save offered (2-hr gate).'}
                          {stage === 'STAGE_2_PIN_PROMPT' &&
                            'Priority Re-Attempt unlocked · Requesting GPS Pin or Skip.'}
                          {stage === 'STAGE_3_COMPLETED_PIN' &&
                            '✓ Landmark injected in NDR API + Google Maps SMS sent to rider.'}
                          {stage === 'STAGE_3_COMPLETED_SKIP' &&
                            '✓ Priority Re-Attempt locked using existing saved address.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ===========================================================
                RIGHT PAGE OF THE BOOK (330px × 560px)
                Flush against the left page with a hairline center book crease!
               =========================================================== */}
            <div
              className={`rs-book-leaf rs-book-leaf--right ${isFolded ? 'is-covered' : ''}`}
              aria-hidden={isFolded}
              inert={isFolded ? true : undefined}
            >
              {/* Subtle Book-Fold Crease Shadow along the center seam */}
              <div className="rs-book-crease-line" aria-hidden="true" />

              <span className="rs-ti-side-btn rs-ti-side-btn--right" aria-hidden="true" />

              <div className="rs-ios-display rs-ios-display--inner-right">
                {posture !== 'whatsapp-duo' ? (
                  <div className="rs-ios-homescreen">
                    <div className="rs-ios-statusbar">
                      <span className="rs-ios-carrier">RescueShip OS</span>
                      <div className="rs-ios-StatusIcons">
                        <span>98%</span>
                        <Wifi size={12} />
                        <BatteryCharging size={14} />
                      </div>
                    </div>

                    {/* Top Clickable iOS Notification Banner */}
                    <button
                      type="button"
                      className="rs-solid-notif-card"
                      onClick={() => {
                        setUserInteracted(true);
                        setPosture('whatsapp-duo');
                      }}
                    >
                      <div className="rs-wa-squircle-sm">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z" />
                        </svg>
                        <span className="rs-notif-badge">1</span>
                      </div>
                      <div className="rs-ios-notif__body">
                        <div className="rs-ios-notif__row">
                          <strong>RescueShip Delivery Support ✓</strong>
                          <span>Open Chat</span>
                        </div>
                        <p>
                          Tap here or on the WhatsApp (1) icon to launch the live rescue chat.
                        </p>
                      </div>
                    </button>

                    <div className="rs-solid-info-card">
                      <div className="rs-ios-glass-card__row">
                        <span>BOOK-OPEN DUAL DISPLAY</span>
                        <strong>SEQUENTIAL FLOW</strong>
                      </div>
                      <p>
                        Walks through <strong>Pre-Delivery UPI</strong> and{' '}
                        <strong>Afternoon NDR Intercept</strong> sequentially, ending with{' '}
                        <strong>Share Location Pin + Skip</strong> in both paths.
                      </p>
                    </div>

                    {/* Bottom iOS Dock */}
                    <div className="rs-solid-dock">
                      <div className="rs-ios-squircle rs-squircle--phone">
                        <Phone size={21} />
                      </div>
                      <div className="rs-ios-squircle rs-squircle--safari">
                        <Compass size={21} />
                      </div>
                      <div className="rs-ios-squircle rs-squircle--messages">
                        <MessageCircle size={21} />
                      </div>
                      <button
                        type="button"
                        className="rs-dock-wa-btn"
                        onClick={() => {
                          setUserInteracted(true);
                          setPosture('whatsapp-duo');
                        }}
                        aria-label="Launch WhatsApp from iOS Dock"
                      >
                        <div className="rs-ios-squircle rs-squircle--whatsapp">
                          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z" />
                          </svg>
                          <span className="rs-ios-badge">1</span>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* RIGHT PAGE OF WHATSAPP: LIVE SEQUENTIAL CHAT */
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
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
