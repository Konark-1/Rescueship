import React, { useEffect, useRef, useState } from 'react';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { createStage, type Stage } from './stage/stage';
import {
  createFoldable,
  INNER_UI_DEPTH,
  INNER_UI_FRAME,
  loadModel,
  type Foldable,
} from './device/foldable';
import { loadLockScreen } from './device/screens';

export interface ScreenFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

/** 25% rig size reduction: the whole 3D phone (and its projected frame) renders at this scale. */
export const RIG_SCALE = 0.75;

interface IPhoneDuoViewerProps {
  openness: number; // 0 (closed) -> 1 (flat open)
  notifPop?: number; // 0 (hidden) -> 1 (settled WhatsApp notification on the clock plane)
  className?: string;
  style?: React.CSSProperties;
  onLoaded?: () => void;
  onScreenFrame?: (frame: ScreenFrame | null) => void;
}

export const IPhoneDuoViewer: React.FC<IPhoneDuoViewerProps> = ({
  openness,
  notifPop = 0,
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
  const onLoadedRef = useRef(onLoaded);
  const onScreenFrameRef = useRef(onScreenFrame);
  const lastFrameRef = useRef<ScreenFrame | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    onScreenFrameRef.current = onScreenFrame;
  }, [onScreenFrame]);

  // Keep refs up to date
  useEffect(() => {
    opennessRef.current = openness;
    if (foldableRef.current) {
      foldableRef.current.setOpenness(openness);
    }
  }, [openness]);

  useEffect(() => {
    notifPopRef.current = notifPop;
  }, [notifPop]);

  // Project the flat inner display quad into host pixels so HTML overlays can
  // register pixel-perfectly with the WebGL phone screen.
  const reportScreenFrame = (camera: PerspectiveCamera) => {
    const host = containerRef.current;
    const foldable = foldableRef.current;
    const callback = onScreenFrameRef.current;
    if (!host || !foldable || !callback) return;
    const currentOpen = opennessRef.current;
    if (currentOpen < 0.9) {
      if (lastFrameRef.current !== null) {
        lastFrameRef.current = null;
        callback(null);
      }
      return;
    }
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < 2 || height < 2) return;
    foldable.root.updateMatrixWorld();
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
        stage.content.scale.setScalar(RIG_SCALE);

        // Precompile shaders
        await stage.renderer.compileAsync(stage.scene, stage.camera);

        if (isDisposed) {
          stage.dispose();
          return;
        }

        // Set initial state
        foldable.setOpenness(opennessRef.current);
        foldable.setNotifPop(notifPopRef.current);
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
          foldable.setNotifPop(notifPopRef.current);
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
          reportScreenFrame(stage.camera);

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
