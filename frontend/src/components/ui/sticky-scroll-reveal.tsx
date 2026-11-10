"use client";

import React, { useRef, useState } from "react";
import { useMotionValueEvent, useScroll, motion } from "motion/react";
import { cn } from "../../lib/utils";

export interface StickyScrollItem {
  title: string;
  badge?: string;
  description: string;
  content?: React.ReactNode;
}

export function StickyScroll({
  content,
  contentClassName,
  className,
}: {
  content: StickyScrollItem[];
  contentClassName?: string;
  className?: string;
}) {
  const [activeCard, setActiveCard] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    container: ref,
    offset: ["start start", "end end"],
  });

  const cardLength = content.length;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const cardsBreakpoints = content.map((_, index) => index / cardLength);
    const closestBreakpointIndex = cardsBreakpoints.reduce(
      (acc, breakpoint, index) => {
        const distance = Math.abs(latest - breakpoint);
        const prevDistance = Math.abs(latest - cardsBreakpoints[acc]);
        return distance < prevDistance ? index : acc;
      },
      0
    );
    setActiveCard(closestBreakpointIndex);
  });

  return (
    <motion.div
      className={cn(
        "h-[32rem] overflow-y-auto relative flex justify-between space-x-10 rounded-2xl p-8 border border-neutral-200/80 bg-white shadow-xs",
        className
      )}
      ref={ref}
    >
      <div className="relative flex items-start px-4">
        <div className="max-w-xl">
          {content.map((item, index) => (
            <div key={item.title + index} className="my-16 first:mt-4 last:mb-24">
              {item.badge && (
                <motion.span
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: activeCard === index ? 1 : 0.4 }}
                  className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-500"
                >
                  {item.badge}
                </motion.span>
              )}
              <motion.h3
                initial={{ opacity: 0.3 }}
                animate={{ opacity: activeCard === index ? 1 : 0.3 }}
                className="text-2xl font-bold tracking-tight text-neutral-900 mt-1"
              >
                {item.title}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0.3 }}
                animate={{ opacity: activeCard === index ? 1 : 0.35 }}
                className="text-neutral-600 text-base leading-relaxed max-w-md mt-4"
              >
                {item.description}
              </motion.p>
            </div>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "hidden lg:block h-72 w-96 rounded-xl bg-neutral-100 sticky top-6 overflow-hidden border border-neutral-200/80 shadow-xs",
          contentClassName
        )}
      >
        {content[activeCard]?.content ?? null}
      </div>
    </motion.div>
  );
}
