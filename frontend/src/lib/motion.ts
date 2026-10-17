import type { Variants } from 'motion/react';

export const springDefault = { type: 'spring' as const, stiffness: 300, damping: 24 };
export const springSnappy = { type: 'spring' as const, stiffness: 400, damping: 28 };
export const springBouncy = { type: 'spring' as const, stiffness: 260, damping: 20 };
export const springScroll = { stiffness: 110, damping: 26, mass: 0.3 };
export const easeSmoothOut = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springDefault,
  },
};

export const chapterReveal: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: easeSmoothOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springSnappy,
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.07,
    },
  },
};

export const hoverLift = {
  whileHover: { y: -5, scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: springSnappy,
};
