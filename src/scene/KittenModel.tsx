// Фигурка котёнка на столе — готовая 3D-модель (Sketchfab «Sims Cat Meme»).
// Модель подготовлена заранее: убран парящий кристалл над головой,
// сетка упрощена до ~24 тыс. треугольников, текстуры 1024px в WebP, сжатие meshopt.

import { useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import kittenUrl from "../assets/kitten.glb?url";

// высота модели в её единицах (низ −0.951 … верх 0.39)
const BOTTOM = -0.951;
const HEIGHT = 1.34;
const TARGET = 0.19; // ≈19 см на столе

function Model() {
  const { scene } = useGLTF(kittenUrl);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.side = THREE.FrontSide;
      mat.envMapIntensity = 0.9;
    });
    return o;
  }, [scene]);
  const s = TARGET / HEIGHT;
  return <primitive object={obj} scale={s} position-y={-BOTTOM * s} />;
}

export function KittenModel({ position, rotation = -0.35 }: { position: [number, number, number]; rotation?: number }) {
  return (
    // userData.dynamic: модель грузится позже комнаты, не склеиваем её со статикой
    <group position={position} rotation-y={rotation} userData={{ dynamic: true }}>
      <Suspense fallback={null}>
        <Model />
      </Suspense>
    </group>
  );
}

useGLTF.preload(kittenUrl);
