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
  animateOnView = false,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.1 });
  
  const [displayValue, setDisplayValue] = useState<string>(() =>
    Math.round(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
  const currentValueRef = useRef(0);

  useEffect(() => {
    const shouldAnimate = !animateOnView || isInView;
    if (shouldAnimate) {
      const startVal = currentValueRef.current;
      const endVal = value;

      const controls = animate(startVal, endVal, {
        duration: 0.9,
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
          setDisplayValue(
            Math.round(endVal).toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          );
        },
      });

      return () => controls.stop();
    } else {
      setDisplayValue(
        Math.round(value).toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      );
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
