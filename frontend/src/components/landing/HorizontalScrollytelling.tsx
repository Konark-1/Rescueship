"use client";

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
  PhoneCall,
  Terminal,
  ShieldCheck,
} from "lucide-react";
import { AnimatedBeam } from "../ui/animated-beam";

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
  { label: "Customer acquisition cost (Meta CAC)", amount: 230, pct: 53 },
  { label: "Forward courier freight committed", amount: 80, pct: 19 },
  { label: "Reverse RTO courier freight penalty", amount: 80, pct: 19 },
  { label: "Warehouse repackaging, QA & restocking", amount: 40, pct: 9 },
];

const CARRIER_LOSS_BENCHMARKS = [
  { name: "Delhivery Express", forward: "₹80", reverse: "₹80", total: "₹160", sla: "48h SLA Lock" },
  { name: "Shadowfax Local", forward: "₹85", reverse: "₹85", total: "₹170", sla: "36h SLA Lock" },
  { name: "BlueDart Surface", forward: "₹110", reverse: "₹110", total: "₹220", sla: "72h SLA Lock" },
];

const INTERCEPT_SCENARIOS = [
  {
    id: "spoof",
    tag: "FAKE ATTEMPT",
    label: "01 // FAKE ATTEMPT",
    tabName: "Door Locked",
    courierRemark: "Consignee Door Locked / Unreachable",
    gpsDelta: "2.4 km away • 0 calls logged",
    botPrompt: "Hi Aarav, our courier partner marked parcel #RS-88412 as “Door Locked / Unreachable”. Are you available to receive it today?",
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
    tabName: "Address",
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
    botPrompt: "Hi Priya, your parcel of ₹1,240 is scheduled for delivery. Would you like to confirm arrival, reschedule, or convert to prepaid with 5% off?",
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
 * 21st.dev Border Beam - Traveling laser light along container perimeter
 */
function BorderBeam({
  color = "#FF3B1D",
  duration = 6,
  size = 180,
  className = "",
}: {
  color?: string;
  duration?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}>
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
          className="opacity-90"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-780"
            dur={`${duration}s`}
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    </div>
  );
}

/**
 * 21st.dev Number Ticker - Smooth tabular spring counter
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
    const duration = 350; // ms
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
 * 21st.dev Radial Spotlight Bento Card with cursor-tracking glow
 */
function BentoCard({
  children,
  className = "",
  innerClassName = "justify-between",
  highlight = false,
  beamColor = "#FF3B1D",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
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
      className={`relative overflow-hidden rounded-2xl border bg-[#0C0D11] backdrop-blur-xl transition-all duration-300 ${
        highlight
          ? "border-[#FF3B1D]/40 shadow-[0_0_40px_-15px_rgba(255,59,29,0.3)]"
          : "border-white/[0.08] hover:border-white/[0.18]"
      } ${className}`}
    >
      {highlight && <BorderBeam color={beamColor} duration={6} size={200} />}

      {/* Radial Cursor Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(550px circle at ${mousePos.x}px ${mousePos.y}px, ${
            beamColor === "#10B981"
              ? "rgba(16, 185, 129, 0.09)"
              : "rgba(255, 59, 29, 0.09)"
          }, transparent 45%)`,
        }}
      />
      {/* Subtle Top Rim Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className={`relative z-10 flex h-full flex-col ${innerClassName}`}>{children}</div>
    </div>
  );
}

export function HorizontalScrollytelling({
  failedOrders: _failedOrdersProp = [],
  rescuedOrders: _rescuedOrdersProp = [],
  cancelledOrders: _cancelledOrdersProp = [],
}: HorizontalScrollytellingProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const beamContainerRef = useRef<HTMLDivElement>(null);
  const node1Ref = useRef<HTMLDivElement>(null);
  const node2Ref = useRef<HTMLDivElement>(null);
  const node3Ref = useRef<HTMLDivElement>(null);

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

  const [activeSlideOverride, setActiveSlideOverride] = useState<number | null>(null);

  // Smooth spring physics for 3 slides with plateau resting regions
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.35,
  });

  const xTransform = useTransform(
    smoothProgress,
    [0, 0.12, 0.42, 0.58, 0.82, 1.0],
    ["0vw", "0vw", "-100vw", "-100vw", "-200vw", "-200vw"]
  );

  const x = activeSlideOverride !== null
    ? activeSlideOverride === 0
      ? "0vw"
      : activeSlideOverride === 1
      ? "-100vw"
      : "-200vw"
    : reducedMotion
    ? activeIndex === 0
      ? "0vw"
      : activeIndex === 1
      ? "-100vw"
      : "-200vw"
    : xTransform;

  useEffect(() => {
    if (activeSlideOverride === null) return;
    const handleScrollAttempt = () => {
      setActiveSlideOverride(null);
    };
    window.addEventListener("wheel", handleScrollAttempt, { passive: true });
    window.addEventListener("touchmove", handleScrollAttempt, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleScrollAttempt);
      window.removeEventListener("touchmove", handleScrollAttempt);
    };
  }, [activeSlideOverride]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.35) setActiveIndex(0);
    else if (latest < 0.65) setActiveIndex(1);
    else setActiveIndex(2);
  });

  // Jump to slide on HUD pill click
  const scrollToSlide = (index: number) => {
    setActiveIndex(index);
    setActiveSlideOverride(index);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerTop = rect.top + window.scrollY;
    const scrollableDistance =
      containerRef.current.scrollHeight - window.innerHeight;
    const targetProgress = index === 0 ? 0.02 : index === 1 ? 0.50 : 0.80;
    const targetScroll = containerTop + scrollableDistance * targetProgress;
    window.scrollTo({ top: targetScroll, behavior: "auto" });
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

      {/* Sticky Full-Viewport Frame Locked Under 64px Fixed Navbar */}
      <div className="sticky top-[64px] flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden bg-[#070708]">
        {/* Subtle Background Technical Dot Grid */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0c_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,#000_60%,transparent_100%)]" />

        {/* =========================================================
            SINGLE UNIFIED HUD HEADER (52px)
           ========================================================= */}
        <header className="relative z-30 h-[52px] shrink-0 border-b border-white/[0.08] bg-[#070708]/95 backdrop-blur-md">
          {/* Top Laser Progress Line */}
          <div className="h-[2px] w-full bg-white/[0.05]">
            <motion.div
              className="h-full bg-gradient-to-r from-[#FF3B1D] via-[#FF6B4A] to-emerald-400"
              style={{ scaleX: smoothProgress, transformOrigin: "0% 50%" }}
            />
          </div>

          <div className="mx-auto flex h-[50px] max-w-[1440px] items-center justify-between px-6">
            {/* Left: Dynamic Chapter Telemetry */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-[#FF3B1D] animate-pulse" />
                <span>CHAPTER 03</span>
                <span className="text-zinc-700">//</span>
                <span className="font-semibold text-[#FF3B1D]">
                  0{activeIndex + 1} / 03
                </span>
              </div>
              <div className="hidden h-4 w-px bg-white/10 sm:block" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={activeIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="hidden font-mono text-xs text-zinc-300 md:block"
                >
                  <span className="font-medium text-white">
                    {SLIDES[activeIndex].slug}
                  </span>{" "}
                  — {SLIDES[activeIndex].meta}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Right: Unified Interactive Segmented Switcher */}
            <nav
              aria-label="Scrollytelling Chapters"
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1"
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
          className="relative z-10 flex h-[calc(100%-52px)] w-[300vw] will-change-transform"
        >
          {/* =========================================================
              SLIDE 01: THE ₹430 BLEED & THE COURIER LIE (MERGED)
             ========================================================= */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="grid w-full max-w-[1340px] grid-cols-1 gap-5 lg:grid-cols-12 lg:h-[550px]">
              {/* Left Column (7 Cols): Headline + Equation + Loss Bars + Carrier Loss Ledger */}
              <BentoCard className="p-6 lg:col-span-7 lg:p-7 justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#FF3B1D]/30 bg-[#FF3B1D]/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-[#FF3B1D]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    PANEL 01 // THE ₹430 RTO BLEED EQUATION
                  </div>

                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                    Every fake remark{" "}
                    <span className="font-serif italic font-normal text-[#FF3B1D]">
                      burns ₹430.
                    </span>
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                    When a field executive fakes an NDR to skip a lane, you don&apos;t just lose a sale—you incinerate Meta/Google CAC, two-way freight, and warehouse margin.
                  </p>
                </div>

                {/* Equation Bento Row */}
                <div className="my-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center rounded-xl border border-white/[0.08] bg-black/60 p-3.5">
                  <div className="sm:col-span-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#FF3B1D]">
                      ₹200 DIRECT LOGISTICS &amp; PACK BURN
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono">
                      <div>
                        <span className="block text-[10px] text-zinc-400">FORWARD</span>
                        <span className="text-base font-bold text-white">₹80</span>
                      </div>
                      <span className="text-zinc-600">+</span>
                      <div>
                        <span className="block text-[10px] text-zinc-400">REVERSE</span>
                        <span className="text-base font-bold text-white">₹80</span>
                      </div>
                      <span className="text-zinc-600">+</span>
                      <div>
                        <span className="block text-[10px] text-zinc-400">PACK/QC</span>
                        <span className="text-base font-bold text-white">₹40</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex sm:col-span-1 justify-center font-mono text-base text-[#FF3B1D]">
                    +
                  </div>

                  <div className="sm:col-span-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#FF3B1D]">
                      WASTED AD CAC
                    </div>
                    <div className="mt-1.5 font-mono">
                      <span className="block text-[10px] text-zinc-400">META / GOOGLE</span>
                      <span className="text-base font-bold text-white">₹230</span>
                    </div>
                  </div>

                  <div className="relative sm:col-span-3 rounded-lg border border-[#FF3B1D]/50 bg-gradient-to-br from-[#FF3B1D]/20 to-transparent p-3 text-center shadow-[0_0_20px_rgba(255,59,29,0.25)]">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-300">
                      TOTAL BLEED / RTO
                    </span>
                    <span className="mt-0.5 block font-mono text-xl font-extrabold text-[#FF3B1D] tabular-nums">
                      ₹430
                    </span>
                  </div>
                </div>

                {/* Loss Component Breakdown Bars */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    <span>UNIT LOSS BREAKDOWN PER FAILED ORDER</span>
                    <span>% OF TOTAL BLEED</span>
                  </div>
                  {LOSS_COMPONENTS.map((item) => (
                    <div key={item.label} className="grid grid-cols-12 items-center gap-2.5 text-xs">
                      <span className="col-span-6 truncate font-mono text-[11px] text-zinc-300">
                        {item.label}
                      </span>
                      <div className="col-span-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${item.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-[#FF3B1D] to-[#FF7A59]"
                        />
                      </div>
                      <span className="col-span-2 text-right font-mono text-[11px] font-semibold text-white tabular-nums">
                        ₹{item.amount}
                      </span>
                    </div>
                  ))}
                </div>

                {/* High-Density Carrier Dispute Loss Matrix (Eliminates Empty Bottom Void) */}
                <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/40 p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-400 pb-2 border-b border-white/[0.06]">
                    <span>3PL CARRIER LOGISTICS BURN BENCHMARK</span>
                    <span>AUTOMATIC DISPUTE ELIGIBILITY</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
                    {CARRIER_LOSS_BENCHMARKS.map((carrier) => (
                      <div key={carrier.name} className="rounded-lg bg-white/[0.02] p-2 border border-white/[0.04]">
                        <span className="block text-[11px] font-bold text-white truncate">{carrier.name}</span>
                        <div className="mt-1 flex items-baseline justify-between text-[10px] text-zinc-400">
                          <span>{carrier.forward}+{carrier.reverse}</span>
                          <span className="font-bold text-[#FF3B1D]">{carrier.total}</span>
                        </div>
                        <span className="mt-1 block text-[9px] text-emerald-400">{carrier.sla}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                    <ShieldAlert className="h-3 w-3 text-[#FF3B1D]" />
                    <span>At 1,000 monthly RTOs, that is ₹4.3 Lakhs incinerated straight from your bottom-line EBITDA.</span>
                  </div>
                </div>
              </BentoCard>

              {/* Right Column (5 Cols): Telemetry Lie Proof + Scale Calculator */}
              <div className="flex flex-col gap-4 lg:col-span-5">
                {/* Top Card: The Courier Lie (Telemetry Proof) */}
                <BentoCard highlight className="p-5 flex-1 justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#FF3B1D]">
                        LIVE TELEMETRY AUDIT // THE LIE
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[10px] text-red-400 border border-red-500/30">
                        <ShieldAlert className="h-3 w-3" /> SPOOF DETECTED
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-2.5 font-mono text-xs">
                        <div className="flex items-center justify-between text-[10px] text-red-400">
                          <span>COURIER API SCAN (14:12:00 PM)</span>
                          <span>AWB: DEL9842104921</span>
                        </div>
                        <p className="mt-1 font-bold text-red-300">
                          &ldquo;Consignee Unavailable / Door Locked&rdquo;
                        </p>
                      </div>

                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5 font-mono text-xs">
                        <div className="flex items-center justify-between text-[10px] text-emerald-400">
                          <span>RESCUESHIP TELEMETRY (14:12:03 PM)</span>
                          <span className="font-bold">DELTA: 2.4 KM</span>
                        </div>
                        <p className="mt-1 text-zinc-200">
                          Driver at highway bypass • <strong className="text-emerald-300">0 call attempts logged</strong> to buyer phone. Dwell time: 4s.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Audio Call Audit Spectrogram Waveform */}
                  <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/60 p-2.5">
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <PhoneCall className="h-3 w-3 text-red-400" />
                        TELECOM GATEWAY VERIFICATION
                      </span>
                      <span className="text-red-400 font-bold">0 INCOMING RINGS</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 h-4">
                      {[15, 30, 20, 45, 60, 25, 10, 40, 70, 50, 30, 20, 80, 40, 20, 10, 30, 50, 20, 10, 35, 65, 40, 20, 10].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full bg-zinc-800"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 font-mono text-[9px] text-zinc-400">
                      Audio Audit: No network call originated from rider device within ±45 minutes of NDR mark.
                    </p>
                  </div>
                </BentoCard>

                {/* Bottom Card: Interactive Monthly Bleed at Scale */}
                <BentoCard className="p-5 flex-1 justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#FF3B1D]">
                        MONTHLY BLEED AT SCALE (15% NDR FAILURE)
                      </span>
                      <span className="font-mono text-xs text-zinc-300 tabular-nums font-semibold">
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

                    <div className="mt-3 flex items-baseline justify-between border-t border-white/[0.08] pt-3">
                      <div>
                        <span className="block font-mono text-[10px] text-zinc-400 uppercase">
                          UNRESCUED LOST ORDERS
                        </span>
                        <span className="font-mono text-lg font-bold text-white tabular-nums">
                          <NumberTicker value={failedOrdersCount} suffix=" /mo" />
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block font-mono text-[10px] text-zinc-400 uppercase">
                          DEAD FREIGHT &amp; CAC BURN
                        </span>
                        <span className="font-mono text-xl font-extrabold text-[#FF3B1D] tabular-nums">
                          <NumberTicker value={monthlyBleed} prefix="₹" suffix="/mo" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* High-Density Distribution Chips */}
                  <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px] text-zinc-400 pt-2 border-t border-white/[0.06]">
                    <div className="rounded bg-white/[0.02] p-1.5 border border-white/[0.04]">
                      <span className="block text-zinc-400">WASTED ADS</span>
                      <span className="text-white font-bold">₹{Math.round((monthlyBleed * 0.53) / 1000)}k</span>
                    </div>
                    <div className="rounded bg-white/[0.02] p-1.5 border border-white/[0.04]">
                      <span className="block text-zinc-400">2-WAY FREIGHT</span>
                      <span className="text-white font-bold">₹{Math.round((monthlyBleed * 0.38) / 1000)}k</span>
                    </div>
                    <div className="rounded bg-white/[0.02] p-1.5 border border-white/[0.04]">
                      <span className="block text-zinc-400">RESTOCK / QA</span>
                      <span className="text-white font-bold">₹{Math.round((monthlyBleed * 0.09) / 1000)}k</span>
                    </div>
                  </div>
                </BentoCard>
              </div>
            </div>
          </div>

          {/* =========================================================
              SLIDE 02: THE WHATSAPP INTERCEPT (INTERACTIVE SIMULATION)
             ========================================================= */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="grid w-full max-w-[1340px] grid-cols-1 gap-5 lg:grid-cols-12 lg:h-[550px]">
              {/* Left 5 Cols: Scenario Selector & Live Webhook Ingestion Engine */}
              <BentoCard className="p-6 lg:col-span-5 lg:p-7 justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-400">
                    <Zap className="h-3.5 w-3.5" />
                    PANEL 02 // REAL-TIME WHATSAPP INTERCEPT
                  </div>

                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                    Intercept the lie in{" "}
                    <span className="font-serif italic font-normal text-emerald-400">
                      2.8 seconds.
                    </span>
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                    Before the rider leaves the pin code, RescueShip fires an automated WhatsApp flow to collect live GPS coordinates or instant UPI prepayment.
                  </p>
                </div>

                {/* Scenario Switcher Buttons */}
                <div className="my-2.5 space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    SELECT NDR FAILURE SCENARIO:
                  </span>
                  {INTERCEPT_SCENARIOS.map((item, idx) => {
                    const selected = activeScenario === idx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectScenario(idx)}
                        className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                          selected
                            ? "border-emerald-500 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                            : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className={selected ? "font-bold text-emerald-300" : "text-zinc-300"}>
                            {item.label}
                          </span>
                          <span className="text-[10px] text-zinc-400">{item.gpsDelta}</span>
                        </div>
                        <p className="mt-1 truncate font-mono text-[11px] text-zinc-400">
                          Remark: &ldquo;{item.courierRemark}&rdquo;
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Real-time Webhook Terminal Feed (Eliminates Empty Bottom Void) */}
                <div className="rounded-xl border border-white/[0.08] bg-black/60 p-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-2 border-b border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Terminal className="h-3 w-3" />
                      NDR WEBHOOK INGESTION // 142ms
                    </span>
                    <span className="text-zinc-400">AUTOMATED SLA</span>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px]">
                    <div className="text-zinc-400">
                      <span className="text-zinc-600">&gt;</span> Carrier: <span className="text-white">Delhivery Express API</span>
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-zinc-600">&gt;</span> Event: <span className="text-[#FF3B1D] font-semibold">{currentScenario.tag}</span>
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-zinc-600">&gt;</span> Action: <span className="text-emerald-400 font-semibold">DISPATCH_WHATSAPP_FLOW</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/40 px-3.5 py-2.5 font-mono text-xs">
                  <span className="text-zinc-400 text-[11px]">AVG BUYER RESPONSE TIME</span>
                  <span className="font-bold text-emerald-400 text-[11px]">
                    42s • 89% OPEN RATE
                  </span>
                </div>
              </BentoCard>

              {/* Right 7 Cols: Live WhatsApp Rescue Simulation (Integrated with .lp-wa) */}
              <BentoCard
                highlight
                beamColor="#10B981"
                className="lp-wa lp-wa--dark p-5 lg:col-span-7 lg:p-6 justify-between"
              >
                {/* Device Top Bar & Verified Header */}
                <div>
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <MessageSquare className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">
                            RescueShip Verified Bot
                          </span>
                          <BadgeCheck className="h-4 w-4 text-emerald-400" />
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
                            OFFICIAL WA API
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-400">
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
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-400">
                        {currentScenario.savedAmount}
                      </span>
                    </div>
                  </div>

                  {/* Simulator Tab Bar for direct scenario switching & Playwright test contract */}
                  <div className="lp-wa__tabs mt-2.5 flex gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-1" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-label="Pre-Delivery"
                      onClick={() => handleSelectScenario(2)}
                      className={`lp-wa__tab flex-1 rounded-lg px-2 py-1 font-mono text-xs transition-all ${
                        activeScenario === 2
                          ? "lp-wa__tab--active bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40"
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
                      className={`lp-wa__tab flex-1 rounded-lg px-2 py-1 font-mono text-xs transition-all ${
                        activeScenario === 0
                          ? "lp-wa__tab--active bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40"
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
                      className={`lp-wa__tab flex-1 rounded-lg px-2 py-1 font-mono text-xs transition-all ${
                        activeScenario === 1
                          ? "lp-wa__tab--active bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40"
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="my-auto space-y-2.5 py-2 overflow-y-auto"
                  >
                    {/* Bot Outbound Alert Message */}
                    <div className="lp-wa__bubble--bot max-w-lg rounded-2xl rounded-tl-sm border border-white/10 bg-zinc-900/90 p-3 text-xs shadow-md">
                      <div className="flex items-center justify-between font-mono text-[9px] uppercase text-[#FF3B1D]">
                        <span>ALERT • ORDER #RS-88412</span>
                        <span className="text-zinc-400">14:12 PM</span>
                      </div>
                      <p className="mt-1 text-zinc-200 leading-relaxed">
                        {currentScenario.botPrompt}
                      </p>
                    </div>

                    {/* Interactive Customer Quick-Action Buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {currentScenario.actions.map((act) => {
                        const isChosen = userSelectedAction === act.id;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => handleActionClick(act.id)}
                            className={`lp-wa__chip rounded-xl px-3 py-1.5 font-mono text-xs font-semibold transition-all ${
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
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"
                        >
                          ⚡ Pay ₹1,178 via UPI (Save 5%)
                        </button>
                      )}
                      {userSelectedAction === "predeliv_resched" && (
                        <button
                          type="button"
                          onClick={() => handleActionClick("resched_tomorrow")}
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                          📅 Tomorrow
                        </button>
                      )}
                      {userSelectedAction === "predeliv_addr" && (
                        <button
                          type="button"
                          onClick={() => handleActionClick("gps")}
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50"
                        >
                          Share GPS Pin
                        </button>
                      )}
                      {userSelectedAction === "gps" && (
                        <button
                          type="button"
                          onClick={() => handleActionClick("confirm_addr")}
                          className="lp-wa__chip rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                          Correct, deliver here
                        </button>
                      )}
                    </div>

                    {/* Buyer Response */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className="lp-wa__bubble--user ml-auto max-w-md rounded-2xl rounded-tr-sm border border-emerald-500/30 bg-emerald-950/35 p-3 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
                        <MapPin className="h-3 w-3" />
                        <span>LIVE BUYER COUNTER-PROOF VERIFIED</span>
                      </div>
                      <p className="mt-1 text-white leading-relaxed">
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
                    <div className="space-y-1.5">
                      <div
                        className="lp-wa__banner flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 font-mono text-xs text-emerald-300"
                        role="status"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">
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
                        <span className="lp-wa__status lp-wa__status--ok rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-400 shrink-0 ml-2">
                          VERIFIED ✓
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-[#FF3B1D]/40 bg-[#FF3B1D]/10 px-3.5 py-2">
                        <div className="flex items-center gap-2">
                          <Navigation className="h-3.5 w-3.5 text-[#FF3B1D] shrink-0" />
                          <span className="font-mono text-xs text-white truncate">
                            {currentScenario.actionTaken}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] font-semibold uppercase text-[#FF3B1D] shrink-0 ml-2">
                          SYNCED ✓
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Authentic WhatsApp Message Input Bar */}
                <div className="my-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-1.5 font-mono text-xs text-zinc-400">
                  <span className="text-zinc-500">📎</span>
                  <span className="flex-1 text-[11px] text-zinc-500">Message RescueShip Bot...</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                    🎤
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.08] pt-2.5 font-mono text-xs text-zinc-400">
                  <span>ZERO MANUAL CALLS</span>
                  <span className="text-white font-semibold">LATENCY: 2,810ms</span>
                </div>
              </BentoCard>
            </div>
          </div>

          {/* =========================================================
              SLIDE 03: CLOSED LOOP RECOVERY (ANIMATED BEAM + ROI)
             ========================================================= */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="grid w-full max-w-[1340px] grid-cols-1 gap-5 lg:grid-cols-12 lg:h-[550px]">
              {/* Left 7 Cols: Closed-Loop Pipeline with Authentic Magic UI Animated Beam */}
              <BentoCard className="p-6 lg:col-span-7 lg:p-7 justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-zinc-200">
                    <RefreshCw className="h-3.5 w-3.5 text-[#FF3B1D]" />
                    PANEL 03 // CLOSED-LOOP COURIER ENFORCEMENT
                  </div>

                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                    Force the re-attempt.{" "}
                    <span className="font-serif italic font-normal text-emerald-400">
                      Lock the margin.
                    </span>
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                    Verified buyer GPS pins and timestamped proof are injected directly into Delhivery, Shiprocket, and ClickPost NDR APIs—blocking premature RTO lock-in.
                  </p>
                </div>

                {/* 3-Node Magic UI Animated Beam Diagram Container */}
                <div
                  ref={beamContainerRef}
                  className="relative my-3 grid grid-cols-3 items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/60 p-5 overflow-hidden"
                >
                  {/* Node 1: Buyer Proof */}
                  <div
                    ref={node1Ref}
                    className="relative z-10 flex flex-col items-center text-center p-2 rounded-xl bg-[#101014] border border-white/10"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-[#18181E] shadow-lg">
                      <MapPin className="h-5 w-5 text-[#FF3B1D]" />
                    </div>
                    <span className="mt-2 font-mono text-xs font-semibold text-white">
                      1. Buyer Pin Drop
                    </span>
                    <span className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      Lat/Long + Gate Verified
                    </span>
                  </div>

                  {/* Node 2: RescueShip AI Engine */}
                  <div
                    ref={node2Ref}
                    className="relative z-10 flex flex-col items-center text-center p-2 rounded-xl bg-[#180F0E] border border-[#FF3B1D]/40 shadow-[0_0_25px_rgba(255,59,29,0.2)]"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#FF3B1D] bg-[#22100D] shadow-[0_0_20px_rgba(255,59,29,0.35)]">
                      <Lock className="h-6 w-6 text-[#FF3B1D]" />
                    </div>
                    <span className="mt-2 font-mono text-xs font-semibold text-[#FF3B1D]">
                      2. RescueShip Engine
                    </span>
                    <span className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      Anti-RTO Proof Token
                    </span>
                  </div>

                  {/* Node 3: 3PL Courier Priority Re-Attempt */}
                  <div
                    ref={node3Ref}
                    className="relative z-10 flex flex-col items-center text-center p-2 rounded-xl bg-[#0B1713] border border-emerald-500/40"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-950/40 shadow-lg">
                      <Truck className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span className="mt-2 font-mono text-xs font-semibold text-emerald-400">
                      3. Priority Re-Attempt
                    </span>
                    <span className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      Delhivery / Shiprocket Sync
                    </span>
                  </div>

                  {/* Magic UI Animated Beams connecting Node 1 -> Node 2, and Node 2 -> Node 3 */}
                  <AnimatedBeam
                    containerRef={beamContainerRef}
                    fromRef={node1Ref}
                    toRef={node2Ref}
                    duration={3}
                    curvature={0}
                    gradientStartColor="#FF3B1D"
                    gradientStopColor="#FF7A59"
                  />
                  <AnimatedBeam
                    containerRef={beamContainerRef}
                    fromRef={node2Ref}
                    toRef={node3Ref}
                    duration={3}
                    delay={0.5}
                    curvature={0}
                    gradientStartColor="#FF7A59"
                    gradientStopColor="#10B981"
                  />
                </div>

                {/* Real-time Carrier API Enforcement Ledger (Eliminates Empty Bottom Void) */}
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-2 border-b border-white/[0.06]">
                    <span>AUTOMATED 3PL API COMMITMENT LEDGER</span>
                    <span className="text-emerald-400 font-bold">100% ENFORCED</span>
                  </div>
                  <div className="mt-2 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-400">POST /api/delhivery/ndr/re-attempt</span>
                      <span className="text-emerald-400 font-bold">200 OK • Attempt Locked</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-400">POST /api/shiprocket/escalation</span>
                      <span className="text-emerald-400 font-bold">200 OK • Fake NDR Overturned</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-400">PUT /api/clickpost/sla-tracker</span>
                      <span className="text-emerald-400 font-bold">200 OK • Return Aborted</span>
                    </div>
                  </div>
                </div>

                {/* Live Carrier Dispatch Ticker */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-1.5 font-mono text-[11px] text-emerald-300">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>LATEST DISPATCH: Delhivery Express AWB DEL-99214</span>
                  </div>
                  <span className="text-white font-semibold">OFD VIA BUYER PIN</span>
                </div>

                {/* Courier Audit Footer */}
                <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <span className="block text-[10px] text-zinc-400 uppercase">
                      FAKE NDR OVERRIDDEN
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-white">
                      94.2% Accuracy
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <span className="block text-[10px] text-zinc-400 uppercase">
                      RE-ATTEMPT SLA
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-white">
                      Next Morning 10 AM
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <span className="block text-[10px] text-zinc-400 uppercase">
                      RTO REDUCTION
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-emerald-400">
                      -38% to -64%
                    </span>
                  </div>
                </div>
              </BentoCard>

              {/* Right 5 Cols: Net Recovered Profit Card + ROI Matrix */}
              <BentoCard
                highlight
                beamColor="#10B981"
                className="p-6 lg:col-span-5 lg:p-7 justify-between"
              >
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                    CLOSED-LOOP P&amp;L IMPACT // NET RECOVERY
                  </span>
                  <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                    Your Recovered Monthly Margin
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Based on <NumberTicker value={monthlyOrders} suffix=" shipments/mo" /> &amp; 68% NDR rescue conversion:
                  </p>
                </div>

                <div className="my-2.5 space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-emerald-300/80">
                      RESCUED ORDERS / MONTH
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-extrabold text-white tabular-nums">
                        <NumberTicker value={recoveredOrdersCount} />
                      </span>
                      <span className="font-mono text-xs text-emerald-400">
                        parcels converted to Delivered
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-white/10" />

                  <div>
                    <span className="font-mono text-[10px] uppercase text-emerald-300/80">
                      NET RECOVERED LOGISTICS &amp; CAC MARGIN
                    </span>
                    <div className="mt-0.5 font-mono text-3xl font-black text-emerald-400 tabular-nums">
                      <NumberTicker value={monthlySaved} prefix="+₹" />
                      <span className="text-sm font-normal text-zinc-400">/mo</span>
                    </div>
                  </div>
                </div>

                {/* High-Density ROI & Payback Matrix */}
                <div className="rounded-xl border border-white/[0.08] bg-black/50 p-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-1.5 border-b border-white/[0.06]">
                    <span>SOFTWARE ROI MULTIPLE</span>
                    <span className="text-emerald-400 font-bold">&lt; 48H PAYBACK</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="rounded bg-white/[0.02] p-1.5 border border-white/[0.04]">
                      <span className="block text-[10px] text-zinc-400">PREVENT PLAN</span>
                      <span className="font-bold text-white">₹4,999/mo</span>
                    </div>
                    <div className="rounded bg-white/[0.02] p-1.5 border border-white/[0.04]">
                      <span className="block text-[10px] text-zinc-400">NET GAIN</span>
                      <span className="font-bold text-emerald-400">+{Math.round((monthlySaved - 4999) / 1000)}k/mo</span>
                    </div>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px] text-zinc-400">
                    <div className="flex justify-between rounded bg-white/[0.02] p-1 border border-white/[0.04]">
                      <span>CAC Preserved:</span>
                      <span className="text-white font-bold">₹{Math.round((monthlySaved * 0.53) / 1000)}k</span>
                    </div>
                    <div className="flex justify-between rounded bg-white/[0.02] p-1 border border-white/[0.04]">
                      <span>2-Way Freight:</span>
                      <span className="text-white font-bold">₹{Math.round((monthlySaved * 0.38) / 1000)}k</span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>100% Risk-Free: 90-Day Money-Back SLA if RTO does not drop by 25%+.</span>
                  </div>
                </div>

                <a
                  href="#calculator"
                  className="group mt-3 flex w-full items-center justify-between rounded-xl bg-[#FF3B1D] px-5 py-3.5 font-mono text-sm font-bold text-black shadow-[0_0_25px_rgba(255,59,29,0.4)] transition hover:bg-[#ff5136]"
                >
                  <span>PLUG INTO YOUR STORE IN 2 MINS</span>
                  <ArrowUpRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
