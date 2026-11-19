// Альбом на столе. Клик открывает книгу (обложка поворачивается)
// и показывает развороты в интерфейсе.

import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "../store";
import { DESK } from "./Room";
import { live } from "./live";

export function Album3D() {
  const cover = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const open = useStore((s) => s.panel === "album");
  const setPanel = useStore((s) => s.setPanel);
  const phase = useStore((s) => s.phase);

  const mats = useMemo(
    () => ({
      cover: new THREE.MeshStandardMaterial({ color: "#7b3f2e", roughness: 0.6 }),
      pages: new THREE.MeshStandardMaterial({ color: "#fbf3e2", roughness: 0.9 }),
      gold: new THREE.MeshStandardMaterial({ color: "#e0b25b", roughness: 0.3, metalness: 0.7, emissive: "#e0b25b", emissiveIntensity: 0.1 }),
      glow: new THREE.MeshBasicMaterial({ color: "#ffe2a8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    }),
    [],
  );

  useFrame(({ clock }, dt) => {
    // шарнир справа: обложка поднимается вверх и ложится вправо, не задевая стол
    const target = open ? -Math.PI * 0.96 : 0;
    cover.current!.rotation.z += (target - cover.current!.rotation.z) * (1 - Math.exp(-6 * dt));
    const pulse = phase === "idle" && !open ? 0.25 + Math.sin(clock.elapsedTime * 2.2) * 0.12 : 0;
    mats.glow.opacity += ((hovered ? 0.55 : pulse) - mats.glow.opacity) * (1 - Math.exp(-8 * dt));
    mats.cover.color.set("#7b3f2e").lerp(live.palette[3], 0.25);
  });

  return (
    <group
      position={[DESK.x - 0.22, 0.8, DESK.z + 0.08]}
      rotation-y={-0.15}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        setPanel(open ? "none" : "album");
      }}
    >
      {/* ореол-подсказка */}
      <mesh ref={glow} position={[0, 0.002, 0]} rotation-x={-Math.PI / 2} material={mats.glow}>
        <planeGeometry args={[0.95, 0.75]} />
      </mesh>
      {/* задняя обложка + блок страниц */}
      <mesh position={[0, 0.012, 0]} castShadow material={mats.cover}>
        <boxGeometry args={[0.62, 0.02, 0.46]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow material={mats.pages}>
        <boxGeometry args={[0.58, 0.06, 0.43]} />
      </mesh>
      {/* корешок и обложка на шарнире справа */}
      <mesh position={[0.31, 0.048, 0]} castShadow material={mats.cover}>
        <boxGeometry args={[0.02, 0.095, 0.46]} />
      </mesh>
      <group ref={cover} position={[0.31, 0.087, 0]}>
        <mesh position={[-0.31, 0, 0]} castShadow material={mats.cover}>
          <boxGeometry args={[0.62, 0.02, 0.46]} />
        </mesh>
        <mesh position={[-0.31, 0.012, 0]} material={mats.gold}>
          <boxGeometry args={[0.3, 0.004, 0.2]} />
        </mesh>
      </group>
      {hovered && !open && (
        <Html position={[0, 0.35, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
          <div className="tag">Альбом воспоминаний</div>
        </Html>
      )}
    </group>
  );
}
