import { useRef, useState } from 'react';
import { useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { IPhoneDuoViewer, type FoldPhase } from './IPhoneDuoViewer';

const PHASE_ANNOUNCEMENTS: Record<FoldPhase, string> = {
  0: 'Closed cover screen showing WhatsApp NDR delivery intercept alert for Order RS-84920.',
  1: 'Foldable handset unfolding to reveal live autonomous delivery recovery.',
  2: 'Dual inner display fully open showing live WhatsApp customer confirmation and courier manifest sync.',
};

export function FoldfolioShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [phase, setPhase] = useState<FoldPhase>(prefersReducedMotion ? 2 : 0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Hold closed briefly at entry (0 -> 0.08) and flat-open at exit (0.84 -> 1.0)
  const clampedFoldProgress = useTransform(scrollYProgress, [0.08, 0.84], [0, 1], {
    clamp: true,
  });

  const openness = useSpring(clampedFoldProgress, {
    stiffness: 135,
    damping: 26,
    mass: 0.45,
    restDelta: 0.0005,
  });

  return (
    <section
      ref={sectionRef}
      id="foldfolio-demo"
      className="chapter-foldfolio"
      aria-labelledby="foldfolio-heading"
    >
      <div className="foldfolio-sticky">
        <div className="foldfolio-ambient-glow" aria-hidden="true" />

        <header className="foldfolio-header">
          <p className="foldfolio-eyebrow">CHAPTER 3.5 • AUTONOMOUS INTERCEPT</p>
          <h2 id="foldfolio-heading" className="foldfolio-title">
            Watch a failed delivery get rescued in real time
          </h2>
          <p className="foldfolio-subtitle">
            Scroll to unfold the live WhatsApp NDR intercept into full recovery telemetry.
          </p>
        </header>

        <div className="foldfolio-center-stage">
          <IPhoneDuoViewer
            openness={openness}
            reducedMotion={prefersReducedMotion}
            onPhaseChange={setPhase}
          />
        </div>

        <p className="sr-only" aria-live="polite">
          {PHASE_ANNOUNCEMENTS[phase]}
        </p>
      </div>
    </section>
  );
}

export default FoldfolioShowcase;
