// Управление персонажем: клик или тап по полу и мебели, кнопки действий
// и очередь действий (дойти, сесть, лечь, взять/надеть/снять наушники).

import * as THREE from "three";
import { create } from "zustand";
import { CHAIR, DESK, SIDE_TABLE } from "./Room";
import { nearestFree } from "./nav";

export type Pose = "stand" | "sit" | "lie" | "desk";
export type HpLoc = "table" | "neck" | "head";

export type Step =
  | { k: "goto"; to: THREE.Vector3; face?: number; tol?: number }
  | { k: "pose"; to: Pose }
  | { k: "hp"; to: HpLoc }
  | { k: "drink" }
  | { k: "do"; fn: () => void };

export const SPOTS = {
  home: new THREE.Vector3(1.4, 0, -1.2),
  chairFront: new THREE.Vector3(CHAIR.x + Math.sin(CHAIR.rot) * 1.0, 0, CHAIR.z + Math.cos(CHAIR.rot) * 1.0),
  chairSeat: new THREE.Vector3(CHAIR.x + Math.sin(CHAIR.rot) * 0.12, 0, CHAIR.z + Math.cos(CHAIR.rot) * 0.12),
  bedSide: new THREE.Vector3(-1.55, 0, -1.9),
  /** Точка «ног» персонажа на кровати; голова к подушке. */
  bedLie: new THREE.Vector3(-2.85, 0.78, -1.25),
  tableFront: new THREE.Vector3(SIDE_TABLE.x + 0.62, 0, SIDE_TABLE.z - 0.42),
  hpRest: new THREE.Vector3(SIDE_TABLE.x - 0.05, 0.67, SIDE_TABLE.z - 0.08),
  /** Кружка какао на столике */
  mugRest: new THREE.Vector3(SIDE_TABLE.x + 0.14, 0.67, SIDE_TABLE.z + 0.12),
  /** Сбоку от стула у письменного стола: отсюда выдвигаем стул и садимся */
  deskSide: new THREE.Vector3(DESK.x - 0.72, 0, DESK.z + 1.4),
};

export const FACE = {
  desk: Math.PI / 2, // лицом к стулу, потом разворот к столу
  chair: CHAIR.rot,
  bed: Math.PI / 2, // спиной к кровати: сначала садимся на край
  table: Math.atan2(SIDE_TABLE.x - SPOTS.tableFront.x, SIDE_TABLE.z - SPOTS.tableFront.z),
};

/** Состояние, которое видит интерфейс (кнопки действий). */
interface HeroUI {
  pose: Pose;
  hp: HpLoc;
  busy: boolean;
}
export const useHeroUI = create<HeroUI>(() => ({ pose: "stand", hp: "table", busy: false }));

export const control = {
  queue: [] as Step[],
  /** Желаемая поза и положение наушников (то, к чему стремится персонаж) */
  pose: "stand" as Pose,
  hp: "table" as HpLoc,
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
  walkTo(p: THREE.Vector3) {
    setQueue([...standFirst(), { k: "goto", to: nearestFree(p.x, p.z, 0.22), tol: 0.08 }]);
  },
  sit() {
    if (control.pose === "sit") return;
    setQueue([...standFirst(), { k: "goto", to: SPOTS.chairFront, face: FACE.chair }, { k: "pose", to: "sit" }]);
  },
  lie() {
    if (control.pose === "lie") return;
    setQueue([...standFirst(), { k: "goto", to: SPOTS.bedSide, face: FACE.bed }, { k: "pose", to: "lie" }]);
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
  takeHp(thenWear = false) {
    if (control.hp !== "table") {
      if (thenWear) setQueue([{ k: "hp", to: "head" }]);
      return;
    }
    const back = control.pose;
    const steps: Step[] = [
      ...standFirst(),
      { k: "goto", to: SPOTS.tableFront, face: FACE.table },
      { k: "hp", to: "neck" },
    ];
    // если сидели или лежали — возвращаемся туда же
    steps.push(...backTo(back));
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
  putBackHp() {
    setQueue([
      ...(control.hp === "head" ? [{ k: "hp", to: "neck" } as Step] : []),
      ...standFirst(),
      { k: "goto", to: SPOTS.tableFront, face: FACE.table },
      { k: "hp", to: "table" },
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
      steps.push(...standFirst(), { k: "goto", to: SPOTS.tableFront, face: FACE.table }, { k: "hp", to: "neck" });
      // классический сценарий из плана: идём в кресло, садимся
      steps.push(...backTo(control.pose === "lie" || control.pose === "desk" ? control.pose : "sit"));
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
