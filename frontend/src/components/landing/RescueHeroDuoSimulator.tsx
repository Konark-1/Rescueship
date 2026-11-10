"use client";

import React, { useState } from "react";
import {
  MapPin,
  CheckCheck,
  RotateCcw,
  Camera,
  Mic,
  Plus,
  Terminal,
  ChevronLeft,
  Phone,
  Video,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "bot" | "user" | "system";
  text: string;
  time: string;
  isPin?: boolean;
}

type StepMode = "folded" | "unfolded" | "whatsapp" | "telemetry";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "sys-1",
    sender: "system",
    text: "Today · Official WhatsApp Business Account",
    time: "14:14 IST",
  },
  {
    id: "bot-1",
    sender: "bot",
    text: "🚚 *Out for Delivery Update:* Delhivery marked your order *AWB #4923118876* (COD ₹1,240) as *'Door Locked / Customer Unavailable'* with 0 calls made.",
    time: "14:14",
  },
  {
    id: "bot-2",
    sender: "bot",
    text: "⚠️ *Fake Attempt Intercepted (12s SLA):* Are you available to receive your order? Confirm below to stop the parcel from being returned to the seller warehouse:",
    time: "14:14",
  },
];

export function RescueHeroDuoSimulator() {
  const [currentStep, setCurrentStep] = useState<StepMode>("whatsapp");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [statusState, setStatusState] = useState<"initial" | "home_confirmed" | "pin_shared" | "upi_converted" | "cancelled">("initial");
  const [activeTabMobile, setActiveTabMobile] = useState<"buyer" | "courier">("buyer");

  const handleUserAction = (type: "home" | "pin" | "upi" | "cancel") => {
    if (type === "home") {
      setStatusState("home_confirmed");
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          sender: "user",
          text: "🏠 I'm Home — Rider Never Knocked",
          time: "14:14",
        },
        {
          id: `b-${Date.now()}`,
          sender: "bot",
          text: "✅ *Priority Re-Attempt Mandate Issued!*\nCarrier delivery partner notified that consignee is home. Delivery attempt locked for today.",
          time: "14:14",
        },
      ]);
    } else if (type === "pin") {
      setStatusState("pin_shared");
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          sender: "user",
          text: "📍 Shared Live Location Pin\n28.5355° N, 77.3910° E · Gate 2, Sector 62",
          time: "14:15",
          isPin: true,
        },
        {
          id: `b-${Date.now()}`,
          sender: "bot",
          text: "✓ *Gate Pin Injected in Delhivery API!*\nRider dispatched direct SMS with Google Maps turn-by-turn navigation to Gate 2.",
          time: "14:15",
        },
      ]);
    } else if (type === "upi") {
      setStatusState("upi_converted");
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          sender: "user",
          text: "⚡ Convert COD to UPI (₹50 Discount Applied)",
          time: "14:15",
        },
        {
          id: `b-${Date.now()}`,
          sender: "bot",
          text: "🎉 *₹1,190 UPI Payment Received!* Order converted from COD to Prepaid. Handover OTP issued to buyer.",
          time: "14:15",
        },
      ]);
    } else if (type === "cancel") {
      setStatusState("cancelled");
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          sender: "user",
          text: "❌ Cancel Order",
          time: "14:15",
        },
        {
          id: `b-${Date.now()}`,
          sender: "bot",
          text: "⚡ *Wait! 1-Shot ₹100 Instant Discount Unlocked:*\nPay ₹1,140 instead of ₹1,240 within 2 hours to hold your parcel for same-day delivery.",
          time: "14:15",
        },
      ]);
    }
  };

  const handleReset = () => {
    setMessages(INITIAL_MESSAGES);
    setStatusState("initial");
  };

  return (
    <div className="w-full bg-[#0E1110] text-neutral-200">
      {/* ================= STEP SELECTOR PILLS ================= */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-[#161918] px-4 py-2.5 gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setCurrentStep("folded")}
            className={`rounded-md px-3 py-1.5 transition ${
              currentStep === "folded"
                ? "bg-white/20 text-white font-semibold shadow-xs"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            1. Folded Cover
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep("unfolded")}
            className={`rounded-md px-3 py-1.5 transition ${
              currentStep === "unfolded"
                ? "bg-white/20 text-white font-semibold shadow-xs"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            2. Unfolded Home
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep("whatsapp")}
            className={`rounded-md px-3 py-1.5 transition flex items-center gap-1.5 ${
              currentStep === "whatsapp" || currentStep === "telemetry"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            3. Interactive Dual Stage
          </button>
        </div>

        {/* Mobile View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex lg:hidden rounded-lg bg-neutral-900 p-0.5 border border-white/10 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setActiveTabMobile("buyer")}
              className={`px-2.5 py-1 rounded-md ${
                activeTabMobile === "buyer" ? "bg-emerald-600 text-white" : "text-neutral-400"
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMobile("courier")}
              className={`px-2.5 py-1 rounded-md ${
                activeTabMobile === "courier" ? "bg-emerald-600 text-white" : "text-neutral-400"
              }`}
            >
              Telemetry
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-neutral-400 hover:bg-white/10 hover:text-white transition"
            title="Reset Simulation"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* ================= STEP 1: FOLDED COVER VIEW ================= */}
      {currentStep === "folded" && (
        <div className="flex min-h-[460px] flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#141816] to-[#0A0D0B]">
          <div className="w-full max-w-xs rounded-[32px] border-[5px] border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
            {/* Dynamic Island */}
            <div className="mx-auto mb-6 h-5 w-24 rounded-full bg-black" />
            {/* Clock */}
            <div className="font-mono text-3xl font-bold text-white">14:14</div>
            <div className="text-xs text-neutral-400">Tuesday, 10 November</div>

            {/* Lock Screen Notification */}
            <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-950/40 p-3.5 text-left backdrop-blur-md">
              <div className="flex items-center justify-between text-[11px] text-red-300 font-mono">
                <span className="font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
                  DELHIVERY SCAN
                </span>
                <span>Now</span>
              </div>
              <div className="mt-1 text-xs font-semibold text-white">
                Remark: Consignee Door Locked
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-300">
                AWB #4923118876 · Attempt 1 of 3
              </div>
            </div>

            {/* WhatsApp Intercept Preview */}
            <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-left backdrop-blur-md">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-mono">
                <span className="font-bold">RESCUESHIP WHATSAPP</span>
                <span>12s ago</span>
              </div>
              <div className="mt-1 text-xs text-white">
                ⚠️ Door Locked scan caught. Are you available?
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep("whatsapp")}
              className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
            >
              <span>Unfold to Inspect Intercept</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: UNFOLDED HOME VIEW ================= */}
      {currentStep === "unfolded" && (
        <div className="flex min-h-[460px] flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#141816] to-[#0A0D0B]">
          <div className="w-full max-w-xl rounded-3xl border border-neutral-700 bg-neutral-900/90 p-6 shadow-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 font-mono text-xs text-emerald-400">
              <Sparkles size={13} />
              DUAL DISPLAY UNFOLDED
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              Two Screens, One Unified Telemetry Engine
            </h3>
            <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
              The buyer confirms on WhatsApp while Delhivery&apos;s field courier system receives the real-time re-attempt mandate.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 text-left">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="font-mono text-[11px] font-bold text-emerald-400">LEFT WING</div>
                <div className="text-sm font-semibold text-white mt-1">Buyer WhatsApp Intercept</div>
                <div className="text-xs text-neutral-400 mt-1">1-tap GPS pins, cancellation save discounts, UPI prepayment.</div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="font-mono text-[11px] font-bold text-amber-300">RIGHT WING</div>
                <div className="text-sm font-semibold text-white mt-1">Live Courier Telemetry</div>
                <div className="text-xs text-neutral-400 mt-1">NDR API webhook hold, 38s turnaround, rider SMS gateway.</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep("whatsapp")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-500 transition"
            >
              <span>Launch Live WhatsApp Intercept Demo</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3 & 4: INTERACTIVE DUAL DISPLAY STAGE ================= */}
      {(currentStep === "whatsapp" || currentStep === "telemetry") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10 min-h-[560px]">
          {/* ──────────────── LEFT PANE: BUYER WHATSAPP ──────────────── */}
          <div className={`flex flex-col bg-[#0B141A] ${activeTabMobile === "courier" ? "hidden lg:flex" : "flex"}`}>
            {/* WhatsApp Business Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#1A2328] px-3.5 py-2.5 text-white">
              <div className="flex items-center gap-2.5">
                <ChevronLeft size={20} className="text-emerald-400" />
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 font-bold text-white text-xs shadow-xs">
                    RS
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-600 p-0.5 text-white">
                    <ShieldCheck size={10} />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-100">
                    RescueShip Assistant
                    <span className="rounded bg-emerald-900/70 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-300">
                      OFFICIAL
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    Online · 12s SLA active
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-neutral-300">
                <Video size={17} />
                <Phone size={16} />
              </div>
            </div>

            {/* Chat Thread */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans text-xs bg-[#0B141A] min-h-[340px]">
              {messages.map((m) => {
                if (m.sender === "system") {
                  return (
                    <div key={m.id} className="text-center my-2">
                      <span className="rounded-md bg-[#182229] px-3 py-1 font-mono text-[10px] text-neutral-400 shadow-2xs">
                        {m.text}
                      </span>
                    </div>
                  );
                }

                const isUser = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2 leading-relaxed shadow-xs ${
                        isUser
                          ? "bg-[#005C4B] text-neutral-100 rounded-tr-none"
                          : "bg-[#202C33] text-neutral-200 rounded-tl-none"
                      }`}
                    >
                      <div className="whitespace-pre-line">{m.text}</div>
                      <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-neutral-400 font-mono">
                        <span>{m.time}</span>
                        {isUser && <CheckCheck size={12} className="text-[#53BDEB]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Quick-Action Buttons */}
            <div className="border-t border-white/10 bg-[#111B21] p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span>⚡ TAP ACTION TO TEST RESCUE FLOW:</span>
                <span className="text-emerald-400">Real-Time</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleUserAction("home")}
                  className={`rounded-lg border px-3 py-2 text-left font-medium transition flex items-center justify-between ${
                    statusState === "home_confirmed"
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-white/10 bg-[#202C33] text-neutral-200 hover:border-emerald-500/50 hover:bg-[#2A3942]"
                  }`}
                >
                  <span>🏠 I&apos;m Home (Re-attempt)</span>
                  <span className="text-[10px] text-emerald-400">Free</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUserAction("pin")}
                  className={`rounded-lg border px-3 py-2 text-left font-medium transition flex items-center justify-between ${
                    statusState === "pin_shared"
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-white/10 bg-[#202C33] text-neutral-200 hover:border-emerald-500/50 hover:bg-[#2A3942]"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-emerald-400" />
                    Share GPS Pin
                  </span>
                  <span className="text-[10px] text-neutral-400">1-tap</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUserAction("upi")}
                  className={`rounded-lg border px-3 py-2 text-left font-medium transition flex items-center justify-between ${
                    statusState === "upi_converted"
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-white/10 bg-[#202C33] text-neutral-200 hover:border-emerald-500/50 hover:bg-[#2A3942]"
                  }`}
                >
                  <span>⚡ Pay via UPI</span>
                  <span className="text-[10px] text-emerald-400">₹50 Off</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUserAction("cancel")}
                  className={`rounded-lg border px-3 py-2 text-left font-medium transition flex items-center justify-between ${
                    statusState === "cancelled"
                      ? "border-red-500 bg-red-500/20 text-red-300"
                      : "border-white/10 bg-[#202C33] text-neutral-300 hover:border-red-500/50 hover:bg-[#2A3942]"
                  }`}
                >
                  <span>❌ Cancel Order</span>
                  <span className="text-[10px] text-red-400">Save ₹100</span>
                </button>
              </div>

              {/* iOS Bottom Input Pill Bar */}
              <div className="flex items-center gap-2 pt-1 text-neutral-400">
                <Plus size={18} className="text-[#00A884]" />
                <div className="flex-1 rounded-full bg-[#2A3942] px-3.5 py-1.5 text-[11px] text-neutral-300">
                  {statusState !== "initial"
                    ? "Order rescue locked · Carrier notified"
                    : "Tap a quick reply button above to test…"}
                </div>
                <Camera size={18} />
                <Mic size={18} />
              </div>
            </div>
          </div>

          {/* ──────────────── RIGHT PANE: LIVE COURIER OS & TELEMETRY ──────────────── */}
          <div className={`flex flex-col bg-[#0D0F0E] text-neutral-200 ${activeTabMobile === "buyer" ? "hidden lg:flex" : "flex"}`}>
            {/* Telemetry Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#141716] px-4 py-2.5">
              <div className="flex items-center gap-2 font-mono text-xs text-neutral-200 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>DELHIVERY NDR GATEWAY // AWB #4923118876</span>
              </div>
              <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 font-semibold">
                INTERCEPT: 12s SLA
              </span>
            </div>

            {/* Swiss RTO Bleed Ledger (3-Column) */}
            <div className="grid grid-cols-3 border-b border-white/10 divide-x divide-white/10 bg-black/40">
              <div className="p-3">
                <div className="font-mono text-[9px] text-neutral-400 font-semibold">01 · FREIGHT &amp; QC</div>
                <div className="text-base font-extrabold text-white font-mono mt-0.5">₹200</div>
                <div className="text-[10px] text-neutral-400">Fwd + Rev + Pack</div>
              </div>
              <div className="p-3">
                <div className="font-mono text-[9px] text-neutral-400 font-semibold">02 · SUNK AD CAC</div>
                <div className="text-base font-extrabold text-white font-mono mt-0.5">₹230</div>
                <div className="text-[10px] text-neutral-400">Meta / Google Ads</div>
              </div>
              <div className={`p-3 transition-colors ${statusState !== "initial" ? "bg-emerald-950/40" : "bg-red-950/20"}`}>
                <div className="font-mono text-[9px] font-semibold text-emerald-400">
                  {statusState !== "initial" ? "✓ TOTAL SAVED" : "⚠ AT RISK"}
                </div>
                <div className="text-base font-extrabold text-emerald-300 font-mono mt-0.5">
                  ₹430 / RTO
                </div>
                <div className="text-[10px] text-emerald-400/80">
                  {statusState !== "initial" ? "Margin Protected" : "Pending Intercept"}
                </div>
              </div>
            </div>

            {/* Autonomous Execution Pipeline */}
            <div className="p-4 space-y-2.5 flex-1">
              <div className="flex items-center justify-between font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                <span>EXECUTION STATE MACHINE</span>
                <span className="text-emerald-400">MODE: NDR_ARREST_V2</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-[10px] font-bold text-emerald-400">
                    01
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Fake NDR Scan Intercepted (&quot;Door Locked&quot;)</span>
                      <span className="font-mono text-[10px] text-emerald-400">12s SLA ✓</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Carrier webhook caught at 14:14:12. WABA template dispatched within 90s SLA window.
                    </div>
                  </div>
                </div>

                <div className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition ${
                  statusState !== "initial"
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-white/10 bg-neutral-900/40"
                }`}>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-bold text-neutral-300">
                    02
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Buyer Availability &amp; Intent Verification</span>
                      <span className={`font-mono text-[10px] ${statusState !== "initial" ? "text-emerald-400 font-bold" : "text-amber-400"}`}>
                        {statusState !== "initial" ? "VERIFIED ✓" : "AWAITING TAP"}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {statusState === "home_confirmed" && "Consignee confirmed presence. False 'Door Locked' remark reversed in Delhivery system."}
                      {statusState === "pin_shared" && "Precise gate GPS coordinates captured over WhatsApp thread."}
                      {statusState === "upi_converted" && "₹1,190 UPI settlement verified. Zero COD risk."}
                      {statusState === "cancelled" && "1-shot retention discount deployed to reverse cancellation."}
                      {statusState === "initial" && "Awaiting buyer confirmation via WhatsApp quick-reply buttons on the left."}
                    </div>
                  </div>
                </div>

                <div className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition ${
                  statusState !== "initial"
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-white/10 bg-neutral-900/40"
                }`}>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-bold text-neutral-300">
                    03
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Courier API Injection &amp; Field Rider Turnaround</span>
                      <span className={`font-mono text-[10px] ${statusState !== "initial" ? "text-emerald-400 font-bold" : "text-neutral-500"}`}>
                        {statusState !== "initial" ? "DISPATCHED ✓" : "STANDBY"}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {statusState !== "initial"
                        ? "Priority re-attempt mandate injected into Delhivery NDR API. Rider alerted while 200m away."
                        : "Mandate will be injected into Delhivery NDR API upon customer response."}
                    </div>
                  </div>
                </div>
              </div>

              {/* Carrier API Payload Inspector */}
              <div className="mt-3 rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[11px]">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 pb-1.5 border-b border-white/10">
                  <span className="flex items-center gap-1.5 text-neutral-300">
                    <Terminal size={12} className="text-emerald-400" />
                    DELHIVERY_NDR_API_PAYLOAD
                  </span>
                  <span className="text-emerald-400 font-semibold">HTTP 200 OK</span>
                </div>
                <pre className="mt-2 text-neutral-300 overflow-x-auto text-[10px] leading-relaxed">
{statusState === "pin_shared"
? `POST /api/v2/ndr/4923118876/reattempt
{
  "action": "PRIORITY_REATTEMPT",
  "lat": 28.5355, "lng": 77.3910,
  "landmark": "Gate 2, Sector 62",
  "rider_sms": "maps.google.com/?q=28.5355,77.3910",
  "rto_arrest_saved": "INR_430"
}`
: statusState === "home_confirmed"
? `POST /api/v2/ndr/4923118876/reattempt
{
  "action": "REATTEMPT_SAME_DAY",
  "remark_override": "BUYER_CONFIRMED_HOME",
  "fake_attempt_reversed": true,
  "carrier_hold_status": "RELEASED_TO_RIDER"
}`
: statusState === "upi_converted"
? `POST /api/v2/ndr/4923118876/convert_prepaid
{
  "action": "CONVERT_COD_TO_PREPAID",
  "upi_ref": "UPI_8941209341",
  "amount_collected": 1190,
  "rto_risk": "ELIMINATED_0_PERCENT"
}`
: `STREAM /webhooks/delhivery/awb-4923118876
{
  "awb": "4923118876",
  "status": "DOOR_LOCKED_UNVERIFIED",
  "call_logs_detected": 0,
  "intercept_action": "WHATSAPP_DISPATCHED",
  "sla_window_sec": 90
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RescueHeroDuoSimulator;
