import { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'motion/react';

function Word({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.07, 1]);
  return <motion.span style={{ opacity, display: 'inline-block', marginRight: '0.28em' }}>{word}</motion.span>;
}

export default function TextReveal({ children, className = '', as: Tag = 'p' }: { children: string; className?: string; as?: 'h1'|'h2'|'h3'|'p'|'span' }) {
  const ref = useRef<HTMLElement>(null);
  const words = children.split(' ');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'start 0.35'] });
  const MTag = motion[Tag] as any;
  return (
    <MTag ref={ref} className={className}>
      {words.map((w, i) => <Word key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />)}
    </MTag>
  );
}
