/**
 * TextReveal — Scroll-driven word-by-word opacity reveal.
 * Each word fades in as the user scrolls through the text.
 * Inspired by Mindloop / Prisma scroll reveals.
 */
import { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'motion/react';

interface TextRevealProps {
  children: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

function Word({ word, progress, range }: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.08, 1]);
  return (
    <motion.span style={{ opacity, display: 'inline-block', marginRight: '0.3em' }}>
      {word}
    </motion.span>
  );
}

export default function TextReveal({ children, className = '', as: Tag = 'p' }: TextRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const words = children.split(' ');

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'start 0.35'],
  });

  const MotionTag = motion[Tag] as any;

  return (
    <MotionTag ref={ref} className={className}>
      {words.map((word, i) => (
        <Word
          key={i}
          word={word}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1) / words.length]}
        />
      ))}
    </MotionTag>
  );
}
