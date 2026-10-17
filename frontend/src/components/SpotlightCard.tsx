import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  enableTilt?: boolean;
}

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(129, 140, 248, 0.08)',
  enableTilt = true,
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tilt, setTilt] = useState<{ rotateX: number; rotateY: number }>({ rotateX: 0, rotateY: 0 });
  const [opacity, setOpacity] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(mq.matches);
      const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    } catch {}
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPosition({ x, y });

    if (enableTilt && !reduced && rect.width > 0 && rect.height > 0) {
      const normX = (x / rect.width) - 0.5; // -0.5 to 0.5
      const normY = (y / rect.height) - 0.5; // -0.5 to 0.5
      setTilt({
        rotateX: Number((-normY * 4.4).toFixed(2)), // up to +-2.2deg
        rotateY: Number((normX * 4.4).toFixed(2)),  // up to +-2.2deg
      });
    }
  }, [enableTilt, reduced]);

  const handleMouseEnter = useCallback(() => setOpacity(1), []);
  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`rs-spotlight ${className}`}
      style={{
        transform: (!reduced && (tilt.rotateX !== 0 || tilt.rotateY !== 0))
          ? `perspective(900px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
          : undefined,
        ...props.style,
      }}
      {...props}
    >
      <div
        className="rs-spotlight__glow"
        style={{
          opacity,
          background: `radial-gradient(420px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
        aria-hidden="true"
      />
      <div className="rs-spotlight__content">{children}</div>
    </div>
  );
}

export default SpotlightCard;
