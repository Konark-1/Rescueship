import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Initializes Lenis smooth scroll on the entire page.
 * Respects prefers-reduced-motion.
 * Returns the Lenis instance for programmatic scrolling.
 */
export function useLenis() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // Expose for anchor link scrolling
    (window as any).__lenis = lenis;

    // Handle anchor clicks
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href^="#"]');
      if (target) {
        e.preventDefault();
        const id = target.getAttribute('href')!.slice(1);
        const el = document.getElementById(id);
        if (el) lenis.scrollTo(el, { offset: -80 });
      }
    };
    document.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      document.removeEventListener('click', handleClick);
      delete (window as any).__lenis;
    };
  }, []);
}
