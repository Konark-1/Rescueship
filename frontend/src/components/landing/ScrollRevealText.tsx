import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

interface ScrollRevealTextProps {
  className?: string;
}

const MANIFESTO_TEXT =
  "Your courier partner logs 'Door Locked' four minutes after scan. No call. No doorbell. Every fake remark burns ₹430 in ad spend, forward freight, and reverse RTO — unless you intercept the buyer on WhatsApp in 90 seconds.";

function Word({
  word,
  progress,
  start,
  end,
  reduced,
}: {
  word: string;
  progress: any;
  start: number;
  end: number;
  reduced: boolean;
}) {
  const isSpecial =
    word.includes('Door') ||
    word.includes('Locked') ||
    word.includes('₹430') ||
    word.includes('90') ||
    word.includes('seconds');

  const opacity = useTransform(progress, [start, end], [isSpecial ? 0.85 : 0.65, 1]);
  const y = useTransform(progress, [start, end], [8, 0]);

  return (
    <motion.span
      className={`nt-manifesto-word ${isSpecial ? 'nt-manifesto-word--highlight' : ''}`}
      style={
        reduced
          ? { opacity: 1, y: 0, display: 'inline-block', marginRight: '0.28em' }
          : { opacity, y, display: 'inline-block', marginRight: '0.28em' }
      }
    >
      {isSpecial ? <em className="nt-serif">{word}</em> : word}
    </motion.span>
  );
}

export function ScrollRevealText({ className = '' }: ScrollRevealTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 80%', 'end 35%'],
  });

  const words = MANIFESTO_TEXT.split(' ');

  return (
    <div ref={containerRef} className={`nt-manifesto ${className}`}>
      <div className="nt-manifesto__inner">
        <p className="sr-only">{MANIFESTO_TEXT}</p>
        <p className="nt-manifesto__p" aria-hidden="true">
          {words.map((word, index) => {
            const start = index / words.length;
            const end = Math.min(start + 0.12, 1);
            return (
              <Word
                key={index}
                word={word}
                progress={scrollYProgress}
                start={start}
                end={end}
                reduced={reduced}
              />
            );
          })}
        </p>
      </div>
    </div>
  );
}

export default ScrollRevealText;
