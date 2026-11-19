// Персонаж в «пластилиновом» чиби-стиле: большая голова, худи с капюшоном,
// круглые формы. Одежда, цвета и наушники настраиваются (src/avatar.ts).
// Анимации процедурные: ожидание, ходьба, посадка, наушники, покачивание в такт.

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { moodOf, useAvatar, type Mood } from "../avatar";
import { useStore } from "../store";
import { CHAIR, SIDE_TABLE } from "./Room";
import { SoundWaves, Waveform } from "./SoundFx";
import { live } from "./live";

export const HOME = new THREE.Vector3(1.4, 0, -1.4);
const CHAIR_FRONT = new THREE.Vector3(CHAIR.x + Math.sin(CHAIR.rot) * 0.95, 0, CHAIR.z + Math.cos(CHAIR.rot) * 0.95);
const CHAIR_SEAT = new THREE.Vector3(CHAIR.x + Math.sin(CHAIR.rot) * 0.12, 0, CHAIR.z + Math.cos(CHAIR.rot) * 0.12);
const HP_REST = new THREE.Vector3(SIDE_TABLE.x, 0.67, SIDE_TABLE.z);

/** Общее состояние персонажа: по нему ориентируется питомец. */
export const hero = {
  pos: HOME.clone(),
  rot: Math.PI / 4,
  sub: "idle" as Sub,
  listening: false,
};
type Sub = "idle" | "toChair" | "turn" | "sit" | "wear" | "listen" | "unwear" | "stand" | "toHome";

// Пропорции чиби
const HIP_Y = 0.5;
const HEAD_Y = 1.3;
const HEAD_R = 0.3;
const SIT_LIFT = 0.17; // таз поднимается на подушку кресла

const WALK_SPEED = 1.3;
const smooth = (t: number) => t * t * (3 - 2 * t);
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleTo = (from: number, to: number) => ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

const clay = (color: string, rough = 0.62) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

export function Character() {
  const avatar = useAvatar((s) => s.avatar);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const thighL = useRef<THREE.Group>(null);
  const thighR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const headphones = useRef<THREE.Group>(null);
  const headAnchor = useRef<THREE.Object3D>(null);
  const eyes = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const smile = useRef<THREE.Mesh>(null);
  const frown = useRef<THREE.Mesh>(null);
  const openMouth = useRef<THREE.Mesh>(null);
  const waveAnchor = useRef<THREE.Group>(null);

  const st = useMemo(
    () => ({ pos: HOME.clone(), rot: Math.PI / 4, walk: 0, moving: 0, sit: 0, hp: 0, hold: 0, sub: "idle" as Sub, blink: 0, nextBlink: 2 }),
    [],
  );

  const mats = useMemo(
    () => ({
      skin: clay(DEFAULT.skin, 0.55),
      blush: new THREE.MeshBasicMaterial({ color: "#ff8a8a", transparent: true, opacity: 0.45, depthWrite: false }),
      hair: clay(DEFAULT.hair, 0.5),
      top: clay(DEFAULT.top, 0.75),
      topDark: clay(DEFAULT.top, 0.75),
      string: clay("#fdf8f0", 0.6),
      pants: clay(DEFAULT.pants, 0.7),
      shoes: clay(DEFAULT.shoes, 0.5),
      sole: clay("#fdf8f0", 0.5),
      eye: new THREE.MeshStandardMaterial({ color: "#1d1a1a", roughness: 0.2 }),
      white: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      mouth: clay("#5a2a22", 0.6),
      hp: clay(DEFAULT.hp, 0.35),
      hpPad: new THREE.MeshStandardMaterial({ color: DEFAULT.pad, roughness: 0.55, emissive: DEFAULT.pad, emissiveIntensity: 0 }),
      earInner: clay("#ffb3c7", 0.6),
    }),
    [],
  );

  // Цвета из настроек
  useEffect(() => {
    mats.skin.color.set(avatar.skinColor);
    mats.hair.color.set(avatar.hairColor);
    mats.top.color.set(avatar.topColor);
    mats.topDark.color.set(avatar.topColor).multiplyScalar(0.82);
    mats.pants.color.set(avatar.pantsColor);
    mats.shoes.color.set(avatar.shoesColor);
    mats.hp.color.set(avatar.headphonesColor);
    mats.hpPad.color.set(avatar.padsColor);
    mats.hpPad.emissive.set(avatar.padsColor);
  }, [avatar, mats]);

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const headWorld = useMemo(() => new THREE.Vector3(), []);
  const headQuat = useMemo(() => new THREE.Quaternion(), []);
  const restQuat = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.4)), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const { phase, setPhase, active } = useStore.getState();

    if (phase === "walking" && (st.sub === "idle" || st.sub === "toHome")) st.sub = "toChair";
    if (phase === "unwinding" && (st.sub === "listen" || st.sub === "wear" || st.sub === "sit")) st.sub = "unwear";
    if (phase === "idle" && !["idle", "toHome", "stand", "unwear"].includes(st.sub)) st.sub = "unwear";

    let moveTarget: THREE.Vector3 | null = null;
    let faceAngle: number | null = null;

    switch (st.sub) {
      case "toChair":
        moveTarget = CHAIR_FRONT;
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
        if (phase === "walking") setPhase("listening"); // другое воспоминание, не вставая
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
        faceAngle = Math.PI / 4 + Math.sin(t * 0.3) * 0.25;
        break;
    }

    let moving = 0;
    if (moveTarget) {
      tmpV.copy(moveTarget).sub(st.pos);
      tmpV.y = 0;
      const dist = tmpV.length();
      if (dist > 0.04) {
        st.rot += angleTo(st.rot, Math.atan2(tmpV.x, tmpV.z)) * (1 - Math.exp(-10 * dt));
        st.pos.addScaledVector(tmpV.normalize(), Math.min(dist, WALK_SPEED * dt));
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
    st.walk += dt * 10 * st.moving;

    const sitE = smooth(st.sit);
    const r = root.current!;
    r.position.set(THREE.MathUtils.lerp(st.pos.x, CHAIR_SEAT.x, sitE), 0, THREE.MathUtils.lerp(st.pos.z, CHAIR_SEAT.z, sitE));
    r.rotation.y = st.rot;
    hero.pos.copy(r.position);
    hero.rot = st.rot;
    hero.sub = st.sub;
    hero.listening = st.sub === "listen";

    // Поза
    const listening = st.sub === "listen";
    const swing = Math.sin(st.walk) * 0.6 * st.moving;
    const breathe = Math.sin(t * 1.8) * 0.01;
    const beat = Math.PI * 2 * (0.8 + live.animSpeed * 0.6);
    const groove = listening ? Math.sin(t * beat) * (0.05 + live.level * 0.14) : 0;

    body.current!.position.y = sitE * SIT_LIFT + Math.abs(Math.sin(st.walk)) * 0.05 * st.moving + breathe;
    body.current!.rotation.z = groove * 0.35;
    thighL.current!.rotation.x = THREE.MathUtils.lerp(swing, -Math.PI / 2, sitE);
    thighR.current!.rotation.x = THREE.MathUtils.lerp(-swing, -Math.PI / 2, sitE);
    // при сидении ноги болтаются в такт
    const dangle = listening ? Math.sin(t * beat * 0.5) * 0.25 : 0;
    shinL.current!.rotation.x = THREE.MathUtils.lerp(Math.max(0, -Math.sin(st.walk)) * 0.8 * st.moving, Math.PI / 2 - 0.25 + dangle, sitE);
    shinR.current!.rotation.x = THREE.MathUtils.lerp(Math.max(0, Math.sin(st.walk)) * 0.8 * st.moving, Math.PI / 2 - 0.25 - dangle, sitE);

    // Руки: тянутся к голове, пока надеваются/снимаются наушники; во время
    // прослушивания придерживают наушники, как на референсе
    const reaching = st.hp > 0.02 && st.hp < 0.98 ? Math.sin(st.hp * Math.PI) : 0;
    st.hold = damp(st.hold, listening ? 1 : 0, 6, dt);
    const h = st.hold;
    const armRest = THREE.MathUtils.lerp(0, -0.35, sitE);
    const free = 1 - Math.max(reaching, h);
    // reaching: руки вперёд-вверх к голове; hold: локти в стороны, ладони у чашек
    armL.current!.rotation.x = -swing * 0.9 * free + armRest * free - reaching * 2.75 - h * 0.25;
    armR.current!.rotation.x = swing * 0.9 * free + armRest * free - reaching * 2.75 - h * 0.25;
    armL.current!.rotation.z = -0.25 - reaching * 0.2 - h * 1.65 + groove * 0.4;
    armR.current!.rotation.z = 0.25 + reaching * 0.2 + h * 1.65 + groove * 0.4;
    foreL.current!.rotation.x = -reaching * 0.9;
    foreR.current!.rotation.x = -reaching * 0.9;
    foreL.current!.rotation.z = -h * 1.6;
    foreR.current!.rotation.z = h * 1.6;

    head.current!.rotation.x = groove * 1.1 + (listening ? -0.06 : 0);
    head.current!.rotation.z = groove * 0.7;
    head.current!.rotation.y = st.sub === "idle" ? Math.sin(t * 0.5) * 0.15 : 0;

    // Мимика
    const mood: Mood = listening ? moodOf(active?.atmosphere) : "happy";
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) {
      st.blink = 0.14;
      st.nextBlink = 2.5 + Math.random() * 3;
    }
    st.blink = Math.max(0, st.blink - dt);
    const closed = mood === "sleepy" ? 0.12 : st.blink > 0 ? 0.1 : 1;
    eyes.current!.scale.y = damp(eyes.current!.scale.y, closed, 18, dt);
    const browTilt = mood === "sad" ? 0.35 : mood === "playful" ? -0.15 : 0;
    browL.current!.rotation.z = damp(browL.current!.rotation.z, -browTilt, 8, dt);
    browR.current!.rotation.z = damp(browR.current!.rotation.z, browTilt, 8, dt);
    smile.current!.visible = mood === "happy" || mood === "sleepy";
    frown.current!.visible = mood === "sad";
    openMouth.current!.visible = mood === "playful";
    openMouth.current!.scale.y = 0.8 + live.level * 0.8;

    // Наушники: со столика на голову
    headAnchor.current!.getWorldPosition(headWorld);
    headAnchor.current!.getWorldQuaternion(headQuat);
    const hpE = smooth(st.hp);
    const hp = headphones.current!;
    hp.position.lerpVectors(HP_REST, headWorld, hpE);
    hp.position.y += Math.sin(st.hp * Math.PI) * 0.35;
    hp.quaternion.slerpQuaternions(restQuat, headQuat, hpE);
    hp.scale.setScalar(THREE.MathUtils.lerp(0.75, 1, hpE));
    mats.hpPad.emissiveIntensity = listening ? 0.25 + live.level * 1.2 : 0;

    // Дорожка над головой
    waveAnchor.current!.position.set(headWorld.x, headWorld.y + 0.62, headWorld.z);
  });

  const isHoodie = avatar.top === "hoodie";
  const longSleeves = avatar.top !== "tshirt";

  return (
    <>
      <group ref={root} position={HOME.toArray()}>
        <group ref={body}>
          {/* ноги */}
          {([[thighL, shinL, -0.11], [thighR, shinR, 0.11]] as const).map(([thigh, shin, x], i) => (
            <group key={i} ref={thigh} position={[x, HIP_Y, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow material={mats.pants}>
                <capsuleGeometry args={[0.1, 0.12, 6, 12]} />
              </mesh>
              <group ref={shin} position={[0, -0.22, 0]}>
                <mesh position={[0, -0.09, 0]} castShadow material={mats.pants}>
                  <capsuleGeometry args={[0.095, 0.1, 6, 12]} />
                </mesh>
                {/* подвёрнутая штанина */}
                <mesh position={[0, -0.16, 0]} material={mats.pants}>
                  <torusGeometry args={[0.095, 0.03, 8, 16]} />
                </mesh>
                {/* кроссовок */}
                <group position={[0, -0.24, 0.04]}>
                  <mesh castShadow material={mats.shoes} scale={[1, 0.7, 1.35]}>
                    <sphereGeometry args={[0.11, 16, 12]} />
                  </mesh>
                  <mesh position={[0, -0.05, 0]} material={mats.sole} scale={[1.02, 0.25, 1.38]}>
                    <sphereGeometry args={[0.11, 16, 8]} />
                  </mesh>
                </group>
              </group>
            </group>
          ))}

          {/* корпус */}
          <mesh position={[0, 0.74, 0]} castShadow material={mats.top} scale={[1, 1, 0.82]}>
            <capsuleGeometry args={[0.24, 0.24, 8, 18]} />
          </mesh>
          {/* пояс кофты */}
          <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} scale={[1, 0.82, 1]} material={avatar.top === "tshirt" ? mats.top : mats.topDark}>
            <torusGeometry args={[0.235, 0.035, 8, 24]} />
          </mesh>
          {isHoodie && (
            <>
              {/* карман-кенгуру */}
              <mesh position={[0, 0.62, 0.19]} rotation-x={-0.12} material={mats.topDark} scale={[1, 0.6, 0.25]}>
                <sphereGeometry args={[0.16, 16, 10]} />
              </mesh>
              {/* шнурки */}
              {[-0.06, 0.06].map((x) => (
                <group key={x} position={[x, 0.86, 0.2]}>
                  <mesh position={[0, -0.07, 0]} material={mats.string}>
                    <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
                  </mesh>
                  <mesh position={[0, -0.15, 0]} material={mats.string}>
                    <sphereGeometry args={[0.02, 8, 6]} />
                  </mesh>
                </group>
              ))}
            </>
          )}
          {avatar.top === "sweater" && (
            // воротник-стойка и «косы» вязки
            <>
              <mesh position={[0, 0.97, 0]} rotation-x={Math.PI / 2} material={mats.topDark}>
                <torusGeometry args={[0.12, 0.045, 8, 20]} />
              </mesh>
              {[-0.09, 0, 0.09].map((x) => (
                <mesh key={x} position={[x, 0.72, 0.195]} material={mats.topDark} scale={[0.5, 3, 0.4]}>
                  <sphereGeometry args={[0.04, 8, 8]} />
                </mesh>
              ))}
            </>
          )}
          {avatar.top === "tshirt" && (
            <mesh position={[0, 0.96, 0.02]} rotation-x={Math.PI / 2 - 0.3} material={mats.topDark}>
              <torusGeometry args={[0.11, 0.02, 6, 20]} />
            </mesh>
          )}

          {/* руки: плечо + предплечье */}
          {([[armL, foreL, -0.27], [armR, foreR, 0.27]] as const).map(([arm, fore, x], i) => (
            <group key={i} ref={arm} position={[x, 0.9, 0]}>
              <mesh position={[0, -0.09, 0]} castShadow material={mats.top}>
                <capsuleGeometry args={[0.085, 0.1, 6, 12]} />
              </mesh>
              {!longSleeves && (
                <mesh position={[0, -0.15, 0]} material={mats.topDark} rotation-x={Math.PI / 2}>
                  <torusGeometry args={[0.085, 0.018, 6, 14]} />
                </mesh>
              )}
              <group ref={fore} position={[0, -0.19, 0]}>
                <mesh position={[0, -0.08, 0]} castShadow material={longSleeves ? mats.top : mats.skin}>
                  <capsuleGeometry args={[longSleeves ? 0.08 : 0.065, 0.08, 6, 12]} />
                </mesh>
                {longSleeves && (
                  <mesh position={[0, -0.15, 0]} rotation-x={Math.PI / 2} material={mats.topDark}>
                    <torusGeometry args={[0.065, 0.022, 6, 14]} />
                  </mesh>
                )}
                <mesh position={[0, -0.2, 0]} castShadow material={mats.skin}>
                  <sphereGeometry args={[0.075, 14, 12]} />
                </mesh>
              </group>
            </group>
          ))}

          {/* голова */}
          <group ref={head} position={[0, 0.98, 0]}>
            <mesh position={[0, HEAD_Y - 0.98, 0]} castShadow material={mats.skin} scale={[1.05, 0.95, 0.95]}>
              <sphereGeometry args={[HEAD_R, 32, 24]} />
            </mesh>
            {/* причёска: «шапочка» и чёлка */}
            <mesh position={[0, HEAD_Y - 0.98 + 0.05, -0.02]} scale={[1.09, 0.95, 1.03]} castShadow material={mats.hair}>
              <sphereGeometry args={[HEAD_R, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            </mesh>
            {[-0.17, -0.06, 0.06, 0.17].map((x, i) => (
              <mesh key={x} position={[x, HEAD_Y - 0.98 + 0.16 - (i % 3 === 0 ? 0.02 : 0), 0.22]} rotation-z={x * -1.5} material={mats.hair} scale={[1.1, 0.8, 0.7]}>
                <sphereGeometry args={[0.09, 12, 10]} />
              </mesh>
            ))}
            {/* лицо */}
            <group position={[0, HEAD_Y - 0.98, 0]}>
              <group ref={eyes} position={[0, 0.0, 0]}>
                {[-0.1, 0.1].map((x) => (
                  <group key={x} position={[x, 0, 0.27]}>
                    <mesh material={mats.eye} scale={[0.75, 1, 0.5]}>
                      <sphereGeometry args={[0.045, 14, 12]} />
                    </mesh>
                    <mesh position={[0.012, 0.016, 0.02]} material={mats.white}>
                      <sphereGeometry args={[0.011, 8, 6]} />
                    </mesh>
                  </group>
                ))}
              </group>
              <mesh ref={browL} position={[-0.1, 0.085, 0.272]} material={mats.hair}>
                <capsuleGeometry args={[0.009, 0.045, 4, 6]} />
              </mesh>
              <mesh ref={browR} position={[0.1, 0.085, 0.272]} material={mats.hair}>
                <capsuleGeometry args={[0.009, 0.045, 4, 6]} />
              </mesh>
              {/* щёки */}
              {[-0.17, 0.17].map((x) => (
                <mesh key={x} position={[x, -0.07, 0.235]} rotation-y={x * 2.2} material={mats.blush}>
                  <circleGeometry args={[0.045, 16]} />
                </mesh>
              ))}
              {/* рот: улыбка / грусть / «о» */}
              <mesh ref={smile} position={[0, -0.075, 0.272]} rotation-z={Math.PI} material={mats.mouth}>
                <torusGeometry args={[0.04, 0.01, 6, 16, Math.PI]} />
              </mesh>
              <mesh ref={frown} position={[0, -0.11, 0.268]} material={mats.mouth}>
                <torusGeometry args={[0.032, 0.009, 6, 16, Math.PI]} />
              </mesh>
              <mesh ref={openMouth} position={[0, -0.09, 0.27]} material={mats.mouth} scale={[1, 1, 0.4]}>
                <sphereGeometry args={[0.032, 12, 10]} />
              </mesh>
            </group>
            {/* капюшон обрамляет лицо */}
            {isHoodie && (
              <group position={[0, HEAD_Y - 0.98, -0.01]}>
                <mesh castShadow scale={[1.08, 1.06, 1.02]}>
                  <sphereGeometry args={[HEAD_R + 0.06, 28, 20, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9]} />
                  <meshStandardMaterial attach="material" color={avatar.topColor} roughness={0.75} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, -0.02, 0.13]} rotation-x={-0.25} material={mats.topDark} scale={[1.08, 1.06, 1]}>
                  <torusGeometry args={[0.285, 0.035, 10, 32, Math.PI * 1.25]} />
                </mesh>
              </group>
            )}
            <object3D ref={headAnchor} position={[0, HEAD_Y - 0.98 + 0.02, 0]} />
          </group>
        </group>
      </group>

      {/* наушники живут в мировых координатах и «перелетают» на голову */}
      <group ref={headphones}>
        <mesh position={[0, 0.02, 0]} castShadow material={mats.hp}>
          <torusGeometry args={[HEAD_R + 0.07, 0.035, 10, 32, Math.PI]} />
        </mesh>
        {avatar.headphones === "cat" &&
          [-1, 1].map((s) => (
            <group key={s} position={[s * 0.25, 0.33, 0.02]} rotation-z={-s * 0.5} scale={1.35}>
              <mesh castShadow material={mats.hp}>
                <coneGeometry args={[0.09, 0.17, 4]} />
              </mesh>
              <mesh position={[0, -0.01, 0.035]} material={mats.earInner} scale={[0.6, 0.65, 0.4]}>
                <coneGeometry args={[0.09, 0.17, 4]} />
              </mesh>
            </group>
          ))}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (HEAD_R + 0.07), -0.04, 0]}>
            <mesh rotation-z={Math.PI / 2} castShadow material={mats.hp}>
              <cylinderGeometry args={[0.12, 0.12, 0.1, 24]} />
            </mesh>
            <mesh position={[-s * 0.055, 0, 0]} rotation-z={Math.PI / 2} material={mats.hpPad}>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 24]} />
            </mesh>
            <mesh position={[s * 0.055, 0, 0]} rotation-z={Math.PI / 2} material={mats.hpPad}>
              <cylinderGeometry args={[0.07, 0.07, 0.02, 20]} />
            </mesh>
            <SoundWaves side={s} />
          </group>
        ))}
      </group>

      <group ref={waveAnchor}>
        <Waveform />
      </group>
    </>
  );
}

const DEFAULT = { skin: "#f6d3b5", hair: "#2b2220", top: "#f28c28", pants: "#3f6fb5", shoes: "#f28c28", hp: "#2b2b31", pad: "#f28c28" };
