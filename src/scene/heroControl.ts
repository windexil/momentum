// Управление персонажем: клик или тап по полу и мебели, кнопки действий
// и очередь действий (дойти, сесть, лечь, взять/надеть/снять наушники).

import * as THREE from "three";
import { create } from "zustand";
import { CHAIR, DESK, FLOOR_LAMP, SIDE_TABLE } from "./Room";
import { isEvening } from "./dayTime";
import { props } from "./sceneState";
import { nearestFree } from "./nav";
import { petLink } from "./petLink";

export type Pose = "stand" | "sit" | "lie" | "desk";
export type HpLoc = "table" | "neck" | "head";
/** Куда можно положить наушники */
export type HpPlace = "side" | "desk" | "bed";

export type Step =
  | { k: "goto"; to: THREE.Vector3; face?: number; tol?: number; via?: THREE.Vector3[]; ignore?: string }
  | { k: "pose"; to: Pose }
  | { k: "hp"; to: HpLoc; place?: HpPlace }
  | { k: "drink" }
  | { k: "pull" }
  /** выдвинуть (1) или задвинуть (0) стул у письменного стола */
  | { k: "chair"; to: 0 | 1 }
  /** мгновенное действие посреди очереди (не прерывает прослушивание) */
  | { k: "cb"; fn: () => void }
  | { k: "do"; fn: () => void };

export const SPOTS = {
  home: new THREE.Vector3(1.4, 0, -1.2),
  chairFront: new THREE.Vector3(CHAIR.x + Math.sin(CHAIR.rot) * 1.0, 0, CHAIR.z + Math.cos(CHAIR.rot) * 1.0),
  chairSeat: new THREE.Vector3(CHAIR.x + Math.sin(CHAIR.rot) * 0.12, 0, CHAIR.z + Math.cos(CHAIR.rot) * 0.12),
  bedSide: new THREE.Vector3(-1.55, 0, -1.9),
  /** Точка «ног» персонажа на кровати; голова к подушке. */
  bedLie: new THREE.Vector3(-2.85, 0.78, -1.25),
  tableFront: new THREE.Vector3(SIDE_TABLE.x + 0.45, 0, SIDE_TABLE.z + 0.55),
  /** Перед торшером: отсюда дёргаем шнурок */
  lampFront: new THREE.Vector3(FLOOR_LAMP.x + 0.5, 0, FLOOR_LAMP.z + 0.05),
  hpRest: new THREE.Vector3(SIDE_TABLE.x - 0.05, 0.67, SIDE_TABLE.z - 0.08),
  /** Кружка какао на столике */
  mugRest: new THREE.Vector3(SIDE_TABLE.x + 0.14, 0.67, SIDE_TABLE.z + 0.12),
  /** Сбоку от стула у письменного стола: отсюда выдвигаем стул и садимся */
  deskSide: new THREE.Vector3(DESK.x - 0.72, 0, DESK.z + 1.4),
};

/**
 * Места для наушников: где они лежат (rest), где встаёт персонаж (front),
 * куда он смотрит (face), поворот наушников (yaw) и поза, из которой
 * до них можно дотянуться без ходьбы (reach).
 */
export const HP_PLACES: Record<HpPlace, { rest: THREE.Vector3; front: THREE.Vector3; face: number; yaw: number; reach: Pose | null; name: string }> = {
  side: { rest: SPOTS.hpRest, front: SPOTS.tableFront, face: 0, yaw: 0.4, reach: null, name: "на столик" },
  desk: {
    rest: new THREE.Vector3(DESK.x + 0.48, 0.86, DESK.z + 0.2),
    // встаём в проход между столом и выдвинутым стулом
    front: new THREE.Vector3(DESK.x + 0.3, 0, DESK.z + 0.68),
    face: Math.PI,
    yaw: -0.3,
    reach: "desk",
    name: "на стол",
  },
  bed: {
    rest: new THREE.Vector3(-2.2, 0.855, -1.2),
    front: new THREE.Vector3(-1.45, 0, -1.2),
    face: -Math.PI / 2,
    yaw: 1.1,
    reach: "lie",
    name: "на кровать",
  },
};

export const FACE = {
  desk: Math.PI / 2, // лицом к стулу, потом разворот к столу
  lamp: -Math.PI / 2 + 0.1,
  chair: CHAIR.rot,
  bed: Math.PI / 2, // спиной к кровати: сначала садимся на край
  table: Math.atan2(SIDE_TABLE.x - SPOTS.tableFront.x, SIDE_TABLE.z - SPOTS.tableFront.z),
};
HP_PLACES.side.face = FACE.table;

/** Точка у стола слева от стула, где проход к столешнице */
const DESK_AISLE = new THREE.Vector3(DESK.x - 0.72, 0, DESK.z + 0.68);

/** Дойти до места с наушниками (или ничего, если уже дотягиваемся). */
function toPlace(place: HpPlace): Step[] {
  const pl = HP_PLACES[place];
  if (pl.reach && control.pose === pl.reach) return [];
  if (place === "desk")
    // к столу: подходим сбоку, отодвигаем стул и проходим к столешнице
    return [
      ...standFirst(),
      { k: "goto", to: SPOTS.deskSide, face: FACE.desk },
      { k: "chair", to: 1 },
      { k: "goto", to: pl.front, face: pl.face, tol: 0.05, via: [DESK_AISLE], ignore: "desk" },
    ];
  return [...standFirst(), { k: "goto", to: pl.front, face: pl.face, tol: 0.08 }];
}

/** Отойти от стола после того, как взяли/положили наушники. Стул задвигает питомец, а если его нет — сам персонаж. */
function fromPlace(place: HpPlace, near: boolean): Step[] {
  if (place !== "desk" || near) return [];
  return [
    { k: "goto", to: SPOTS.deskSide, face: FACE.desk, tol: 0.06, via: [DESK_AISLE], ignore: "desk" },
    ...chairBack(),
  ];
}

/** Задвинуть стул: зовём питомца, без питомца — сами. */
export function chairBack(): Step[] {
  if (petLink.available()) return [{ k: "cb", fn: () => petLink.pushChair() }];
  return [{ k: "chair", to: 0 }];
}

/** Состояние, которое видит интерфейс (кнопки действий). */
interface HeroUI {
  pose: Pose;
  hp: HpLoc;
  busy: boolean;
  /** где лежат наушники, когда они не у персонажа */
  place: HpPlace;
}
export const useHeroUI = create<HeroUI>(() => ({ pose: "stand", hp: "table", busy: false, place: "side" }));

export const control = {
  queue: [] as Step[],
  /** Желаемая поза и положение наушников (то, к чему стремится персонаж) */
  pose: "stand" as Pose,
  hp: "table" as HpLoc,
  /** Где лежат (или будут лежать) наушники */
  hpPlace: "side" as HpPlace,
  /** Вызывается, когда новая команда прервала подготовку к прослушиванию */
  onInterrupt: null as null | (() => void),
};

function backTo(pose: Pose): Step[] {
  if (pose === "sit") return [{ k: "goto", to: SPOTS.chairFront, face: FACE.chair }, { k: "pose", to: "sit" }];
  if (pose === "lie") return [{ k: "goto", to: SPOTS.bedSide, face: FACE.bed }, { k: "pose", to: "lie" }];
  if (pose === "desk") return [{ k: "goto", to: SPOTS.deskSide, face: FACE.desk }, { k: "pose", to: "desk" }];
  return [];
}

function standFirst(): Step[] {
  return control.pose === "stand" ? [] : [{ k: "pose", to: "stand" }];
}

function setQueue(steps: Step[]) {
  // новая команда во время подготовки к музыке отменяет прослушивание
  if (control.queue.some((s) => s.k === "do") && !steps.some((s) => s.k === "do")) control.onInterrupt?.();
  control.queue = steps;
  useHeroUI.setState({ busy: steps.length > 0 });
}

export const heroCmd = {
  /** Подойти к точке и встать лицом в заданную сторону (например, к питомцу). */
  approach(p: THREE.Vector3, face: number) {
    setQueue([...standFirst(), { k: "goto", to: nearestFree(p.x, p.z, 0.22), tol: 0.08, face }]);
  },
  walkTo(p: THREE.Vector3) {
    setQueue([...standFirst(), { k: "goto", to: nearestFree(p.x, p.z, 0.22), tol: 0.08 }]);
  },
  sit() {
    if (control.pose === "sit") return;
    setQueue([...standFirst(), { k: "goto", to: SPOTS.chairFront, face: FACE.chair }, { k: "pose", to: "sit" }]);
  },
  lie() {
    if (control.pose === "lie") return;
    // вечером без наушников сначала гасим торшер — ложимся спать
    const lightsOut = isEvening() && control.hp !== "head" && props.lampOn;
    setQueue([
      ...standFirst(),
      ...(lightsOut ? ([{ k: "goto", to: SPOTS.lampFront, face: FACE.lamp }, { k: "pull" }] as Step[]) : []),
      { k: "goto", to: SPOTS.bedSide, face: FACE.bed },
      { k: "pose", to: "lie" },
    ]);
  },
  /** Подойти к торшеру и дёрнуть шнурок (включить/выключить). */
  toggleLamp() {
    const back = control.pose;
    setQueue([...standFirst(), { k: "goto", to: SPOTS.lampFront, face: FACE.lamp }, { k: "pull" }, ...(back === "lie" ? [] : backTo(back))]);
  },
  desk() {
    if (control.pose === "desk") return;
    setQueue([...standFirst(), ...backTo("desk")]);
  },
  /** Подойти к столику и попить какао (потом вернуться, где были). */
  drink() {
    const back = control.pose;
    setQueue([...standFirst(), { k: "goto", to: SPOTS.tableFront, face: FACE.table }, { k: "drink" }, ...backTo(back)]);
  },
  stand() {
    setQueue(standFirst());
  },
  /** Подойти к столу и задвинуть выдвинутый стул самому. */
  pushChair() {
    setQueue([...standFirst(), { k: "goto", to: SPOTS.deskSide, face: FACE.desk }, { k: "chair", to: 0 }]);
  },
  takeHp(thenWear = false) {
    if (control.hp !== "table") {
      if (thenWear) setQueue([{ k: "hp", to: "head" }]);
      return;
    }
    const back = control.pose;
    const near = toPlace(control.hpPlace).length === 0;
    const steps: Step[] = [...toPlace(control.hpPlace), { k: "hp", to: "neck" }, ...fromPlace(control.hpPlace, near)];
    // если сидели или лежали — возвращаемся туда же
    if (!near) steps.push(...backTo(back));
    if (thenWear) steps.push({ k: "hp", to: "head" });
    setQueue(steps);
  },
  wearHp() {
    if (control.hp === "table") return heroCmd.takeHp(true);
    setQueue([{ k: "hp", to: "head" }]);
  },
  removeHp() {
    setQueue([{ k: "hp", to: "neck" }]);
  },
  /** Положить наушники: на столик, на письменный стол или на кровать. */
  putBackHp(place: HpPlace = control.hpPlace) {
    if (control.hp === "table") return;
    const near = toPlace(place).length === 0;
    setQueue([
      ...(control.hp === "head" ? [{ k: "hp", to: "neck" } as Step] : []),
      ...toPlace(place),
      { k: "hp", to: "table", place },
      ...fromPlace(place, near),
    ]);
  },
  /** Подготовка к прослушиванию воспоминания; onReady вызывается, когда наушники на голове. */
  prepareListening(onReady: () => void) {
    if (control.hp === "head") {
      setQueue([{ k: "do", fn: onReady }]);
      return;
    }
    const steps: Step[] = [];
    if (control.hp === "table") {
      const near = toPlace(control.hpPlace).length === 0;
      steps.push(...toPlace(control.hpPlace), { k: "hp", to: "neck" }, ...fromPlace(control.hpPlace, near));
      // классический сценарий из плана: идём в кресло, садимся (или остаёмся, где были)
      if (!near) steps.push(...backTo(control.pose === "lie" || control.pose === "desk" ? control.pose : "sit"));
    } else if (control.pose === "stand") {
      steps.push({ k: "goto", to: SPOTS.chairFront, face: FACE.chair }, { k: "pose", to: "sit" });
    }
    steps.push({ k: "hp", to: "head" }, { k: "do", fn: onReady });
    setQueue(steps);
  },
  clear() {
    setQueue([]);
  },
  shift(): Step | undefined {
    const s = control.queue.shift();
    useHeroUI.setState({ busy: control.queue.length > 0 });
    return s;
  },
};
if (import.meta.env.DEV) (window as unknown as { __hero: unknown }).__hero = { heroCmd, control };
