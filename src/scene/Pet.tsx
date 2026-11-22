// Домашний питомец в плюшевом чиби-стиле: кот, собака или кролик.
// Ходит за персонажем, садится у кресла, запрыгивает на кровать, когда
// персонаж ложится, и реагирует на настроение музыки.

import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { moodOf, useAvatar, type Mood, type PetKind } from "../avatar";
import { useStore } from "../store";
import { hero } from "./Character";
import { CHAIR } from "./Room";
import { live } from "./live";
import { BOUNDS, findPath, moveWithCollision, nearestFree } from "./nav";
import { heroCmd } from "./heroControl";

/** Команды питомцу из интерфейса: позвать к себе или погладить. */
const petReq = { call: false, pet: false, tp: null as THREE.Vector3 | null };
/** Где сейчас питомец (для кнопок и подхода персонажа) */
export const petInfo = {
  pos: new THREE.Vector3(0.8, 0, -0.9),
  present: false,
  /** что сейчас делает (для звуков) */
  mode: "rest" as string,
  /** 0..1 насколько его гладят */
  pet: 0,
};
export const petCmd = {
  call() {
    petReq.call = true;
  },
  /** перенести питомца вместе с персонажем (в локацию воспоминания и обратно) */
  teleport(p: THREE.Vector3) {
    petReq.tp = p.clone();
  },
  pet() {
    petReq.pet = true;
    // персонаж подходит к питомцу и встаёт к нему лицом
    const p = petInfo.pos;
    const dir = new THREE.Vector3().subVectors(hero.pos, p).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    const spot = p.clone().addScaledVector(dir, 0.48);
    // встаём лицом к питомцу
    heroCmd.approach(spot, Math.atan2(-dir.x, -dir.z));
  },
};

/** Случайная точка не слишком близко к текущей — чтобы прогулка была заметной */
function randomSpotFrom(from: THREE.Vector3) {
  for (let i = 0; i < 8; i++) {
    const p = randomSpot();
    if (p.distanceTo(from) > 1.6) return p;
  }
  return randomSpot();
}
const randomSpot = () =>
  nearestFree(
    THREE.MathUtils.lerp(BOUNDS.min + 0.5, BOUNDS.max - 0.5, Math.random()),
    THREE.MathUtils.lerp(BOUNDS.min + 0.5, BOUNDS.max - 0.5, Math.random()),
    PET_R,
  );

// Хвост кошки: гладкая трубка знаком вопроса (вверх и завиток к спине).
const CAT_TAIL_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0.05, -0.06),
  new THREE.Vector3(0, 0.13, -0.09),
  new THREE.Vector3(0, 0.22, -0.08),
  new THREE.Vector3(0, 0.28, -0.03),
  new THREE.Vector3(0, 0.285, 0.025),
  new THREE.Vector3(0, 0.255, 0.05),
]);
const catTail = (() => {
  const g = new THREE.TubeGeometry(CAT_TAIL_CURVE, 48, 0.026, 12, false);
  // хвост сужается к кончику
  const pos = g.attributes.position as THREE.BufferAttribute;
  const segs = 48, radial = 12;
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    CAT_TAIL_CURVE.getPointAt(i / segs, c);
    const k = 1 - (i / segs) * 0.15;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * k, c.y + (pos.getY(idx) - c.y) * k, c.z + (pos.getZ(idx) - c.z) * k);
    }
  }
  g.computeVertexNormals();
  return g;
})();
const CAT_TAIL_TIP = CAT_TAIL_CURVE.getPointAt(1).toArray() as [number, number, number];

const CHAIR_SPOT = new THREE.Vector3(CHAIR.x + 1.05, 0, CHAIR.z - 0.5);
const BED_FLOOR = new THREE.Vector3(-1.55, 0, -0.95);
const PET_R = 0.14;
const BED_SPOT = new THREE.Vector3(-2.45, 0.8, -1.05);
const angleTo = (from: number, to: number) => ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const approach = (v: number, t: number, s: number) => (v < t ? Math.min(t, v + s) : Math.max(t, v - s));
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const clay = (c: string, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

type PetState = Mood | "idle";
const BUBBLE: Record<PetState, string> = { idle: "", happy: "♥", playful: "♪", sleepy: "z z z", sad: "💧" };

export function Pet() {
  const kind = useAvatar((s) => s.avatar.pet);
  if (kind === "none") return null;
  return <PetBody key={kind} kind={kind} />;
}

function PetBody({ kind }: { kind: Exclude<PetKind, "none"> }) {
  const petColor = useAvatar((s) => s.avatar.petColor);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Group>(null);
  const earR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const tongue = useRef<THREE.Mesh>(null);
  const legs = useRef<THREE.Group[]>([]);
  const [bubble, setBubble] = useState<PetState>("idle");
  const [menu, setMenu] = useState(false);
  // эмоции питомца (z z z, ноты) не показываем поверх дневника, формы записи и вида из-за стола
  const panel = useStore((s) => s.panel);
  const [fp, setFp] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.(".pet-menu")) setMenu(false);
    };
    const id = setTimeout(() => window.addEventListener("pointerdown", close), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", close);
    };
  }, [menu]);
  const st = useMemo(
    () => ({
      pos: new THREE.Vector3(0.8, 0, -0.9), rot: 0, walk: 0, moving: 0, lie: 0, onBed: 0, mood: "idle" as PetState, blink: 0,
      // маршрут в обход мебели
      path: [] as THREE.Vector3[], planGoal: new THREE.Vector3(999, 0, 999), planT: 0,
      // своя жизнь: гуляет, отдыхает, дремлет; приходит, когда зовут
      mode: "rest" as "wander" | "rest" | "nap" | "called" | "petWait" | "petting",
      modeT: 1, pet: 0, wander: new THREE.Vector3(), here: new THREE.Vector3(), arrivedT: 0,
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      fur: clay(petColor),
      furDark: clay(petColor),
      light: clay("#fff6ea"),
      dark: new THREE.MeshStandardMaterial({ color: "#221c1e", roughness: 0.25 }),
      white: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      pink: clay("#ff9fb4"),
      blush: new THREE.MeshBasicMaterial({ color: "#ff8fa8", transparent: true, opacity: 0.5, depthWrite: false }),
      collar: clay("#e85d75", 0.5),
      bell: new THREE.MeshStandardMaterial({ color: "#f2c14e", roughness: 0.25, metalness: 0.7 }),
    }),
    // цвет меняется в эффекте ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    mats.fur.color.set(petColor);
    mats.furDark.color.set(petColor).multiplyScalar(0.78);
  }, [petColor, mats]);

  const tmp = useMemo(() => ({ target: new THREE.Vector3(), d: new THREE.Vector3() }), []);

  useFrame(({ clock }, rawDt) => {
    if (hero.firstPerson !== fp) setFp(hero.firstPerson);
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const chosen = useAvatar.getState().avatar.petMood;
    const { active } = useStore.getState();
    const autoMood: PetState = hero.listening ? moodOf(active?.atmosphere) : hero.lie > 0.5 ? "sleepy" : "idle";
    const mood: PetState =
      st.mode === "petting" ? "happy" : chosen !== "auto" ? chosen : st.mode === "nap" ? "sleepy" : autoMood;
    if (mood !== st.mood) {
      st.mood = mood;
      setBubble(mood);
    }

    if (petReq.tp) {
      st.pos.copy(petReq.tp);
      petReq.tp = null;
      st.onBed = 0;
      st.path = [];
      st.mode = "rest";
      st.modeT = 2;
    }
    // в локации воспоминания сидит рядом с хозяином и никуда не уходит
    const inLoc = useStore.getState().place !== "room";
    if (inLoc) (st.mode = "rest"), (st.modeT = 2);

    // Куда идти
    const wantBed = hero.lie > 0.6 && !inLoc;
    const nearChair = hero.sit > 0.5 && !inLoc;
    let goal: THREE.Vector3;
    let tol = 0.05;
    if (wantBed) goal = BED_FLOOR;
    else if (nearChair) goal = CHAIR_SPOT;
    else {
      st.modeT -= dt;
      if (petReq.call) {
        petReq.call = false;
        st.mode = "called";
        st.modeT = 20;
        st.arrivedT = 0;
      }
      if (petReq.pet) {
        petReq.pet = false;
        st.mode = "petWait";
        st.modeT = 15;
      }
      const stay = () => tmp.target.copy(st.pos);
      const dHero = Math.hypot(hero.pos.x - st.pos.x, hero.pos.z - st.pos.z);
      switch (st.mode) {
        case "called": {
          // бежит к персонажу и садится перед ним
          tmp.target.set(0, 0, 0.55).applyAxisAngle(THREE.Object3D.DEFAULT_UP, hero.rot).add(hero.pos);
          goal = tmp.target;
          tol = 0.25;
          if (dHero < 0.9) st.arrivedT += dt;
          if (st.arrivedT > 6 || st.modeT <= 0) (st.mode = "rest"), (st.modeT = 3 + Math.random() * 4);
          break;
        }
        case "petWait":
          goal = stay();
          tol = 1;
          if (dHero < 0.75 && !hero.moving) (st.mode = "petting"), (st.modeT = 3.5);
          else if (st.modeT <= 0) (st.mode = "rest"), (st.modeT = 3);
          break;
        case "petting":
          goal = stay();
          tol = 1;
          if (st.modeT <= 0) (st.mode = "rest"), (st.modeT = 4 + Math.random() * 3);
          break;
        case "wander":
          goal = st.wander;
          tol = 0.15;
          if (st.pos.distanceTo(st.wander) < 0.2 || st.modeT <= 0) {
            // чаще всего сразу идёт дальше; иногда принюхивается или дремлет
            const roll = Math.random();
            if (roll < 0.72) {
              st.wander.copy(randomSpotFrom(st.pos));
              st.modeT = 15;
            } else {
              st.mode = roll < 0.93 ? "rest" : "nap";
              st.modeT = st.mode === "nap" ? 10 + Math.random() * 10 : 1.2 + Math.random() * 2;
            }
          }
          break;
        default:
          // отдых или дрёма: стоим на месте, потом идём гулять дальше
          goal = stay();
          tol = 1;
          if (st.modeT <= 0) {
            // иногда подходит к хозяину сам, чаще — в случайное место
            if (Math.random() < 0.25) st.here.set(0, 0, 0.7).applyAxisAngle(THREE.Object3D.DEFAULT_UP, hero.rot).add(hero.pos), st.wander.copy(nearestFree(st.here.x, st.here.z, PET_R));
            else st.wander.copy(randomSpotFrom(st.pos));
            st.mode = "wander";
            st.modeT = 15;
          }
      }
    }

    let moving = 0;
    const onBedTarget = wantBed && st.pos.distanceTo(BED_FLOOR) < 0.12 ? 1 : 0;
    if (!wantBed && st.onBed > 0) {
      st.onBed = approach(st.onBed, 0, dt / 0.6); // спрыгиваем
    } else if (st.onBed < 1 || !wantBed) {
      tmp.d.subVectors(goal, st.pos).setY(0);
      const dist = tmp.d.length();
      if (dist > tol && st.onBed === 0) {
        // пересчитываем маршрут, когда цель заметно сдвинулась (или раз в секунду)
        st.planT -= dt;
        if (st.planGoal.distanceTo(goal) > 0.35 || st.planT <= 0 || !st.path.length) {
          st.planGoal.copy(goal);
          st.planT = 1;
          st.path = findPath(st.pos, nearestFree(goal.x, goal.z, PET_R), PET_R);
        }
        while (st.path.length > 1 && Math.hypot(st.path[0].x - st.pos.x, st.path[0].z - st.pos.z) < 0.15) st.path.shift();
        const wp = st.path[0] ?? goal;
        tmp.d.subVectors(wp, st.pos).setY(0);
        const wdist = Math.max(0.0001, tmp.d.length());
        // гуляет неспешно, а на зов бежит
        const speed = st.mode === "wander" && !wantBed && !nearChair ? 0.62 : Math.min(2.4, 0.9 + dist * 1.4);
        st.rot += angleTo(st.rot, Math.atan2(tmp.d.x, tmp.d.z)) * (1 - Math.exp(-8 * dt));
        tmp.d.normalize().multiplyScalar(Math.min(wdist, speed * dt));
        moveWithCollision(st.pos, tmp.d.x, tmp.d.z, PET_R);
        moving = 1;
      } else {
        const look = new THREE.Vector3().subVectors(hero.pos, st.pos);
        st.rot += angleTo(st.rot, Math.atan2(look.x, look.z) + (mood === "playful" ? Math.sin(t * 3) * 0.6 : 0)) * (1 - Math.exp(-4 * dt));
      }
      if (onBedTarget) st.onBed = approach(st.onBed, 1, dt / 0.7);
    }
    st.moving += (moving - st.moving) * (1 - Math.exp(-10 * dt));
    st.walk += dt * 15 * st.moving;

    const lying = !moving && st.mode !== "petting" && (mood === "sleepy" || (wantBed && st.onBed > 0.99)) ? 1 : 0;
    petInfo.pos.copy(st.pos);
    petInfo.present = true;
    petInfo.mode = st.mode;
    st.lie += (lying - st.lie) * (1 - Math.exp(-4 * dt));

    // Анимация по настроению
    const beat = t * Math.PI * 2 * (0.8 + live.animSpeed * 0.6);
    let hop = 0, wag = Math.sin(t * 2) * 0.3, headX = 0, earDroop = 0, tilt = 0;
    const still = !moving && (st.onBed === 0 || st.onBed === 1);
    if (still && st.mode === "petting") {
      // мурчит: хвост медленно ходит, без подпрыгиваний
      wag = Math.sin(t * 2.4) * 0.45;
    } else if (still) {
      if (mood === "happy") {
        hop = Math.abs(Math.sin(beat * 0.5)) * (0.05 + live.level * 0.08);
        wag = Math.sin(t * 14) * 0.6;
        tilt = Math.sin(t * 1.5) * 0.15;
      } else if (mood === "playful") {
        hop = Math.abs(Math.sin(beat)) * (0.07 + live.level * 0.1);
        wag = Math.sin(t * 18) * 0.7;
        tilt = Math.sin(beat) * 0.25;
      } else if (mood === "sad") {
        headX = 0.4;
        earDroop = 0.9;
        wag = Math.sin(t * 0.8) * 0.08 - 0.4;
      } else if (mood === "sleepy") {
        headX = 0.15;
        wag = Math.sin(t * 0.6) * 0.1;
      }
    }

    // Прыжок на кровать по дуге
    const jumpE = smoother(st.onBed);
    const px = THREE.MathUtils.lerp(st.pos.x, BED_SPOT.x, jumpE);
    const pz = THREE.MathUtils.lerp(st.pos.z, BED_SPOT.z, jumpE);
    const py = BED_SPOT.y * jumpE + Math.sin(st.onBed * Math.PI) * 0.45;
    const r = root.current!;
    r.position.set(px, py + hop, pz);
    r.rotation.y = st.rot;
    body.current!.scale.set(1 + st.lie * 0.1, 1 - st.lie * 0.28 + Math.sin(t * (st.lie > 0.5 ? 1.2 : 2.5)) * 0.02, 1);
    body.current!.position.y = -st.lie * 0.06 + Math.abs(Math.sin(st.walk)) * 0.035 * st.moving;
    // когда гладят — привстаёт на задние лапы и тянется головой к руке
    st.pet += ((st.mode === "petting" ? 1 : 0) - st.pet) * (1 - Math.exp(-5 * dt));
    petInfo.pet = st.pet;
    hero.petting = st.pet;
    const rub = Math.sin(t * 3.2) * st.pet;
    body.current!.rotation.z = tilt + rub * 0.08;
    body.current!.rotation.x = -st.pet * 0.42;
    body.current!.position.y += st.pet * 0.05;
    head.current!.rotation.x = headX + st.lie * 0.3 - st.pet * 0.55;
    head.current!.rotation.z = tilt * 0.6 + (mood === "idle" ? Math.sin(t * 0.7) * 0.15 : 0) + rub * 0.3;
    head.current!.rotation.y = rub * 0.2;
    tail.current!.rotation.y = wag;
    const droopBase = kind === "dog" ? 0.2 : 0;
    earL.current!.rotation.z = 0.2 + earDroop * 0.8 + droopBase + (kind === "dog" ? Math.sin(st.walk) * 0.2 * st.moving : 0);
    earR.current!.rotation.z = -0.2 - earDroop * 0.8 - droopBase - (kind === "dog" ? Math.sin(st.walk) * 0.2 * st.moving : 0);
    st.blink = Math.sin(t * 0.9 + 1) > 0.985 ? 1 : 0;
    const eyeClosed = mood === "sleepy" || st.mode === "petting" || (st.lie > 0.7 && wantBed) || st.blink;
    eyes.current!.scale.y += ((eyeClosed ? 0.15 : 1) - eyes.current!.scale.y) * (1 - Math.exp(-15 * dt));
    if (tongue.current) tongue.current.visible = mood === "happy" || mood === "playful" || st.moving > 0.5;
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = Math.sin(st.walk + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 * st.moving - (i < 2 ? st.pet * 0.9 : 0);
    });
  });

  // ---------- внешний вид ----------
  const ears =
    kind === "cat" ? (
      <>
        {[earL, earR].map((ref, i) => (
          <group key={i} ref={ref} position={[(i ? 1 : -1) * 0.095, 0.11, -0.01]}>
            <mesh material={mats.fur} position={[0, 0.055, 0]} scale={[1, 1, 0.6]} castShadow>
              <coneGeometry args={[0.06, 0.12, 12]} />
            </mesh>
            <mesh material={mats.pink} position={[0, 0.048, 0.022]} scale={[0.55, 0.65, 0.3]}>
              <coneGeometry args={[0.06, 0.12, 12]} />
            </mesh>
          </group>
        ))}
      </>
    ) : kind === "dog" ? (
      <>
        {[earL, earR].map((ref, i) => (
          <group key={i} ref={ref} position={[(i ? 1 : -1) * 0.14, 0.07, 0]}>
            <mesh material={mats.furDark} position={[0, -0.075, 0]} scale={[0.42, 1, 0.75]} castShadow>
              <sphereGeometry args={[0.085, 14, 12]} />
            </mesh>
          </group>
        ))}
      </>
    ) : (
      <>
        {[earL, earR].map((ref, i) => (
          <group key={i} ref={ref} position={[(i ? 1 : -1) * 0.06, 0.12, -0.02]} rotation-x={-0.15}>
            <mesh material={mats.fur} position={[0, 0.13, 0]} scale={[1, 1, 0.6]} castShadow>
              <capsuleGeometry args={[0.042, 0.19, 6, 12]} />
            </mesh>
            <mesh material={mats.pink} position={[0, 0.13, 0.02]} scale={[0.55, 0.85, 0.3]}>
              <capsuleGeometry args={[0.042, 0.19, 6, 12]} />
            </mesh>
          </group>
        ))}
      </>
    );

  return (
    <group
      ref={root}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        setMenu((m) => !m);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {menu && (
        <Html position={[0, 0.85, 0]} center zIndexRange={[40, 30]}>
          <div className="pet-menu" onPointerDown={(e) => e.stopPropagation()}>
            <button onClick={() => { petCmd.pet(); setMenu(false); }}>🤚 Погладить</button>
            <button onClick={() => { petCmd.call(); setMenu(false); }}>📣 Позвать к себе</button>
          </div>
        </Html>
      )}
      <group ref={body}>
        {/* тело: круглое «плюшевое» */}
        <mesh position={[0, 0.15, -0.03]} castShadow material={mats.fur} scale={[0.95, 0.9, 1.1]}>
          <sphereGeometry args={[0.13, 24, 18]} />
        </mesh>
        <mesh position={[0, 0.14, 0.05]} material={mats.light} scale={[0.62, 0.7, 0.45]}>
          <sphereGeometry args={[0.12, 16, 12]} />
        </mesh>
        {/* лапки */}
        {[[-0.07, 0.06], [0.07, 0.06], [-0.07, -0.11], [0.07, -0.11]].map(([x, z], i) => (
          <group key={i} ref={(el) => { if (el) legs.current[i] = el; }} position={[x, 0.07, z]}>
            <mesh position={[0, -0.03, 0.01]} castShadow material={i < 2 ? mats.light : mats.fur} scale={[1, 0.9, 1.2]}>
              <sphereGeometry args={[0.045, 12, 10]} />
            </mesh>
          </group>
        ))}
        {/* хвост */}
        <group ref={tail} position={[0, 0.17, -0.16]}>
          {kind === "bunny" ? (
            <mesh material={mats.light} position={[0, 0, -0.02]}>
              <sphereGeometry args={[0.055, 14, 12]} />
            </mesh>
          ) : kind === "cat" ? (
            <>
              <mesh geometry={catTail} material={mats.fur} castShadow />
              <mesh position={CAT_TAIL_TIP} material={mats.light}>
                <sphereGeometry args={[0.024, 12, 10]} />
              </mesh>
            </>
          ) : (
            <mesh material={mats.fur} position={[0, 0.05, -0.03]} rotation-x={-0.7}>
              <capsuleGeometry args={[0.03, 0.08, 4, 8]} />
            </mesh>
          )}
        </group>
        {/* ошейник с колокольчиком */}
        <mesh position={[0, 0.24, 0.05]} rotation-x={Math.PI / 2 - 0.35} material={mats.collar}>
          <torusGeometry args={[0.075, 0.016, 8, 20]} />
        </mesh>
        <mesh position={[0, 0.2, 0.125]} material={mats.bell}>
          <sphereGeometry args={[0.022, 10, 8]} />
        </mesh>

        {/* большая голова */}
        <group ref={head} position={[0, 0.36, 0.06]}>
          <mesh castShadow material={mats.fur} scale={[1.12, 0.98, 1]}>
            <sphereGeometry args={[0.15, 28, 22]} />
          </mesh>
          {/* мордочка */}
          <mesh position={[0, -0.045, 0.105]} material={mats.light} scale={[1.15, 0.78, kind === "dog" ? 1 : 0.65]}>
            <sphereGeometry args={[0.065, 16, 12]} />
          </mesh>
          <mesh position={[0, -0.02, kind === "dog" ? 0.165 : 0.145]} material={kind === "dog" ? mats.dark : mats.pink} scale={[1.2, 0.85, 0.8]}>
            <sphereGeometry args={[kind === "dog" ? 0.022 : 0.015, 10, 8]} />
          </mesh>
          {/* ротик «w» */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.016, -0.05, kind === "dog" ? 0.162 : 0.142]} rotation-z={Math.PI} material={mats.dark}>
              <torusGeometry args={[0.016, 0.004, 4, 10, Math.PI]} />
            </mesh>
          ))}
          {kind === "dog" && (
            <mesh ref={tongue} position={[0, -0.075, 0.15]} rotation-x={0.4} material={mats.pink} scale={[1, 1.4, 0.4]}>
              <sphereGeometry args={[0.018, 10, 8]} />
            </mesh>
          )}
          {/* глаза с бликами */}
          <group ref={eyes}>
            {[-0.06, 0.06].map((x) => (
              <group key={x} position={[x, 0.015, 0.128]}>
                <mesh material={mats.dark} scale={[0.85, 1, 0.5]}>
                  <sphereGeometry args={[0.026, 12, 10]} />
                </mesh>
                <mesh position={[0.008, 0.01, 0.012]} material={mats.white}>
                  <sphereGeometry args={[0.007, 6, 6]} />
                </mesh>
              </group>
            ))}
          </group>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, -0.035, 0.11]} rotation-y={x * 4} material={mats.blush}>
              <circleGeometry args={[0.022, 12]} />
            </mesh>
          ))}
          {ears}
          {BUBBLE[bubble] && panel === "none" && !fp && (
            <Html position={[0, 0.3, 0]} center distanceFactor={7} zIndexRange={[5, 0]}>
              <div className={`pet-bubble mood-${bubble}`}>{BUBBLE[bubble]}</div>
            </Html>
          )}
        </group>
      </group>
    </group>
  );
}

if (import.meta.env.DEV) (window as unknown as { __pet: unknown }).__pet = { info: petInfo, cmd: petCmd, hero };
