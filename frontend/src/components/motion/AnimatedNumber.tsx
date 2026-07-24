import { useEffect, useRef, useState } from 'react';
import { useInView, animate } from 'motion/react';

interface Props { value: number; prefix?: string; suffix?: string; decimals?: number; className?: string; duration?: number; }

export default function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, className = '', duration = 2 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: v => setDisplay(v) });
    return () => c.stop();
  }, [inView, value, duration]);
  return <span ref={ref} className={className}>{prefix}{display.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}
