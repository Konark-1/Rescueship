"use client";

import React, { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, motion } from "motion/react";
import { cn } from "../../lib/utils";

export interface TimelineEntry {
  title: string;
  badge?: string;
  badgeVariant?: "alert" | "timing" | "success" | "rescue";
  content: React.ReactNode;
}

export function Timeline({
  data,
  className,
}: {
  data: TimelineEntry[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 20%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div
      className={cn("w-full font-sans md:px-10", className)}
      ref={containerRef}
    >
      <div ref={ref} className="relative max-w-7xl mx-auto pb-12">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex justify-start pt-10 md:pt-20 md:gap-10"
          >
            {/* Sticky Milestone Marker */}
            <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
              <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-[#f6f5f0] flex items-center justify-center border border-neutral-300 shadow-sm">
                <div className="h-4 w-4 rounded-full bg-neutral-900 border border-neutral-400 p-2" />
              </div>
              <div className="hidden md:block md:pl-20">
                <h3 className="text-xl md:text-3xl font-bold font-mono text-neutral-800">
                  {item.title}
                </h3>
                {item.badge && (
                  <span className="inline-block mt-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500">
                    {item.badge}
                  </span>
                )}
              </div>
            </div>

            {/* Content Section */}
            <div className="relative pl-20 pr-4 md:pl-4 w-full">
              <div className="md:hidden block mb-4">
                <h3 className="text-2xl font-bold font-mono text-neutral-800">
                  {item.title}
                </h3>
                {item.badge && (
                  <span className="inline-block mt-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500">
                    {item.badge}
                  </span>
                )}
              </div>
              {item.content}
            </div>
          </div>
        ))}

        {/* Scroll Beam Follow Line */}
        <div
          style={{
            height: height + "px",
          }}
          className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-gradient-to-b from-transparent via-neutral-200 to-transparent"
        >
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t from-emerald-500 via-amber-500 to-transparent from-[0%] via-[10%] rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"
          />
        </div>
      </div>
    </div>
  );
}
