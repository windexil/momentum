import { Canvas, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import { useQuality, useQualitySettings } from "./quality";
import * as THREE from "three";
import { Album3D } from "./Album3D";
import { AtmosphereRig } from "./AtmosphereRig";
import { Character } from "./Character";
import { CameraFollow, Interact } from "./Interact";
import { Particles } from "./Particles";
import { PhotoStrip } from "./PhotoStrip";
import { Pet } from "./Pet";
import { Room } from "./Room";

export function Scene() {
  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={1}
      camera={{ position: [9.6, 7.9, 9.6], fov: 36, near: 0.1, far: 80 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <QualityRig />
      <FrameLimiter />
      <Suspense fallback={null}>
        <AtmosphereRig />
        <Room />
        <Album3D />
        <PhotoStrip />
        <Character />
        <Pet />
        <Interact />
        <CameraFollow />
        <Particles />
        {import.meta.env.DEV && <DevHandle />}
      </Suspense>
      <OrbitControls
        makeDefault
        target={[0.3, 1.0, 0.1]}
        enablePan={false}
        minDistance={4.5}
        maxDistance={18}
        minPolarAngle={0.55}
        maxPolarAngle={1.25}
        minAzimuthAngle={0.15}
        maxAzimuthAngle={Math.PI / 2 - 0.15}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}

/** Только в режиме разработки: доступ к камере из консоли и тестов. */
function DevHandle() {
  const state = useThree();
  (window as unknown as { __three: unknown }).__three = state;
  return null;
}

/** Подстраивает размер кадра под качество и следит за FPS в режиме «авто». */
function QualityRig() {
  const { dpr } = useQualitySettings();
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, dpr));
  }, [dpr, setDpr]);
  const q = useQuality.getState;
  return (
    <PerformanceMonitor
      bounds={() => [28, 50]}
      flipflops={3}
      onDecline={() => q().decline()}
      onIncline={() => q().incline()}
      onFallback={() => useQuality.setState({ autoLevel: "medium" })}
    />
  );
}

/**
 * Не больше 60 кадров в секунду: на мониторах 120–165 Гц это вдвое
 * снижает нагрузку на видеокарту, а глазу разницы почти не видно.
 */
function FrameLimiter() {
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef(0);
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      id = requestAnimationFrame(tick);
      if (now - last.current >= 1000 / 60 - 2) {
        last.current = now;
        invalidate();
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [invalidate]);
  return null;
}
