"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

export interface RescueCommandHeroProps {
  /**
   * Pass ONLY your clean iPhone Duo component here
   * (Zero duplicate RescueShip navbars & Zero Netlify badges)
   */
  children?: React.ReactNode;
  fallbackImageSrc?: string;
}

export function RescueCommandHero({
  children,
  fallbackImageSrc = "/images/clean-iphone-duo-stage.png",
}: RescueCommandHeroProps) {
  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Subtle 3D perspective lift as user scrolls down (does NOT shrink your demo into a tiny box)
  const stageRotateX = useTransform(scrollYProgress, [0, 0.45], [10, 0]);
  const stageScale = useTransform(scrollYProgress, [0, 0.45], [0.96, 1]);
  const stageY = useTransform(scrollYProgress, [0, 0.45], [16, 0]);

  // Parallax movement for the foreground floating telemetry cards
  const floatLeftY = useTransform(scrollYProgress, [0, 0.6], [0, -35]);
  const floatRightY = useTransform(scrollYProgress, [0, 0.6], [0, -50]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen w-full overflow-x-clip bg-[#F6F5F0] pt-12 pb-24 text-neutral-900"
    >
      {/* ================= 1. BACKGROUND LAYER ================= */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Subtle 48px Architectural Engineering Grid */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(23, 23, 23, 0.045) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(23, 23, 23, 0.045) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse 80% 65% at 50% 35%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 65% at 50% 35%, black 40%, transparent 100%)",
          }}
        />

        {/* Ambient Emerald + Warm Orange Glow Behind the Hardware Frame */}
        <div className="absolute top-[42%] left-1/2 h-[420px] w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-emerald-500/15 via-teal-400/10 to-orange-500/10 blur-3xl" />
      </div>

      {/* ================= 2. HERO COPY & CTA LAYER ================= */}
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 text-center">
        {/* Top Live Status Pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-emerald-300/90 bg-emerald-50/90 px-4 py-1.5 font-mono text-[11px] font-semibold tracking-wider text-emerald-800 shadow-2xs backdrop-blur-xs"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          REAL-TIME NDR INTERCEPT FOR INDIAN D2C
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="max-w-4xl text-4xl font-extrabold tracking-tight text-neutral-950 sm:text-6xl md:text-[68px] md:leading-[1.04]"
        >
          Intercept fake NDRs{" "}
          <span className="block text-[#007A4D]">
            before the rider leaves.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 md:text-lg"
        >
          RescueShip catches &ldquo;Door Locked&rdquo; carrier scans in 12
          seconds and verifies buyer intent over WhatsApp while the delivery
          partner is still 200m away.
        </motion.p>

        {/* CTA Row + Instant Trust Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-3.5"
        >
          <a
            href="#start"
            className="rounded-full bg-[#FF3B1D] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-[#FF3B1D]/20 transition hover:bg-[#e03216]"
          >
            Start Free Rescue Trial →
          </a>
          <a
            href="#calculator"
            className="rounded-full border border-neutral-300 bg-white px-7 py-3.5 text-sm font-semibold text-neutral-800 shadow-2xs transition hover:bg-neutral-50"
          >
            Calculate RTO Loss
          </a>
        </motion.div>

        {/* Carrier Compatibility Strip (Adds immediate D2C credibility) */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] text-neutral-500">
          <span>⚡ 12s Webhook SLA</span>
          <span>·</span>
          <span>✓ Delhivery, BlueDart, Ekart, Xpressbees</span>
          <span>·</span>
          <span>✓ Official Meta WhatsApp Cloud</span>
        </div>
      </div>

      {/* ================= 3. FOREGROUND + CENTER STAGE ================= */}
      <div
        className="relative z-10 mx-auto mt-10 max-w-6xl px-4"
        style={{ perspective: "1400px" }}
      >
        {/* FOREGROUND FLOATING CARD 1: Top-Left Carrier Webhook Trigger */}
        <motion.div
          style={{ y: floatLeftY }}
          className="pointer-events-none absolute -top-10 -left-4 xl:-left-14 xl:-top-6 z-30 hidden w-64 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xl lg:block"
        >
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="flex items-center gap-1.5 font-bold text-red-800">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              NDR WEBHOOK CAUGHT
            </span>
            <span className="text-neutral-700 font-medium">14:14:12</span>
          </div>
          <div className="mt-1.5 text-xs font-bold text-neutral-900">
            Delhivery · AWB #4923118876
          </div>
          <div className="mt-1 rounded bg-red-100/90 px-2 py-1 font-mono text-[10px] font-bold text-red-950">
            Remark: &ldquo;Consignee Door Locked&rdquo;
          </div>
        </motion.div>

        {/* FOREGROUND FLOATING CARD 2: Mid-Right Buyer WhatsApp Verification */}
        <motion.div
          style={{ y: floatRightY }}
          className="pointer-events-none absolute top-1/4 -right-4 xl:-right-14 z-30 hidden w-68 rounded-xl border border-emerald-200 bg-white p-3.5 shadow-xl lg:block"
        >
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="flex items-center gap-1.5 font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              WHATSAPP PIN VERIFIED
            </span>
            <span className="text-neutral-700 font-medium">+42s</span>
          </div>
          <div className="mt-1.5 text-xs font-bold text-neutral-900">
            Buyer confirmed availability + GPS
          </div>
          <div className="mt-1 rounded bg-emerald-100/90 px-2 py-1 font-mono text-[10px] font-bold text-emerald-950">
            ✓ Converted ₹1,240 COD → UPI Prepaid
          </div>
        </motion.div>

        {/* FOREGROUND FLOATING CARD 3: Bottom-Left Rider Re-Route Metric */}
        <motion.div
          style={{ y: floatLeftY }}
          className="pointer-events-none absolute -bottom-7 left-4 xl:-bottom-8 xl:left-8 z-30 hidden items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-white shadow-2xl lg:flex"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 font-mono text-sm font-bold text-emerald-400">
            ₹430
          </div>
          <div>
            <div className="font-mono text-[10px] text-neutral-400 uppercase">
              DEAD FREIGHT + CAC SAVED
            </div>
            <div className="text-xs font-bold text-white">
              Same-Day Handover in 9m 40s
            </div>
          </div>
        </motion.div>

        {/* MAIN HARDWARE STAGE (Full-Width, Clean Chrome Header, Zero Duplicate Navbar) */}
        <motion.div
          style={{
            rotateX: stageRotateX,
            scale: stageScale,
            y: stageY,
            transformStyle: "preserve-3d",
          }}
          className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[#0D0F0E] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35)]"
        >
          {/* Clean Hardware Terminal Top Bar (Replaces the duplicate website navbar!) */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#141716] px-4 py-3 font-mono text-[11px] text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
              <span className="ml-2 text-neutral-300 font-semibold">
                RESCUESHIP LIVE INTERCEPT SIMULATOR
              </span>
            </div>

            <div className="hidden items-center gap-4 sm:flex">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LEFT: BUYER WHATSAPP
              </span>
              <span className="text-white/20">|</span>
              <span className="text-amber-300">RIGHT: LIVE COURIER OS</span>
            </div>
          </div>

          {/* Interactive iPhone Duo Content Area */}
          <div className="relative w-full">
            {children ? (
              children
            ) : (
              <img
                src={fallbackImageSrc}
                alt="RescueShip Dual Phone Live Intercept Demo"
                className="w-full object-cover"
              />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default RescueCommandHero;
