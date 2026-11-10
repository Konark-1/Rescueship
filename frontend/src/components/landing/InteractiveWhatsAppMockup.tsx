"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCheck, MapPin, RotateCcw } from "lucide-react";

export function InteractiveWhatsAppMockup() {
  const [hasReplied, setHasReplied] = useState<boolean>(false);
  const [selectedChoice, setSelectedChoice] = useState<string>("✅ Yes, I'm home");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Auto-play preview after 3 seconds if visitor doesn't click
  useEffect(() => {
    if (hasReplied) return;

    const timer = setTimeout(() => {
      triggerReply("✅ Yes, I'm home");
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasReplied]);

  const triggerReply = (choice: string) => {
    if (hasReplied) return;
    setSelectedChoice(choice);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setHasReplied(true);
      setTimeout(() => {
        setConfirmed(true);
      }, 350);
    }, 700);
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasReplied(false);
    setIsTyping(false);
    setConfirmed(false);
    setSelectedChoice("✅ Yes, I'm home");
  };

  const replyText =
    selectedChoice === "📍 Share GPS Pin"
      ? "📍 Shared live GPS pin · Flat 402. Please send him up!"
      : "Yes! I'm in Flat 402. Bell didn't ring, please send him up.";

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-xl border border-neutral-200/80 bg-[#efeae2] shadow-sm select-none flex flex-col justify-between">
      {/* WhatsApp Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-black/10 bg-[#075e54] px-3.5 py-1.5 text-white">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-[#128c7e] text-xs font-bold text-white shadow-sm">
            ⚓
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold tracking-tight text-white">RescueShip Assistant</span>
              <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-400 text-[9px] text-[#075e54] font-bold">
                ✓
              </span>
            </div>
            <span className="text-[9.5px] text-emerald-100/90 font-medium">Official Business Account</span>
          </div>
        </div>

        {/* Replay action */}
        <button
          type="button"
          onClick={handleReplay}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-emerald-100/80 hover:bg-white/10 hover:text-white transition-colors"
          title="Replay dialogue"
        >
          <RotateCcw className="size-2.5" />
          <span>Replay</span>
        </button>
      </div>

      {/* WhatsApp Chat Body */}
      <div className="flex flex-1 flex-col justify-between p-2.5">
        {/* Message 1: Inbound Prompt */}
        <div className="max-w-[92%] rounded-lg rounded-tl-none bg-white p-2.5 text-neutral-900 shadow-sm border border-black/5">
          <p className="text-[11.5px] leading-snug text-neutral-900 font-normal">
            Hi Priya! Blue Dart marked order #89421 as &ldquo;Door Locked&rdquo;. Are you at home to receive it right now?
          </p>
          <div className="mt-1 flex items-center justify-end text-[9.5px] text-neutral-400 font-mono">
            <span>02:14 PM</span>
          </div>
        </div>

        {/* Action Choice Chips */}
        <div className="my-1 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => triggerReply("✅ Yes, I'm home")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
              hasReplied && selectedChoice === "✅ Yes, I'm home"
                ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                : "border-emerald-600/80 bg-white text-emerald-800 hover:bg-emerald-50 shadow-xs"
            }`}
          >
            <span>✅ Yes, I&apos;m home</span>
          </button>

          <button
            type="button"
            onClick={() => triggerReply("📍 Share GPS Pin")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
              hasReplied && selectedChoice === "📍 Share GPS Pin"
                ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                : "border-emerald-600/80 bg-white text-emerald-800 hover:bg-emerald-50 shadow-xs"
            }`}
          >
            <MapPin className="size-3 text-emerald-600" />
            <span>Share GPS Pin</span>
          </button>
        </div>

        {/* Dynamic Reply or Typing */}
        <div className="min-h-[36px] flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {isTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 self-end rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-1.5 text-xs text-neutral-700 shadow-sm border border-emerald-600/10"
              >
                <span className="text-[10.5px] text-emerald-950 font-medium">Priya typing</span>
                <span className="flex gap-0.5">
                  <motion.span
                    animate={{ y: [0, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                    className="size-1 rounded-full bg-emerald-800"
                  />
                  <motion.span
                    animate={{ y: [0, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                    className="size-1 rounded-full bg-emerald-800"
                  />
                  <motion.span
                    animate={{ y: [0, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                    className="size-1 rounded-full bg-emerald-800"
                  />
                </span>
              </motion.div>
            )}

            {hasReplied && (
              <motion.div
                key="reply"
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="max-w-[88%] self-end rounded-lg rounded-tr-none bg-[#d9fdd3] p-2 px-2.5 text-neutral-900 shadow-sm border border-emerald-600/15"
              >
                <p className="text-[11px] leading-snug font-normal text-neutral-950">
                  {replyText}
                </p>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px] text-neutral-500 font-mono">
                  <span>02:15 PM</span>
                  <CheckCheck className="size-3 text-[#34b7f1]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Subtle dispatch status */}
        {confirmed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-1.5 self-center rounded-full bg-white/90 px-3 py-0.5 text-[9.5px] font-semibold text-emerald-900 shadow-xs border border-emerald-600/20 backdrop-blur-xs"
          >
            <span className="size-1.5 rounded-full bg-emerald-600" />
            <span>Driver notified · Delivery re-routed to Flat 402</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
