// Управление персонажем: ввод (клавиатура, джойстик, клик по полу)
// и очередь действий (дойти, сесть, лечь, взять/надеть/снять наушники).

import * as THREE from "three";
import { create } from "zustand";
import { CHAIR, SIDE_TABLE } from "./Room";
import { nearestFree } from "./nav";

export type Pose = "stand" | "sit" | "lie";
export type HpLoc = "table" | "neck" | "head";

export type Step =
  | { k: "goto"; to: THREE.Vector3; face?: number; tol?: number }
  | { k: "pose"; to: Pose }
  | { k: "hp"; to: HpLoc }
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
};

export const FACE = {
  chair: CHAIR.rot,
  bed: -Math.PI / 2,
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
  /** Ввод направления: x — вправо, y — вперёд (относительно камеры), длина 0..1 */
  input: new THREE.Vector2(),
  keys: new THREE.Vector2(),
  stick: new THREE.Vector2(),
  queue: [] as Step[],
  /** Желаемая поза и положение наушников (то, к чему стремится персонаж) */
  pose: "stand" as Pose,
  hp: "table" as HpLoc,
  /** Вызывается, когда ручной ввод прервал подготовку к прослушиванию */
  onInterrupt: null as null | (() => void),
};

function standFirst(): Step[] {
  return control.pose === "stand" ? [] : [{ k: "pose", to: "stand" }];
}

function setQueue(steps: Step[]) {
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
    if (back === "sit") steps.push({ k: "goto", to: SPOTS.chairFront, face: FACE.chair }, { k: "pose", to: "sit" });
    if (back === "lie") steps.push({ k: "goto", to: SPOTS.bedSide, face: FACE.bed }, { k: "pose", to: "lie" });
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
      if (control.pose !== "lie") steps.push({ k: "goto", to: SPOTS.chairFront, face: FACE.chair }, { k: "pose", to: "sit" });
      else steps.push({ k: "goto", to: SPOTS.bedSide, face: FACE.bed }, { k: "pose", to: "lie" });
    } else if (control.pose === "stand" && control.input.lengthSq() === 0) {
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

// Клавиатура: WASD и стрелки
const pressed = new Set<string>();
function updateKeys() {
  const x = (pressed.has("d") || pressed.has("arrowright") ? 1 : 0) - (pressed.has("a") || pressed.has("arrowleft") ? 1 : 0);
  const y = (pressed.has("w") || pressed.has("arrowup") ? 1 : 0) - (pressed.has("s") || pressed.has("arrowdown") ? 1 : 0);
  control.keys.set(x, y);
  if (control.keys.lengthSq() > 1) control.keys.normalize();
}
const KEYMAP: Record<string, string> = { ц: "w", ф: "a", ы: "s", в: "d" }; // русская раскладка

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    let k = e.key.toLowerCase();
    k = KEYMAP[k] ?? k;
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      // стрелки влево/вправо в открытом альбоме листают страницы
      if (document.querySelector(".album") && k.startsWith("arrow")) return;
      pressed.add(k);
      updateKeys();
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    let k = e.key.toLowerCase();
    k = KEYMAP[k] ?? k;
    pressed.delete(k);
    updateKeys();
  });
  window.addEventListener("blur", () => {
    pressed.clear();
    updateKeys();
  });
}
