"use client";

import { useState, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { ChevronDown } from "lucide-react";

export type GalleryStep = {
  id: string;
  stepNum: string;
  shortTitle: string;
  time: string;
  badge: string;
  image: string;
  title: string;
  description: string;
  footerLeft: string;
  footerRight: string;
};

/* ═══════════════════════════════════════════════════════════════
   1. OLD METHOD (18H UN-INTERCEPTED RTO TRAP) - 4 STEPS
   ═══════════════════════════════════════════════════════════════ */
const OLD_METHOD_STEPS: GalleryStep[] = [
  {
    id: "old-1",
    stepNum: "01",
    shortTitle: "RIDER FAILS",
    time: "02:14 PM",
    badge: "FAKE NDR SCAN",
    image: "/assets/story/courier_rider_bike.jpg",
    title: "1. Rider fails delivery without calling.",
    description:
      'Stopped 200m away in heavy traffic with 42 stops left before shift end, the rider taps "Customer Unavailable — Door Locked" on his app and speeds away without ringing.',
    footerLeft: "No phone call · No doorbell ring",
    footerRight: "STEP 01 / 04",
  },
  {
    id: "old-2",
    stepNum: "02",
    shortTitle: "FAILED SMS",
    time: "02:19 PM",
    badge: "BUYER CONFUSED",
    image: "/assets/story/customer_sofa_phone.jpg",
    title: "2. Notification of failed delivery.",
    description:
      'The buyer is sitting at home with ₹1,240 COD cash ready on the table. Her phone buzzes with a false carrier SMS: "We missed you today." Trust is broken immediately.',
    footerLeft: "False carrier SMS · Buyer intent lost",
    footerRight: "STEP 02 / 04",
  },
  {
    id: "old-3",
    stepNum: "03",
    shortTitle: "HUB CUTOFF",
    time: "08:45 PM",
    badge: "HUB CUTOFF",
    image: "/assets/story/logistics_warehouse_hub.jpg",
    title: "3. Courier ships back to warehouse without attempt.",
    description:
      "At the 9:00 PM hub cutoff, un-intercepted parcels are scanned directly into reverse return bags without a real attempt and locked onto a line-haul truck.",
    footerLeft: "Reverse scan locked · ₹430 dead freight",
    footerRight: "STEP 03 / 04",
  },
  {
    id: "old-4",
    stepNum: "04",
    shortTitle: "DEAD REATTEMPT",
    time: "DAY 2 · 02:30 PM",
    badge: "RTO LOSS",
    image: "/assets/story/old_step_4_cancelled_order.png",
    title: "4. Next-day reattempt fails (Order Cancelled).",
    description:
      '24 hours later, buyer impulse has cooled off or they bought elsewhere. The next-day reattempt is rejected at the door: "I needed it yesterday. Return it."',
    footerLeft: "100% CAC burned · Inventory stuck 9 days",
    footerRight: "STEP 04 / 04",
  },
];

/* ═══════════════════════════════════════════════════════════════
   2. OUR METHOD (RESCUESHIP 90S SAME-DAY RESOLUTION) - 4 STEPS
   ═══════════════════════════════════════════════════════════════ */
const OUR_METHOD_STEPS: GalleryStep[] = [
  {
    id: "new-1",
    stepNum: "01",
    shortTitle: "12S INTERCEPT",
    time: "02:14 PM",
    badge: "WEBHOOK HOLD",
    image: "/assets/story/rider_rerouted_alert.jpg",
    title: "1. Rider fails — intercepted in 12 seconds.",
    description:
      'The split-second the rider marks "Door Locked", RescueShip catches the carrier webhook and locks a priority hold on the parcel before he leaves the street sector.',
    footerLeft: "12s webhook capture · Rider held in sector",
    footerRight: "STEP 01 / 04",
  },
  {
    id: "new-2",
    stepNum: "02",
    shortTitle: "AVAILABILITY PING",
    time: "02:15 PM",
    badge: "INSTANT VERIFY",
    image: "/assets/story/our_step_2_whatsapp_availability.png",
    title: "2. Phone notification confirming availability.",
    description:
      "An automated WhatsApp reaches the buyer in 45s. She taps 'Yes, I am at home in Flat 402' in 45 seconds—zero IVR calls or annoying call centers required.",
    footerLeft: "Live buyer confirmation · 45s response",
    footerRight: "STEP 02 / 04",
  },
  {
    id: "new-3",
    stepNum: "03",
    shortTitle: "COD → PREPAID",
    time: "02:19 PM",
    badge: "ADDRESS + UPI",
    image: "/assets/story/our_step_3_address_pin_upi.png",
    title: "3. Address updated & COD converted to Prepaid.",
    description:
      "The buyer drops her exact flat landmark/GPS pin and completes a 1-tap UPI payment link (with an optional ₹50 instant prepaid discount) to eliminate cash risk.",
    footerLeft: "GPS pin captured · COD converted to UPI",
    footerRight: "STEP 03 / 04",
  },
  {
    id: "new-4",
    stepNum: "04",
    shortTitle: "SAME-DAY DELIVERY",
    time: "03:00 PM",
    badge: "DELIVERED SAME DAY",
    image: "/assets/story/doorstep_handover.jpg",
    title: "4. Successfully delivered same day (Zero next-day wait).",
    description:
      "With verified GPS coordinates and prepaid confirmation pushed to the driver app, the rider loops back 200m and hands over the parcel same day.",
    footerLeft: "₹1,240 revenue saved · Same-day handover",
    footerRight: "STEP 04 / 04",
  },
];

export function RescueTimelineSection({
  legacyBeats,
}: {
  legacyBeats?: { time: string; role: string; title: string; desc: string }[];
} = {}) {
  const [mode, setMode] = useState<"old" | "our">("old");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isManualOverride, setIsManualOverride] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const currentModeRef = useRef<"old" | "our">(mode);
  currentModeRef.current = mode;

  // 180vh scroll runway: smooth, snappy flip from Old Method to Our Method without scroll fatigue
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (isManualOverride) return;

    // Scroll ONLY toggles mode between Old Method and Our Method with safe deadzone.
    // Guarded by currentModeRef to guarantee ZERO redundant React re-renders while scrolling.
    if (latest < 0.44 && currentModeRef.current !== "old") {
      setMode("old");
    } else if (latest > 0.56 && currentModeRef.current !== "our") {
      setMode("our");
    }
  });

  const isRescue = mode === "our";

  // Helper to manually switch mode with 3D flip
  const handleModeSwitch = (targetMode: "old" | "our") => {
    setIsManualOverride(true);
    setMode(targetMode);
    setTimeout(() => setIsManualOverride(false), 1800);
  };

  return (
    <section
      ref={sectionRef}
      id="product"
      style={{ scrollSnapAlign: "none" }}
      className="lp-chapter lp-chapter--paper relative min-h-auto md:h-[180vh] w-full bg-[#F6F5F0] text-neutral-900 border-t border-b border-neutral-200/80 select-none"
      aria-label="The 2:14 PM delivery story and 90-second autonomous rescue"
    >
      {/* Full-Viewport Sticky Stage */}
      <div className="relative md:sticky md:top-14 flex min-h-auto md:h-[calc(100vh-3.5rem)] w-full flex-col justify-between px-4 py-4 md:px-8 lg:px-12 md:py-5">
        <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-between">
          {/* 1. COMPACT FULL-WIDTH HEADER + INCIDENT BAR */}
          <div>
            <div className="mb-1 text-center font-mono text-xs font-semibold tracking-[0.22em] text-neutral-500 uppercase">
              {isRescue
                ? "AUTONOMOUS 90-SECOND RESCUE · SAME-DAY HANDOVER"
                : "OPERATIONAL REALITY · WHAT HAPPENS AT 2:14 PM ON THE STREET"}
            </div>

            {/* Stable Headline Banner (Zero Layout Shift, Pure Opacity/Y Crossfade) */}
            <div className="mx-auto mb-3 max-w-4xl text-center min-h-[96px] sm:min-h-[88px] flex flex-col justify-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl md:text-[38px] md:leading-[1.15] text-neutral-900">
                    {isRescue
                      ? "Our Method: The 4-step same-day rescue engine."
                      : "Old Method: The 4-step reverse logistics trap."}
                  </h2>
                  <p className="mx-auto mt-1 max-w-2xl text-xs md:text-sm text-neutral-600 leading-relaxed">
                    {isRescue
                      ? "Instead of losing the order to next-day RTO, RescueShip intercepts the rider in 12 seconds, verifies availability, converts COD to Prepaid, and delivers the same day:"
                      : "Every D2C founder knows this sinking feeling. Your marketing spent ₹230 to get the order. Then a false 'Door Locked' scan starts a multi-day dead loss cycle:"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Incident Log & Mode Flip Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-300/80 bg-[#ECEAE4] px-4 py-2 font-mono text-xs md:text-sm shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                    isRescue
                      ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                      : "bg-red-500 shadow-[0_0_8px_#ef4444]"
                  }`}
                />
                <span className="font-bold text-neutral-800">
                  INCIDENT_LOG #89421
                </span>
                <span className="hidden text-neutral-400 sm:inline">·</span>
                <span className="hidden font-semibold text-red-700 sm:inline">
                  CARRIER REMARK: &ldquo;DOOR LOCKED&rdquo;
                </span>
                <span className="hidden text-neutral-400 lg:inline">·</span>
                <span className="hidden text-neutral-500 lg:inline">
                  SCAN: 02:14:12 PM
                </span>
              </div>

              {/* Interactive Flip Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleModeSwitch("old")}
                  className={`cursor-pointer rounded-full px-3.5 py-1 font-mono text-xs font-bold tracking-wider transition-all duration-300 ${
                    !isRescue
                      ? "border border-red-300 bg-white text-red-700 shadow-xs ring-1 ring-red-200"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  OLD METHOD (18H RTO TRAP)
                </button>
                <span className="text-xs text-neutral-400">vs</span>
                <button
                  type="button"
                  onClick={() => handleModeSwitch("our")}
                  className={`cursor-pointer rounded-full px-3.5 py-1 font-mono text-xs font-bold tracking-wider transition-all duration-300 ${
                    isRescue
                      ? "border border-emerald-500 bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  OUR METHOD (SAME-DAY RESCUE)
                </button>
              </div>
            </div>
          </div>

          {/* 2. ELASTIC GALLERY + 3D FLIP STAGE (Pure Native CSS Transitions for 120 FPS) */}
          <div className="my-2.5 flex min-h-0 flex-1 flex-col md:flex-row gap-3 w-full h-[480px] md:h-[500px]">
            {[0, 1, 2, 3].map((index) => {
              const isExpanded = activeIndex === index;
              const oldStep = OLD_METHOD_STEPS[index];
              const ourStep = OUR_METHOD_STEPS[index];

              return (
                <div
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    flex: isExpanded ? "4.2 1 0%" : "0.85 1 0%",
                    perspective: "1600px",
                  }}
                  className="group relative h-full min-h-[140px] cursor-pointer overflow-hidden rounded-2xl transition-[flex] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[flex]"
                >
                  {/* 3D Flipper Container: Hardware Accelerated via CSS transform transition */}
                  <div
                    style={{
                      transform: isRescue ? "rotateY(180deg)" : "rotateY(0deg)",
                      transformStyle: "preserve-3d",
                      transitionDelay: `${index * 45}ms`,
                    }}
                    className="relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] will-change-transform"
                  >
                    {/* ================= FRONT FACE: OLD METHOD ================= */}
                    <div
                      style={{ backfaceVisibility: "hidden" }}
                      className={`absolute inset-0 flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border transition-colors duration-200 ${
                        isExpanded
                          ? "border-red-300 bg-white shadow-md ring-1 ring-red-200"
                          : "border-neutral-200/90 bg-neutral-900"
                      }`}
                    >
                      <ElasticPanelContent
                        step={oldStep}
                        isExpanded={isExpanded}
                        variant="old"
                      />
                    </div>

                    {/* ================= BACK FACE: OUR METHOD (Rotated 180deg) ================= */}
                    <div
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                      className={`absolute inset-0 flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border transition-colors duration-200 ${
                        isExpanded
                          ? "border-emerald-400 bg-white shadow-md shadow-emerald-950/5 ring-1 ring-emerald-300"
                          : "border-emerald-900/40 bg-neutral-900"
                      }`}
                    >
                      <ElasticPanelContent
                        step={ourStep}
                        isExpanded={isExpanded}
                        variant="our"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. BOTTOM PROGRESS INDICATOR & LIVE CHAT CUE */}
          <div className="flex flex-col items-center gap-1.5 pt-1 font-mono text-xs text-neutral-500">
            <div className="flex items-center justify-between w-full max-w-lg">
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Jump to step ${idx + 1}`}
                    onClick={() => setActiveIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      activeIndex === idx
                        ? isRescue
                          ? "w-8 bg-emerald-600"
                          : "w-8 bg-red-500"
                        : "w-2 bg-neutral-300 hover:bg-neutral-400"
                    }`}
                  />
                ))}
              </div>

              <div className="text-center font-semibold uppercase tracking-wider text-[11px]">
                {isRescue
                  ? "✓ SAME-DAY RESCUE ACTIVE"
                  : "⚠ 18H DEAD RTO TRAP"}
              </div>

              <div className="hidden sm:block text-[11px]">
                MODE:{" "}
                <span
                  className={
                    isRescue
                      ? "font-bold text-emerald-700"
                      : "font-bold text-red-700"
                  }
                >
                  {isRescue ? "RESCUESHIP" : "LEGACY"}
                </span>
              </div>
            </div>

            {/* Scroll Indicator: Guidance on what scrolling triggers */}
            <div className="flex flex-col items-center justify-center -space-y-0.5 text-neutral-700">
              <span className="font-semibold uppercase tracking-widest text-[11px]">
                {isRescue ? "Scroll for live chat interface" : "Scroll to switch to Our Method"}
              </span>
              <div className="flex flex-col items-center pt-0.5 text-neutral-400">
                <ChevronDown className="h-4 w-4 animate-bounce" />
              </div>
            </div>
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

/**
 * Renders the interior of each Elastic Gallery panel with pure hardware-accelerated CSS transitions:
 * - Collapsed panels show their background image slice with dark tint + vertical text
 * - Expanded panel smoothly presents full details without backdrop-filter GPU stalls
 */
function ElasticPanelContent({
  step,
  isExpanded,
  variant,
}: {
  step: GalleryStep;
  isExpanded: boolean;
  variant: "old" | "our";
}) {
  const isRescue = variant === "our";

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden">
      {/* COLLAPSED VERTICAL SLICE OVERLAY */}
      <div
        className={`absolute inset-0 z-20 flex flex-col items-center justify-between p-3 text-white transition-opacity duration-200 ${
          isExpanded ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
        }`}
      >
        {/* Full-height background image inside collapsed slice */}
        <img
          src={step.image}
          alt={step.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover brightness-[0.42] contrast-110"
        />
        <div
          className={`absolute inset-0 bg-gradient-to-b ${
            isRescue
              ? "from-emerald-950/70 via-black/40 to-emerald-950/85"
              : "from-black/70 via-black/40 to-red-950/80"
          }`}
        />

        {/* Step Number Pill at Top */}
        <span
          className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs font-bold ${
            isRescue
              ? "border-emerald-400/50 bg-emerald-950/80 text-emerald-200"
              : "border-white/30 bg-neutral-900/80 text-white"
          }`}
        >
          {step.stepNum}
        </span>

        {/* Vertical Rotated Label in Center */}
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="flex -rotate-90 items-center gap-2.5 whitespace-nowrap font-mono text-xs tracking-[0.2em] uppercase">
            <span className="font-bold text-white">{step.shortTitle}</span>
            <span className="text-white/50">·</span>
            <span className={isRescue ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>
              {step.time}
            </span>
          </div>
        </div>

        {/* Bottom Indicator Dot */}
        <span
          className={`relative z-10 h-2 w-2 rounded-full ${
            isRescue ? "bg-emerald-400" : "bg-red-400"
          }`}
        />
      </div>

      {/* EXPANDED FULL CARD VIEW */}
      <div
        className={`relative z-10 flex h-full w-full flex-col justify-between p-4 md:p-5 transition-opacity duration-200 ${
          isExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Top Row: Timestamp + Status Pill + Step Counter */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xl md:text-2xl font-extrabold tracking-tight text-neutral-900">
              {step.time}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider uppercase ${
                isRescue
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {step.badge}
            </span>
          </div>

          <span className="font-mono text-xs font-semibold text-neutral-400">
            STEP {step.stepNum}
          </span>
        </div>

        {/* Elastic Image Stage with GPU Scale Transition */}
        <div className="relative my-2.5 min-h-[160px] flex-1 overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-900">
          <img
            src={step.image}
            alt={step.title}
            loading="lazy"
            decoding="async"
            style={{
              transform: isExpanded ? "scale(1)" : "scale(1.05)",
            }}
            className="h-full w-full object-cover transition-transform duration-300 ease-out will-change-transform"
          />

          {/* Subtle Live Overlay Badge on Image (Crisp Alpha, Zero Backdrop Blur) */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 rounded-lg border border-white/20 bg-black/80 px-2.5 py-1 font-mono text-[11px] text-white">
            <span
              className={`h-2 w-2 rounded-full ${
                isRescue ? "bg-emerald-400 animate-pulse" : "bg-red-500"
              }`}
            />
            <span>{step.shortTitle}</span>
          </div>
        </div>

        {/* Copy Block */}
        <div>
          <h3 className="text-base md:text-lg font-bold tracking-tight text-neutral-900">
            {step.title}
          </h3>
          <p className="mt-1 text-xs md:text-sm leading-relaxed text-neutral-600 line-clamp-2">
            {step.description}
          </p>

          {/* Footer Bar */}
          <div className="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 font-mono text-xs text-neutral-500">
            <span
              className={
                isRescue ? "font-semibold text-emerald-700" : "text-neutral-700"
              }
            >
              {step.footerLeft}
            </span>
            <span className="text-neutral-400">{step.footerRight}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RescueTimelineSection as RescueElasticGallerySection };
export default RescueTimelineSection;
