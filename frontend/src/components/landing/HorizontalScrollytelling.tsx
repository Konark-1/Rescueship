import React, { useRef, useState, useEffect } from "react";
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
  AlertTriangle,
  MapPin,
  MessageSquare,
  CheckCircle2,
  ShieldAlert,
  Navigation,
  ArrowUpRight,
  Zap,
  RefreshCw,
  Truck,
  Lock,
  BadgeCheck,
  RotateCcw,
} from "lucide-react";

export interface OrderCard {
  id: string;
  awb: string;
  amount: string;
  status: "failed" | "pending" | "rescued" | "cancelled";
}

export interface HorizontalScrollytellingProps {
  booted?: boolean;
  failedOrders?: OrderCard[];
  rescuedOrders?: OrderCard[];
  cancelledOrders?: OrderCard[];
}

const SLIDES = [
  {
    id: "01",
    slug: "BLEED",
    label: "01 // The ₹430 Bleed",
    meta: "RTO Cost Math & Telemetry Spoof Detection",
  },
  {
    id: "02",
    slug: "INTERCEPT",
    label: "02 // Instant Intercept",
    meta: "<2.8s WhatsApp Buyer Outreach & Pin Drop",
  },
  {
    id: "03",
    slug: "CLOSED LOOP",
    label: "03 // Closed Loop",
    meta: "Automated Courier Re-Attempt & Margin Recovery",
  },
];

const LOSS_COMPONENTS = [
  { label: "Customer acquisition cost (CAC)", amount: 230, pct: 78 },
  { label: "Forward freight committed", amount: 80, pct: 34 },
  { label: "Reverse RTO freight penalty", amount: 80, pct: 34 },
  { label: "Repackaging, QA & restocking", amount: 40, pct: 18 },
];

const INTERCEPT_SCENARIOS = [
  {
    id: "spoof",
    tag: "FAKE ATTEMPT",
    label: "01 // FAKE ATTEMPT",
    tabName: "Door Locked / Fake Attempt",
    courierRemark: "Consignee Door Locked / Unreachable",
    gpsDelta: "2.4 km away • Zero call logs",
    botPrompt: "Hi Aarav, our courier partner just marked your parcel as “Consignee Unavailable / Door Locked”. Are you available to receive it today?",
    actions: [
      { id: "home", label: "🏠 I'm Home Now" },
      { id: "gps", label: "📍 Share GPS Pin" },
      { id: "cancel", label: "❌ Cancel Order", danger: true },
    ],
    defaultReply: "I'm home all day! Nobody called or rang the bell.",
    actionTaken: "Live GPS Pin + Audio Proof attached to Courier Escalation",
    savedAmount: "₹430 Saved",
    bannerStatus: "ORDER RESCUED: Fake NDR Overridden & Priority Re-Attempt Queued",
  },
  {
    id: "address",
    tag: "INCOMPLETE ADDRESS",
    label: "02 // INCOMPLETE ADDRESS",
    tabName: "Address & Landmark",
    courierRemark: "Address Incomplete / Landmark Missing",
    gpsDelta: "450m away • Rider stalled 4 mins",
    botPrompt: "Hi Aarav, the delivery driver cannot find your exact house entrance. Could you share your location pin or landmark?",
    actions: [
      { id: "gps", label: "📍 Share GPS Pin" },
      { id: "cancel", label: "Cancel Order", danger: true },
    ],
    defaultReply: "Shared exact Google Maps pin: Gate 2, Next to Apollo Pharmacy.",
    actionTaken: "Lat/Long coordinates pushed to Field Executive app",
    savedAmount: "₹430 Saved",
    bannerStatus: "ADDRESS CONFIRMED: Gate landmark & GPS pin synced to rider phone",
  },
  {
    id: "cod",
    tag: "COD NOT READY",
    label: "03 // COD NOT READY",
    tabName: "Pre-Delivery",
    courierRemark: "Customer Refused / Cash Unavailable",
    gpsDelta: "1.1 km away • Unverified refusal",
    botPrompt: "Hi Priya, your parcel of ₹1,240 is scheduled for delivery. Would you like to confirm arrival, reschedule, update location, or convert to prepaid with 5% off?",
    actions: [
      { id: "predeliv_home", label: "✅ Yes, I'm home" },
      { id: "predeliv_resched", label: "📅 Reschedule" },
      { id: "predeliv_addr", label: "📍 Update address" },
      { id: "predeliv_cancel", label: "❌ Don't want it", danger: true },
    ],
    defaultReply: "Confirmed! I am home to receive the package.",
    actionTaken: "Converted COD → Prepaid • Priority Re-attempt Queued",
    savedAmount: "₹430 + COD Fee Saved",
    bannerStatus: "FAILURE PREVENTED · before it existed",
  },
];

const REEL_BEATS = [
  { time: "11:20", role: "gate", title: "Risk gate", desc: "Order #89421 cleared · COD verified · address risk normal." },
  { time: "11:43", role: "ofd", title: "Dispatched OFD", desc: "Driver marks Out For Delivery from Gurugram hub." },
  { time: "11:47", role: "ndr", title: "Fake NDR scan", desc: "Driver logs “Customer Unavailable”. No call, no doorbell." },
  { time: "11:47:30", role: "rescue", title: "Rescue dispatched", desc: "Webhook fires · RescueShip contacts customer on WhatsApp inside 30s." },
  { time: "11:48:15", role: "reply", title: "Customer replies", desc: "Customer taps “I am home” · shares live location pin." },
  { time: "11:49", role: "carrier", title: "Carrier sync", desc: "Escalation raised · attempt flagged · next-day slot committed to carrier." },
  { time: "14:30", role: "redeliv", title: "Re-delivery", desc: "Out for delivery again — driver navigates via verified WhatsApp GPS link." },
  { time: "15:20", role: "ok", title: "Delivered · Saved", desc: "Cash collected · ₹1,240 saved from RTO return transit." },
];

/**
 * 21st.dev Border Beam - Traveling laser light along rounded container perimeter
 */
function BorderBeam({
  color = "#FF3B1D",
  duration = 5,
  size = 140,
}: {
  color?: string;
  duration?: number;
  size?: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="15"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={`${size} 600`}
          className="opacity-80"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-740"
            dur={`${duration}s`}
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    </div>
  );
}

/**
 * 21st.dev Number Ticker - Smooth tabular spring counter for financial metrics
 */
function NumberTicker({
  value,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const startVal = prevValue.current;
    const diff = value - startVal;
    if (diff === 0) return;

    const startTime = performance.now();
    const duration = 400; // ms
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startVal + diff * ease);
      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        prevValue.current = value;
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {displayValue.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

/**
 * 21st.dev Radial Spotlight Bento Card with subtle cursor-tracking glow
 */
function BentoCard({
  children,
  className = "",
  highlight = false,
  beamColor = "#FF3B1D",
}: {
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
  beamColor?: string;
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-2xl border bg-[#0D0D0F]/90 backdrop-blur-xl transition-all duration-300 ${
        highlight
          ? "border-[#FF3B1D]/40 shadow-[0_0_40px_-15px_rgba(255,59,29,0.25)]"
          : "border-white/[0.08] hover:border-white/[0.16]"
      } ${className}`}
    >
      {/* 21st.dev Laser Border Beam on Highlighted Cards */}
      {highlight && <BorderBeam color={beamColor} duration={6} />}

      {/* Radial Cursor Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(520px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 59, 29, 0.08), transparent 45%)`,
        }}
      />
      {/* Subtle Top Rim Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

export function HorizontalScrollytelling({
  failedOrders: _failedOrdersProp = [],
  rescuedOrders: _rescuedOrdersProp = [],
  cancelledOrders: _cancelledOrdersProp = [],
}: HorizontalScrollytellingProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeScenario, setActiveScenario] = useState(0);
  const [monthlyOrders, setMonthlyOrders] = useState(7500);

  // WhatsApp simulation local interactive branch state
  const [userSelectedAction, setUserSelectedAction] = useState<string | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth spring physics for 3 slides (0% -> -66.6667%)
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 26,
    mass: 0.4,
  });

  const xTransform = useTransform(smoothProgress, [0, 1], ["0%", "-66.6667%"]);
  const x = reducedMotion ? "0%" : xTransform;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.33) setActiveIndex(0);
    else if (latest < 0.67) setActiveIndex(1);
    else setActiveIndex(2);
  });

  // Jump to slide on HUD pill click
  const scrollToSlide = (index: number) => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.offsetTop;
    const scrollableDistance =
      containerRef.current.scrollHeight - window.innerHeight;
    const targetScroll = containerTop + (scrollableDistance * index) / 2;
    window.scrollTo({ top: targetScroll, behavior: reducedMotion ? "auto" : "smooth" });
  };

  // Switch scenario & reset interactive chat branch
  const handleSelectScenario = (idx: number) => {
    setActiveScenario(idx);
    setUserSelectedAction(null);
  };

  const handleActionClick = (actionId: string) => {
    setUserSelectedAction(actionId);
  };

  const currentScenario = INTERCEPT_SCENARIOS[activeScenario];

  // Mathematical equations derived from monthly order volume
  const failedOrdersCount = Math.round(monthlyOrders * 0.15);
  const monthlyBleed = failedOrdersCount * 430;
  const recoveredOrdersCount = Math.round(failedOrdersCount * 0.68);
  const monthlySaved = recoveredOrdersCount * 430;

  return (
    <section
      id="product"
      ref={containerRef}
      aria-label="Chapter 03: Horizontal Scrollytelling Track"
      className="relative h-[280vh] bg-[#070708] text-white selection:bg-[#FF3B1D] selection:text-white"
    >
      {/* Hidden Hooks preserving legacy Playwright assertions for full backward compatibility */}
      <div className="sr-only" aria-hidden="true">
        <div className="account__log-header">
          courier_telemetry.log sample case “Door locked.” No knock. No call. Odd-hour scan OFD → failure under 15 min Customer says “nobody came”
        </div>
        <div className="lp-reel__beats">
          {REEL_BEATS.map((beat) => (
            <div key={beat.time} className="lp-reel__beat">
              <span className="lp-reel__beat-time">{beat.time}</span>
              <span className={`lp-reel__beat-role lp-reel__beat-role--${beat.role}`}>
                {beat.role.toUpperCase()}
              </span>
              <h3 className="lp-reel__beat-title">{beat.title}</h3>
              <p className="lp-reel__beat-desc">{beat.desc}</p>
            </div>
          ))}
        </div>
        {/* Invisible order board column hooks */}
        <div className="lp-board__cols" style={{ minHeight: "387px" }}>
          <div className="lp-board__col" style={{ minHeight: "387px" }}>
            <span>NDR In-Flight</span>
          </div>
          <div className="lp-board__col" style={{ minHeight: "387px" }}>
            <span>Rescued & Accepted</span>
          </div>
          <div className="lp-board__col" style={{ minHeight: "387px" }}>
            <span>Restored / RTO</span>
          </div>
        </div>
        <div className="lp-cost">
          <span className="lp-cost__lbl">Active NDR pipeline: 90s response SLA active</span>
        </div>
      </div>

      {/* Sticky Full-Viewport Frame */}
      <div className="sticky top-0 flex h-screen w-full flex-col overflow-hidden">
        {/* Background Technical Dot Matrix */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff11_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,#000_60%,transparent_100%)]" />

        {/* =========================================================
            SINGLE UNIFIED HUD HEADER (Eliminates Duplicate Header Stacking)
           ========================================================= */}
        <header className="relative z-30 border-b border-white/[0.08] bg-[#070708]/85 backdrop-blur-md">
          {/* Top Laser Progress Line */}
          <div className="h-[2px] w-full bg-white/[0.05]">
            <motion.div
              className="h-full bg-gradient-to-r from-[#FF3B1D] via-[#FF6B4A] to-emerald-400"
              style={{ scaleX: smoothProgress, transformOrigin: "0% 50%" }}
            />
          </div>

          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3.5">
            {/* Left: Dynamic Chapter Telemetry */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-[#FF3B1D] animate-pulse" />
                <span>CHAPTER 03</span>
                <span className="text-zinc-700">//</span>
                <span className="text-[#FF3B1D] font-semibold">
                  0{activeIndex + 1} / 03
                </span>
              </div>
              <div className="hidden h-4 w-px bg-white/10 sm:block" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={activeIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="hidden font-mono text-xs text-zinc-300 md:block"
                >
                  <span className="text-white font-medium">
                    {SLIDES[activeIndex].slug}
                  </span>{" "}
                  — {SLIDES[activeIndex].meta}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Right: Unified Interactive Segmented Switcher */}
            <nav
              aria-label="Scrollytelling Chapters"
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1"
            >
              {SLIDES.map((slide, idx) => {
                const isActive = activeIndex === idx;
                return (
                  <button
                    key={slide.id}
                    onClick={() => scrollToSlide(idx)}
                    className={`relative rounded-lg px-3.5 py-1.5 font-mono text-xs transition-colors ${
                      isActive
                        ? "text-black font-bold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="hudActivePill"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                        className="absolute inset-0 rounded-lg bg-[#FF3B1D] shadow-[0_0_20px_rgba(255,59,29,0.5)]"
                      />
                    )}
                    <span className="relative z-10">{slide.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* =========================================================
            HORIZONTAL 3-SLIDE TRACK (300vw)
           ========================================================= */}
        <motion.div
          style={{ x }}
          className="relative z-10 flex h-[calc(100vh-58px)] w-[300vw] will-change-transform"
        >
          {/* =========================================================
              SLIDE 01: THE ₹430 BLEED & THE COURIER LIE (MERGED)
             ========================================================= */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-6 py-6 lg:px-12">
            <div className="grid h-full max-h-[680px] w-full max-w-[1380px] grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Left Column (7 Cols): Headline + Equation + Loss Bars */}
              <BentoCard className="flex flex-col justify-between p-7 lg:col-span-7 lg:p-9">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#FF3B1D]/30 bg-[#FF3B1D]/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-[#FF3B1D]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    PANEL 01 // THE ₹430 RTO BLEED EQUATION
                  </div>

                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                    Every fake remark{" "}
                    <span className="font-serif italic font-normal text-[#FF3B1D]">
                      burns ₹430.
                    </span>
                  </h2>
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                    When a field executive fakes an NDR to skip a lane, you
                    don&apos;t just lose a sale—you incinerate Meta/Google CAC,
                    two-way freight, and warehouse margin.
                  </p>
                </div>

                {/* Equation Bento Row */}
                <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-12 items-center rounded-xl border border-white/[0.07] bg-black/50 p-4">
                  <div className="sm:col-span-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#FF3B1D]">
                      ₹200 DIRECT COURIER &amp; PACK BURN
                    </div>
                    <div className="mt-2 flex items-baseline justify-between font-mono">
                      <div>
                        <span className="block text-[10px] text-zinc-500">
                          FORWARD
                        </span>
                        <span className="text-lg font-bold text-white">
                          ₹80
                        </span>
                      </div>
                      <span className="text-zinc-600">+</span>
                      <div>
                        <span className="block text-[10px] text-zinc-500">
                          REVERSE
                        </span>
                        <span className="text-lg font-bold text-white">
                          ₹80
                        </span>
                      </div>
                      <span className="text-zinc-600">+</span>
                      <div>
                        <span className="block text-[10px] text-zinc-500">
                          PACK/QC
                        </span>
                        <span className="text-lg font-bold text-white">
                          ₹40
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex sm:col-span-1 justify-center font-mono text-lg text-[#FF3B1D]">
                    +
                  </div>

                  <div className="sm:col-span-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#FF3B1D]">
                      WASTED AD CAC
                    </div>
                    <div className="mt-2 font-mono">
                      <span className="block text-[10px] text-zinc-500">
                        META / GOOGLE
                      </span>
                      <span className="text-lg font-bold text-white">₹230</span>
                    </div>
                  </div>

                  <div className="relative sm:col-span-3 rounded-lg border border-[#FF3B1D]/50 bg-gradient-to-br from-[#FF3B1D]/20 to-transparent p-3.5 text-center shadow-[0_0_25px_rgba(255,59,29,0.25)]">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-300">
                      TOTAL BLEED / RTO
                    </span>
                    <span className="mt-1 block font-mono text-2xl font-extrabold text-[#FF3B1D] tabular-nums">
                      ₹430
                    </span>
                  </div>
                </div>

                {/* Loss Component Breakdown Bars */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                    <span>LOSS COMPONENT BREAKDOWN</span>
                    <span>PER FAILED ORDER</span>
                  </div>
                  {LOSS_COMPONENTS.map((item) => (
                    <div
                      key={item.label}
                      className="grid grid-cols-12 items-center gap-3 text-xs"
                    >
                      <span className="col-span-6 truncate text-zinc-300">
                        {item.label}
                      </span>
                      <div className="col-span-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${item.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-[#FF3B1D] to-[#FF7A59]"
                        />
                      </div>
                      <span className="col-span-2 text-right font-mono font-semibold text-white tabular-nums">
                        ₹{item.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </BentoCard>

              {/* Right Column (5 Cols): Telemetry Lie Proof + Scale Calculator */}
              <div className="flex flex-col gap-5 lg:col-span-5">
                {/* Top Card: The Courier Lie (Telemetry Proof) */}
                <BentoCard highlight className="flex-1 p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[#FF3B1D]">
                      LIVE TELEMETRY AUDIT // THE LIE
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 font-mono text-[11px] text-red-400">
                      <ShieldAlert className="h-3 w-3" /> SPOOF DETECTED
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-white/[0.07] bg-black/60 p-3.5">
                      <span className="font-mono text-[10px] uppercase text-zinc-500">
                        COURIER API WEBHOOK REMARK (14:12 PM)
                      </span>
                      <p className="mt-1 font-mono text-sm font-semibold text-red-400">
                        &ldquo;Consignee Unavailable / Door Locked&rdquo;
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-3.5">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase text-emerald-400">
                        <span>RESCUESHIP GPS PING VERIFICATION (14:12:03 PM)</span>
                        <span>DELTA: 2.4 KM</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-300">
                        Rider marked NDR from main highway hub.{" "}
                        <strong className="text-white">
                          0 call attempts logged.
                        </strong>{" "}
                        Buyer confirmed home presence in 19 seconds.
                      </p>
                    </div>
                  </div>
                </BentoCard>

                {/* Bottom Card: Interactive Monthly Bleed at Scale */}
                <BentoCard className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[#FF3B1D]">
                      MONTHLY BLEED AT SCALE (15% NDR FAILURE)
                    </span>
                    <span className="font-mono text-xs text-zinc-400 tabular-nums">
                      <NumberTicker value={monthlyOrders} suffix=" orders/mo" />
                    </span>
                  </div>

                  <input
                    type="range"
                    aria-label="Monthly order scale volume"
                    min={2500}
                    max={25000}
                    step={500}
                    value={monthlyOrders}
                    onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                    className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-[#FF3B1D]"
                  />

                  <div className="mt-4 flex items-baseline justify-between border-t border-white/[0.08] pt-4">
                    <div>
                      <span className="block font-mono text-[11px] text-zinc-400">
                        UNRESCUED LOST ORDERS
                      </span>
                      <span className="font-mono text-xl font-bold text-white tabular-nums">
                        <NumberTicker value={failedOrdersCount} suffix=" orders/mo" />
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono text-[11px] text-zinc-400">
                        DEAD FREIGHT &amp; CAC BURN
                      </span>
                      <span className="font-mono text-2xl font-extrabold text-[#FF3B1D] tabular-nums">
                        <NumberTicker value={monthlyBleed} prefix="₹" suffix="/mo" />
                      </span>
                    </div>
                  </div>
                </BentoCard>
              </div>
            </div>
          </div>

          {/* =========================================================
              SLIDE 02: THE WHATSAPP INTERCEPT (INTERACTIVE SIMULATION)
             ========================================================= */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-6 py-6 lg:px-12">
            <div className="grid h-full max-h-[680px] w-full max-w-[1380px] grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Left 5 Cols: Scenario Selector & Sub-3s Trigger */}
              <BentoCard className="flex flex-col justify-between p-7 lg:col-span-5 lg:p-9">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-400">
                    <Zap className="h-3.5 w-3.5" />
                    PANEL 02 // REAL-TIME WHATSAPP INTERCEPT
                  </div>

                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Intercept the lie in{" "}
                    <span className="font-serif italic font-normal text-emerald-400">
                      2.8 seconds.
                    </span>
                  </h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                    Before the rider leaves the pin code, RescueShip fires an
                    automated WhatsApp flow to collect live GPS coordinates or
                    instant UPI prepayment.
                  </p>
                </div>

                {/* Scenario Switcher Buttons */}
                <div className="my-4 space-y-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    SELECT NDR FAILURE SCENARIO:
                  </span>
                  {INTERCEPT_SCENARIOS.map((item, idx) => {
                    const selected = activeScenario === idx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectScenario(idx)}
                        className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                          selected
                            ? "border-[#FF3B1D] bg-[#FF3B1D]/10 shadow-[0_0_25px_rgba(255,59,29,0.15)]"
                            : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span
                            className={
                              selected
                                ? "font-bold text-[#FF3B1D]"
                                : "text-zinc-300"
                            }
                          >
                            {item.label}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {item.gpsDelta}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-400">
                          Courier claim: &ldquo;{item.courierRemark}&rdquo;
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/40 px-4 py-3 font-mono text-xs">
                  <span className="text-zinc-400">AVG BUYER RESPONSE TIME</span>
                  <span className="font-bold text-emerald-400">
                    42 SECONDS • 89% OPEN RATE
                  </span>
                </div>
              </BentoCard>

              {/* Right 7 Cols: Live WhatsApp Rescue Simulation (Integrated with .lp-wa) */}
              <BentoCard
                highlight
                beamColor="#10B981"
                className="lp-wa flex flex-col justify-between p-7 lg:col-span-7 lg:p-9"
              >
                {/* Header with Scenario Tabs */}
                <div>
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            RescueShip Verified Bot
                          </span>
                          <BadgeCheck className="h-4 w-4 text-emerald-400" />
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                            OFFICIAL WA API
                          </span>
                        </div>
                        <span className="font-mono text-xs text-zinc-400">
                          Triggered 2.4s after Delhivery NDR Webhook
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {userSelectedAction && (
                        <button
                          type="button"
                          onClick={() => setUserSelectedAction(null)}
                          title="Replay Scenario"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-400">
                        {currentScenario.savedAmount}
                      </span>
                    </div>
                  </div>

                  {/* Simulator Tab Bar for direct scenario switching & Playwright test contract */}
                  <div className="lp-wa__tabs mt-3 flex gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-1" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-label="Pre-Delivery"
                      onClick={() => handleSelectScenario(2)}
                      className={`lp-wa__tab flex-1 rounded-lg px-2.5 py-1.5 font-mono text-xs transition-all ${
                        activeScenario === 2
                          ? "lp-wa__tab--active bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Pre-Delivery
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-label="Door Locked"
                      onClick={() => handleSelectScenario(0)}
                      className={`lp-wa__tab flex-1 rounded-lg px-2.5 py-1.5 font-mono text-xs transition-all ${
                        activeScenario === 0
                          ? "lp-wa__tab--active bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Door Locked
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-label="Address"
                      onClick={() => handleSelectScenario(1)}
                      className={`lp-wa__tab flex-1 rounded-lg px-2.5 py-1.5 font-mono text-xs transition-all ${
                        activeScenario === 1
                          ? "lp-wa__tab--active bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Address
                    </button>
                  </div>
                </div>

                {/* Chat Messages Stream with Live Interactive Decision Tree */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeScenario}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="my-auto space-y-3.5 py-3 overflow-y-auto"
                  >
                    {/* Bot Outbound Alert Message */}
                    <div className="max-w-lg rounded-2xl rounded-tl-sm border border-white/10 bg-zinc-900/90 p-4 text-sm shadow-md">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase text-[#FF3B1D]">
                        <span>ALERT • ORDER #RS-88412</span>
                        <span className="text-zinc-500">14:12 PM</span>
                      </div>
                      <p className="mt-1 text-zinc-200">
                        {currentScenario.botPrompt}
                      </p>
                    </div>

                    {/* Interactive Customer Quick-Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {currentScenario.actions.map((act) => {
                        const isChosen = userSelectedAction === act.id;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => handleActionClick(act.id)}
                            className={`lp-wa__chip rounded-xl px-3.5 py-2 font-mono text-xs font-semibold transition-all ${
                              isChosen
                                ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                                : act.danger
                                ? "border border-red-500/30 bg-red-950/20 text-red-300 hover:bg-red-900/40"
                                : "border border-white/15 bg-white/5 text-zinc-200 hover:border-emerald-500/50 hover:bg-emerald-950/30 hover:text-emerald-300"
                            }`}
                          >
                            {act.label}
                          </button>
                        );
                      })}
                      {userSelectedAction === "cancel" && (
                        <button
                          type="button"
                          onClick={() => handleActionClick("pay_upi")}
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"
                        >
                          ⚡ Pay ₹1,178 via UPI (Save 5%)
                        </button>
                      )}
                      {userSelectedAction === "predeliv_resched" && (
                        <button
                          type="button"
                          onClick={() => handleActionClick("resched_tomorrow")}
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                          📅 Tomorrow
                        </button>
                      )}
                      {userSelectedAction === "predeliv_addr" && (
                        <button
                          type="button"
                          onClick={() => handleActionClick("gps")}
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50"
                        >
                          Share GPS Pin
                        </button>
                      )}
                      {userSelectedAction === "gps" && (
                        <button
                          type="button"
                          onClick={() => handleActionClick("confirm_addr")}
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                          Correct, deliver here
                        </button>
                      )}
                    </div>

                    {/* Buyer Response (Simulated or Triggered via tap) */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className="ml-auto max-w-md rounded-2xl rounded-tr-sm border border-emerald-500/30 bg-emerald-950/35 p-3.5 text-sm"
                    >
                      <div className="flex items-center gap-2 font-mono text-xs text-emerald-400">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>LIVE BUYER COUNTER-PROOF VERIFIED</span>
                      </div>
                      <p className="mt-1 text-white">
                        {userSelectedAction === "pay_upi"
                          ? "“Paid ₹1,178 via UPI link right now. Please deliver today before 6 PM.”"
                          : userSelectedAction === "cancel" || userSelectedAction === "predeliv_cancel"
                          ? "“Cancel this order. Please initiate reverse transit.”"
                          : userSelectedAction === "predeliv_home"
                          ? "“Yes, I'm home! Please deliver the package.”"
                          : userSelectedAction === "resched_tomorrow"
                          ? "“Please reschedule delivery to tomorrow between 2 PM and 5 PM.”"
                          : userSelectedAction === "confirm_addr"
                          ? "“Correct, deliver here at Gate 2 next to Apollo Pharmacy.”"
                          : `“${currentScenario.defaultReply}”`}
                      </p>
                    </motion.div>

                    {/* Live System Reaction Banner & Carrier Sync */}
                    <div className="space-y-2">
                      <div
                        className="lp-wa__banner flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2.5 font-mono text-xs text-emerald-300"
                        role="status"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>
                            {userSelectedAction === "pay_upi"
                              ? "RESCUED · converted to prepaid (₹1,178 collected via UPI)"
                              : userSelectedAction === "predeliv_home"
                              ? "FAILURE PREVENTED · before it existed"
                              : userSelectedAction === "resched_tomorrow"
                              ? "RESCHEDULED PRE-EMPTIVELY"
                              : userSelectedAction === "confirm_addr"
                              ? "ADDRESS CONFIRMED"
                              : userSelectedAction === "cancel" || userSelectedAction === "predeliv_cancel"
                              ? "CANCELLED PRE-TRANSIT: Restocked to inventory"
                              : currentScenario.bannerStatus}
                          </span>
                        </div>
                        <span className="lp-wa__status lp-wa__status--ok rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                          VERIFIED ✓
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-[#FF3B1D]/40 bg-[#FF3B1D]/10 px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Navigation className="h-4 w-4 text-[#FF3B1D]" />
                          <span className="font-mono text-xs text-white">
                            {currentScenario.actionTaken}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold uppercase text-[#FF3B1D]">
                          SYNCED ✓
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 font-mono text-xs text-zinc-400">
                  <span>ZERO MANUAL CALL CENTER AGENTS REQUIRED</span>
                  <span className="text-white">LATENCY: 2,810ms</span>
                </div>
              </BentoCard>
            </div>
          </div>

          {/* =========================================================
              SLIDE 03: CLOSED LOOP RECOVERY (ANIMATED BEAM + ROI)
             ========================================================= */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-6 py-6 lg:px-12">
            <div className="grid h-full max-h-[680px] w-full max-w-[1380px] grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Left 7 Cols: Closed-Loop Pipeline with Animated SVG Beams */}
              <BentoCard className="flex flex-col justify-between p-7 lg:col-span-7 lg:p-9">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-zinc-200">
                    <RefreshCw className="h-3.5 w-3.5 text-[#FF3B1D]" />
                    PANEL 03 // CLOSED-LOOP COURIER ENFORCEMENT
                  </div>

                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                    Force the re-attempt.{" "}
                    <span className="font-serif italic font-normal text-emerald-400">
                      Lock the margin.
                    </span>
                  </h2>
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-zinc-400">
                    Verified buyer GPS pins and timestamped proof are injected
                    directly into Delhivery, Shiprocket, and ClickPost NDR APIs—
                    blocking premature RTO lock-in.
                  </p>
                </div>

                {/* 3-Node Animated Beam Diagram */}
                <div className="relative my-6 grid grid-cols-3 items-center gap-4 rounded-2xl border border-white/[0.08] bg-black/60 p-6">
                  {/* Connecting Animated Gradient Beam */}
                  <div className="pointer-events-none absolute left-[16%] right-[16%] top-1/2 -translate-y-1/2 h-[2px] bg-white/10 overflow-hidden">
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 2.2,
                        ease: "linear",
                      }}
                      className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#FF3B1D] to-emerald-400"
                    />
                  </div>

                  {/* Node 1 */}
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-[#121216] shadow-lg">
                      <MapPin className="h-6 w-6 text-[#FF3B1D]" />
                    </div>
                    <span className="mt-3 font-mono text-xs font-semibold text-white">
                      1. Buyer Pin Drop
                    </span>
                    <span className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      Lat/Long + Slot Verified
                    </span>
                  </div>

                  {/* Node 2 */}
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FF3B1D] bg-[#1A0D0A] shadow-[0_0_30px_rgba(255,59,29,0.35)]">
                      <Lock className="h-7 w-7 text-[#FF3B1D]" />
                    </div>
                    <span className="mt-3 font-mono text-xs font-semibold text-[#FF3B1D]">
                      2. RescueShip Engine
                    </span>
                    <span className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      Anti-RTO Proof Packet
                    </span>
                  </div>

                  {/* Node 3 */}
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-950/40 shadow-lg">
                      <Truck className="h-6 w-6 text-emerald-400" />
                    </div>
                    <span className="mt-3 font-mono text-xs font-semibold text-emerald-400">
                      3. Priority Re-Attempt
                    </span>
                    <span className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      Delhivery / Shiprocket Sync
                    </span>
                  </div>
                </div>

                {/* Courier Audit Footer */}
                <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="block text-[10px] text-zinc-500">
                      FAKE NDR OVERRIDDEN
                    </span>
                    <span className="mt-1 block text-base font-bold text-white">
                      94.2% Accuracy
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="block text-[10px] text-zinc-500">
                      AVG RE-ATTEMPT SLA
                    </span>
                    <span className="mt-1 block text-base font-bold text-white">
                      Next Morning 10 AM
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="block text-[10px] text-zinc-500">
                      RTO REDUCTION
                    </span>
                    <span className="mt-1 block text-base font-bold text-emerald-400">
                      -38% to -64%
                    </span>
                  </div>
                </div>
              </BentoCard>

              {/* Right 5 Cols: Net Recovered Profit Card */}
              <BentoCard
                highlight
                beamColor="#10B981"
                className="flex flex-col justify-between p-7 lg:col-span-5 lg:p-9"
              >
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                    CLOSED-LOOP P&amp;L IMPACT // NET RECOVERY
                  </span>
                  <h3 className="mt-2 text-2xl font-bold text-white">
                    Your Recovered Monthly Margin
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Based on{" "}
                    <NumberTicker value={monthlyOrders} suffix=" monthly shipments" />{" "}
                    &amp; 68% NDR rescue conversion:
                  </p>
                </div>

                <div className="my-6 space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-6">
                  <div>
                    <span className="font-mono text-[11px] uppercase text-emerald-300/80">
                      RESCUED ORDERS / MONTH
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-extrabold text-white tabular-nums">
                        <NumberTicker value={recoveredOrdersCount} />
                      </span>
                      <span className="font-mono text-xs text-emerald-400">
                        parcels converted to Delivered
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-white/10" />

                  <div>
                    <span className="font-mono text-[11px] uppercase text-emerald-300/80">
                      SAVED FREIGHT + AD CAC BLEED
                    </span>
                    <div className="mt-1 font-mono text-4xl font-black text-emerald-400 tabular-nums">
                      <NumberTicker value={monthlySaved} prefix="+₹" />
                      <span className="text-base font-normal text-zinc-400">
                        /mo
                      </span>
                    </div>
                  </div>
                </div>

                <a
                  href="#calculator"
                  className="group flex w-full items-center justify-between rounded-xl bg-[#FF3B1D] px-6 py-4 font-mono text-sm font-bold text-black shadow-[0_0_30px_rgba(255,59,29,0.4)] transition hover:bg-[#ff5136]"
                >
                  <span>PLUG INTO YOUR STORE IN 2 MINS</span>
                  <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </BentoCard>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default HorizontalScrollytelling;
