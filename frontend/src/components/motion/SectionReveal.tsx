/**
 * SectionReveal — Elegant entrance animation for sections.
 * Fades up + slight scale with spring easing.
 */
import { motion } from 'motion/react';
import { ReactNode } from 'react';

interface SectionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

export default function SectionReveal({
  children,
  className = '',
  delay = 0,
  y = 40,
}: SectionRevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
