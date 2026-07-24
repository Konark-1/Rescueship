import { useRef, useCallback } from 'react';

export function useMagnetic(strength = 0.3) {
  const ref = useRef<HTMLElement>(null);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
  }, [strength]);
  const onMouseLeave = useCallback(() => { if (ref.current) ref.current.style.transform = 'translate(0,0)'; }, []);
  return { ref, onMouseMove, onMouseLeave };
}
