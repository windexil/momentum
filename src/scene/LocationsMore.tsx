// Ещё шесть локаций воспоминаний: горы, осенний парк, деревня, концерт,
// пустыня и ярмарка с колесом обозрения. Тот же принцип, что в Locations.tsx:
// всё из простых фигур, персонаж стоит в начале координат, камера смотрит
// с +z на -z, поэтому главное — позади персонажа, а перед ним свободно.

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { live } from "./live";
import { Firs, Ground, Inst, mat, rng, scatter, type Item } from "./Locations";

const glow = (color: string, k = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k });

/** Скамейка: сиденье, спинка и две опоры */
function Bench({ p, rot = 0, wood, metal }: { p: [number, number, number]; rot?: number; wood: THREE.Material; metal: THREE.Material }) {
  return (
    <group position={p} rotation-y={rot}>
      <mesh position={[0, 0.42, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.06, 0.42]} />
      </mesh>
      <mesh position={[0, 0.72, -0.19]} rotation-x={-0.12} material={wood} castShadow>
        <boxGeometry args={[1.5, 0.3, 0.05]} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.21, 0]} material={metal} castShadow>
          <boxGeometry args={[0.06, 0.42, 0.4]} />
        </mesh>
      ))}
    </group>
  );
}

/** Фонарный столб, свет которого разгорается к ночи */
function Lamp({ p, pole, bulb }: { p: [number, number, number]; pole: THREE.Material; bulb: THREE.Material }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (light.current) light.current.intensity = 0.6 + live.night * 6;
  });
  return (
    <group position={p}>
      <mesh position={[0, 1.4, 0]} material={pole} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 2.8, 8]} />
      </mesh>
      <mesh position={[0, 2.88, 0]} material={bulb}>
        <sphereGeometry args={[0.14, 12, 8]} />
      </mesh>
      <pointLight ref={light} position={[0, 2.7, 0]} color="#ffd98a" distance={7} decay={1.5} />
    </group>
  );
}

// ---------- горы ----------

export function Mountains() {
  const flag = useRef<THREE.Mesh>(null);
  const m = useMemo(
    () => ({
      rock: mat("#7d7a82", { flatShading: true }),
      rock2: mat("#69707c", { flatShading: true }),
      snow: mat("#f5f8fc", { flatShading: true, roughness: 0.9 }),
      lake: new THREE.MeshStandardMaterial({ color: "#4f9cc4", roughness: 0.1, metalness: 0.25 }),
      tent: mat("#f08a24", { flatShading: true }),
      pole: mat("#5b3d27"),
      flag: new THREE.MeshStandardMaterial({ color: "#e84545", side: THREE.DoubleSide }),
      stone: mat("#8e8c88", { flatShading: true }),
      flower: glow("#ffd166", 0.4),
    }),
    [],
  );
  const geo = useMemo(() => ({ cone: new THREE.ConeGeometry(1, 1, 7), stone: new THREE.DodecahedronGeometry(1, 0), ball: new THREE.SphereGeometry(1, 8, 6) }), []);
  // хребет: большие вершины вдали, пониже — ближе, у каждой снежная шапка
  const peaks = useMemo(() => {
    const r = rng(31);
    const big: Item[] = [], mid: Item[] = [], caps: Item[] = [];
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 10 + (r() * 2 - 1) * 3, z = -34 - r() * 8, h = 14 + r() * 10, w = 8 + r() * 5;
      big.push({ p: [x, h / 2 - 0.5, z], s: [w, h, w], r: [0, r() * 3, 0] });
      caps.push({ p: [x, h - 0.5 - h * 0.17, z], s: [w * 0.36, h * 0.34, w * 0.36], r: [0, r() * 3, 0] });
    }
    for (let i = 0; i < 8; i++) {
      const x = -30 + i * 8.5 + (r() * 2 - 1) * 2, z = -20 - r() * 6, h = 6 + r() * 5, w = 5 + r() * 3;
      mid.push({ p: [x, h / 2 - 0.3, z], s: [w, h, w], r: [0, r() * 3, 0] });
    }
    return { big, mid, caps };
  }, []);
  const firs = useMemo(() => scatter(41, 26, (x, z) => z > -18 && Math.hypot(x - 4, z + 7) > 3.2, { x: 22, z0: -18, z1: 6 }), []);
  const stones = useMemo<Item[]>(() => {
    const r = rng(43);
    return Array.from({ length: 14 }, () => {
      let x = (r() * 2 - 1) * 10;
      if (Math.abs(x) < 1.8) x += x < 0 ? -2 : 2;
      return { p: [x, 0.05, -1 - r() * 9], s: [0.2 + r() * 0.5, 0.15 + r() * 0.35, 0.2 + r() * 0.5], r: [r(), r() * 3, 0] };
    });
  }, []);
  const flowers = useMemo<Item[]>(() => {
    const r = rng(47);
    return Array.from({ length: 40 }, () => ({ p: [(r() * 2 - 1) * 6, 0.06, -0.5 - r() * 5], s: 0.04 + r() * 0.03 }));
  }, []);
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.25;
  });
  return (
    <group>
      <Ground color="#7f9a5a" />
      <Inst geo={geo.cone} material={m.rock2} items={peaks.big} shadow={false} />
      <Inst geo={geo.cone} material={m.snow} items={peaks.caps} shadow={false} />
      <Inst geo={geo.cone} material={m.rock} items={peaks.mid} shadow={false} />
      <Firs items={firs} green="#2d5e3c" />
      {/* горное озеро */}
      <mesh rotation-x={-Math.PI / 2} position={[4, 0.015, -7]} scale={[3, 1.8, 1]} material={m.lake} receiveShadow>
        <circleGeometry args={[1, 32]} />
      </mesh>
      <Inst geo={geo.stone} material={m.stone} items={stones} />
      <Inst geo={geo.ball} material={m.flower} items={flowers} shadow={false} />
      {/* палатка и флажок на камне */}
      <group position={[-2.6, 0, -2.2]} rotation-y={0.5}>
        <mesh position={[0, 0.55, 0]} rotation-y={Math.PI / 4} scale={[1.2, 1.1, 1.6]} material={m.tent} castShadow>
          <coneGeometry args={[1, 1, 4]} />
        </mesh>
      </group>
      <group position={[2.2, 0, -1.6]}>
        <mesh position={[0, 0.3, 0]} scale={[0.6, 0.45, 0.5]} geometry={geo.stone} material={m.stone} castShadow />
        <mesh position={[0, 1.15, 0]} material={m.pole}>
          <cylinderGeometry args={[0.02, 0.02, 1.4, 5]} />
        </mesh>
        <mesh ref={flag} position={[0.2, 1.65, 0]} material={m.flag}>
          <planeGeometry args={[0.4, 0.26]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- осенний парк ----------

export function Park() {
  const falling = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(
    () => ({
      path: mat("#b9a07a"),
      bark: mat("#5e4130"),
      orange: mat("#e98a2b", { flatShading: true }),
      red: mat("#c9452f", { flatShading: true }),
      yellow: mat("#e9c03a", { flatShading: true }),
      leaf: new THREE.MeshStandardMaterial({ color: "#e0802c", side: THREE.DoubleSide, roughness: 0.8 }),
      wood: mat("#8a5a36"),
      metal: mat("#2f3138", { metalness: 0.5, roughness: 0.45 }),
      bulb: glow("#ffe2a8", 2.5),
      pond: new THREE.MeshStandardMaterial({ color: "#5d8fa3", roughness: 0.12, metalness: 0.2 }),
      duck: mat("#f4f1e8"),
      beak: mat("#f0a020"),
    }),
    [],
  );
  const geo = useMemo(() => ({ ball: new THREE.IcosahedronGeometry(1, 1), trunk: new THREE.CylinderGeometry(0.1, 0.16, 1, 6), leaf: new THREE.PlaneGeometry(0.09, 0.07) }), []);
  const trees = useMemo(() => scatter(53, 34, (x, z) => !(Math.abs(x) < 1.6 && z < 0) && Math.hypot(x + 4.5, z + 6) > 2.8), []);
  const crowns = useMemo(() => {
    const out: [Item[], Item[], Item[]] = [[], [], []];
    const trunks: Item[] = [];
    trees.forEach((t, i) => {
      trunks.push({ p: [t.x, 0.9 * t.s, t.z], s: [t.s, 1.8 * t.s, t.s] });
      out[i % 3].push({ p: [t.x, 2.4 * t.s, t.z], s: 1.15 * t.s, r: [i, i * 2, 0] });
      out[(i + 1) % 3].push({ p: [t.x + 0.5 * t.s, 2.0 * t.s, t.z + 0.3], s: 0.75 * t.s, r: [i, i, 0] });
    });
    return { out, trunks };
  }, [trees]);
  // опавшие листья на траве
  const ground = useMemo<Item[]>(() => {
    const r = rng(57);
    return Array.from({ length: 160 }, () => ({ p: [(r() * 2 - 1) * 9, 0.012, 2 - r() * 12], s: 0.8 + r() * 1.2, r: [-Math.PI / 2, 0, r() * 6] }));
  }, []);
  const leafMats = useMemo(() => [m.orange, m.red, m.yellow], [m]);
  // падающие листья кружатся и снова поднимаются вверх
  const fall = useMemo(() => {
    const r = rng(59);
    return Array.from({ length: 40 }, () => ({ x: (r() * 2 - 1) * 6, z: -r() * 7, y0: r() * 4, sp: 0.25 + r() * 0.3, ph: r() * 6 }));
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const mesh = falling.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    fall.forEach((f, i) => {
      const y = 4.2 - ((f.y0 + t * f.sp) % 4.2);
      o.position.set(f.x + Math.sin(t * 1.3 + f.ph) * 0.4, y, f.z + Math.cos(t + f.ph) * 0.2);
      o.rotation.set(t * 2 + f.ph, t * 1.5, f.ph);
      o.scale.setScalar(1.6);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <Ground color="#8a9452" />
      {/* аллея уходит вглубь парка */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -12]} material={m.path} receiveShadow>
        <planeGeometry args={[2.2, 30]} />
      </mesh>
      <Inst geo={geo.trunk} material={m.bark} items={crowns.trunks} />
      {crowns.out.map((items, i) => (
        <Inst key={i} geo={geo.ball} material={leafMats[i]} items={items} />
      ))}
      {[0, 1, 2].map((k) => (
        <Inst key={k} geo={geo.leaf} material={leafMats[k]} items={ground.filter((_, i) => i % 3 === k)} shadow={false} />
      ))}
      <instancedMesh ref={falling} args={[geo.leaf, m.leaf, fall.length]} />
      <Bench p={[-2.1, 0, -1.4]} rot={0.15} wood={m.wood} metal={m.metal} />
      <Bench p={[2.3, 0, -3.2]} rot={-0.2} wood={m.wood} metal={m.metal} />
      <Lamp p={[-1.6, 0, -4.5]} pole={m.metal} bulb={m.bulb} />
      <Lamp p={[1.6, 0, -9]} pole={m.metal} bulb={m.bulb} />
      {/* пруд с уточками */}
      <mesh rotation-x={-Math.PI / 2} position={[-4.5, 0.012, -6]} scale={[2.4, 1.6, 1]} material={m.pond} receiveShadow>
        <circleGeometry args={[1, 32]} />
      </mesh>
      {[
        [-4.9, -5.6],
        [-3.9, -6.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.06, z]} rotation-y={i * 2}>
          <mesh scale={[0.16, 0.1, 0.22]} material={m.duck}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
          <mesh position={[0, 0.12, 0.13]} scale={0.07} material={m.duck}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
          <mesh position={[0, 0.11, 0.21]} rotation-x={Math.PI / 2} material={m.beak}>
            <coneGeometry args={[0.025, 0.06, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- деревня ----------

export function Village() {
  const smoke = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      wall: mat("#c98d55", { flatShading: true }),
      log: mat("#9a6a40", { flatShading: true }),
      roof: mat("#a8433a", { flatShading: true }),
      frame: mat("#f3ead8"),
      win: new THREE.MeshStandardMaterial({ color: "#ffd98a", emissive: "#ffb347", emissiveIntensity: 0.4 }),
      fence: mat("#b58a5a"),
      bed: mat("#6b4a32"),
      green: mat("#4f8f3c", { flatShading: true }),
      petal: mat("#f2c12e", { flatShading: true }),
      seed: mat("#4a3020"),
      stem: mat("#5d8f3a"),
      hay: mat("#e0bd5c", { flatShading: true }),
      stone: mat("#8f8a82", { flatShading: true }),
      field: mat("#d9b95b"),
      smoke: new THREE.MeshStandardMaterial({ color: "#e9e6e0", transparent: true, opacity: 0.5, roughness: 1 }),
      apple: mat("#d33a2c"),
    }),
    [],
  );
  const geo = useMemo(() => ({ post: new THREE.BoxGeometry(0.08, 0.7, 0.05), ball: new THREE.IcosahedronGeometry(1, 1), trunk: new THREE.CylinderGeometry(0.1, 0.15, 1, 6), sphere: new THREE.SphereGeometry(1, 8, 6) }), []);
  // забор вдоль двора
  const fence = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (let x = -9; x <= 9; x += 0.32) if (Math.abs(x) > 1.2) out.push({ p: [x, 0.35, -3.2], s: 1 });
    return out;
  }, []);
  const sunflowers = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: 2.6 + i * 0.42, z: -2.6 + (i % 2) * 0.25, h: 1.3 + (i % 3) * 0.2 })), []);
  const trees = useMemo(() => scatter(61, 14, (x, z) => z < -6 && Math.hypot(x + 3.2, z + 8) > 3.5, { x: 22, z0: -24, z1: -6 }), []);
  const treeItems = useMemo(() => {
    const crowns: Item[] = [], trunks: Item[] = [], apples: Item[] = [];
    const r = rng(63);
    trees.forEach((t, i) => {
      trunks.push({ p: [t.x, 0.7 * t.s, t.z], s: [t.s, 1.4 * t.s, t.s] });
      crowns.push({ p: [t.x, 1.9 * t.s, t.z], s: 1.1 * t.s, r: [i, i, 0] });
      for (let k = 0; k < 5; k++) {
        const a = r() * 6.28, y = 1.6 + r() * 0.8;
        apples.push({ p: [t.x + Math.cos(a) * 1.05 * t.s, y * t.s, t.z + Math.sin(a) * 1.05 * t.s], s: 0.08 });
      }
    });
    return { crowns, trunks, apples };
  }, [trees]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    smoke.current?.children.forEach((c, i) => {
      const k = (t * 0.25 + i / 4) % 1;
      c.position.set(Math.sin(k * 4 + i) * 0.2, k * 2.4, 0);
      c.scale.setScalar(0.15 + k * 0.35);
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = (1 - k) * 0.5;
    });
  });
  return (
    <group>
      <Ground color="#79a34d" />
      {/* поле пшеницы за деревней */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, -30]} material={m.field} receiveShadow>
        <planeGeometry args={[120, 14]} />
      </mesh>
      <Inst geo={geo.post} material={m.fence} items={fence} />
      <mesh position={[-5, 0.55, -3.2]} material={m.fence} castShadow>
        <boxGeometry args={[8, 0.06, 0.04]} />
      </mesh>
      <mesh position={[5, 0.55, -3.2]} material={m.fence} castShadow>
        <boxGeometry args={[8, 0.06, 0.04]} />
      </mesh>
      {/* деревянный дом с резными наличниками и печной трубой */}
      <group position={[-3.2, 0, -8]} rotation-y={0.2}>
        <mesh position={[0, 1.1, 0]} material={m.log} castShadow receiveShadow>
          <boxGeometry args={[4, 2.2, 3]} />
        </mesh>
        <mesh position={[0, 2.85, 0]} rotation-z={Math.PI / 2} scale={[1.3, 2.4, 1.85]} material={m.roof} castShadow>
          <cylinderGeometry args={[1, 1, 1, 3]} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <group key={x} position={[x, 1.2, 1.52]}>
            <mesh material={m.frame}>
              <boxGeometry args={[0.8, 0.85, 0.04]} />
            </mesh>
            <mesh position={[0, 0, 0.03]} material={m.win}>
              <planeGeometry args={[0.6, 0.65]} />
            </mesh>
          </group>
        ))}
        <mesh position={[1.1, 3.3, -0.4]} material={m.stone} castShadow>
          <boxGeometry args={[0.35, 1, 0.35]} />
        </mesh>
        <group ref={smoke} position={[1.1, 3.9, -0.4]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} geometry={geo.sphere} material={m.smoke.clone()} />
          ))}
        </group>
      </group>
      {/* грядки, подсолнухи и стог сена */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-3 + i * 1.1, 0, -1.6]}>
          <mesh position={[0, 0.06, 0]} material={m.bed} receiveShadow>
            <boxGeometry args={[0.7, 0.12, 1.4]} />
          </mesh>
          {[-0.45, 0, 0.45].map((z) => (
            <mesh key={z} position={[0, 0.2, z]} scale={[0.18, 0.12, 0.18]} geometry={geo.ball} material={m.green} />
          ))}
        </group>
      ))}
      {sunflowers.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <mesh position={[0, f.h / 2, 0]} material={m.stem}>
            <cylinderGeometry args={[0.02, 0.025, f.h, 5]} />
          </mesh>
          <group position={[0, f.h, 0.04]} rotation-x={0.35}>
            <mesh material={m.petal} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 12]} />
            </mesh>
            <mesh position={[0, 0, 0.012]} material={m.seed} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.08, 0.08, 0.03, 10]} />
            </mesh>
          </group>
        </group>
      ))}
      <mesh position={[5.6, 0.7, -6]} scale={[1.1, 0.8, 1.1]} material={m.hay} castShadow>
        <sphereGeometry args={[1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* колодец */}
      <group position={[2.2, 0, -5.5]}>
        <mesh position={[0, 0.35, 0]} material={m.stone} castShadow>
          <cylinderGeometry args={[0.5, 0.55, 0.7, 10]} />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 1, 0]} material={m.log}>
            <boxGeometry args={[0.07, 1.3, 0.07]} />
          </mesh>
        ))}
        <mesh position={[0, 1.75, 0]} rotation-z={Math.PI / 2} scale={[0.4, 1.1, 0.5]} material={m.roof} castShadow>
          <cylinderGeometry args={[1, 1, 1, 3]} />
        </mesh>
      </group>
      {/* яблони */}
      <Inst geo={geo.trunk} material={m.log} items={treeItems.trunks} />
      <Inst geo={geo.ball} material={m.green} items={treeItems.crowns} />
      <Inst geo={geo.sphere} material={m.apple} items={treeItems.apples} shadow={false} />
    </group>
  );
}

// ---------- концерт ----------

const BEAM_COLORS = ["#ff4fa3", "#4fc3ff", "#b77bff", "#ffd34f", "#4fffb0", "#ff784f"];

export function Concert() {
  const beams = useRef<THREE.Group>(null);
  const crowd = useRef<THREE.InstancedMesh>(null);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const m = useMemo(
    () => ({
      floor: mat("#2a2630"),
      stage: mat("#1d1b22", { roughness: 0.6 }),
      edge: glow("#ff4fa3", 1.5),
      truss: mat("#9a9ca6", { metalness: 0.7, roughness: 0.35 }),
      speaker: mat("#121216", { roughness: 0.7 }),
      cone: mat("#3a3a44"),
      people: mat("#2b2833", { roughness: 0.9 }),
      stick: glow("#7dffb0", 3),
    }),
    [],
  );
  const beamMats = useMemo(
    () => BEAM_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    [],
  );
  const beamGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(1.2, 9, 16, 1, true);
    g.translate(0, -4.5, 0);
    return g;
  }, []);
  // зрители: силуэты, которые подпрыгивают под музыку
  const people = useMemo(() => {
    const r = rng(71);
    const out: { x: number; z: number; h: number; ph: number }[] = [];
    for (let i = 0; out.length < 70 && i < 600; i++) {
      const x = (r() * 2 - 1) * 9, z = -2.2 - r() * 8;
      if (Math.abs(x) < 1.4 && z > -3.5) continue;
      out.push({ x, z, h: 0.9 + r() * 0.35, ph: r() * 6 });
    }
    return out;
  }, []);
  const personGeo = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.17, 0.6, 4, 8);
    g.translate(0, 0.47, 0);
    return g;
  }, []);
  const stickGeo = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), []);
  const sticks = useMemo<Item[]>(() => people.filter((_, i) => i % 6 === 0).map((p) => ({ p: [p.x + 0.12, p.h + 0.45, p.z], s: [1, 1, 1], r: [0, 0, 0.5] })), [people]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const beat = Math.max(0, Math.sin(t * Math.PI * 2 * 2)) ** 3; // 120 ударов в минуту
    beams.current?.children.forEach((b, i) => {
      b.rotation.z = Math.sin(t * (0.6 + i * 0.13) + i) * 0.55;
      b.rotation.x = 0.25 + Math.sin(t * 0.8 + i * 2) * 0.2;
      beamMats[i % beamMats.length].opacity = 0.12 + beat * 0.16 + live.night * 0.08;
    });
    if (crowd.current) {
      people.forEach((p, i) => {
        o.position.set(p.x, Math.max(0, Math.sin(t * Math.PI * 4 + p.ph)) * 0.12, p.z);
        o.scale.set(1, p.h, 1);
        o.rotation.set(0, 0, Math.sin(t * 2 + p.ph) * 0.08);
        o.updateMatrix();
        crowd.current!.setMatrixAt(i, o.matrix);
      });
      crowd.current.instanceMatrix.needsUpdate = true;
    }
    if (screen.current) {
      c.setHSL((t * 0.05) % 1, 0.8, 0.5);
      screen.current.emissive.copy(c);
      screen.current.emissiveIntensity = 0.8 + beat * 1.2;
    }
  });
  return (
    <group>
      <Ground color="#3a3540" />
      {/* сцена с подсвеченным краем, фермами, колонками и экраном */}
      <group position={[0, 0, -13]}>
        <mesh position={[0, 0.6, 0]} material={m.stage} receiveShadow castShadow>
          <boxGeometry args={[14, 1.2, 6]} />
        </mesh>
        <mesh position={[0, 1.2, 3.01]} material={m.edge}>
          <boxGeometry args={[14, 0.06, 0.02]} />
        </mesh>
        {[-6.8, 6.8].map((x) => (
          <mesh key={x} position={[x, 4.5, 2.5]} material={m.truss} castShadow>
            <boxGeometry args={[0.25, 7, 0.25]} />
          </mesh>
        ))}
        <mesh position={[0, 8, 2.5]} material={m.truss} castShadow>
          <boxGeometry args={[13.9, 0.25, 0.25]} />
        </mesh>
        <mesh position={[0, 4.6, -2.5]}>
          <planeGeometry args={[9, 4.5]} />
          <meshStandardMaterial ref={screen} color="#111" emissive="#ff4fa3" emissiveIntensity={1} />
        </mesh>
        {[-5.5, 5.5].map((x) => (
          <group key={x} position={[x, 1.2, 1.8]}>
            <mesh position={[0, 1.3, 0]} material={m.speaker} castShadow>
              <boxGeometry args={[1.4, 2.6, 1]} />
            </mesh>
            {[0.6, 1.6].map((y) => (
              <mesh key={y} position={[0, y, 0.51]} material={m.cone}>
                <circleGeometry args={[0.38, 20]} />
              </mesh>
            ))}
          </group>
        ))}
        <group ref={beams} position={[0, 8, 2.5]}>
          {BEAM_COLORS.map((_, i) => (
            <mesh key={i} position={[-5.5 + i * 2.2, 0, 0]} geometry={beamGeo} material={beamMats[i]} />
          ))}
        </group>
      </group>
      <instancedMesh ref={crowd} args={[personGeo, m.people, people.length]} castShadow />
      <Inst geo={stickGeo} material={m.stick} items={sticks} shadow={false} />
    </group>
  );
}

// ---------- пустыня ----------

export function Desert() {
  const m = useMemo(
    () => ({
      dune: mat("#e2b878", { roughness: 1 }),
      dune2: mat("#d6a465", { roughness: 1 }),
      cactus: mat("#4f8a4a", { flatShading: true }),
      rock: mat("#b86a45", { flatShading: true }),
      mesa: mat("#c0784c", { flatShading: true }),
      cloth: mat("#3f6fb5"),
      pole: mat("#7a5435"),
      water: new THREE.MeshStandardMaterial({ color: "#47a7b8", roughness: 0.1, metalness: 0.2 }),
      palm: mat("#3f8f4a", { flatShading: true }),
      flower: glow("#ff6fa1", 0.6),
    }),
    [],
  );
  const geo = useMemo(() => ({ sphere: new THREE.SphereGeometry(1, 16, 10), stone: new THREE.DodecahedronGeometry(1, 0), cyl: new THREE.CylinderGeometry(1, 1, 1, 8) }), []);
  const dunes = useMemo<Item[]>(() => {
    const r = rng(81);
    return Array.from({ length: 22 }, () => {
      let x = (r() * 2 - 1) * 30;
      const z = -6 - r() * 30;
      if (Math.abs(x) < 4 && z > -10) x += x < 0 ? -5 : 5;
      return { p: [x, -0.4, z], s: [3 + r() * 5, 0.9 + r() * 1.6, 2 + r() * 3], r: [0, r() * 3, 0] };
    });
  }, []);
  const mesas = useMemo<Item[]>(() => [
    { p: [-18, 3, -40], s: [7, 6, 5] },
    { p: [12, 2.4, -44], s: [9, 4.8, 6] },
    { p: [26, 3.5, -36], s: [5, 7, 4] },
  ], []);
  const cacti = useMemo(() => [
    { x: -2.4, z: -2.2, h: 1.6 },
    { x: 3.1, z: -3.5, h: 2.1 },
    { x: -5.5, z: -6, h: 2.4 },
    { x: 6.5, z: -1.5, h: 1.3 },
    { x: 1.4, z: -8, h: 1.9 },
  ], []);
  const rocks = useMemo<Item[]>(() => {
    const r = rng(83);
    return Array.from({ length: 10 }, () => {
      let x = (r() * 2 - 1) * 9;
      if (Math.abs(x) < 1.8) x += x < 0 ? -2 : 2;
      return { p: [x, 0.05, -1 - r() * 8], s: [0.2 + r() * 0.4, 0.15 + r() * 0.3, 0.2 + r() * 0.4], r: [r(), r() * 3, 0] };
    });
  }, []);
  return (
    <group>
      <Ground color="#e8c58a" />
      <Inst geo={geo.sphere} material={m.dune} items={dunes.filter((_, i) => i % 2 === 0)} />
      <Inst geo={geo.sphere} material={m.dune2} items={dunes.filter((_, i) => i % 2 === 1)} />
      <Inst geo={geo.cyl} material={m.mesa} items={mesas} shadow={false} />
      <Inst geo={geo.stone} material={m.rock} items={rocks} />
      {cacti.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation-y={i}>
          <mesh position={[0, c.h / 2, 0]} material={m.cactus} castShadow>
            <capsuleGeometry args={[0.16, c.h - 0.3, 4, 8]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.22, c.h * (0.45 + (s > 0 ? 0.1 : 0)), 0]}>
              <mesh position={[s * 0.06, 0, 0]} rotation-z={Math.PI / 2} material={m.cactus} castShadow>
                <capsuleGeometry args={[0.09, 0.14, 4, 6]} />
              </mesh>
              <mesh position={[s * 0.16, 0.22, 0]} material={m.cactus} castShadow>
                <capsuleGeometry args={[0.09, 0.32, 4, 6]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, c.h + 0.02, 0]} scale={0.07} geometry={geo.sphere} material={m.flower} />
        </group>
      ))}
      {/* оазис и шатёр путешественника */}
      <mesh rotation-x={-Math.PI / 2} position={[-7, 0.015, -10]} scale={[2.6, 1.6, 1]} material={m.water} receiveShadow>
        <circleGeometry args={[1, 32]} />
      </mesh>
      <group position={[2.6, 0, -1.8]} rotation-y={-0.4}>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} position={[x, 0.8, 0]} material={m.pole}>
            <cylinderGeometry args={[0.03, 0.03, 1.6, 5]} />
          </mesh>
        ))}
        <mesh position={[0, 1.62, 0]} rotation-z={Math.PI / 2} scale={[0.5, 1.7, 1.2]} material={m.cloth} castShadow>
          <cylinderGeometry args={[1, 1, 1, 3, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- ярмарка ----------

export function Fair() {
  const wheel = useRef<THREE.Group>(null);
  const carousel = useRef<THREE.Group>(null);
  const balloons = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      path: mat("#c9b48e"),
      steel: mat("#e8e6ef", { metalness: 0.4, roughness: 0.4 }),
      cabin: [mat("#ff6f61"), mat("#ffd166"), mat("#4fb3e8"), mat("#80ed99")],
      roofA: mat("#e84545"),
      roofB: mat("#fbf6ec"),
      base: mat("#7a4b8c"),
      pole: mat("#ffd36b", { metalness: 0.5, roughness: 0.35 }),
      horse: mat("#fbf6ec"),
      stall: mat("#8a5a36"),
      bulbs: [glow("#ffd98a", 2.5), glow("#ff8fab", 2.5), glow("#9bf6ff", 2.5)],
      string: mat("#333"),
    }),
    [],
  );
  const R = 5.2, CABINS = 12;
  const spokes = useMemo<Item[]>(
    () => Array.from({ length: CABINS }, (_, i) => ({ p: [0, 0, 0], s: [0.06, R, 0.06], r: [0, 0, (i / CABINS) * Math.PI * 2] })),
    [],
  );
  const spokeGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  // гирлянды лампочек над аллеей
  const bulbs = useMemo(() => {
    const out: Item[][] = [[], [], []];
    for (let row = 0; row < 3; row++) {
      const z = -2.5 - row * 3;
      for (let i = 0; i <= 26; i++) {
        const x = -6.5 + i * 0.5, sag = Math.sin((i / 26) * Math.PI) * 0.6;
        out[i % 3].push({ p: [x, 3.2 - sag, z], s: 0.06 });
      }
    }
    return out;
  }, []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const balloonCols = ["#ff4d6d", "#ffd166", "#4cc9f0", "#80ed99", "#b77bff"];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (wheel.current) {
      wheel.current.rotation.z = t * 0.12;
      // кабинки всегда висят вертикально
      wheel.current.children.forEach((c) => {
        if (c.userData.cabin) c.rotation.z = -t * 0.12;
      });
    }
    if (carousel.current) {
      carousel.current.rotation.y = t * 0.6;
      carousel.current.children.forEach((c, i) => {
        if (c.userData.horse) c.position.y = 0.9 + Math.sin(t * 2.4 + i) * 0.18;
      });
    }
    m.bulbs.forEach((b, i) => (b.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 3 + i * 2.1)) * 2 + live.night));
    balloons.current?.children.forEach((b, i) => {
      b.position.y = 2.2 + Math.sin(t * 1.2 + i) * 0.08;
      b.rotation.z = Math.sin(t * 0.9 + i) * 0.08;
    });
  });
  return (
    <group>
      <Ground color="#86a85a" />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -6]} material={m.path} receiveShadow>
        <planeGeometry args={[16, 14]} />
      </mesh>
      {/* колесо обозрения */}
      <group position={[-6, 0, -15]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.4, 3.2, 0]} rotation-z={s * 0.38} material={m.steel} castShadow>
            <boxGeometry args={[0.18, 7, 0.18]} />
          </mesh>
        ))}
        <group ref={wheel} position={[0, 6.2, 0]}>
          <mesh material={m.steel}>
            <torusGeometry args={[R, 0.08, 6, 48]} />
          </mesh>
          <Inst geo={spokeGeo} material={m.steel} items={spokes} shadow={false} />
          {Array.from({ length: CABINS }, (_, i) => {
            const a = (i / CABINS) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
                <group userData={{ cabin: true }}>
                  <mesh position={[0, -0.45, 0]} material={m.cabin[i % 4]} castShadow>
                    <boxGeometry args={[0.55, 0.5, 0.5]} />
                  </mesh>
                  <mesh position={[0, -0.15, 0]} material={m.steel}>
                    <boxGeometry args={[0.04, 0.3, 0.04]} />
                  </mesh>
                </group>
              </group>
            );
          })}
        </group>
      </group>
      {/* карусель с лошадками */}
      <group position={[5, 0, -7]}>
        <mesh position={[0, 0.2, 0]} material={m.base} castShadow receiveShadow>
          <cylinderGeometry args={[2.4, 2.5, 0.4, 24]} />
        </mesh>
        <mesh position={[0, 3.3, 0]} material={m.roofA} castShadow>
          <coneGeometry args={[2.7, 1.2, 12]} />
        </mesh>
        <mesh position={[0, 2.66, 0]} material={m.roofB}>
          <cylinderGeometry args={[2.7, 2.7, 0.2, 24]} />
        </mesh>
        <mesh position={[0, 1.6, 0]} material={m.pole}>
          <cylinderGeometry args={[0.25, 0.25, 2.6, 10]} />
        </mesh>
        <group ref={carousel}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <group key={i} userData={{ horse: true }} position={[Math.cos(a) * 1.7, 0.9, Math.sin(a) * 1.7]} rotation-y={-a}>
                <mesh position={[0, 0.8, 0]} material={m.pole}>
                  <cylinderGeometry args={[0.03, 0.03, 2, 6]} />
                </mesh>
                <mesh position={[0, 0.2, 0]} material={m.horse} castShadow>
                  <boxGeometry args={[0.18, 0.28, 0.6]} />
                </mesh>
                <mesh position={[0, 0.42, 0.3]} rotation-x={-0.5} material={m.horse}>
                  <boxGeometry args={[0.14, 0.3, 0.14]} />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>
      {/* палатки с полосатыми крышами */}
      {[-3.2, 0.2].map((x, i) => (
        <group key={x} position={[x, 0, -4.5 - i * 0.5]} rotation-y={i * 0.2}>
          <mesh position={[0, 0.5, 0]} material={m.stall} castShadow>
            <boxGeometry args={[1.6, 1, 0.9]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[-0.6 + k * 0.4, 1.75, 0.1]} rotation-x={0.5} material={k % 2 ? m.roofB : m.roofA} castShadow>
              <boxGeometry args={[0.4, 0.04, 1.2]} />
            </mesh>
          ))}
          {[-0.75, 0.75].map((px) => (
            <mesh key={px} position={[px, 1.2, 0.5]} material={m.stall}>
              <boxGeometry args={[0.05, 1.3, 0.05]} />
            </mesh>
          ))}
        </group>
      ))}
      {bulbs.map((items, i) => (
        <Inst key={i} geo={bulbGeo} material={m.bulbs[i]} items={items} shadow={false} />
      ))}
      {/* связка воздушных шариков у палатки */}
      <group ref={balloons} position={[-2.2, 0, -3.7]}>
        {balloonCols.map((c, i) => (
          <group key={i} position={[(i - 2) * 0.16, 2.2, (i % 2) * 0.12]}>
            <mesh scale={[0.18, 0.22, 0.18]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={c} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.75, 0]} material={m.string}>
              <cylinderGeometry args={[0.004, 0.004, 1.3, 3]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
