"use client";

import React, { useRef, useState } from "react";

export interface StorySpotlightCardProps {
  stat: string;
  pillText: string;
  pillVariant?: "alert" | "timing" | "success" | "rescue";
  title: string;
  description: string;
  footerText: string;
  mediaContent?: React.ReactNode;
  imgSrc?: string;
  imgAlt?: string;
  isRescue?: boolean;
  className?: string;
}

export function StorySpotlightCard({
  stat,
  pillText,
  pillVariant = "alert",
  title,
  description,
  footerText,
  mediaContent,
  imgSrc,
  imgAlt,
  isRescue = false,
  className = "",
}: StorySpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

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
    : pillVariant === "timing"
    ? "bg-amber-50 text-amber-800 border-amber-200/80"
    : pillVariant === "success"
    ? "bg-stone-100 text-stone-700 border-stone-200/80"
    : "bg-rose-50 text-rose-800 border-rose-200/80";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border bg-white p-5 lg:p-6 transition-all duration-300 ease-out hover:-translate-y-1 ${
        isRescue
          ? "border-emerald-500/25 shadow-[0_2px_12px_rgba(16,185,129,0.04)] hover:shadow-[0_16px_36px_rgba(16,185,129,0.08)] hover:border-emerald-500/50"
          : "border-neutral-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.07)] hover:border-neutral-300"
      } ${className}`}
    >
      {/* Subtle cursor spotlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, ${
            isRescue ? "rgba(16, 185, 129, 0.06)" : "rgba(0, 0, 0, 0.03)"
          }, transparent 80%)`,
        }}
        aria-hidden="true"
      />

      {/* Top Bar: Timestamp + Pill */}
      <div className="relative z-10 flex items-center justify-between pb-3">
        <span className="font-mono text-2xl lg:text-[26px] font-bold tracking-tight text-neutral-900">
          {stat}
        </span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider ${pillStyle}`}>
          {pillText}
        </span>
      </div>

      {/* Media or Visual Content */}
      <div className="relative z-10 my-2">
        {mediaContent ? (
          mediaContent
        ) : (
          <div className="relative h-[220px] w-full overflow-hidden rounded-xl bg-neutral-100 border border-black/5">
            {imgSrc && (
              <img
                src={imgSrc}
                alt={imgAlt || title}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                loading="lazy"
              />
            )}
          </div>
        )}
      </div>

      {/* Content: Title & Description */}
      <div className="relative z-10 flex flex-1 flex-col pt-2">
        <h3 className="text-lg font-bold text-neutral-900 tracking-tight leading-snug">
          {title}
        </h3>
        <p className="mt-2 text-sm text-neutral-600 leading-relaxed font-normal flex-grow">
          {description}
        </p>

        {/* Card Footer */}
        <div className="mt-4 border-t border-neutral-100 pt-3 text-xs font-mono text-neutral-600">
          {footerText}
        </div>
      </div>
    </div>
  );
}
