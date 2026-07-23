import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { hoverLift } from '../../lib/motion';

export interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  enableSpotlight?: boolean;
  colorVar?: string;
  pulse?: boolean;
}

export const MotionCard: React.FC<MotionCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(99, 102, 241, 0.18)',
  enableSpotlight = true,
  colorVar,
  pulse,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: -1000, y: -1000 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !enableSpotlight) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      whileHover={hoverLift.whileHover}
      whileTap={hoverLift.whileTap}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`glass-card relative overflow-hidden ${className} ${pulse ? 'pulse-card' : ''}`}
      style={{ position: 'relative', ...(colorVar ? { '--card-accent': colorVar } as any : {}) }}
      {...(props as any)}
    >
      {enableSpotlight && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${cursorPos.x}px ${cursorPos.y}px, ${spotlightColor}, transparent 40%)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </motion.div>
  );
};
