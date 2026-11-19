// Персонаж из простых форм с процедурными анимациями:
// ожидание, ходьба, посадка в кресло, надевание и снятие наушников.
// Логика — маленький конечный автомат поверх фаз из стора.

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../store";
import { CHAIR, SIDE_TABLE } from "./Room";
import { live } from "./live";

const HOME = new THREE.Vector3(1.4, 0, -1.4);
const CHAIR_FRONT = new THREE.Vector3(
  CHAIR.x + Math.sin(CHAIR.rot) * 0.95,
  0,
  CHAIR.z + Math.cos(CHAIR.rot) * 0.95,
);
const CHAIR_SEAT = new THREE.Vector3(CHAIR.x + Math.sin(CHAIR.rot) * 0.08, 0, CHAIR.z + Math.cos(CHAIR.rot) * 0.08);
const HP_REST = new THREE.Vector3(SIDE_TABLE.x, 0.66, SIDE_TABLE.z);

const WALK_SPEED = 1.5;
const smooth = (t: number) => t * t * (3 - 2 * t);
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
function angleTo(from: number, to: number) {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export function Character() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const thighL = useRef<THREE.Group>(null);
  const thighR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const headphones = useRef<THREE.Group>(null);
  const headAnchor = useRef<THREE.Object3D>(null);

  const st = useMemo(
    () => ({
      pos: HOME.clone(),
      rot: -Math.PI * 0.75,
      walk: 0,
      moving: 0,
      sit: 0, // 0 стоит, 1 сидит
      hp: 0, // 0 наушники на столике, 1 на голове
      sub: "idle" as "idle" | "toChair" | "turn" | "sit" | "wear" | "listen" | "unwear" | "stand" | "toHome",
      wait: 0,
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: "#f2c9a5", roughness: 0.7 }),
      hair: new THREE.MeshStandardMaterial({ color: "#3b2a22", roughness: 0.8 }),
      shirt: new THREE.MeshStandardMaterial({ color: "#f4a259", roughness: 0.8 }),
      pants: new THREE.MeshStandardMaterial({ color: "#3d5a80", roughness: 0.8 }),
      shoes: new THREE.MeshStandardMaterial({ color: "#2b2d42", roughness: 0.6 }),
      hp: new THREE.MeshStandardMaterial({ color: "#2b2b31", roughness: 0.4, metalness: 0.3 }),
      hpPad: new THREE.MeshStandardMaterial({ color: "#e76f51", roughness: 0.6, emissive: "#e76f51", emissiveIntensity: 0 }),
    }),
    [],
  );

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const headWorld = useMemo(() => new THREE.Vector3(), []);
  const headQuat = useMemo(() => new THREE.Quaternion(), []);
  const restQuat = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.3)), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const { phase, setPhase } = useStore.getState();

    // Синхронизация с фазами стора
    if (phase === "walking" && (st.sub === "idle" || st.sub === "toHome")) st.sub = "toChair";
    if (phase === "unwinding" && (st.sub === "listen" || st.sub === "wear" || st.sub === "sit")) st.sub = "unwear";
    if (phase === "walking" && st.sub === "listen") st.sub = "listen"; // смена воспоминания в кресле
    if (phase === "idle" && st.sub !== "idle" && st.sub !== "toHome" && st.sub !== "stand" && st.sub !== "unwear") st.sub = "unwear";

    let moveTarget: THREE.Vector3 | null = null;
    let faceAngle: number | null = null;

    switch (st.sub) {
      case "toChair":
        moveTarget = st.sit > 0.01 ? null : CHAIR_FRONT;
        if (st.sit > 0.01) st.sub = "wear"; // уже сидим — сразу к наушникам
        break;
      case "turn":
        faceAngle = CHAIR.rot;
        if (Math.abs(angleTo(st.rot, CHAIR.rot)) < 0.05) st.sub = "sit";
        break;
      case "sit":
        faceAngle = CHAIR.rot;
        st.sit = Math.min(1, st.sit + dt / 0.9);
        if (st.sit >= 1) {
          st.sub = "wear";
          setPhase("sitting");
        }
        break;
      case "wear":
        faceAngle = CHAIR.rot;
        st.hp = Math.min(1, st.hp + dt / 1.3);
        if (st.hp >= 1) {
          st.sub = "listen";
          setPhase("listening");
        }
        break;
      case "listen":
        faceAngle = CHAIR.rot;
        if (phase === "walking") {
          // выбрали другое воспоминание, не вставая
          setPhase("listening");
        }
        break;
      case "unwear":
        faceAngle = CHAIR.rot;
        st.hp = Math.max(0, st.hp - dt / 1.2);
        if (st.hp <= 0) st.sub = st.sit > 0 ? "stand" : "toHome";
        break;
      case "stand":
        faceAngle = CHAIR.rot;
        st.sit = Math.max(0, st.sit - dt / 0.8);
        if (st.sit <= 0) st.sub = "toHome";
        break;
      case "toHome":
        moveTarget = HOME;
        break;
      case "idle":
        faceAngle = -Math.PI * 0.75 + Math.sin(t * 0.3) * 0.15;
        break;
    }

    // Ходьба
    let moving = 0;
    if (moveTarget) {
      tmpV.copy(moveTarget).sub(st.pos);
      tmpV.y = 0;
      const dist = tmpV.length();
      if (dist > 0.04) {
        const want = Math.atan2(tmpV.x, tmpV.z);
        st.rot += angleTo(st.rot, want) * (1 - Math.exp(-10 * dt));
        const step = Math.min(dist, WALK_SPEED * dt);
        st.pos.addScaledVector(tmpV.normalize(), step);
        moving = 1;
      } else if (st.sub === "toChair") {
        st.sub = "turn";
      } else if (st.sub === "toHome") {
        st.sub = "idle";
        if (useStore.getState().phase === "unwinding") setPhase("idle");
      }
    }
    if (faceAngle !== null) st.rot += angleTo(st.rot, faceAngle) * (1 - Math.exp(-6 * dt));
    st.moving = damp(st.moving, moving, 10, dt);
    st.walk += dt * 8.5 * st.moving;

    // Позиция: при посадке смещаемся к сиденью
    const sitE = smooth(st.sit);
    const root_ = root.current!;
    root_.position.set(
      THREE.MathUtils.lerp(st.pos.x, CHAIR_SEAT.x, sitE),
      0,
      THREE.MathUtils.lerp(st.pos.z, CHAIR_SEAT.z, sitE),
    );
    root_.rotation.y = st.rot;

    // Поза
    const swing = Math.sin(st.walk) * 0.55 * st.moving;
    const breathe = Math.sin(t * 1.6) * 0.012;
    const groove = phaseIs(st.sub, "listen") ? Math.sin(t * Math.PI * 2 * (0.9 + live.animSpeed * 0.6)) * (0.04 + live.level * 0.12) : 0;

    body.current!.position.y = THREE.MathUtils.lerp(0, -0.38, sitE) + Math.abs(Math.sin(st.walk)) * 0.04 * st.moving + breathe;
    thighL.current!.rotation.x = THREE.MathUtils.lerp(swing, -Math.PI / 2, sitE);
    thighR.current!.rotation.x = THREE.MathUtils.lerp(-swing, -Math.PI / 2, sitE);
    shinL.current!.rotation.x = THREE.MathUtils.lerp(Math.max(0, -Math.sin(st.walk)) * 0.7 * st.moving, Math.PI / 2, sitE);
    shinR.current!.rotation.x = THREE.MathUtils.lerp(Math.max(0, Math.sin(st.walk)) * 0.7 * st.moving, Math.PI / 2, sitE);

    // Руки: тянутся к голове, пока надеваются/снимаются наушники
    const reaching = st.hp > 0.02 && st.hp < 0.98 ? Math.sin(st.hp * Math.PI) : 0;
    const armRest = THREE.MathUtils.lerp(0, -0.5, sitE);
    armL.current!.rotation.x = -swing * 0.8 + armRest - reaching * 2.6;
    armR.current!.rotation.x = swing * 0.8 + armRest - reaching * 2.6;
    armL.current!.rotation.z = 0.12 + reaching * 0.35;
    armR.current!.rotation.z = -0.12 - reaching * 0.35;

    head.current!.rotation.x = groove * 1.4 + (phaseIs(st.sub, "listen") ? -0.12 : 0);
    head.current!.rotation.z = groove * 0.6;

    // Наушники: со столика на голову
    headAnchor.current!.getWorldPosition(headWorld);
    headAnchor.current!.getWorldQuaternion(headQuat);
    const hpE = smooth(st.hp);
    const hp = headphones.current!;
    hp.position.lerpVectors(HP_REST, headWorld, hpE);
    hp.position.y += Math.sin(st.hp * Math.PI) * 0.35; // дуга при переносе
    hp.quaternion.slerpQuaternions(restQuat, headQuat, hpE);
    mats.hpPad.emissiveIntensity = phaseIs(st.sub, "listen") ? 0.4 + live.level * 1.5 : 0;
  });

  return (
    <>
      <group ref={root} position={HOME.toArray()}>
        <group ref={body}>
          {/* ноги: бедро + голень, шарнир в тазу и колене */}
          {[
            [thighL, shinL, -0.12],
            [thighR, shinR, 0.12],
          ].map(([thigh, shin, x], i) => (
            <group key={i} ref={thigh as React.RefObject<THREE.Group>} position={[x as number, 0.88, 0]}>
              <mesh position={[0, -0.22, 0]} castShadow material={mats.pants}>
                <capsuleGeometry args={[0.085, 0.3, 4, 10]} />
              </mesh>
              <group ref={shin as React.RefObject<THREE.Group>} position={[0, -0.44, 0]}>
                <mesh position={[0, -0.2, 0]} castShadow material={mats.pants}>
                  <capsuleGeometry args={[0.075, 0.28, 4, 10]} />
                </mesh>
                <mesh position={[0, -0.4, 0.06]} castShadow material={mats.shoes}>
                  <boxGeometry args={[0.15, 0.08, 0.26]} />
                </mesh>
              </group>
            </group>
          ))}
          {/* корпус */}
          <mesh position={[0, 1.18, 0]} castShadow material={mats.shirt}>
            <capsuleGeometry args={[0.2, 0.42, 6, 14]} />
          </mesh>
          {/* руки */}
          {[
            [armL, -0.27],
            [armR, 0.27],
          ].map(([arm, x], i) => (
            <group key={i} ref={arm as React.RefObject<THREE.Group>} position={[x as number, 1.42, 0]}>
              <mesh position={[0, -0.25, 0]} castShadow material={mats.shirt}>
                <capsuleGeometry args={[0.065, 0.36, 4, 10]} />
              </mesh>
              <mesh position={[0, -0.5, 0]} castShadow material={mats.skin}>
                <sphereGeometry args={[0.065, 12, 10]} />
              </mesh>
            </group>
          ))}
          {/* голова */}
          <group ref={head} position={[0, 1.56, 0]}>
            <mesh position={[0, 0.03, 0]} material={mats.skin}>
              <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
            </mesh>
            <mesh position={[0, 0.2, 0]} castShadow material={mats.skin}>
              <sphereGeometry args={[0.19, 24, 18]} />
            </mesh>
            {/* волосы */}
            <mesh position={[0, 0.26, -0.03]} scale={[1.05, 0.85, 1.07]} castShadow material={mats.hair}>
              <sphereGeometry args={[0.19, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            </mesh>
            {/* глаза */}
            <mesh position={[-0.065, 0.21, 0.172]} material={mats.hair}>
              <sphereGeometry args={[0.022, 8, 8]} />
            </mesh>
            <mesh position={[0.065, 0.21, 0.172]} material={mats.hair}>
              <sphereGeometry args={[0.022, 8, 8]} />
            </mesh>
            <object3D ref={headAnchor} position={[0, 0.22, 0]} />
          </group>
        </group>
      </group>

      {/* наушники живут в мировых координатах и «перелетают» на голову */}
      <group ref={headphones}>
        <mesh position={[0, 0.06, 0]} castShadow material={mats.hp}>
          <torusGeometry args={[0.215, 0.022, 8, 24, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.215, 0.0, 0]}>
            <mesh rotation-z={Math.PI / 2} castShadow material={mats.hp}>
              <cylinderGeometry args={[0.075, 0.075, 0.06, 18]} />
            </mesh>
            <mesh position={[-s * 0.035, 0, 0]} rotation-z={Math.PI / 2} material={mats.hpPad}>
              <cylinderGeometry args={[0.06, 0.06, 0.02, 18]} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

function phaseIs(sub: string, name: string) {
  return sub === name;
}
