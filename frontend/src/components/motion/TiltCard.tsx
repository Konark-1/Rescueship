import { useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';

export default function TiltCard({ children, className = '', intensity = 8 }: { children: ReactNode; className?: string; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState('perspective(800px) rotateX(0) rotateY(0)');
  const move = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    setT(`perspective(800px) rotateX(${(0.5 - y) * intensity}deg) rotateY(${(x - 0.5) * intensity}deg) scale3d(1.02,1.02,1.02)`);
  };
  const leave = () => setT('perspective(800px) rotateX(0) rotateY(0)');
  return <motion.div ref={ref} className={className} onMouseMove={move} onMouseLeave={leave} style={{ transform: t, transition: 'transform 0.15s ease-out', willChange: 'transform', transformStyle: 'preserve-3d' }}>{children}</motion.div>;
}
