// Персонаж в «пластилиновом» чиби-стиле: большая голова, худи с капюшоном,
// круглые формы. Одежда, цвета и наушники настраиваются (src/avatar.ts).
// Управление: клик или тап по полу и мебели, кнопки действий (heroControl.ts).
// Анимации процедурные и сглаженные: ходьба, посадка, лёжа на кровати,
// перенос наушников со столика на шею и на голову, покачивание в такт.

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { moodOf, useAvatar, type Mood } from "../avatar";
import { useStore } from "../store";
import { Waveform } from "./SoundFx";
import { control, heroCmd, SPOTS, useHeroUI, type Pose } from "./heroControl";
import { live } from "./live";
import { DESK } from "./Room";
import { props } from "./sceneState";
import { findPath, moveWithCollision } from "./nav";

/** Общее состояние персонажа: по нему ориентируются питомец, камера и эффекты. */
export const hero = {
  pos: SPOTS.home.clone(),
  rot: Math.PI / 4,
  pose: "stand" as Pose,
  /** 0..1 насколько персонаж лежит */
  lie: 0,
  sit: 0,
  desk: 0,
  moving: false,
  listening: false,
};

// Пропорции чиби
const HIP_Y = 0.5;
const HEAD_Y = 1.3;
const HEAD_R = 0.3;
const SIT_LIFT = 0.17; // таз поднимается на подушку кресла
const RADIUS = 0.22;
const MAX_SPEED = 1.7;
// Кровать: сначала садимся на край, потом откидываемся на спину
const BED_EDGE = new THREE.Vector3(-2.08, HIP_Y + 0.27, -1.9); // таз на краю матраса
const BED_HIP = new THREE.Vector3(-2.72, 0.93, -2.5); // таз лёжа, голова на подушке
const LIE_TILT = -Math.PI / 2 + 0.12; // чуть приподнятая голова
// Письменный стол: выдвигаем стул, садимся боком и придвигаемся
const DESK_LIFT = 0.1;
const DESK_SEAT1 = new THREE.Vector3(DESK.x - 0.1, 0, DESK.z + 1.2); // на выдвинутом стуле
const DESK_SEAT2 = new THREE.Vector3(DESK.x - 0.1, 0, DESK.z + 0.92); // придвинулись к столу
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleTo = (from: number, to: number) => ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

const clay = (color: string, rough = 0.62) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

export function Character() {
  const avatar = useAvatar((s) => s.avatar);
  const root = useRef<THREE.Group>(null);
  const poseG = useRef<THREE.Group>(null);
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
  const neckAnchor = useRef<THREE.Object3D>(null);
  const eyes = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const smile = useRef<THREE.Mesh>(null);
  const frown = useRef<THREE.Mesh>(null);
  const openMouth = useRef<THREE.Mesh>(null);
  const waveAnchor = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Object3D>(null);
  const mug = useRef<THREE.Group>(null);

  const st = useMemo(
    () => ({
      pos: SPOTS.home.clone(),
      rot: Math.PI / 4,
      vel: new THREE.Vector3(),
      walk: 0,
      sit: 0,
      lie: 0,
      desk: 0,
      drink: 0,
      pull: 0,
      turnFirst: false,
      carry: 0, // 0 — наушники на столике, 1 — у персонажа
      onHead: 0, // 0 — на шее, 1 — на голове
      hold: 0,
      settle: 0, // «устроился поудобнее» после надевания
      blink: 0,
      nextBlink: 2,
      stuck: 0,
      lastDist: Infinity,
      path: [] as THREE.Vector3[],
      pathFor: null as unknown,
      replans: 0,
      request: 0,
      unwinding: false,
      uiPose: "stand" as Pose,
      uiHp: "table" as string,
    }),
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
      mug: new THREE.MeshStandardMaterial({ color: "#f6f1ea", roughness: 0.4, side: THREE.DoubleSide }),
      cocoa: new THREE.MeshStandardMaterial({ color: "#6b3a22", roughness: 0.25, emissive: "#3a1a0a", emissiveIntensity: 0.25 }),
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

  // Прерывание подготовки ручным вводом — сбрасываем прослушивание
  useEffect(() => {
    control.onInterrupt = () => {
      const s = useStore.getState();
      if (s.phase === "walking") s.setPhase("idle");
    };
  }, []);

  const tmp = useMemo(
    () => ({
      v: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      right: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      headW: new THREE.Vector3(),
      headQ: new THREE.Quaternion(),
      neckW: new THREE.Vector3(),
      neckQ: new THREE.Quaternion(),
      carryP: new THREE.Vector3(),
      carryQ: new THREE.Quaternion(),
      restQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.4)),
      handW: new THREE.Vector3(),
      mugQ: new THREE.Quaternion(),
      mugE: new THREE.Euler(),
    }),
    [],
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const store = useStore.getState();
    const { phase, setPhase, active } = store;

    // ---- Связь со сценарием прослушивания ----
    if (store.request !== st.request) {
      st.request = store.request;
      st.unwinding = false;
      heroCmd.prepareListening(() => useStore.getState().setPhase("listening"));
    }
    if (phase === "unwinding" && !st.unwinding) {
      st.unwinding = true;
      if (control.hp === "head") control.hp = "neck";
    }
    if (st.unwinding && st.onHead <= 0.001) {
      st.unwinding = false;
      if (useStore.getState().phase === "unwinding") setPhase("idle");
    }
    // сняли наушники вручную во время музыки — музыка затихает
    if (phase === "listening" && control.hp !== "head") store.stopReliving();

    // ---- Очередь действий ----
    tmp.desired.set(0, 0, 0);
    let faceAngle: number | null = null;
    const step = control.queue[0];
    // начатое чаепитие не бросаем: ставим кружку на место и только потом идём дальше
    const finishingDrink = st.drink > 0 && step?.k !== "drink";
    if (finishingDrink) {
      st.drink = Math.max(st.drink, 0.82) + dt / 0.8;
      if (st.drink >= 1) st.drink = 0;
    }
    const free = st.sit < 0.02 && st.lie < 0.02 && st.desk < 0.02;
    if (step && !finishingDrink) {
      if (step.k === "goto") {
        if (!free) control.pose = "stand";
        else {
          // маршрут в обход мебели считаем один раз на шаг
          if (st.pathFor !== step) {
            st.pathFor = step;
            st.path = findPath(st.pos, step.to, RADIUS);
            st.stuck = 0;
            st.replans = 0;
            st.lastDist = Infinity;
            st.turnFirst = true;
          }
          while (st.path.length > 1 && Math.hypot(st.path[0].x - st.pos.x, st.path[0].z - st.pos.z) < 0.18) {
            st.path.shift();
            st.lastDist = Infinity;
          }
          const last = st.path.length <= 1;
          const target = st.path[0] ?? step.to;
          tmp.v.copy(target).sub(st.pos).setY(0);
          const dist = tmp.v.length();
          if (last && dist < (step.tol ?? 0.06)) {
            if (step.face !== undefined && Math.abs(angleTo(st.rot, step.face)) > 0.06) faceAngle = step.face;
            else heroCmd.shift();
          } else if (st.turnFirst && Math.abs(angleTo(st.rot, Math.atan2(tmp.v.x, tmp.v.z))) > 0.5 && dist > 0.3) {
            // сначала разворачиваемся по маршруту (в сторону обхода), потом идём
            faceAngle = Math.atan2(tmp.v.x, tmp.v.z);
          } else {
            st.turnFirst = false;
            // на промежуточных точках не тормозим, у цели мягко останавливаемся
            const speed = last ? Math.min(MAX_SPEED, dist * 2.2 + 0.25) : MAX_SPEED * 0.85;
            tmp.desired.copy(tmp.v).normalize().multiplyScalar(speed);
            if (dist > st.lastDist - 0.0015) st.stuck += dt;
            else st.stuck = Math.max(0, st.stuck - dt * 0.5);
            st.lastDist = Math.min(st.lastDist, dist);
            if (st.stuck > 0.8) {
              // упёрлись — пересчитываем маршрут, а если не помогло, пропускаем шаг
              st.stuck = 0;
              st.lastDist = Infinity;
              if (++st.replans > 2) heroCmd.shift();
              else st.path = findPath(st.pos, step.to, RADIUS);
            }
          }
        }
      } else if (step.k === "pose") {
        control.pose = step.to;
        const done = (["sit", "lie", "desk"] as const).every((k) => Math.abs(st[k] - (step.to === k ? 1 : 0)) < 0.001);
        if (done) heroCmd.shift();
      } else if (step.k === "pull") {
        // дёрнуть шнурок торшера: на середине движения свет переключается
        const before = st.pull;
        st.pull = Math.min(1, st.pull + dt / 1.6);
        if (before < 0.55 && st.pull >= 0.55) props.lampOn = !props.lampOn;
        if (st.pull >= 1) {
          st.pull = 0;
          heroCmd.shift();
        }
      } else if (step.k === "drink") {
        // взять кружку, отпить, поставить обратно
        st.drink = Math.min(1, st.drink + dt / 3.6);
        if (st.drink >= 1) {
          st.drink = 0;
          heroCmd.shift();
        }
      } else if (step.k === "hp") {
        control.hp = step.to;
        const c = step.to === "table" ? 0 : 1, h = step.to === "head" ? 1 : 0;
        if (Math.abs(st.carry - c) < 0.001 && Math.abs(st.onHead - h) < 0.001) heroCmd.shift();
      } else {
        heroCmd.shift();
        step.fn();
      }
    }

    // ---- Позы ----
    // встать из одной позы прежде, чем принять другую
    const UP = { sit: 1.0, lie: 2.4, desk: 2.2 }, DOWN = { sit: 0.9, lie: 1.8, desk: 1.6 };
    let leaving = false;
    for (const k of ["sit", "lie", "desk"] as const) {
      if (k !== control.pose && st[k] > 0) {
        st[k] = approach(st[k], 0, dt / DOWN[k]);
        leaving = true;
      }
    }
    if (!leaving && control.pose !== "stand") st[control.pose] = approach(st[control.pose], 1, dt / UP[control.pose]);

    // ---- Наушники ----
    const carryT = control.hp === "table" ? 0 : 1;
    const headT = control.hp === "head" ? 1 : 0;
    if (carryT === 0 && st.onHead > 0) st.onHead = approach(st.onHead, 0, dt / 1.3);
    else if (headT === 1 && st.carry < 1) st.carry = approach(st.carry, 1, dt / 1.1);
    else {
      st.carry = approach(st.carry, carryT, dt / 1.1);
      st.onHead = approach(st.onHead, headT, dt / 1.6);
    }

    // ---- Перемещение ----
    st.vel.x = damp(st.vel.x, tmp.desired.x, 9, dt);
    st.vel.z = damp(st.vel.z, tmp.desired.z, 9, dt);
    const speed = Math.hypot(st.vel.x, st.vel.z);
    if (speed > 0.01) moveWithCollision(st.pos, st.vel.x * dt, st.vel.z * dt, RADIUS);
    if (speed > 0.08) st.rot += angleTo(st.rot, Math.atan2(st.vel.x, st.vel.z)) * (1 - Math.exp(-10 * dt));
    else if (faceAngle !== null) st.rot += angleTo(st.rot, faceAngle) * (1 - Math.exp(-7 * dt));
    const moveAmt = Math.min(1, speed / MAX_SPEED);
    st.walk += dt * (4 + 8 * moveAmt) * Math.min(1, speed * 3);

    // ---- Корень ----
    // Кресло: пятимся к сиденью. Кровать: фаза A — садимся на край,
    // фаза B — разворачиваемся и откидываемся на спину, поворачиваясь вокруг таза.
    const sitE = smoother(st.sit);
    const lieA = smoother(clamp01(st.lie / 0.5));
    const lieB = smoother(clamp01((st.lie - 0.5) / 0.5));
    const lieE = lieB;
    const r = root.current!;
    // стол: A — выдвигаем стул, B — садимся на него, C — придвигаемся
    const deskA = smoother(clamp01(st.desk / 0.3));
    const deskB = smoother(clamp01((st.desk - 0.3) / 0.45));
    const deskC = smoother(clamp01((st.desk - 0.75) / 0.25));
    props.deskChair = 0.45 * deskA - 0.28 * deskC;
    const yaw = st.rot + angleTo(st.rot, 0) * lieB + angleTo(st.rot, Math.PI) * deskB;
    const tilt = LIE_TILT * lieB;
    const chairLift = sitE * SIT_LIFT + deskB * DESK_LIFT;
    // где должен быть таз
    tmp.v.set(st.pos.x, HIP_Y, st.pos.z);
    tmp.v.x = THREE.MathUtils.lerp(tmp.v.x, SPOTS.chairSeat.x, sitE);
    tmp.v.z = THREE.MathUtils.lerp(tmp.v.z, SPOTS.chairSeat.z, sitE);
    tmp.v.y += chairLift;
    if (st.lie > 0) {
      tmp.v.lerp(BED_EDGE, lieA);
      tmp.v.lerp(BED_HIP, lieB);
    }
    if (st.desk > 0) {
      tmp.v.x = THREE.MathUtils.lerp(tmp.v.x, DESK_SEAT1.x, deskB);
      tmp.v.z = THREE.MathUtils.lerp(tmp.v.z, DESK_SEAT1.z, deskB);
      tmp.v.z = THREE.MathUtils.lerp(tmp.v.z, DESK_SEAT2.z, deskC);
    }
    // корень = таз минус повёрнутое смещение таза
    const hipH = HIP_Y + chairLift;
    const oy = hipH * Math.cos(tilt), oz = hipH * Math.sin(tilt);
    r.position.set(tmp.v.x - oz * Math.sin(yaw), tmp.v.y - oy, tmp.v.z - oz * Math.cos(yaw));
    r.rotation.y = yaw;
    poseG.current!.rotation.x = tilt;
    const px = tmp.v.x, pz = tmp.v.z;
    // ноги согнуты, когда сидим в кресле или на краю кровати
    const legBend = Math.max(sitE, lieA * (1 - lieB), deskB);

    // ---- Сценарий музыки ----
    const listening = phase === "listening" && st.onHead > 0.98;
    hero.pos.set(px, 0, pz);
    hero.rot = r.rotation.y;
    hero.pose = control.pose;
    hero.sit = st.sit;
    hero.lie = st.lie;
    hero.desk = st.desk;
    hero.moving = speed > 0.15;
    hero.listening = listening;

    // Поза тела
    const swing = Math.sin(st.walk) * 0.6 * moveAmt;
    const breathe = Math.sin(t * 1.8) * 0.01;
    const beat = Math.PI * 2 * (0.8 + live.animSpeed * 0.6);
    // покачивание нарастает плавно, а не включается рывком
    st.settle = damp(st.settle, listening ? 1 : 0, 1.5, dt);
    const groove = Math.sin(t * beat) * (0.05 + live.level * 0.14) * st.settle;

    body.current!.position.y = chairLift + Math.abs(Math.sin(st.walk)) * 0.05 * moveAmt + breathe * (1 - lieE);
    body.current!.rotation.z = groove * 0.35 * (1 - lieE);
    const dangle = Math.sin(t * beat * 0.5) * 0.25 * st.settle * legBend;
    // лёжа одна нога чуть согнута — поза отдыха
    const restKnee = 0.35 * lieB;
    thighL.current!.rotation.x = swing * (1 - legBend) - (Math.PI / 2) * legBend - restKnee * 0.5;
    thighR.current!.rotation.x = -swing * (1 - legBend) - (Math.PI / 2) * legBend;
    shinL.current!.rotation.x = Math.max(0, -Math.sin(st.walk)) * 0.8 * moveAmt * (1 - legBend) + (Math.PI / 2 - 0.25 + dangle) * legBend + restKnee + groove * 0.6 * lieE;
    shinR.current!.rotation.x = Math.max(0, Math.sin(st.walk)) * 0.8 * moveAmt * (1 - legBend) + (Math.PI / 2 - 0.25 - dangle) * legBend - groove * 0.6 * lieE;

    // Руки: тянутся к столику/голове во время переноса наушников,
    // а во время музыки (если стоим на месте) придерживают наушники
    const reachCarry = st.carry > 0.01 && st.carry < 0.99 ? Math.sin(st.carry * Math.PI) : 0;
    const reachHead = st.onHead > 0.01 && st.onHead < 0.99 ? Math.sin(st.onHead * Math.PI) : 0;
    const reaching = Math.max(reachCarry * 0.7, reachHead);
    st.hold = damp(st.hold, listening && speed < 0.2 ? 1 : 0, 3, dt);
    const h = st.hold * (1 - reaching);
    // какао: тянемся к кружке (grab) и подносим ко рту (sip) правой рукой
    const d = st.drink;
    const grab = d > 0 ? smoother(clamp01(d / 0.2)) * smoother(clamp01((1 - d) / 0.15)) : 0;
    const sip = d > 0 ? smoother(clamp01((d - 0.22) / 0.2)) * smoother(clamp01((0.82 - d) / 0.2)) : 0;
    const reachMug = Math.sin(clamp01(d / 0.22) * Math.PI) * 0.6 + Math.sin(clamp01((d - 0.82) / 0.18) * Math.PI) * 0.6;
    // за столом: тянем стул (A), потом руки ложатся на столешницу (C)
    const pull = Math.sin(deskA * Math.PI) * (1 - deskB);
    const onDesk = deskC;
    const freeArm = 1 - Math.max(reaching, h, pull, onDesk);
    // в кресле локти лежат на подлокотниках, предплечья вперёд
    const elbow = sitE * freeArm;
    // шнурок торшера: рука вверх, хват, рывок вниз
    const pu = st.pull;
    const raise = pu > 0 ? Math.sin(clamp01(pu / 0.9) * Math.PI * 0.5) * smoother(clamp01((1 - pu) / 0.25)) : 0;
    const tug = pu > 0 ? Math.sin(clamp01((pu - 0.4) / 0.3) * Math.PI) : 0;
    props.cord = tug;
    const freeR = 1 - Math.max(grab, reachMug, raise);
    // на кровати руки вдоль тела, ладони на животе
    const rest = lieB * freeArm;
    armL.current!.rotation.x = -swing * 0.9 * freeArm * (1 - sitE) - reaching * 2.75 - h * 0.25 + elbow * 0.12 - rest * 0.5;
    armR.current!.rotation.x = (swing * 0.9 * freeArm * (1 - sitE) - reaching * 2.75 - h * 0.25 + elbow * 0.12 - rest * 0.5) * freeR - reachMug * 1.0 - sip * 1.2 - (grab - sip) * 0.25;
    armL.current!.rotation.z = -0.25 - reaching * 0.2 - h * 1.65 - elbow * 0.6 + rest * 0.1 + groove * 0.4;
    armR.current!.rotation.z = (0.25 + reaching * 0.2 + h * 1.65 + elbow * 0.6 - rest * 0.1 + groove * 0.4) * freeR + (reachMug + grab) * 0.15 - sip * 0.05;
    foreL.current!.rotation.x = -reaching * 0.9 - elbow * 1.35 - rest * 1.2;
    foreR.current!.rotation.x = (-reaching * 0.9 - elbow * 1.35 - rest * 1.2) * freeR - reachMug * 0.3 - sip * 1.85 - (grab - sip) * 0.9;
    foreL.current!.rotation.z = -h * 1.6 + elbow * 0.45 + rest * 0.6;
    foreR.current!.rotation.z = (h * 1.6 - elbow * 0.45 - rest * 0.6) * freeR - sip * 0.35;
    armR.current!.rotation.x += -raise * 2.6 + tug * 0.5;
    armR.current!.rotation.z += raise * 0.25;
    foreR.current!.rotation.x += -raise * 0.25;
    // стул и стол: обе руки вперёд
    for (const [arm, fore] of [[armL, foreL], [armR, foreR]] as const) {
      arm.current!.rotation.x += -pull * 1.1 - onDesk * 0.55;
      fore.current!.rotation.x += -pull * 0.25 - onDesk * 1.05;
    }

    head.current!.rotation.x = groove * 1.1 - 0.06 * st.settle - 0.25 * lieE + sip * 0.18 + onDesk * 0.12;
    head.current!.rotation.z = groove * 0.7;
    head.current!.rotation.y = speed < 0.05 && !listening && control.pose === "stand" ? Math.sin(t * 0.5) * 0.15 : 0;

    // ---- Мимика ----
    const mood: Mood = listening ? moodOf(active?.atmosphere) : control.pose === "lie" ? "sleepy" : "happy";
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

    // ---- Наушники: столик → шея → голова (по дуге) ----
    headAnchor.current!.getWorldPosition(tmp.headW);
    headAnchor.current!.getWorldQuaternion(tmp.headQ);
    neckAnchor.current!.getWorldPosition(tmp.neckW);
    neckAnchor.current!.getWorldQuaternion(tmp.neckQ);
    const onHeadE = smoother(st.onHead);
    tmp.carryP.lerpVectors(tmp.neckW, tmp.headW, onHeadE);
    tmp.carryP.y += Math.sin(st.onHead * Math.PI) * 0.18;
    tmp.carryQ.slerpQuaternions(tmp.neckQ, tmp.headQ, onHeadE);
    const carryE = smoother(st.carry);
    const hp = headphones.current!;
    hp.position.lerpVectors(SPOTS.hpRest, tmp.carryP, carryE);
    hp.position.y += Math.sin(st.carry * Math.PI) * 0.3;
    hp.quaternion.slerpQuaternions(tmp.restQ, tmp.carryQ, carryE);
    hp.scale.setScalar(THREE.MathUtils.lerp(0.75, THREE.MathUtils.lerp(0.95, 1, onHeadE), carryE));
    mats.hpPad.emissiveIntensity = st.settle * (0.25 + live.level * 1.2);

    // ---- Кружка: на столике или в правой руке ----
    handR.current!.getWorldPosition(tmp.handW);
    const m = mug.current!;
    m.position.lerpVectors(SPOTS.mugRest, tmp.handW, grab);
    // у чиби короткие ручки: при глотке кружка чуть «подплывает» к губам
    m.position.y += sip * 0.1;
    tmp.mugE.set(-sip * 0.9, yaw, 0, "YXZ");
    tmp.mugQ.setFromEuler(tmp.mugE);
    m.quaternion.identity().slerp(tmp.mugQ, grab);

    // Дорожка над головой
    waveAnchor.current!.position.set(tmp.headW.x, tmp.headW.y + 0.62 - lieE * 0.1, tmp.headW.z);

    // ---- Состояние для кнопок интерфейса ----
    const uiHp = control.hp;
    if (st.uiPose !== control.pose || st.uiHp !== uiHp) {
      st.uiPose = control.pose;
      st.uiHp = uiHp;
      useHeroUI.setState({ pose: control.pose, hp: uiHp });
    }
  });

  const isHoodie = avatar.top === "hoodie";
  const longSleeves = avatar.top !== "tshirt";

  return (
    <>
      <group ref={root} position={SPOTS.home.toArray()}>
        <group ref={poseG}>
        <group ref={body}>
          {/* снятые наушники висят на шее дужкой назад, за головой */}
          <object3D ref={neckAnchor} position={[0, 0.99, -0.07]} rotation-x={-1.15} />
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
                {i === 1 && <object3D ref={handR} position={[0, -0.2, 0.06]} />}
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
          </group>
        ))}
      </group>

      {/* кружка какао со столика */}
      <group ref={mug} position={SPOTS.mugRest.toArray()}>
        {/* кружка открыта сверху: видно какао и пенку */}
        <mesh castShadow material={mats.mug}>
          <cylinderGeometry args={[0.065, 0.06, 0.13, 24, 1, true]} />
        </mesh>
        <mesh position={[0, -0.063, 0]} rotation-x={Math.PI / 2} material={mats.mug}>
          <circleGeometry args={[0.06, 20]} />
        </mesh>
        <mesh position={[0, 0.065, 0]} rotation-x={Math.PI / 2} material={mats.mug}>
          <torusGeometry args={[0.062, 0.006, 6, 24]} />
        </mesh>
        <mesh position={[0.07, 0.0, 0]} material={mats.mug}>
          <torusGeometry args={[0.035, 0.012, 8, 16]} />
        </mesh>
        <mesh position={[0, 0.045, 0]} rotation-x={-Math.PI / 2} material={mats.cocoa}>
          <circleGeometry args={[0.062, 24]} />
        </mesh>
        {/* маршмеллоу */}
        {[[0.02, 0.015], [-0.022, 0.005], [0.003, -0.025]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.05, z]} rotation-y={i} material={mats.mug}>
            <boxGeometry args={[0.022, 0.016, 0.022]} />
          </mesh>
        ))}
      </group>

      <group ref={waveAnchor}>
        <Waveform />
      </group>
    </>
  );
}

const DEFAULT = { skin: "#f6d3b5", hair: "#2b2220", top: "#f28c28", pants: "#3f6fb5", shoes: "#f28c28", hp: "#2b2b31", pad: "#f28c28" };
