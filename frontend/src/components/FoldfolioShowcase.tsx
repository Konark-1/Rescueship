import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  CheckCheck,
  Phone,
  Video,
  RotateCcw,
  PackageCheck,
  ChevronLeft,
  Lock,
  Plus,
  Mic,
  Camera,
  Terminal,
  ArrowUpRight,
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
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Sequential WhatsApp flow state
  const [stage, setStage] = useState<FlowStage>('STAGE_1_PRE_DELIVERY');
  const [activePathLabel, setActivePathLabel] = useState<'PRE_DELIVERY' | 'NDR_INTERCEPT'>('PRE_DELIVERY');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [liveSlaTimer, setLiveSlaTimer] = useState(38);

  // Live Dashboard pulse counter
  useEffect(() => {
    const id = window.setInterval(() => {
      setLiveSlaTimer((prev) => (prev < 44 ? prev + 1 : 38));
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, stage]);

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

  return (
    <section
      id="foldfolio-demo"
      className="rs-duo-clean-section"
      aria-label="Interactive WhatsApp & Live Telemetry Showcase"
    >
      <div className="rs-duo-inner-wrap">
        {/* Direction A Clean Audited Header */}
        <header className="rs-duo-header-bar">
          <div className="rs-duo-header-simple">
            <h2 className="rs-fold-title">
              Watch a failed delivery get rescued in real time.
            </h2>
            <p className="rs-fold-subtitle">
              An unverified "Door Locked" scan is intercepted on WhatsApp within 90 seconds, confirmed by the buyer, and re-dispatched to the courier.
            </p>
          </div>
        </header>

        {/* =========================================================
            THE ORIGINAL RESTORED SPLIT-VIEW SHOWCASE COMPONENT
            Left Pane: Authentic iOS WhatsApp Business Chat
            Right Pane: Swiss Telemetry & Live Execution Inspector
           ========================================================= */}
        <div className="rs-duo-app-fullbleed">
          {/* LEFT PANE: AUTHENTIC iOS WHATSAPP BUSINESS API (WABA) CHAT */}
          <div className="rs-wa-pane">
            {/* Native iOS WhatsApp Top Navigation Bar */}
            <div className="rs-wa-header">
              <button
                type="button"
                className="rs-wa-back-btn"
                onClick={() => handleResetFlow(false)}
                aria-label="Reset Conversation"
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
                  This business uses a secure service from Meta to manage this chat.
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
                                  I&apos;m Home — Lock Free Priority Re-Attempt
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
                    : '▲ TOTAL BLEED AT RISK'}
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
                  ? 'NODE: OFD_PREPAID_CONVERT'
                  : 'NODE: NDR_ARREST_ENGINE'}
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

        {/* Direction A Audited Pill: Solid architectural dot, clean typography */}
        <div className="rs-floating-island-wrap">
          <div className="rs-floating-island">
            <span className="rs-island-dot is-emerald" aria-hidden="true" />
            <div className="rs-island-copy">
              <strong>Interactive Sandbox: Tap inside WhatsApp</strong>
              <span>Test both rescue flows live in real time.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FoldfolioShowcase;
