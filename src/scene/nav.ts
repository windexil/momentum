// Простая навигация: препятствия-мебель и движение со скольжением вдоль них.

import * as THREE from "three";
import { CHAIR, DESK, SIDE_TABLE } from "./Room";

type Box = { kind: "box"; x0: number; x1: number; z0: number; z1: number };
type Circle = { kind: "circle"; x: number; z: number; r: number };
export type Obstacle = (Box | Circle) & { id: string };

export const BOUNDS = 3.72;

export const OBSTACLES: Obstacle[] = [
  { id: "bed", kind: "box", x0: -3.85, x1: -1.85, z0: -3.95, z1: -0.72 },
  { id: "desk", kind: "box", x0: DESK.x - 1.05, x1: DESK.x + 1.05, z0: DESK.z - 0.55, z1: DESK.z + 1.05 },
  { id: "chair", kind: "circle", x: CHAIR.x, z: CHAIR.z, r: 0.68 },
  { id: "side", kind: "circle", x: SIDE_TABLE.x, z: SIDE_TABLE.z, r: 0.36 },
  { id: "plant1", kind: "circle", x: 3.3, z: -1.6, r: 0.38 },
  { id: "plant2", kind: "circle", x: -3.3, z: 2.9, r: 0.32 },
  { id: "lamp", kind: "circle", x: -3.2, z: 1.0, r: 0.24 },
  { id: "shelf", kind: "box", x0: -4, x1: -3.6, z0: 1.0, z1: 2.8 },
];

export function blocked(x: number, z: number, r: number, ignore?: string): boolean {
  if (Math.abs(x) > BOUNDS - r || Math.abs(z) > BOUNDS - r) return true;
  for (const o of OBSTACLES) {
    if (o.id === ignore) continue;
    if (o.kind === "box") {
      const cx = Math.max(o.x0, Math.min(x, o.x1));
      const cz = Math.max(o.z0, Math.min(z, o.z1));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    } else if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + r) ** 2) return true;
  }
  return false;
}

/** Двигает точку на (dx, dz), скользя вдоль препятствий. Возвращает true, если сдвинулись. */
export function moveWithCollision(pos: THREE.Vector3, dx: number, dz: number, r: number, ignore?: string): boolean {
  const nx = pos.x + dx, nz = pos.z + dz;
  if (!blocked(nx, nz, r, ignore)) {
    pos.x = nx;
    pos.z = nz;
    return true;
  }
  if (!blocked(nx, pos.z, r, ignore)) {
    pos.x = nx;
    return true;
  }
  if (!blocked(pos.x, nz, r, ignore)) {
    pos.z = nz;
    return true;
  }
  return false;
}

/** Ближайшая свободная точка (для клика по мебели или стене). */
export function nearestFree(x: number, z: number, r: number): THREE.Vector3 {
  if (!blocked(x, z, r)) return new THREE.Vector3(x, 0, z);
  for (let rad = 0.1; rad < 3; rad += 0.1) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad;
      if (!blocked(px, pz, r)) return new THREE.Vector3(px, 0, pz);
    }
  }
  return new THREE.Vector3(0, 0, 0);
}
