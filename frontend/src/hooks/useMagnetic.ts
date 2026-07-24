import { useRef, useCallback } from 'react';

/**
 * Magnetic hover effect — element subtly follows cursor.
 * GPU-accelerated (transform only). Strength 0-1.
 */
export function useMagnetic(strength: number = 0.3) {
  const ref = useRef<HTMLElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, [strength]);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translate(0px, 0px)';
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
