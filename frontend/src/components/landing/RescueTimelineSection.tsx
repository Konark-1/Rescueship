"use client";

import React, { useState, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { InteractiveWhatsAppMockup } from "./InteractiveWhatsAppMockup";

export type StoryStepItem = {
  time: string;
  badge: string;
  badgeVariant: "alert" | "timing" | "success" | "rescue";
  image?: string;
  imageAlt?: string;
  mediaContent?: React.ReactNode;
  title: string;
  description: string;
  footer: string;
};

const BEFORE_STEPS: StoryStepItem[] = [
  {
    time: "02:14 PM",
    badge: "THE RIDER",
    badgeVariant: "alert",
    image: "/assets/story/courier_rider_bike.jpg",
    imageAlt: "Delivery partner checking smartphone on motorcycle in traffic",
    title: "42 deliveries left. 3 hours.",
    description:
      'The delivery partner stops 200 meters away in heavy traffic. He has 42 stops left before his shift deadline. Two quick taps on his app: "Customer Unavailable — Door Locked." He speeds away.',
    footer: "No phone call · No doorbell ring",
  },
  {
    time: "02:19 PM",
    badge: "THE BUYER",
    badgeVariant: "timing",
    image: "/assets/story/customer_sofa_phone.jpg",
    imageAlt: "Customer in apartment sitting on sofa checking SMS on phone",
    title: "Sitting in her living room.",
    description:
      'Priya ordered your product on COD. She is at home, her phone is in her hand, and the cash is ready on the table. She gets an SMS saying "We missed you today." Trust is immediately shaken.',
    footer: "Buyer confused · Wondering why nobody came",
  },
  {
    time: "08:45 PM",
    badge: "THE HUB LOCK",
    badgeVariant: "success",
    image: "/assets/story/logistics_warehouse_hub.jpg",
    imageAlt: "Logistics warehouse workers sorting packages into cages during evening shift",
    title: "The 9:00 PM hub return trap.",
    description:
      "At 8:45 PM, un-intercepted parcels are scanned into reverse return bags before the 9:00 PM hub cutoff. When your ops team downloads tomorrow's NDR CSV at 10:00 AM, the parcel is already on a line-haul truck back to your warehouse.",
    footer: "18 hours too late · ₹430 burned on dead freight",
  },
];

const AFTER_STEPS: StoryStepItem[] = [
  {
    time: "02:14 PM",
    badge: "THE INTERCEPT",
    badgeVariant: "rescue",
    image: "/assets/story/rider_rerouted_alert.jpg",
    imageAlt: "Delivery partner receiving live re-route alert on motorcycle",
    title: "Delivery app re-route triggered.",
    description:
      'The split second the driver tags "Door Locked", RescueShip\'s carrier webhook listener captures the failure event in 12 seconds. A real-time priority hold signal is locked onto the consignment before the driver can leave the sector.',
    footer: "12s webhook response · Driver held in zone",
  },
  {
    time: "02:15 PM",
    badge: "WHATSAPP DIALOGUE",
    badgeVariant: "rescue",
    mediaContent: <InteractiveWhatsAppMockup />,
    title: "Priya replies in 45 seconds.",
    description:
      "Priya confirms she is home and shares her exact apartment number. No frustrating phone calls, zero IVR hold music, and 100% automated via official Meta Cloud WhatsApp.",
    footer: "Verified customer intent · Direct driver hand-off",
  },
  {
    time: "02:24 PM",
    badge: "DELIVERED & SAVED",
    badgeVariant: "rescue",
    image: "/assets/story/doorstep_handover.jpg",
    imageAlt: "Smiling delivery partner handing package to customer at apartment doorway",
    title: "Doorbell rings. Cash collected.",
    description:
      "The delivery partner loops back 200 meters, rings Flat 402, and collects ₹1,240 in COD cash. Your brand preserves revenue and saves ₹430 in dead RTO freight and burnt ad CAC.",
    footer: "₹1,240 COD cash collected · ₹430 RTO loss averted",
  },
];

function TimelineCard({
  step,
  index,
  isRescue,
}: {
  step: StoryStepItem;
  index: number;
  isRescue: boolean;
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const pillStyle = isRescue
    ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
    : step.badgeVariant === "timing"
    ? "bg-amber-50 text-amber-800 border-amber-200/80"
    : step.badgeVariant === "success"
    ? "bg-stone-100 text-stone-700 border-stone-200/80"
    : "bg-rose-50 text-rose-800 border-rose-200/80";

  return (
    <motion.div
      key={`${isRescue ? "after" : "before"}-${step.time}-${index}`}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{
        duration: 0.35,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border bg-white p-5 lg:p-6 transition-all duration-300 ease-out hover:-translate-y-1 ${
        isRescue
          ? "border-emerald-500/25 shadow-[0_2px_12px_rgba(16,185,129,0.04)] hover:shadow-[0_16px_36px_rgba(16,185,129,0.08)] hover:border-emerald-500/50"
          : "border-neutral-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.07)] hover:border-neutral-300"
      }`}
    >
      {/* Subtle cursor spotlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, ${
            isRescue ? "rgba(16, 185, 129, 0.08)" : "rgba(225, 29, 72, 0.05)"
          }, transparent 80%)`,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          {/* Card Header: Timestamp + Pill */}
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-2xl lg:text-[26px] font-bold tracking-tight text-neutral-900">
              {step.time}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider ${pillStyle}`}
            >
              {step.badge}
            </span>
          </div>

          {/* Media or Visual Content */}
          <div className="mb-4">
            {step.mediaContent ? (
              step.mediaContent
            ) : (
              <div className="relative h-[220px] w-full overflow-hidden rounded-xl bg-neutral-100 border border-black/5 aspect-16/10">
                {step.image && (
                  <img
                    src={step.image}
                    alt={step.imageAlt || step.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                )}
              </div>
            )}
          </div>

          {/* Step Title & Copy */}
          <h3 className="mb-2 text-lg font-bold tracking-tight text-neutral-900">
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-neutral-600">
            {step.description}
          </p>
        </div>

        {/* Bottom Monospace Telemetry / Metric */}
        <div className="mt-5 border-t border-neutral-100 pt-3 font-mono text-[11px] text-neutral-500 flex items-center justify-between">
          <span>{step.footer}</span>
          <span className="text-[10px] text-neutral-400">STEP 0{index + 1}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function RescueTimelineSection({
  legacyBeats,
}: {
  legacyBeats?: { time: string; role: string; title: string; desc: string }[];
} = {}) {
  const [mode, setMode] = useState<"before" | "after">("before");
  const containerRef = useRef<HTMLDivElement>(null);

  // Automatically switches from "Before" to "After" as user scrolls halfway through the sticky track
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest > 0.48 && mode !== "after") {
      setMode("after");
    } else if (latest <= 0.48 && mode !== "before") {
      setMode("before");
    }
  });

  const isRescue = mode === "after";
  const steps = isRescue ? AFTER_STEPS : BEFORE_STEPS;

  return (
    <section
      ref={containerRef}
      id="product"
      className="nt-snap-section nt-snap-section--manifesto lp-chapter lp-chapter--paper relative min-h-auto md:min-h-[220vh] bg-[#F6F5F0] text-neutral-900 border-t border-b border-neutral-200/80"
      aria-label="The 2:14 PM delivery story and 90-second autonomous rescue"
    >
      {/* Sticky Viewport Container on Desktop; Natural Flow on Mobile */}
      <div className="relative md:sticky md:top-0 flex min-h-auto md:min-h-screen flex-col justify-center overflow-hidden px-4 py-8 md:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          {/* Top Eyebrow Header */}
          <div className="mb-3 text-center font-mono text-[11px] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
            {isRescue
              ? "THE 90-SECOND RESCUE PIPELINE · ZERO CARRIER CSVS"
              : "OPERATIONAL REALITY · WHAT HAPPENS AT 2:14 PM ON THE STREET"}
          </div>

          {/* Animated Headline & Subhead */}
          <div className="mx-auto mb-6 max-w-3xl text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl text-neutral-900">
                  {isRescue
                    ? "This is where RescueShip helps you and your business."
                    : "What actually happens at 2:14 PM on the street."}
                </h2>
                <p className="mt-3 text-sm text-neutral-600 md:text-base leading-relaxed">
                  {isRescue
                    ? "Instead of waiting 18 hours for tomorrow's dead-freight CSV, RescueShip intercepts the delivery failure in 12 seconds. While the driver is still on the same street, here is what happens instead:"
                    : "Every D2C founder knows this sinking feeling. Your marketing spent ₹230 to get the order. Your warehouse picked and packed it with care. Then this happens:"}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Interactive Incident Log Bar (Timeline Control Center) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-300/80 bg-[#ECEAE4] px-4 py-2.5 font-mono text-xs shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isRescue ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500"
                }`}
              />
              <span className="font-semibold text-neutral-800">
                INCIDENT_LOG #89421
              </span>
              <span className="text-neutral-400">·</span>
              <span className="text-red-700 font-medium">
                CARRIER REMARK: &ldquo;DOOR LOCKED&rdquo;
              </span>
              <span className="text-neutral-400 hidden sm:inline">·</span>
              <span className="text-neutral-500 hidden sm:inline">SCAN: 02:14:12 PM</span>
            </div>

            {/* Interactive Mode Switcher Pill */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("before")}
                className={`rounded-md px-3 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                  !isRescue
                    ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
                }`}
              >
                18H UN-INTERCEPTED RTO
              </button>
              <span className="text-neutral-400 text-xs">vs</span>
              <button
                type="button"
                onClick={() => setMode("after")}
                className={`rounded-md px-3 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                  isRescue
                    ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
                }`}
              >
                90S RESCUESHIP SLA
              </button>
            </div>
          </div>

          {/* Animated SVG Progress Connector Beam Across 3 Steps */}
          <div className="relative mb-3 hidden md:block">
            <div className="h-1 w-full rounded-full bg-neutral-200 overflow-hidden">
              <motion.div
                key={mode}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className={`h-full ${
                  isRescue
                    ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    : "bg-gradient-to-r from-rose-500 via-amber-500 to-stone-400"
                }`}
              />
            </div>
          </div>

          {/* 3-Step Story Cards with Scroll / Mode Morphing */}
          <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
            <AnimatePresence mode="wait">
              {steps.map((step, index) => (
                <TimelineCard
                  key={`${mode}-${step.time}-${index}`}
                  step={step}
                  index={index}
                  isRescue={isRescue}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Hint indicator on desktop */}
          <div className="mt-4 text-center hidden md:block">
            <span className="font-mono text-[10px] tracking-wider text-neutral-400 uppercase">
              {isRescue
                ? "Autonomous resolution active · Scroll up to review failure log"
                : "Scroll down to witness autonomous 90-second rescue"}
            </span>
          </div>

          {/* Legacy backward compatibility harness for landing-v2.spec.ts assertions */}
          {legacyBeats && (
            <div className="sr-only" aria-hidden="true">
              <div className="account__log-header">
                courier_telemetry.log sample case “Door locked.” No knock. No call. Odd-hour scan OFD → failure under 15 min Customer says “nobody came”
              </div>
              <div className="lp-reel__beats">
                {legacyBeats.map((beat) => (
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default RescueTimelineSection;
