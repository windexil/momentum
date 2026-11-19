// Невидимые зоны для клика/тапа: пол (идти), кресло (сесть),
// кровать (лечь), столик с наушниками (взять/надеть). Плюс лёгкое
// приближение камеры во время музыки (сама камера за персонажем не ездит).

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { hero } from "./Character";
import { control, heroCmd } from "./heroControl";
import { CHAIR, DESK, ROOM, ROOM_X, ROOM_Z, SIDE_TABLE } from "./Room";

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
  // белая метка в точке, куда идёт персонаж
  const marker = useRef<THREE.Mesh>(null);
  const markerT = useRef(0);
  const markMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }), []);
  const dot = useRef<THREE.Mesh>(null);
  const dotMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }), []);

  useFrame((_, dt) => {
    const m = marker.current!;
    // метка держится, пока персонаж идёт, и гаснет, когда он дошёл
    const walking = control.queue.some((s) => s.k === "goto" && s.to === target.current);
    markerT.current = walking ? Math.min(1, markerT.current + dt * 4) : Math.max(0, markerT.current - dt * 1.5);
    const k = markerT.current;
    markMat.opacity = k * 0.85;
    dotMat.opacity = k * 0.35;
    const pulse = 1 + Math.sin(performance.now() / 260) * 0.08;
    m.scale.setScalar(pulse * (0.7 + k * 0.3));
    dot.current!.position.copy(m.position);
  });
  const target = useRef<THREE.Vector3 | null>(null);

  return (
    <group>
      <mesh
        position={[0, 0.003, 0]}
        rotation-x={-Math.PI / 2}
        material={ghost}
        onClick={tap((e) => {
          heroCmd.walkTo(e.point);
          const step = control.queue.find((s) => s.k === "goto");
          target.current = step && step.k === "goto" ? step.to : null;
          if (target.current) marker.current!.position.set(target.current.x, 0.02, target.current.z);
        })}
      >
        <planeGeometry args={[(ROOM_X + ROOM) * 2, (ROOM_Z + ROOM) * 2]} />
      </mesh>
      <mesh ref={marker} rotation-x={-Math.PI / 2} material={markMat}>
        <ringGeometry args={[0.14, 0.2, 40]} />
      </mesh>
      <mesh ref={dot} rotation-x={-Math.PI / 2} material={dotMat}>
        <circleGeometry args={[0.14, 32]} />
      </mesh>
      <mesh position={[CHAIR.x, 0.55, CHAIR.z]} rotation-y={CHAIR.rot} material={ghost} onClick={tap(() => heroCmd.sit())} {...hover}>
        <boxGeometry args={[1.2, 1.1, 1.1]} />
      </mesh>
      <mesh position={[-2.85, 0.5, -2.3]} material={ghost} onClick={tap(() => heroCmd.lie())} {...hover}>
        <boxGeometry args={[1.95, 1.0, 3.1]} />
      </mesh>
      {/* столик: наушники и кружка какао */}
      <mesh
        position={[SIDE_TABLE.x - 0.06, 0.66, SIDE_TABLE.z - 0.1]}
        material={ghost}
        onClick={tap(() => (control.hp === "table" ? heroCmd.takeHp() : control.hp === "neck" ? heroCmd.wearHp() : heroCmd.removeHp()))}
        {...hover}
      >
        <boxGeometry args={[0.5, 0.22, 0.38]} />
      </mesh>
      <mesh position={[SIDE_TABLE.x + 0.15, 0.68, SIDE_TABLE.z + 0.14]} material={ghost} onClick={tap(() => heroCmd.drink())} {...hover}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
      </mesh>
      {/* стол и стул: сесть за стол (альбом на столешнице кликается отдельно) */}
      <mesh position={[DESK.x - 0.1, 0.5, DESK.z + 0.75]} material={ghost} onClick={tap(() => heroCmd.desk())} {...hover}>
        <boxGeometry args={[0.6, 1.0, 0.6]} />
      </mesh>
      <mesh position={[DESK.x, 0.36, DESK.z]} material={ghost} onClick={tap(() => heroCmd.desk())}>
        <boxGeometry args={[2.0, 0.72, 0.85]} />
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
