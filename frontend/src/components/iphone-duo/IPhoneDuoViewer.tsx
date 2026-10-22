import React, { useEffect, useRef, useState } from 'react';
import { MathUtils } from 'three';
import { createStage, type Stage } from './stage/stage';
import { createFoldable, loadModel, type Foldable } from './device/foldable';
import { loadLockScreen } from './device/screens';

interface IPhoneDuoViewerProps {
  openness: number; // 0 (closed) -> 1 (flat open)
  className?: string;
  style?: React.CSSProperties;
  onLoaded?: () => void;
}

export const IPhoneDuoViewer: React.FC<IPhoneDuoViewerProps> = ({
  openness,
  className = '',
  style,
  onLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const foldableRef = useRef<Foldable | null>(null);
  const opennessRef = useRef<number>(openness);
  const onLoadedRef = useRef(onLoaded);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  // Keep openness ref up to date
  useEffect(() => {
    opennessRef.current = openness;
    if (foldableRef.current) {
      foldableRef.current.setOpenness(openness);
    }
  }, [openness]);

  useEffect(() => {
    const hostElement = containerRef.current;
    if (!hostElement) return;

    let isDisposed = false;
    let animFrameId: number;

    async function init3D(host: HTMLElement) {
      try {
        const stage = createStage(host);
        stageRef.current = stage;

        // Disable mouse orbit by default so scroll / touch passes through cleanly
        stage.setOrbitEnabled(false);

        // Load 3D model and lock screen artwork in parallel
        const [model, lockScreen] = await Promise.all([
          loadModel(),
          loadLockScreen(),
        ]);

        if (isDisposed) {
          stage.dispose();
          return;
        }

        const anisotropy = stage.renderer.capabilities.getMaxAnisotropy();
        const environment = stage.scene.environment;
        const foldable = createFoldable(model, lockScreen, anisotropy, environment);
        foldableRef.current = foldable;

        stage.content.add(foldable.root);

        // Precompile shaders
        await stage.renderer.compileAsync(stage.scene, stage.camera);

        if (isDisposed) {
          stage.dispose();
          return;
        }

        // Set initial state
        foldable.setOpenness(opennessRef.current);
        foldable.warmUp();

        setIsLoaded(true);
        onLoadedRef.current?.();

        // 60/120fps render loop
        let prevTime = performance.now();
        const renderLoop = (time: number) => {
          if (isDisposed) return;
          const delta = Math.min((time - prevTime) / 1000, 1 / 30);
          prevTime = time;

          const currentOpen = opennessRef.current;
          foldable.setOpenness(currentOpen);
          foldable.advanceBlend(delta);

          // Camera framing based on openness
          // When closed: slight yaw to showcase titanium rim and side buttons
          // When open: flat head-on framing
          const targetYaw = -0.10 * (1 - currentOpen);
          const targetDistance = MathUtils.lerp(34.0, 35.5, currentOpen);
          const targetPitch = MathUtils.lerp(1.57, 1.51, currentOpen);

          stage.applyView({
            distance: targetDistance,
            pitch: targetPitch,
            yaw: targetYaw,
          });

          stage.render();
          foldable.render(stage.renderer);

          animFrameId = requestAnimationFrame(renderLoop);
        };

        animFrameId = requestAnimationFrame(renderLoop);
      } catch (err) {
        console.error('Failed to initialize 3D iPhone Duo:', err);
        setHasError(true);
      }
    }

    init3D(hostElement);

    return () => {
      isDisposed = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (stageRef.current) {
        stageRef.current.dispose();
        stageRef.current = null;
      }
      foldableRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`rs-duo-webgl-canvas-host ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isLoaded ? 1 : 0.05,
        transition: 'opacity 0.4s ease',
        ...style,
      }}
    >
      {hasError && (
        <div className="rs-duo-webgl-error" style={{ display: 'none' }}>
          WebGL not supported
        </div>
      )}
    </div>
  );
};
