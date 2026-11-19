// Невидимые зоны для клика/тапа: пол (идти), кресло (сесть),
// кровать (лечь), столик с наушниками (взять/надеть), торшер.
// Плюс камера, которая следует за персонажем.

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "../store";
import * as THREE from "three";
import { hero } from "./Character";
import { control, heroCmd } from "./heroControl";
import { CHAIR, DESK, FLOOR_LAMP, ROOM, ROOM_X, ROOM_Z, SIDE_TABLE } from "./Room";

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
      {/* торшер: дёрнуть шнурок */}
      <mesh position={[FLOOR_LAMP.x, 1.0, FLOOR_LAMP.z]} material={ghost} onClick={tap(() => heroCmd.toggleLamp())} {...hover}>
        <cylinderGeometry args={[0.3, 0.3, 2.0, 12]} />
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

// Глаза персонажа, сидящего за столом, и куда он смотрит: стол и лента со снимками
const FP_EYE = new THREE.Vector3(DESK.x - 0.02, 1.5, DESK.z + 0.5);
const FP_LOOK = new THREE.Vector3(DESK.x + 0.42, 1.55, DESK.z - 0.55);
// Альбом открыт на столе: наклоняемся к нему и смотрим сверху
// камера прямо над раскрытым альбомом (чуть сдвинута к себе, чтобы верх страниц был сверху экрана)
const ALB_LOOK = new THREE.Vector3(DESK.x + 0.09, 0.9, DESK.z + 0.08);
const ALB_EYE = new THREE.Vector3(DESK.x + 0.09, 1.76, DESK.z + 0.1);
// насколько можно повернуть взгляд за столом (радианы)
const Q_DOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
// влево (к окну и кровати) можно дальше, вправо — до шкафа, чтобы не смотреть «за стену»
const YAW_LEFT = 1.1, YAW_RIGHT = 0.5, PITCH_MAX = 0.75;

/**
 * Камера следует за персонажем: точка, вокруг которой она вращается,
 * мягко едет за ним. Во время музыки камера чуть приближается.
 */
export function CameraFollow() {
  const { camera, controls, gl } = useThree() as unknown as {
    camera: THREE.Camera;
    controls: { target: THREE.Vector3; update: () => void } | null;
    gl: THREE.WebGLRenderer;
  };
  const tmp = useMemo(() => ({ goal: new THREE.Vector3(), delta: new THREE.Vector3(), off: new THREE.Vector3(), dir: new THREE.Vector3() }), []);
  // поворот взгляда за столом: тянем мышью или пальцем
  const look = useRef({ yaw: 0, pitch: 0, drag: null as null | { x: number; y: number; yaw: number; pitch: number }, album: 0 });
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      if (!hero.firstPerson) return;
      look.current.drag = { x: e.clientX, y: e.clientY, yaw: look.current.yaw, pitch: look.current.pitch };
    };
    const move = (e: PointerEvent) => {
      const d = look.current.drag;
      if (!d || !hero.firstPerson || useStore.getState().panel === "album") return;
      const k = 2.2 / Math.max(400, el.clientWidth);
      look.current.yaw = THREE.MathUtils.clamp(d.yaw - (e.clientX - d.x) * k, -YAW_RIGHT, YAW_LEFT);
      look.current.pitch = THREE.MathUtils.clamp(d.pitch + (e.clientY - d.y) * k, -PITCH_MAX, PITCH_MAX);
    };
    const up = () => {
      look.current.drag = null;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);
  const zoom = useRef({ listening: false, goal: null as number | null, before: 0 });
  // вид от первого лица за столом
  const fp = useRef({ on: false, k: 0, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 36 });

  useFrame((_, rawDt) => {
    // только для отладки: свободная камера без слежения за персонажем
    if (import.meta.env.DEV && (window as unknown as { __noFollow?: boolean }).__noFollow) return;
    if (!controls) return;
    const dt = Math.min(rawDt, 0.05);
    const cam = camera as THREE.PerspectiveCamera;
    const f = fp.current;
    const wantFp = hero.desk > 0.85;
    if (wantFp && !f.on) {
      // запоминаем, откуда смотрели, чтобы потом вернуться
      f.on = true;
      f.pos.copy(camera.position);
      f.tgt.copy(controls.target);
      f.fov = cam.fov;
      (controls as unknown as { enabled: boolean }).enabled = false;
    }
    if (f.on) {
      f.k = Math.min(1, Math.max(0, f.k + (wantFp ? dt : -dt) / 1.1));
      const e = f.k * f.k * (3 - 2 * f.k);
      const L = look.current;
      // открытый альбом: камера наклоняется к столу
      const albumOpen = wantFp && useStore.getState().panel === "album";
      L.album += ((albumOpen ? 1 : 0) - L.album) * (1 - Math.exp(-3 * dt));
      if (!wantFp || albumOpen) {
        L.yaw *= 1 - Math.min(1, dt * 4);
        L.pitch *= 1 - Math.min(1, dt * 4);
      }
      // направление взгляда с учётом поворота
      tmp.dir.subVectors(FP_LOOK, FP_EYE);
      const len = tmp.dir.length();
      tmp.dir.normalize();
      const yaw0 = Math.atan2(tmp.dir.x, tmp.dir.z) + L.yaw;
      const pitch0 = Math.asin(tmp.dir.y) - L.pitch;
      tmp.dir.set(Math.sin(yaw0) * Math.cos(pitch0), Math.sin(pitch0), Math.cos(yaw0) * Math.cos(pitch0)).multiplyScalar(len);
      const eye = tmp.off.copy(FP_EYE).lerp(ALB_EYE, L.album);
      tmp.goal.lerpVectors(f.pos, eye, e);
      camera.position.copy(tmp.goal);
      tmp.dir.add(FP_EYE).lerp(ALB_LOOK, L.album);
      tmp.delta.lerpVectors(f.tgt, tmp.dir, e);
      controls.target.copy(tmp.delta);
      cam.fov = THREE.MathUtils.lerp(f.fov, 60, e);
      cam.updateProjectionMatrix();
      camera.lookAt(controls.target);
      // над альбомом смотрим строго вниз, верх страниц — вверху экрана
      if (L.album > 0.001) camera.quaternion.slerp(Q_DOWN, L.album * e);
      hero.firstPerson = e > 0.92;
      if (!wantFp && f.k === 0) {
        f.on = false;
        hero.firstPerson = false;
        (controls as unknown as { enabled: boolean }).enabled = true;
        controls.update();
      }
      return;
    }
    tmp.goal.set(hero.pos.x, 0.85 + hero.lie * 0.15, hero.pos.z);
    tmp.delta.subVectors(tmp.goal, controls.target).multiplyScalar(1 - Math.exp(-3 * dt));
    controls.target.add(tmp.delta);
    camera.position.add(tmp.delta);

    const z = zoom.current;
    tmp.off.subVectors(camera.position, controls.target);
    const dist = tmp.off.length();
    if (hero.listening !== z.listening) {
      z.listening = hero.listening;
      if (hero.listening) {
        z.before = dist;
        z.goal = Math.max(5.2, dist * 0.82);
      } else z.goal = z.before || null;
    }
    if (z.goal !== null) {
      const nd = dist + (z.goal - dist) * (1 - Math.exp(-1.2 * dt));
      camera.position.copy(controls.target).addScaledVector(tmp.off.normalize(), nd);
      if (Math.abs(nd - z.goal) < 0.03) z.goal = null;
    }
    controls.update();
  });
  return null;
}
