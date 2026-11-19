import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";
import { Album3D } from "./Album3D";
import { AtmosphereRig } from "./AtmosphereRig";
import { Character } from "./Character";
import { Particles } from "./Particles";
import { Pet } from "./Pet";
import { Room } from "./Room";

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [8.6, 7.4, 8.6], fov: 36, near: 0.1, far: 80 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <Suspense fallback={null}>
        <AtmosphereRig />
        <Room />
        <Album3D />
        <Character />
        <Pet />
        <Particles />
        <ContactShadows position={[0, 0.005, 0]} scale={9} blur={2.4} opacity={0.35} far={2} resolution={512} />
      </Suspense>
      <OrbitControls
        target={[-0.2, 1.0, -0.4]}
        enablePan={false}
        minDistance={4.5}
        maxDistance={16}
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
