import { useEffect } from 'react';
import Lenis from 'lenis';

export function useLenis() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });
    let raf: number;
    const loop = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    (window as any).__lenis = lenis;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]');
      if (a) { e.preventDefault(); const el = document.getElementById(a.getAttribute('href')!.slice(1)); if (el) lenis.scrollTo(el, { offset: -80 }); }
    };
    document.addEventListener('click', onClick);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); document.removeEventListener('click', onClick); delete (window as any).__lenis; };
  }, []);
}
