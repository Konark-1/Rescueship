import React, { useEffect, useRef, useState } from 'react';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { createStage, type Stage } from './iphone-duo/stage/stage';
import {
  createFoldable,
  INNER_UI_DEPTH,
  INNER_UI_FRAME,
  loadModel,
  type Foldable,
} from './iphone-duo/device/foldable';
import { loadLockScreen } from './iphone-duo/device/screens';

export interface ScreenFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

export interface IPhoneDuoViewerProps {
  openness: number; // 0 (closed) -> 1 (flat open)
  notifPop?: number; // 0 (hidden) -> 1 (settled WhatsApp notification on the clock plane)
  unlock?: number; // 0 (locked) -> 1 (unlocked)
  className?: string;
  style?: React.CSSProperties;
  onLoaded?: () => void;
  onScreenFrame?: (frame: ScreenFrame | null) => void;
}

export const IPhoneDuoViewer: React.FC<IPhoneDuoViewerProps> = ({
  openness,
  notifPop = 0,
  unlock = 0,
  className = '',
  style,
  onLoaded,
  onScreenFrame,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const foldableRef = useRef<Foldable | null>(null);
  const opennessRef = useRef<number>(openness);
  const notifPopRef = useRef<number>(notifPop);
  const unlockRef = useRef<number>(unlock);
  const onLoadedRef = useRef(onLoaded);
  const onScreenFrameRef = useRef(onScreenFrame);
  const lastFrameRef = useRef<ScreenFrame | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    onScreenFrameRef.current = onScreenFrame;
  }, [onScreenFrame]);

  useEffect(() => {
    opennessRef.current = openness;
    if (foldableRef.current) {
      foldableRef.current.setOpenness(openness);
    }
  }, [openness]);

  useEffect(() => {
    notifPopRef.current = notifPop;
    if (foldableRef.current) {
      foldableRef.current.setNotifPop(notifPop);
    }
  }, [notifPop]);

  useEffect(() => {
    unlockRef.current = unlock;
    if (foldableRef.current) {
      foldableRef.current.setUnlock(unlock);
    }
  }, [unlock]);

  const reportScreenFrame = (camera: PerspectiveCamera) => {
    const host = containerRef.current;
    const foldable = foldableRef.current;
    const callback = onScreenFrameRef.current;
    if (!host || !foldable || !callback) return;

    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < 2 || height < 2) return;

    foldable.root.updateMatrixWorld(true);
    const corner = new Vector3();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const [cx, cy] of [
      [INNER_UI_FRAME.x, INNER_UI_FRAME.y],
      [INNER_UI_FRAME.x + INNER_UI_FRAME.z, INNER_UI_FRAME.y],
      [INNER_UI_FRAME.x, INNER_UI_FRAME.y + INNER_UI_FRAME.w],
      [INNER_UI_FRAME.x + INNER_UI_FRAME.z, INNER_UI_FRAME.y + INNER_UI_FRAME.w],
    ]) {
      corner.set(cx, cy, INNER_UI_DEPTH);
      foldable.root.localToWorld(corner);
      corner.project(camera);
      const px = ((corner.x + 1) / 2) * width;
      const py = ((1 - corner.y) / 2) * height;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    const frame: ScreenFrame = {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
      radius: ((maxY - minY) * 66) / 1125,
    };

    const previous = lastFrameRef.current;
    const moved =
      !previous ||
      Math.abs(previous.left - frame.left) > 0.5 ||
      Math.abs(previous.top - frame.top) > 0.5 ||
      Math.abs(previous.width - frame.width) > 0.5 ||
      Math.abs(previous.height - frame.height) > 0.5;

    if (moved) {
      lastFrameRef.current = frame;
      callback(frame);
    }
  };

  useEffect(() => {
    const hostElement = containerRef.current;
    if (!hostElement) return;

    let isDisposed = false;
    let animFrameId: number;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = hostElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointerTargetRef.current.x = MathUtils.clamp(nx, -1, 1);
      pointerTargetRef.current.y = MathUtils.clamp(ny, -1, 1);
    };

    const handlePointerLeave = () => {
      pointerTargetRef.current.x = 0;
      pointerTargetRef.current.y = 0;
    };

    hostElement.addEventListener('pointermove', handlePointerMove, { passive: true });
    hostElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    async function init3D(host: HTMLElement) {
      try {
        const stage = createStage(host);
        stageRef.current = stage;

        stage.setOrbitEnabled(false);

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

        // Precompute screen frame at flat-open position so overlay has pixel-perfect dimensions immediately
        foldable.setOpenness(1.0);
        stage.applyView({ distance: 36.5, pitch: 1.51, yaw: 0 });
        stage.render();
        reportScreenFrame(stage.camera);

        // Restore initial state
        const initialOpen = opennessRef.current;
        foldable.setOpenness(initialOpen);
        foldable.setNotifPop(notifPopRef.current);
        foldable.setUnlock(unlockRef.current);
        foldable.warmUp();

        await stage.renderer.compileAsync(stage.scene, stage.camera);

        if (isDisposed) {
          stage.dispose();
          return;
        }

        setIsLoaded(true);
        onLoadedRef.current?.();

        let prevTime = performance.now();
        const renderLoop = (time: number) => {
          if (isDisposed) return;
          const delta = Math.min((time - prevTime) / 1000, 1 / 30);
          prevTime = time;

          const currentOpen = opennessRef.current;
          foldable.setOpenness(currentOpen);
          foldable.setNotifPop(notifPopRef.current);
          foldable.setUnlock(unlockRef.current);
          foldable.advanceBlend(delta);

          // Pointer parallax damping
          const ease = 0.08;
          pointerCurrentRef.current.x +=
            (pointerTargetRef.current.x - pointerCurrentRef.current.x) * ease;
          pointerCurrentRef.current.y +=
            (pointerTargetRef.current.y - pointerCurrentRef.current.y) * ease;

          const parallaxYaw = pointerCurrentRef.current.x * 0.05;
          const parallaxPitch = -pointerCurrentRef.current.y * 0.035;

          // Camera framing based on openness:
          // When closed: slight yaw to catch titanium spine rim light
          // When open: flat front-on framing
          const baseYaw = -0.10 * (1 - currentOpen);
          const targetYaw = baseYaw + parallaxYaw;
          const targetDistance = MathUtils.lerp(35.0, 36.5, currentOpen);
          const targetPitch = MathUtils.lerp(1.57, 1.51, currentOpen) + parallaxPitch;

          stage.applyView({
            distance: targetDistance,
            pitch: targetPitch,
            yaw: targetYaw,
          });

          stage.render();
          foldable.render(stage.renderer);

          if (currentOpen >= 0.85) {
            reportScreenFrame(stage.camera);
          }

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
      hostElement.removeEventListener('pointermove', handlePointerMove);
      hostElement.removeEventListener('pointerleave', handlePointerLeave);
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

export default IPhoneDuoViewer;
