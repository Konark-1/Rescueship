import { motion, useReducedMotion } from 'motion/react';

interface SlotCounterProps {
  value: string | number;
  className?: string;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function SingleDigit({ digit, reduced }: { digit: number; reduced: boolean }) {
  return (
    <span
      className="nt-slot-digit"
      style={{
        display: 'inline-block',
        height: '1em',
        lineHeight: '1em',
        overflow: 'hidden',
        verticalAlign: 'top',
        position: 'relative',
        width: '0.62em',
        textAlign: 'center',
      }}
    >
      <motion.span
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }}
        initial={false}
        animate={reduced ? { y: `-${digit * 10}%` } : { y: `-${digit * 10}%` }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 22 }}
      >
        {DIGITS.map((n) => (
          <span key={n} style={{ height: '1em', lineHeight: '1em' }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export function SlotCounter({ value, className = '' }: SlotCounterProps) {
  const reduced = !!useReducedMotion();
  const str = String(value);

  return (
    <span className={`nt-slot-counter ${className}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {str.split('').map((char, i) => {
        const isNum = !isNaN(Number(char)) && char !== ' ';
        if (!isNum) {
          return (
            <span key={i} className="nt-slot-char">
              {char}
            </span>
          );
        }
        return <SingleDigit key={i} digit={Number(char)} reduced={reduced} />;
      })}
    </span>
  );
}

export default SlotCounter;
