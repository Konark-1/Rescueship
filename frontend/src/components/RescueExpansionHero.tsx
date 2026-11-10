"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export interface RescueExpansionHeroProps {
  /** Pass a video URL (.mp4) or image URL, OR pass your custom React dashboard/demo via children */
  mediaType?: "video" | "image" | "component";
  mediaSrc?: string;
  posterSrc?: string;
  children?: React.ReactNode;
}

export function RescueExpansionHero({
  mediaType = "image",
  mediaSrc = "/images/hero-dashboard-preview.jpg", // Replace with your hero video or dashboard image
  posterSrc,
  children,
}: RescueExpansionHeroProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  // Smoothly tracks scroll through the 220vh Hero runway without hijacking window wheel events
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"],
  });

  // Center media box expands from a compact card (380px x 260px) to a full-bleed 92vw x 82vh stage
  const boxWidth = useTransform(scrollYProgress, [0, 0.75], ["42vw", "92vw"]);
  const boxHeight = useTransform(scrollYProgress, [0, 0.75], ["42vh", "82vh"]);
  const borderRadius = useTransform(scrollYProgress, [0, 0.75], [24, 16]);

  // Split title slides apart as the media expands (exact @arunachalam effect)
  const leftTextX = useTransform(scrollYProgress, [0, 0.6], ["0%", "-35%"]);
  const rightTextX = useTransform(scrollYProgress, [0, 0.6], ["0%", "35%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);

  // Bottom overlay caption fades in once fully expanded
  const expandedCaptionOpacity = useTransform(
    scrollYProgress,
    [0.65, 0.9],
    [0, 1]
  );
  const expandedCaptionY = useTransform(scrollYProgress, [0.65, 0.9], [20, 0]);

  return (
    <section
      ref={targetRef}
      className="relative h-[220vh] w-full bg-[#F6F5F0] text-neutral-900"
    >
      {/* Sticky Full-Screen Stage */}
      <div className="sticky top-0 flex h-screen w-full flex-col items-center justify-center overflow-hidden px-4">
        {/* Top Pill & Split Headline (Slides apart as you scroll) */}
        <motion.div
          style={{ opacity: textOpacity }}
          className="pointer-events-none z-20 mb-6 flex flex-col items-center text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-emerald-50 px-3.5 py-1 font-mono text-[11px] font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            REAL-TIME NDR INTERCEPT FOR INDIAN D2C
          </div>

          <h1 className="max-w-5xl text-4xl font-extrabold tracking-tight text-neutral-950 sm:text-6xl md:text-7xl">
            <motion.span style={{ x: leftTextX }} className="block">
              Intercept fake NDRs
            </motion.span>
            <motion.span
              style={{ x: rightTextX }}
              className="block text-emerald-700"
            >
              before the rider leaves.
            </motion.span>
          </h1>

          <p className="mt-4 max-w-xl text-sm text-neutral-600 md:text-base">
            RescueShip catches &ldquo;Door Locked&rdquo; carrier scans in 12
            seconds and verifies buyer intent over WhatsApp while the driver is
            still 200m away.
          </p>

          {/* CTA Buttons (clickable before scroll) */}
          <div className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#start"
              className="rounded-full bg-[#FF3B1D] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e03216]"
            >
              Start Free Rescue Trial →
            </a>
            <a
              href="#calculate-rto"
              className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
            >
              Calculate RTO Loss
            </a>
          </div>
        </motion.div>

        {/* Expanding Media Container */}
        <motion.div
          style={{
            width: boxWidth,
            height: boxHeight,
            borderRadius,
          }}
          className="relative z-10 min-h-[240px] min-w-[310px] overflow-hidden border border-neutral-300/80 bg-neutral-950 shadow-2xl"
        >
          {mediaType === "video" && mediaSrc ? (
            <video
              src={mediaSrc}
              poster={posterSrc}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : mediaType === "component" ? (
            <div className="h-full w-full overflow-hidden">{children}</div>
          ) : (
            <img
              src={mediaSrc}
              alt="RescueShip Live Command Center"
              className="h-full w-full object-cover"
            />
          )}

          {/* Subtle Bottom Bar that Appears When Fully Expanded */}
          <motion.div
            style={{ opacity: expandedCaptionOpacity, y: expandedCaptionY }}
            className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-6 text-white"
          >
            <div>
              <div className="font-mono text-xs text-emerald-400 uppercase">
                LIVE TELEMETRY · 90-SECOND SLA
              </div>
              <div className="text-lg font-bold md:text-2xl">
                Zero Carrier CSVs. 100% Automated WhatsApp + Webhook Hold.
              </div>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-mono text-xs backdrop-blur-md">
              Avg. COD Saved: <span className="text-emerald-300">₹430 / order</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll to Expand Indicator */}
        <motion.div
          style={{ opacity: textOpacity }}
          className="mt-4 font-mono text-[10px] tracking-[0.2em] text-neutral-400 uppercase"
        >
          ↓ SCROLL TO EXPAND LIVE INTERCEPT ENGINE
        </motion.div>
      </div>
    </section>
  );
}

export default RescueExpansionHero;
