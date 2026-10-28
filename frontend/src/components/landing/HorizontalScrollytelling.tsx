"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
} from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { RescueScene } from "../story/RescueScene";

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

const SLIDES = [
  { id: "01", label: "01 Bleed", title: "BLEED — ₹430 / RTO Bleed Math" },
  { id: "02", label: "02 The Cutoff", title: "THE CUTOFF — Why Next-Day Fails" },
  { id: "03", label: "03 Recovery", title: "RECOVERY — Automatic Re-Attempt" },
];

const LOSS_COMPONENTS = [
  { label: "Customer acquisition cost (CAC)", amount: 230, pct: 78 },
  { label: "Forward freight committed", amount: 80, pct: 34 },
  { label: "Reverse RTO freight penalty", amount: 80, pct: 34 },
  { label: "Repackaging, QA & restocking", amount: 40, pct: 18 },
];

export function HorizontalScrollytelling({
  booted = true,
}: HorizontalScrollytellingProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  const x = useTransform(smoothProgress, [0, 1], ["0%", "-66.6667%"]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v < 0.33) setActiveSlide(0);
    else if (v < 0.67) setActiveSlide(1);
    else setActiveSlide(2);
  });

  const scrollToSlide = (idx: number) => {
    if (!sectionRef.current) return;
    const top = sectionRef.current.offsetTop;
    const scrollable = sectionRef.current.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: top + (scrollable * idx) / 2,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="product"
      ref={sectionRef}
      aria-label="Chapter 03: Horizontal Scrollytelling Track"
      className="relative h-[280vh] bg-[#080809] text-white selection:bg-[#FF3B1D] selection:text-white"
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

      {/* Sticky Viewport — pt-16 clears your fixed top Navbar */}
      <div className="sticky top-0 flex h-dvh w-full flex-col overflow-hidden pt-16">
        {/* Clean Single Top Chapter Bar (Matches your original industrial style) */}
        <div className="relative z-30 border-b border-white/[0.08] bg-[#080809]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3.5 lg:px-12">
            <div className="flex items-center gap-3 font-mono text-xs tracking-wider">
              <span className="text-[#FF3B1D] font-bold">
                0{activeSlide + 1}
              </span>
              <span className="text-zinc-400">/</span>
              <span className="text-zinc-400">03</span>
              <span className="ml-2 text-zinc-200 font-medium">
                {SLIDES[activeSlide].title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {SLIDES.map((slide, idx) => {
                const isActive = activeSlide === idx;
                return (
                  <button
                    key={slide.id}
                    onClick={() => scrollToSlide(idx)}
                    className={`rounded-md border px-3.5 py-1.5 font-mono text-xs transition-colors ${
                      isActive
                        ? "border-[#FF3B1D] bg-[#FF3B1D] font-semibold text-white"
                        : "border-white/10 bg-transparent text-zinc-400 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {slide.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtle Scroll Progress Line */}
          <div className="h-[1px] w-full bg-white/[0.06]">
            <motion.div
              className="h-full bg-[#FF3B1D]"
              style={{ scaleX: smoothProgress, transformOrigin: "0% 50%" }}
            />
          </div>
        </div>

        {/* Horizontal 3-Slide Track */}
        <motion.div
          style={{ x }}
          className="flex flex-1 w-[300vw] items-center will-change-transform"
        >
          {/* ===============================================================
              SLIDE 01: THE ₹430 BLEED (Open Left Layout + Clean Right Stack)
             =============================================================== */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-6 lg:px-12">
            <div className="grid w-full max-w-[1400px] grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              {/* Left 7 Cols: Open Editorial Typography (NO outer wrapper box) */}
              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF3B1D]">
                  PANEL 01 // THE ₹430 BLEED EQUATION
                </p>

                <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                  Every fake remark{" "}
                  <span className="font-serif italic font-normal text-[#FF3B1D]">
                    burns ₹430.
                  </span>
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                  When a courier fakes an NDR, you don&apos;t just lose forward
                  shipping. You bleed ad spend, double freight, and warehouse
                  handling.
                </p>

                {/* Clean Equation Strip */}
                <div className="mt-10 rounded-2xl border border-white/10 bg-[#0D0D0F] p-6">
                  <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
                    {/* Courier & Pack Burn */}
                    <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-5 sm:col-span-6">
                      <span className="block font-mono text-[11px] uppercase tracking-wider text-[#FF3B1D]">
                        ₹200 DIRECT COURIER &amp; PACK BURN
                      </span>
                      <div className="mt-4 flex items-baseline justify-between font-mono">
                        <div>
                          <span className="block text-xs text-zinc-400">
                            FORWARD
                          </span>
                          <span className="mt-1 block text-2xl font-bold text-white">
                            ₹80
                          </span>
                        </div>
                        <span className="text-lg text-zinc-400">+</span>
                        <div>
                          <span className="block text-xs text-zinc-400">
                            REVERSE RTO
                          </span>
                          <span className="mt-1 block text-2xl font-bold text-white">
                            ₹80
                          </span>
                        </div>
                        <span className="text-lg text-zinc-400">+</span>
                        <div>
                          <span className="block text-xs text-zinc-400">
                            PACK / QC
                          </span>
                          <span className="mt-1 block text-2xl font-bold text-white">
                            ₹40
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden justify-center font-mono text-xl text-[#FF3B1D] sm:flex sm:col-span-1">
                      +
                    </div>

                    {/* Wasted Ad CAC */}
                    <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-5 sm:col-span-2">
                      <span className="block font-mono text-[11px] uppercase tracking-wider text-[#FF3B1D]">
                        AD CAC
                      </span>
                      <span className="mt-4 block font-mono text-xs text-zinc-400">
                        META / GOOGLE
                      </span>
                      <span className="mt-1 block font-mono text-2xl font-bold text-white">
                        ₹230
                      </span>
                    </div>

                    {/* Total Bleed */}
                    <div className="rounded-xl border border-[#FF3B1D]/50 bg-[#1A0D0A] p-5 sm:col-span-3">
                      <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-300">
                        TOTAL BLEED
                      </span>
                      <span className="mt-3 block font-mono text-4xl font-extrabold text-[#FF3B1D]">
                        ₹430
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Clean Loss Bars + Monthly Scale */}
              <div className="space-y-5 lg:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-[#0D0D0F] p-7">
                  <span className="block font-mono text-xs uppercase tracking-wider text-zinc-400">
                    LOSS COMPONENT BREAKDOWN
                  </span>

                  <div className="mt-6 space-y-5">
                    {LOSS_COMPONENTS.map((item) => (
                      <div
                        key={item.label}
                        className="grid grid-cols-12 items-center gap-4"
                      >
                        <span className="col-span-6 text-sm text-zinc-200 sm:text-base">
                          {item.label}
                        </span>
                        <div className="col-span-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            style={{ width: `${item.pct}%` }}
                            className="h-full rounded-full bg-[#FF3B1D]"
                          />
                        </div>
                        <span className="col-span-2 text-right font-mono text-base font-bold text-white">
                          ₹{item.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#FF3B1D]/30 bg-[#0D0D0F] p-7">
                  <span className="block font-mono text-xs uppercase tracking-wider text-[#FF3B1D]">
                    MONTHLY BLEED AT SCALE
                  </span>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300 sm:text-lg">
                    At <strong className="text-white">7,500 orders/mo</strong>{" "}
                    with a 15% failure rate, that&apos;s{" "}
                    <strong className="text-white">1,125 lost orders</strong>{" "}
                    costing{" "}
                    <span className="font-mono font-bold text-[#FF3B1D]">
                      ₹4,83,750/mo
                    </span>{" "}
                    in dead freight.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ===============================================================
              SLIDE 02: THE 7:00 PM HUB CUTOFF (No JSON, Pure Operational Truth)
             =============================================================== */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-6 lg:px-12">
            <div className="grid w-full max-w-[1400px] grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              {/* Left 6 Cols: Open Editorial Typography */}
              <div className="lg:col-span-6">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF3B1D]">
                  PANEL 02 // THE 7:00 PM HUB CUTOFF
                </p>

                <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                  Wait until tomorrow,{" "}
                  <span className="font-serif italic font-normal text-[#FF3B1D]">
                    and it&apos;s already RTO.
                  </span>
                </h2>

                <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                  Couriers bag unverified parcels for return at the{" "}
                  <strong className="text-white">
                    7:00 PM evening hub sortation
                  </strong>
                  . If you rely on next-morning NDR reports or manual calling
                  teams, the parcel is already on a truck back to your
                  warehouse.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-6 border-t border-white/10 pt-8">
                  <div>
                    <span className="block font-mono text-xs uppercase tracking-wider text-zinc-400">
                      STANDARD COURIER NDR REPORT
                    </span>
                    <span className="mt-2 block font-mono text-3xl font-bold text-zinc-400 sm:text-4xl">
                      18 hrs late
                    </span>
                    <span className="mt-1 block text-sm text-zinc-400">
                      Sent next morning after hub lock
                    </span>
                  </div>

                  <div>
                    <span className="block font-mono text-xs uppercase tracking-wider text-[#FF3B1D]">
                      RESCUESHIP INTERCEPT
                    </span>
                    <span className="mt-2 block font-mono text-3xl font-bold text-white sm:text-4xl">
                      &lt; 3 seconds
                    </span>
                    <span className="mt-1 block text-sm text-zinc-300">
                      While the rider is still on the street
                    </span>
                  </div>
                </div>
              </div>

              {/* Right 6 Cols: Clean 2-Card Operational Comparison */}
              <div className="space-y-5 lg:col-span-6">
                {/* Card 1: What happens without RescueShip */}
                <div className="rounded-2xl border border-white/10 bg-[#0D0D0F] p-7">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                    <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                      WITHOUT RESCUESHIP (MANUAL / CSV)
                    </span>
                    <span className="font-mono text-xs font-semibold text-red-400">
                      RESULT: ₹430 LOST
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-4">
                    <div>
                      <span className="font-mono text-xs text-zinc-400">
                        02:12 PM
                      </span>
                      <p className="mt-1 text-base font-medium text-zinc-200">
                        Rider marks fake &ldquo;Door Locked&rdquo;
                      </p>
                    </div>
                    <div>
                      <span className="font-mono text-xs text-red-400">
                        07:00 PM
                      </span>
                      <p className="mt-1 text-base font-medium text-white">
                        Hub locks parcel into reverse RTO
                      </p>
                    </div>
                    <div>
                      <span className="font-mono text-xs text-zinc-400">
                        NEXT DAY 10 AM
                      </span>
                      <p className="mt-1 text-base text-zinc-400">
                        Your team sees the failure too late
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: What happens with RescueShip */}
                <div className="rounded-2xl border border-[#FF3B1D]/40 bg-[#0D0D0F] p-7">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                    <span className="font-mono text-xs uppercase tracking-wider text-[#FF3B1D]">
                      WITH RESCUESHIP (INSTANT INTERCEPT)
                    </span>
                    <span className="font-mono text-xs font-semibold text-emerald-400">
                      RESULT: ORDER SAVED
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-4">
                    <div>
                      <span className="font-mono text-xs text-[#FF3B1D]">
                        02:12:02 PM
                      </span>
                      <p className="mt-1 text-base font-medium text-white">
                        Fake remark caught via live webhook
                      </p>
                    </div>
                    <div>
                      <span className="font-mono text-xs text-[#FF3B1D]">
                        02:12:05 PM
                      </span>
                      <p className="mt-1 text-base font-medium text-white">
                        Buyer confirms availability on WhatsApp
                      </p>
                    </div>
                    <div>
                      <span className="font-mono text-xs text-emerald-400">
                        BEFORE 07:00 PM
                      </span>
                      <p className="mt-1 text-base font-medium text-emerald-400">
                        Courier API forced to re-attempt
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===============================================================
              SLIDE 03: AUTOMATIC RECOVERY (Clean Resolution & Net Savings)
             =============================================================== */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-6 lg:px-12">
            <div className="grid w-full max-w-[1400px] grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              {/* Left 7 Cols: Open Editorial + 3 Clean Resolution Rows */}
              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF3B1D]">
                  PANEL 03 // CLOSED-LOOP RESOLUTION
                </p>

                <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                  Buyer replies on WhatsApp.{" "}
                  <span className="font-serif italic font-normal text-[#FF3B1D]">
                    Courier must deliver.
                  </span>
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                  No manual spreadsheets or calling agents. Whatever the buyer
                  submits on WhatsApp is automatically pushed into Delhivery,
                  Shiprocket, or BlueDart before evening hub lock.
                </p>

                {/* 3 Clean Architectural Rows (No fake code tags) */}
                <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
                  <div className="flex items-baseline justify-between py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        1. Fake Attempt Overturned
                      </h3>
                      <p className="mt-0.5 text-sm text-zinc-400 sm:text-base">
                        Buyer confirms they are home — blocks RTO and schedules
                        next-morning delivery.
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-[#FF3B1D]">
                      AUTO RE-ATTEMPT
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        2. Missing Landmark Fixed
                      </h3>
                      <p className="mt-0.5 text-sm text-zinc-400 sm:text-base">
                        Buyer drops their live WhatsApp pin — updates courier
                        manifest with exact landmark.
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-[#FF3B1D]">
                      ADDRESS SYNCED
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        3. Cash Refusal Converted to UPI
                      </h3>
                      <p className="mt-0.5 text-sm text-zinc-400 sm:text-base">
                        COD buyer pays instantly via WhatsApp UPI link — removes
                        cash-unavailable excuses.
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-[#FF3B1D]">
                      COD → PREPAID
                    </span>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Single High-Impact Savings Card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-[#0D0D0F] p-8 sm:p-10">
                  <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                    MONTHLY SAVINGS AT 7,500 ORDERS/MO
                  </span>

                  <div className="mt-6 border-b border-white/10 pb-6">
                    <span className="block font-mono text-sm text-zinc-400">
                      At a conservative 45% NDR recovery rate:
                    </span>
                    <span className="mt-2 block font-mono text-3xl font-bold text-white sm:text-4xl">
                      506 Orders Saved / Mo
                    </span>
                  </div>

                  <div className="mt-6">
                    <span className="block font-mono text-xs uppercase tracking-wider text-zinc-400">
                      NET FREIGHT &amp; AD CAC RECOVERED
                    </span>
                    <span className="mt-2 block font-mono text-5xl font-extrabold text-[#FF3B1D] sm:text-6xl">
                      ₹2,17,580
                      <span className="text-xl font-normal text-zinc-400">
                        /mo
                      </span>
                    </span>
                  </div>

                  <a
                    href="#calculate-rto"
                    className="mt-8 flex w-full items-center justify-between rounded-xl bg-[#FF3B1D] px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#ff5136]"
                  >
                    <span>Calculate Your Exact Store Savings</span>
                    <ArrowUpRight className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Backward-compatibility test harness for automated E2E test suites */}
      <div
        className="pointer-events-auto fixed bottom-0 right-0 z-[99999] h-[550px] w-[360px] opacity-[0.001] overflow-hidden"
        style={{ pointerEvents: "auto" }}
      >
        <RescueScene active={booted} />
      </div>
    </section>
  );
}

export default HorizontalScrollytelling;
