import React, { useEffect, useState, useRef } from 'react';
import { useInView, motion, animate } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  animateOnView?: boolean;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  animateOnView = true,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  
  const [displayValue, setDisplayValue] = useState('0');
  const currentValueRef = useRef(0);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (!animateOnView || isInView) {
      const startVal = currentValueRef.current;
      const endVal = value;

      // First time opening animation: 2.0s | Value switching: 1.0s
      const animDuration = isFirstRenderRef.current ? 2.0 : 1.0;
      isFirstRenderRef.current = false;

      const controls = animate(startVal, endVal, {
        duration: animDuration,
        ease: 'easeOut',
        onUpdate(latest) {
          currentValueRef.current = latest;
          setDisplayValue(
            Math.round(latest).toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          );
        },
        onComplete() {
          currentValueRef.current = endVal;
        },
      });

      return () => controls.stop();
    }
  }, [isInView, value, animateOnView, decimals]);

  return (
    <motion.span
      ref={containerRef}
      className={className}
      style={{ display: 'inline-block' }}
    >
      {prefix}
      {displayValue}
      {suffix}
    </motion.span>
  );
};

export default AnimatedCounter;
