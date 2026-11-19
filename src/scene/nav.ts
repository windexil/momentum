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

// ---------- Поиск пути (A* по сетке) ----------
const CELL = 0.12;
const N = Math.ceil((BOUNDS * 2) / CELL);
const toCell = (v: number) => Math.max(0, Math.min(N - 1, Math.round((v + BOUNDS) / CELL)));
const toWorld = (i: number) => i * CELL - BOUNDS;
let grid: Uint8Array | null = null;
let gridR = 0;
function getGrid(r: number) {
  if (grid && gridR === r) return grid;
  grid = new Uint8Array(N * N);
  gridR = r;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) grid[j * N + i] = blocked(toWorld(i), toWorld(j), r + 0.03) ? 1 : 0;
  return grid;
}

/** Есть ли прямая видимость между точками (без столкновений). */
export function clearLine(a: THREE.Vector3, b: THREE.Vector3, r: number): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(2, Math.ceil(d / 0.05));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, r)) return false;
  }
  return true;
}

/** Маршрут в обход мебели: список точек до цели (последняя — сама цель). */
export function findPath(from: THREE.Vector3, to: THREE.Vector3, r: number): THREE.Vector3[] {
  if (clearLine(from, to, r)) return [to.clone()];
  const g = getGrid(r);
  const free = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && !g[j * N + i];
  const snap = (p: THREE.Vector3) => {
    let bi = toCell(p.x), bj = toCell(p.z);
    if (free(bi, bj)) return [bi, bj];
    for (let rad = 1; rad < 12; rad++)
      for (let di = -rad; di <= rad; di++)
        for (let dj = -rad; dj <= rad; dj++) if (free(bi + di, bj + dj)) return [bi + di, bj + dj];
    return [bi, bj];
  };
  const [si, sj] = snap(from), [gi, gj] = snap(to);
  const start = sj * N + si, goal = gj * N + gi;
  const gScore = new Float32Array(N * N).fill(Infinity);
  const came = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  const open: number[] = [start];
  const f = new Float32Array(N * N).fill(Infinity);
  gScore[start] = 0;
  const h = (c: number) => Math.hypot((c % N) - gi, Math.floor(c / N) - gj);
  f[start] = h(start);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) break;
    closed[cur] = 1;
    const ci = cur % N, cj = Math.floor(cur / N);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!free(ni, nj)) continue;
        if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue; // не срезаем углы
        const n = nj * N + ni;
        if (closed[n]) continue;
        const tg = gScore[cur] + (di && dj ? Math.SQRT2 : 1);
        if (tg < gScore[n]) {
          came[n] = cur;
          gScore[n] = tg;
          f[n] = tg + h(n);
          if (!open.includes(n)) open.push(n);
        }
      }
  }
  if (came[goal] === -1 && goal !== start) return [to.clone()];
  const cells: THREE.Vector3[] = [];
  for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.push(new THREE.Vector3(toWorld(c % N), 0, toWorld(Math.floor(c / N))));
  cells.reverse();
  cells.push(to.clone());
  // сглаживаем: выкидываем точки, если следующую видно напрямую
  const out: THREE.Vector3[] = [];
  let anchor = from.clone();
  for (let k = 0; k < cells.length; k++) {
    const next = cells[k + 1];
    if (next && clearLine(anchor, next, r)) continue;
    out.push(cells[k]);
    anchor = cells[k];
  }
  return out.length ? out : [to.clone()];
}
