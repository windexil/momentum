// Невидимые зоны для клика/тапа: пол (идти), кресло (сесть),
// кровать (лечь), столик с наушниками (взять/надеть). Плюс лёгкое
// приближение камеры во время музыки (сама камера за персонажем не ездит).

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { hero } from "./Character";
import { control, heroCmd } from "./heroControl";
import { CHAIR, ROOM, SIDE_TABLE } from "./Room";

const ghost = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

function tap(fn: (e: ThreeEvent<MouseEvent>) => void) {
  return (e: ThreeEvent<MouseEvent>) => {
    // отличаем клик от поворота камеры
    if (e.delta > 6) return;
    e.stopPropagation();
    fn(e);
  };
}
const hover = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  },
  onPointerOut: () => {
    document.body.style.cursor = "";
  },
};

export function Interact() {
  return (
    <group>
      <mesh
        position={[0, 0.003, 0]}
        rotation-x={-Math.PI / 2}
        material={ghost}
        onClick={tap((e) => heroCmd.walkTo(e.point))}
      >
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
      </mesh>
      <mesh position={[CHAIR.x, 0.55, CHAIR.z]} rotation-y={CHAIR.rot} material={ghost} onClick={tap(() => heroCmd.sit())} {...hover}>
        <boxGeometry args={[1.2, 1.1, 1.1]} />
      </mesh>
      <mesh position={[-2.85, 0.5, -2.3]} material={ghost} onClick={tap(() => heroCmd.lie())} {...hover}>
        <boxGeometry args={[1.95, 1.0, 3.1]} />
      </mesh>
      <mesh
        position={[SIDE_TABLE.x, 0.65, SIDE_TABLE.z]}
        material={ghost}
        onClick={tap(() => (control.hp === "table" ? heroCmd.takeHp() : control.hp === "neck" ? heroCmd.wearHp() : heroCmd.removeHp()))}
        {...hover}
      >
        <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
      </mesh>
    </group>
  );
}

/** Камера чуть приближается, когда играет музыка, и возвращается обратно. */
export function CameraZoom() {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3; update: () => void } | null };
  const off = useMemo(() => new THREE.Vector3(), []);
  const zoom = useRef({ listening: false, goal: null as number | null, before: 0 });

  useFrame((_, rawDt) => {
    if (!controls) return;
    const dt = Math.min(rawDt, 0.05);
    const z = zoom.current;
    off.subVectors(camera.position, controls.target);
    const dist = off.length();
    if (hero.listening !== z.listening) {
      z.listening = hero.listening;
      if (hero.listening) {
        z.before = dist;
        z.goal = Math.max(5.2, dist * 0.82);
      } else z.goal = z.before || null;
    }
    if (z.goal !== null) {
      const nd = dist + (z.goal - dist) * (1 - Math.exp(-1.2 * dt));
      camera.position.copy(controls.target).addScaledVector(off.normalize(), nd);
      if (Math.abs(nd - z.goal) < 0.03) z.goal = null;
      controls.update();
    }
  });
  return null;
}
