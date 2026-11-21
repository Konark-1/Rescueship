import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { type MotionValue } from 'motion/react';
import { createRescueScreenSurfaces } from './rescueScreens';
import { createStage, type Stage } from './iphone-duo/stage/stage';
import { createFoldable, loadModel, type Foldable } from './iphone-duo/device/foldable';
import { loadLockScreen } from './iphone-duo/device/screens';

export type FoldPhase = 0 | 1 | 2;

interface IPhoneDuoViewerProps {
  openness: MotionValue<number>;
  reducedMotion: boolean;
  onPhaseChange?: (phase: FoldPhase) => void;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function phaseFromOpenness(t: number): FoldPhase {
  if (t < 0.18) return 0;
  if (t < 0.78) return 1;
  return 2;
}

export function IPhoneDuoViewer({
  openness,
  reducedMotion,
  onPhaseChange,
}: IPhoneDuoViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<FoldPhase>(0);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const [webglFailed, setWebglFailed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    let disposed = false;
    let rafId = 0;
    let stage: Stage | null = null;
    let foldable: Foldable | null = null;
    let rescueScreens: ReturnType<typeof createRescueScreenSurfaces> | null = null;

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointerTargetRef.current.x = THREE.MathUtils.clamp(nx, -1, 1);
      pointerTargetRef.current.y = THREE.MathUtils.clamp(ny, -1, 1);
    };

    const handlePointerLeave = () => {
      pointerTargetRef.current.x = 0;
      pointerTargetRef.current.y = 0;
    };

    container.addEventListener('pointermove', handlePointerMove, { passive: true });
    container.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    const init = async () => {
      try {
        // createStage without obstacle frames the 3D phone dead-center
        stage = createStage(container);

        if (disposed) {
          stage.dispose();
          return;
        }

        // Disable OrbitControls so page scrolling is never hijacked
        stage.setOrbitEnabled(false);

        // Load 3D model and lock screen artwork in parallel side-by-side
        const [model, lockScreen] = await Promise.all([
          loadModel(),
          loadLockScreen(),
        ]);

        if (disposed) {
          stage.dispose();
          return;
        }

        const maxAnisotropy = stage.renderer.capabilities.getMaxAnisotropy();
        rescueScreens = createRescueScreenSurfaces(maxAnisotropy);

        foldable = createFoldable(
          model,
          lockScreen,
          maxAnisotropy,
          stage.scene.environment
        );

        if (disposed) {
          rescueScreens.dispose();
          stage.dispose();
          return;
        }

        // Bind high-contrast WhatsApp NDR Lockscreen (outer) + Live Recovery Telemetry (inner)
        foldable.setScreens(rescueScreens.outerCanvas, rescueScreens.innerCanvas);

        stage.content.add(foldable.root);

        // Set initial closed/open state
        const initialT = reducedMotion ? 1 : clamp01(openness.get());
        foldable.setOpenness(initialT);
        foldable.warmUp();

        setIsReady(true);

        let prevTime = performance.now();

        const tick = (time: number) => {
          if (disposed || !stage || !foldable) return;

          const delta = Math.min((time - prevTime) / 1000, 1 / 30);
          prevTime = time;

          const t = reducedMotion ? 1 : clamp01(openness.get());
          foldable.setOpenness(t);
          foldable.advanceBlend(delta);

          const nextPhase = phaseFromOpenness(t);
          if (nextPhase !== phaseRef.current) {
            phaseRef.current = nextPhase;
            onPhaseChangeRef.current?.(nextPhase);
          }

          // Subtle pointer parallax damping
          const ease = 0.08;
          pointerCurrentRef.current.x +=
            (pointerTargetRef.current.x - pointerCurrentRef.current.x) * ease;
          pointerCurrentRef.current.y +=
            (pointerTargetRef.current.y - pointerCurrentRef.current.y) * ease;

          const parallaxYaw = reducedMotion ? 0 : pointerCurrentRef.current.x * 0.065;
          const parallaxPitch = reducedMotion ? 0 : -pointerCurrentRef.current.y * 0.045;

          // Cinematic camera framing:
          // When closed: slight yaw to catch rim light on titanium spine
          // When open: flat front-on framing
          const baseYaw = -0.12 * (1 - t);
          const targetYaw = baseYaw + parallaxYaw;
          const targetDistance = THREE.MathUtils.lerp(35.0, 36.5, t);
          const targetPitch = THREE.MathUtils.lerp(1.57, 1.51, t) + parallaxPitch;

          stage.applyView({
            distance: targetDistance,
            pitch: targetPitch,
            yaw: targetYaw,
          });

          // Render WebGL frame & screen wipe
          stage.render();
          foldable.render(stage.renderer);

          rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
      } catch (error) {
        if (!disposed) {
          console.error('[IPhoneDuoViewer] WebGL initialization failed:', error);
          setWebglFailed(true);
        }
      }
    };

    void init();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      rescueScreens?.dispose();
      stage?.dispose();
    };
  }, [openness, reducedMotion]);

  if (webglFailed) {
    return (
      <div className="foldfolio-fallback" role="region" aria-label="RescueShip live NDR preview">
        <div className="foldfolio-fallback-card">
          <span className="foldfolio-fallback-badge">WhatsApp NDR Intercept</span>
          <p className="foldfolio-fallback-title">Order #RS-84920 Rescued in 42s</p>
          <p className="foldfolio-fallback-copy">
            Hardware 3D WebGL acceleration is unavailable on this browser. Courier webhook patched
            with customer security pin and re-attempt scheduled automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="foldfolio-stage-frame">
      <div
        ref={hostRef}
        className={`foldfolio-canvas-host${isReady ? ' is-ready' : ''}`}
        aria-hidden="true"
      />
    </div>
  );
}

export default IPhoneDuoViewer;
