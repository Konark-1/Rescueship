import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'motion/react';

export function StoryProgress({ progress }: { progress: MotionValue<number> }) {
  const w = useTransform(progress, [0, 1], ['0%', '100%']);
  return <div className="story-progress" aria-hidden="true"><motion.div className="story-progress__bar" style={{ width: w }} /></div>;
}

export function ChapterIndicator({ current, total }: { current: MotionValue<number>; total: number }) {
  const d = useTransform(current, v => String(Math.min(Math.floor(v) + 1, total)).padStart(2, '0'));
  return (
    <div className="story-indicator" aria-hidden="true">
      <motion.span className="story-indicator__num">{d}</motion.span>
      <span className="story-indicator__sep">/</span>
      <span>{String(total).padStart(2, '0')}</span>
    </div>
  );
}

export function StoryChapter({ children, scrollHeight = '300vh', className = '' }: {
  children: (progress: MotionValue<number>) => ReactNode;
  scrollHeight?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  return (
    <div ref={ref} style={{ height: scrollHeight }} className={`story-ch ${className}`}>
      <div className="story-ch__sticky">{children(scrollYProgress)}</div>
    </div>
  );
}

export function usePhase(progress: MotionValue<number>, start: number, end: number) {
  return useTransform(progress, [start, end], [0, 1], { clamp: true });
}
