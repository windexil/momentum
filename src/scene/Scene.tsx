import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
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
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [9.6, 7.9, 9.6], fov: 36, near: 0.1, far: 80 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
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
