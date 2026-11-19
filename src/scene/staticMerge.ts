// Склейка неподвижных деталей комнаты: сотни маленьких мешей с одним
// материалом превращаются в один, и видеокарте нужно гораздо меньше
// вызовов отрисовки (и в основном проходе, и для теней).
// Подвижные части помечаются userData.dynamic и не трогаются.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const ATTRS = ["position", "normal", "uv"] as const;

export function mergeStatic(root: THREE.Object3D): () => void {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[]; src: THREE.Mesh[] }>();

  const visit = (o: THREE.Object3D) => {
    if (o.userData.dynamic) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material) && m.visible) {
      const g = m.geometry;
      if (ATTRS.every((a) => g.getAttribute(a))) {
        let geo = g.index ? g.toNonIndexed() : g.clone();
        for (const name of Object.keys(geo.attributes)) if (!(ATTRS as readonly string[]).includes(name)) geo.deleteAttribute(name);
        geo.clearGroups();
        const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
        geo.applyMatrix4(mtx);
        // зеркальная матрица переворачивает треугольники
        if (mtx.determinant() < 0) geo = flip(geo);
        const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = { mat: m.material, cast: m.castShadow, recv: m.receiveShadow, geos: [], src: [] }));
        b.geos.push(geo);
        b.src.push(m);
      }
    }
    for (const c of o.children) visit(c);
  };
  for (const c of root.children) visit(c);

  const added: THREE.Mesh[] = [];
  const hidden: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    if (b.geos.length < 2) {
      b.geos.forEach((g) => g.dispose());
      continue;
    }
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    mesh.name = "merged";
    mesh.raycast = () => {};
    root.add(mesh);
    added.push(mesh);
    for (const s of b.src) {
      s.visible = false;
      hidden.push(s);
    }
  }
  return () => {
    for (const m of added) {
      root.remove(m);
      m.geometry.dispose();
    }
    for (const s of hidden) s.visible = true;
  };
}

function flip(g: THREE.BufferGeometry) {
  for (const name of ATTRS) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    const n = a.itemSize;
    const arr = a.array as Float32Array;
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const t = arr[(i + 1) * n + k];
        arr[(i + 1) * n + k] = arr[(i + 2) * n + k];
        arr[(i + 2) * n + k] = t;
      }
    }
    a.needsUpdate = true;
  }
  return g;
}
