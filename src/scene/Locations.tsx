// Локации воспоминаний: море, лес, ночной город и зима (остальные — в LocationsMore.tsx).
// Всё построено из простых фигур в том же мягком стиле, что и комната,
// без загружаемых моделей. Свет, небо, дымка и частицы задаёт атмосфера дня,
// поэтому один и тот же пляж бывает и на закате, и в полдень.
//
// Локация строится вокруг начала координат. Камера смотрит с +z на -z
// (группа повёрнута на 45°, как и обзор комнаты), поэтому всё главное
// стоит позади персонажа, а перед ним — свободно.

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../store";
import { live } from "./live";
import type { Place } from "../atmosphere/types";
import { Concert, Desert, Fair, Mountains, Park, Village } from "./LocationsMore";

export function Locations() {
  const place = useStore((s) => s.place);
  if (place === "room") return null;
  return (
    <group rotation-y={Math.PI / 4}>
      <SkyDome />
      <LocationBody place={place} />
    </group>
  );
}

function LocationBody({ place }: { place: Exclude<Place, "room"> }) {
  switch (place) {
    case "beach": return <Beach />;
    case "forest": return <Forest />;
    case "city": return <City />;
    case "winter": return <Winter />;
    case "mountains": return <Mountains />;
    case "park": return <Park />;
    case "village": return <Village />;
    case "concert": return <Concert />;
    case "desert": return <Desert />;
    case "fair": return <Fair />;
  }
}

// ---------- общее ----------

/** Детерминированный генератор случайных чисел: локация всегда одинаковая */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export type Item = { p: [number, number, number]; s: number | [number, number, number]; r?: [number, number, number] };

/** Много одинаковых предметов за один вызов отрисовки */
export function Inst({ geo, material, items, shadow = true }: { geo: THREE.BufferGeometry; material: THREE.Material; items: Item[]; shadow?: boolean }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, material, items.length);
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      if (typeof it.s === "number") o.scale.setScalar(it.s);
      else o.scale.set(...it.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.castShadow = shadow;
    m.receiveShadow = true;
    return m;
  }, [geo, material, items, shadow]);
  return <primitive object={mesh} />;
}

export function Ground({ color, rough = 1 }: { color: string; rough?: number }) {
  const m = useMemo(() => mat(color, { roughness: rough }), [color, rough]);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow material={m}>
      <circleGeometry args={[70, 48]} />
    </mesh>
  );
}

/** Небо: градиент от цвета дымки у горизонта к цвету неба, солнце и звёзды ночью */
function SkyDome() {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: {
          top: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          sun: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3(0, 0.3, -1) },
          night: { value: 0 },
          time: { value: 0 },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          varying vec3 vDir; uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; uniform vec3 sunDir; uniform float night; uniform float time;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          void main(){
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, h));
            float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
            c += sun * (pow(d, 220.0) * 1.2 + pow(d, 12.0) * 0.25) * (1.0 - night * 0.5);
            vec2 g = floor(vec2(atan(vDir.z, vDir.x) * 120.0, vDir.y * 160.0));
            float s = step(0.993, hash(g)) * (0.6 + 0.4 * sin(time * 2.0 + hash(g + 1.0) * 40.0));
            c += vec3(s) * night * smoothstep(0.05, 0.3, h);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  useFrame(({ clock }) => {
    const fog = scene.fog as THREE.FogExp2 | null;
    const u = sky.uniforms;
    u.horizon.value.copy(fog ? fog.color : live.skyColor);
    u.top.value.copy(live.skyColor).multiplyScalar(0.9 - live.night * 0.4);
    u.sun.value.copy(live.keyLightColor);
    // солнце там же, откуда светит основной свет (сзади-сбоку от персонажа)
    const az = THREE.MathUtils.degToRad(live.lightAngle), el = THREE.MathUtils.degToRad(live.lightElevation);
    u.sunDir.value.set(Math.cos(az) * 0.6, Math.sin(el) * 0.7 + 0.08, -1);
    u.night.value = live.night;
    u.time.value = clock.elapsedTime;
  });
  return (
    <mesh material={sky} renderOrder={-1}>
      <sphereGeometry args={[60, 32, 16]} />
    </mesh>
  );
}

/** Ель из нескольких конусов; snow — белые шапки на ярусах */
function useFirs(items: { x: number; z: number; s: number }[], green: string, snow = false) {
  return useMemo(() => {
    const cone = new THREE.ConeGeometry(1, 1, 8);
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1, 6);
    const needles = mat(green, { flatShading: true });
    const bark = mat("#5b3d27");
    const white = mat("#f4f7fb", { roughness: 0.9, flatShading: true });
    const tiers: Item[] = [], caps: Item[] = [], trunks: Item[] = [];
    for (const t of items) {
      trunks.push({ p: [t.x, 0.3 * t.s, t.z], s: [t.s, 0.6 * t.s, t.s] });
      for (let k = 0; k < 3; k++) {
        const r = (1 - k * 0.27) * 0.95 * t.s, h = (1.25 - k * 0.15) * t.s, y = (0.55 + k * 0.72) * t.s + h / 2;
        tiers.push({ p: [t.x, y, t.z], s: [r, h, r], r: [0, k * 0.4 + t.x, 0] });
        if (snow) caps.push({ p: [t.x, y + h * 0.3, t.z], s: [r * 0.55, h * 0.42, r * 0.55], r: [0, k * 0.4 + t.x, 0] });
      }
    }
    return { cone, trunk, needles, bark, white, tiers, caps, trunks };
  }, [items, green, snow]);
}

export function Firs({ items, green, snow }: { items: { x: number; z: number; s: number }[]; green: string; snow?: boolean }) {
  const f = useFirs(items, green, snow);
  return (
    <>
      <Inst geo={f.trunk} material={f.bark} items={f.trunks} />
      <Inst geo={f.cone} material={f.needles} items={f.tiers} />
      {snow && <Inst geo={f.cone} material={f.white} items={f.caps} />}
    </>
  );
}

/** Случайные точки вне поляны вокруг персонажа и вне обзора перед ним */
export function scatter(seed: number, n: number, keep: (x: number, z: number) => boolean, area = { x: 26, z0: -32, z1: 8 }) {
  const r = rng(seed);
  const out: { x: number; z: number; s: number }[] = [];
  for (let i = 0; out.length < n && i < n * 30; i++) {
    const x = (r() * 2 - 1) * area.x, z = area.z0 + r() * (area.z1 - area.z0);
    if (Math.hypot(x, z) < 3.2 || (z > -1 && Math.abs(x) < 7) || !keep(x, z)) continue;
    out.push({ x, z, s: 0.8 + r() * 0.9 });
  }
  return out;
}

// ---------- море ----------

function Beach() {
  const foam = useRef<THREE.Group>(null);
  const gulls = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      sea: mat("#2a9db3", { roughness: 0.18, metalness: 0.15 }),
      shallow: mat("#59c7c4", { roughness: 0.2, transparent: true, opacity: 0.85 }),
      foam: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, transparent: true, opacity: 0.7 }),
      wet: mat("#c9ad78", { roughness: 0.5 }),
      trunk: mat("#8a6240", { flatShading: true }),
      leaf: mat("#3f8f4a", { flatShading: true }),
      coco: mat("#5c3b22"),
      rock: mat("#8d8a86", { flatShading: true }),
      red: mat("#e8584b"),
      white: mat("#fbf6ec"),
      towel: mat("#4fb3a9"),
      island: mat("#5d8c55", { flatShading: true }),
      gull: mat("#f4f4f4"),
      ball: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }),
    }),
    [],
  );
  const ballGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.22, 24, 16);
    const cols = ["#ff6f61", "#ffffff", "#ffd166", "#ffffff", "#4fb3e8", "#ffffff"].map((c) => new THREE.Color(c));
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const a = (Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI * 2);
      cols[Math.floor(a * 6) % 6].toArray(col, i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const rocks = useMemo<Item[]>(() => {
    const r = rng(7);
    return Array.from({ length: 9 }, () => {
      const x = (r() * 2 - 1) * 14, z = -2.6 - r() * 2.5;
      return { p: [x + (Math.abs(x) < 3 ? 5 : 0), 0.05, z], s: [0.3 + r() * 0.5, 0.25 + r() * 0.3, 0.3 + r() * 0.4], r: [r(), r() * 3, 0] };
    });
  }, []);
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // полосы пены набегают на берег и тают
    foam.current?.children.forEach((c, i) => {
      const k = ((t * 0.18 + i / 3) % 1 + 1) % 1;
      c.position.z = -3.5 - (1 - k) * 2.6;
      (c as THREE.Mesh).scale.z = 0.6 + k * 0.8;
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = Math.sin(k * Math.PI) * 0.75;
    });
    if (gulls.current) {
      gulls.current.children.forEach((g, i) => {
        const a = t * (0.22 + i * 0.05) + i * 2.1;
        g.position.set(Math.cos(a) * (6 + i * 2), 4.2 + i * 0.6 + Math.sin(t * 1.3 + i) * 0.2, -10 + Math.sin(a) * 4);
        g.rotation.y = -a;
        const w = Math.sin(t * 6 + i) * 0.35;
        (g.children[0] as THREE.Object3D).rotation.z = 0.35 + w;
        (g.children[1] as THREE.Object3D).rotation.z = -0.35 - w;
      });
    }
  });

  return (
    <group>
      <Ground color="#e8cf98" />
      {/* мокрый песок у кромки воды */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -3.6]} material={m.wet} receiveShadow>
        <planeGeometry args={[140, 1.6]} />
      </mesh>
      {/* море: мелководье и глубина */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, -5.4]} material={m.shallow}>
        <planeGeometry args={[140, 3]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -40]} material={m.sea}>
        <planeGeometry args={[140, 66]} />
      </mesh>
      <group ref={foam}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.05, -4]} material={m.foam.clone()}>
            <planeGeometry args={[140, 0.22]} />
          </mesh>
        ))}
      </group>
      {/* далёкий остров */}
      <mesh position={[-14, -1.2, -38]} scale={[9, 3.2, 4]} material={m.island}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>
      <Palm p={[-3.4, 0, -1.6]} h={3.4} lean={0.35} m={m} />
      <Palm p={[4.2, 0, -2.2]} h={3.9} lean={-0.3} m={m} />
      <Palm p={[-7.5, 0, 0.5]} h={3.0} lean={0.2} m={m} />
      <Palm p={[8.5, 0, -0.5]} h={3.6} lean={-0.15} m={m} />
      {/* зонтик и полотенце */}
      <group position={[1.9, 0, -0.9]}>
        <mesh position={[0, 0.9, 0]} rotation-z={0.08} material={m.white} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 1.8, 6]} />
        </mesh>
        <mesh position={[0.07, 1.85, 0]} rotation-z={0.08} material={m.red} castShadow>
          <coneGeometry args={[1.05, 0.38, 10, 1, true]} />
        </mesh>
        <mesh position={[0.08, 1.98, 0]} rotation-z={0.08} material={m.white} castShadow>
          <coneGeometry args={[0.5, 0.18, 10]} />
        </mesh>
        <mesh position={[-0.35, 0.015, 0.4]} rotation={[-Math.PI / 2, 0, 0.3]} material={m.towel} receiveShadow>
          <planeGeometry args={[0.75, 1.5]} />
        </mesh>
      </group>
      <mesh geometry={ballGeo} material={m.ball} position={[-1.5, 0.22, -0.4]} castShadow />
      <Inst geo={rockGeo} material={m.rock} items={rocks} />
      <group ref={gulls}>
        {[0, 1, 2].map((i) => (
          <group key={i}>
            <mesh position={[-0.18, 0, 0]} material={m.gull}>
              <boxGeometry args={[0.36, 0.02, 0.1]} />
            </mesh>
            <mesh position={[0.18, 0, 0]} material={m.gull}>
              <boxGeometry args={[0.36, 0.02, 0.1]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Palm({ p, h, lean, m }: { p: [number, number, number]; h: number; lean: number; m: Record<string, THREE.Material> }) {
  const { trunk, top } = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * h * 0.15, h * 0.55, 0), new THREE.Vector3(lean * h * 0.45, h, 0));
    const g = new THREE.TubeGeometry(curve, 10, 0.11, 7, false);
    return { trunk: g, top: curve.getPoint(1) };
  }, [h, lean]);
  return (
    <group position={p}>
      <mesh geometry={trunk} material={m.trunk} castShadow />
      <group position={top}>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} rotation-y={(i / 7) * Math.PI * 2}>
            <mesh position={[0.62, -0.18, 0]} rotation-z={-0.45} scale={[0.75, 0.04, 0.17]} material={m.leaf} castShadow>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          </group>
        ))}
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.12, -0.12, Math.sin(a) * 0.12]} material={m.coco} castShadow>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- лес ----------

function Forest() {
  const fire = useRef<THREE.Group>(null);
  const fireLight = useRef<THREE.PointLight>(null);
  const m = useMemo(
    () => ({
      path: mat("#a8835a"),
      crown: mat("#6aa04e", { flatShading: true }),
      crown2: mat("#4f8a43", { flatShading: true }),
      bark: mat("#6b4a30"),
      bush: mat("#4d7f3c", { flatShading: true }),
      cap: mat("#d2453b"),
      stem: mat("#f3e6cf"),
      stone: mat("#8b8780", { flatShading: true }),
      flame: new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff7a1a", emissiveIntensity: 2.2, transparent: true, opacity: 0.9 }),
      log: mat("#7a5435", { flatShading: true }),
    }),
    [],
  );
  const firs = useMemo(() => scatter(11, 46, (x, z) => !(z < 0 && Math.abs(x - z * 0.15) < 1.6)), []);
  const round = useMemo(() => scatter(23, 18, (x, z) => !(z < 0 && Math.abs(x - z * 0.15) < 1.8)), []);
  const geo = useMemo(
    () => ({ ball: new THREE.IcosahedronGeometry(1, 1), trunk: new THREE.CylinderGeometry(0.1, 0.15, 1, 6), stone: new THREE.DodecahedronGeometry(1, 0) }),
    [],
  );
  const roundItems = useMemo(() => {
    const crowns: Item[] = [], trunks: Item[] = [];
    round.forEach((t, i) => {
      trunks.push({ p: [t.x, 0.8 * t.s, t.z], s: [t.s, 1.6 * t.s, t.s] });
      crowns.push({ p: [t.x, 2.2 * t.s, t.z], s: 1.0 * t.s, r: [i, i * 2, 0] });
      crowns.push({ p: [t.x + 0.5 * t.s, 1.9 * t.s, t.z + 0.2], s: 0.7 * t.s, r: [i, i, 0] });
    });
    return { crowns, trunks };
  }, [round]);
  const bushes = useMemo<Item[]>(() => {
    const r = rng(5);
    return Array.from({ length: 22 }, () => {
      let x = (r() * 2 - 1) * 12, z = -1 - r() * 12;
      if (Math.abs(x) < 2.2) x += x < 0 ? -2 : 2;
      return { p: [x, 0.15, z], s: [0.45 + r() * 0.4, 0.35 + r() * 0.25, 0.45 + r() * 0.4], r: [0, r() * 3, 0] };
    });
  }, []);
  const stones = useMemo<Item[]>(
    () => Array.from({ length: 8 }, (_, i) => ({ p: [2.1 + Math.cos((i / 8) * Math.PI * 2) * 0.42, 0.07, -1.3 + Math.sin((i / 8) * Math.PI * 2) * 0.42], s: [0.12, 0.09, 0.12], r: [i, i, 0] })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    fire.current?.children.forEach((c, i) => {
      c.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.18 + Math.sin(t * 13 + i) * 0.1;
      c.rotation.y = t * (0.5 + i * 0.2);
    });
    if (fireLight.current) fireLight.current.intensity = (2.2 + live.night * 5) * (1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 7.3) * 0.06);
  });
  return (
    <group>
      <Ground color="#6c8f45" />
      {/* тропинка уходит в лес */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0.15]} position={[-0.5 - i * 1.1, 0.012, -3 - i * 7]} material={m.path} receiveShadow>
          <planeGeometry args={[1.3 - i * 0.12, 7.4]} />
        </mesh>
      ))}
      <Firs items={firs} green="#2f6b3a" />
      <Inst geo={geo.trunk} material={m.bark} items={roundItems.trunks} />
      <Inst geo={geo.ball} material={m.crown} items={roundItems.crowns} />
      <Inst geo={geo.ball} material={m.bush} items={bushes} />
      {/* костёр в камнях и бревно-скамейка */}
      <Inst geo={geo.stone} material={m.stone} items={stones} />
      <group position={[2.1, 0, -1.3]}>
        {[0, 1.2, 2.4].map((a) => (
          <mesh key={a} position={[0, 0.08, 0]} rotation={[Math.PI / 2 - 0.5, 0, a]} material={m.log} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
          </mesh>
        ))}
        <group ref={fire} position={[0, 0.2, 0]}>
          <mesh material={m.flame} scale={[1, 1, 1]}>
            <coneGeometry args={[0.18, 0.5, 7]} />
          </mesh>
          <mesh position={[0.07, -0.05, 0.04]} material={m.flame} scale={[0.6, 0.7, 0.6]}>
            <coneGeometry args={[0.18, 0.5, 7]} />
          </mesh>
        </group>
        <pointLight ref={fireLight} position={[0, 0.5, 0]} color="#ff9a3c" distance={7} decay={1.6} />
      </group>
      <mesh position={[3.2, 0.18, -0.6]} rotation={[0, 0.5, Math.PI / 2]} material={m.log} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.2, 1.6, 8]} />
      </mesh>
      {/* грибы */}
      {[
        [-1.8, -1.1],
        [-2.1, -0.7],
        [1.2, -2.6],
        [-3.4, -3.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} scale={0.8 + (i % 2) * 0.4}>
          <mesh position={[0, 0.07, 0]} material={m.stem}>
            <cylinderGeometry args={[0.025, 0.03, 0.14, 6]} />
          </mesh>
          <mesh position={[0, 0.14, 0]} scale={[1, 0.6, 1]} material={m.cap} castShadow>
            <sphereGeometry args={[0.08, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- ночной город ----------

/** Текстура окон: часть окон горит тёплым светом */
function windowTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  const r = rng(seed);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++) {
      const on = r() < 0.45;
      g.fillStyle = on ? (r() < 0.7 ? "#ffd27a" : "#ffe9c4") : "#1a1d2a";
      g.fillRect(x * 16 + 4, y * 16 + 4, 8, 9);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function neonTexture(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 96);
  g.font = "bold 58px 'Comfortaa', 'Nunito', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 50);
  g.shadowBlur = 0;
  g.fillStyle = "#fff";
  g.globalAlpha = 0.6;
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BUILDING_COLORS = ["#4a4f66", "#5b5266", "#3e4a5c", "#665a52", "#525c66", "#47405a"];

function City() {
  const lamps = useRef<THREE.Group>(null);
  const data = useMemo(() => {
    const r = rng(31);
    const tex = windowTexture(3);
    const blocks: { p: [number, number, number]; w: number; h: number; d: number; ry: number; color: string }[] = [];
    // ряд домов за дорогой
    for (let x = -30; x < 30; ) {
      const w = 3 + r() * 3.5, h = 5 + r() * 10;
      blocks.push({ p: [x + w / 2, h / 2, -11.5 - r() * 1.5], w, h, d: 5, ry: 0, color: BUILDING_COLORS[Math.floor(r() * 6)] });
      x += w + 0.3;
    }
    // дома по бокам, ближе к зрителю
    for (const side of [-1, 1])
      for (let z = -7; z < 6; ) {
        const w = 3 + r() * 2.5, h = 4 + r() * 8;
        blocks.push({ p: [side * (11 + r()), h / 2, z + w / 2], w, h, d: 5, ry: Math.PI / 2, color: BUILDING_COLORS[Math.floor(r() * 6)] });
        z += w + 0.3;
      }
    const mats = blocks.map((b) => {
      const map = tex.clone();
      map.needsUpdate = true;
      map.repeat.set(Math.max(1, Math.round(b.w / 1.6)), Math.max(1, Math.round(b.h / 2.6)));
      return new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.9, emissive: "#ffffff", emissiveMap: map, emissiveIntensity: 0.9 });
    });
    return { blocks, mats };
  }, []);
  const m = useMemo(
    () => ({
      walk: mat("#7a7d86"),
      curb: mat("#9a9ca3"),
      road: mat("#2a2d36", { roughness: 0.55 }),
      line: mat("#e8e2cf"),
      pole: mat("#2f3138", { metalness: 0.6, roughness: 0.4 }),
      bulb: new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#ffd98a", emissiveIntensity: 3 }),
      bench: mat("#8a5a3a"),
      puddle: new THREE.MeshStandardMaterial({ color: "#1d2130", roughness: 0.05, metalness: 0.9 }),
      neon: new THREE.MeshBasicMaterial({ map: neonTexture("КАФЕ", "#ff5fa2"), toneMapped: false }),
      neon2: new THREE.MeshBasicMaterial({ map: neonTexture("КИНО", "#5fd8ff"), toneMapped: false }),
    }),
    [],
  );
  const dashes = useMemo<Item[]>(() => Array.from({ length: 30 }, (_, i) => ({ p: [-29 + i * 2, 0.012, -4.3], s: [0.9, 0.01, 0.12] })), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useFrame(() => {
    // окна и фонари ярче, когда в воспоминании ночь
    for (const mt of data.mats) mt.emissiveIntensity = 0.25 + live.night * 1.1;
    lamps.current?.children.forEach((l) => {
      const light = l.children.find((c) => (c as THREE.PointLight).isPointLight) as THREE.PointLight | undefined;
      if (light) light.intensity = 1.5 + live.night * 7;
    });
  });
  return (
    <group>
      <Ground color="#2f323b" rough={0.8} />
      {/* тротуар, где стоит персонаж, бордюр, дорога с разметкой и тротуар напротив */}
      <mesh position={[0, 0.06, 0.6]} material={m.walk} receiveShadow>
        <boxGeometry args={[60, 0.12, 4.2]} />
      </mesh>
      <mesh position={[0, 0.07, -1.55]} material={m.curb} receiveShadow>
        <boxGeometry args={[60, 0.14, 0.2]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -4.3]} material={m.road} receiveShadow>
        <planeGeometry args={[60, 5.4]} />
      </mesh>
      <Inst geo={box} material={m.line} items={dashes} shadow={false} />
      <mesh position={[0, 0.06, -8.3]} material={m.walk} receiveShadow>
        <boxGeometry args={[60, 0.12, 2.6]} />
      </mesh>
      {[
        [-2.5, -3.4, 0.7],
        [3.4, -5.1, 1.1],
        [0.8, -2.6, 0.45],
      ].map(([x, z, s], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.01, z]} scale={[s * 1.6, s, 1]} material={m.puddle}>
          <circleGeometry args={[1, 20]} />
        </mesh>
      ))}
      {data.blocks.map((b, i) => (
        <mesh key={i} position={b.p} rotation-y={b.ry} material={data.mats[i]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
        </mesh>
      ))}
      {/* вывески */}
      <mesh position={[-3.2, 3.2, -8.95]} material={m.neon}>
        <planeGeometry args={[2.4, 0.9]} />
      </mesh>
      <mesh position={[5.5, 3.6, -8.95]} material={m.neon2}>
        <planeGeometry args={[2.2, 0.82]} />
      </mesh>
      <pointLight position={[-3.2, 3, -8]} color="#ff5fa2" intensity={3} distance={6} decay={1.8} />
      {/* фонари */}
      <group ref={lamps}>
        {[-5, 5].map((x) => (
          <group key={x} position={[x, 0, -1.2]}>
            <mesh position={[0, 1.7, 0]} material={m.pole} castShadow>
              <cylinderGeometry args={[0.05, 0.07, 3.4, 8]} />
            </mesh>
            <mesh position={[0, 3.35, -0.25]} rotation-x={Math.PI / 2} material={m.pole}>
              <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
            </mesh>
            <mesh position={[0, 3.28, -0.5]} material={m.bulb}>
              <sphereGeometry args={[0.13, 12, 8]} />
            </mesh>
            <pointLight position={[0, 3.1, -0.5]} color="#ffd98a" distance={9} decay={1.5} />
          </group>
        ))}
      </group>
      {/* скамейка */}
      <group position={[-2.2, 0.12, -0.6]}>
        <mesh position={[0, 0.42, 0]} material={m.bench} castShadow>
          <boxGeometry args={[1.5, 0.06, 0.45]} />
        </mesh>
        <mesh position={[0, 0.72, -0.2]} rotation-x={-0.15} material={m.bench} castShadow>
          <boxGeometry args={[1.5, 0.3, 0.05]} />
        </mesh>
        {[-0.65, 0.65].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]} material={m.pole}>
            <boxGeometry args={[0.06, 0.4, 0.4]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- зима ----------

function Winter() {
  const lights = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      snowman: mat("#f6f8fc", { roughness: 0.9 }),
      coal: mat("#222"),
      carrot: mat("#f08a24"),
      scarf: mat("#d33a3a"),
      stick: mat("#5b3d27"),
      ice: new THREE.MeshStandardMaterial({ color: "#bfe3f5", roughness: 0.08, metalness: 0.3 }),
      wall: mat("#7d4b3a", { flatShading: true }),
      roof: mat("#f4f7fb", { flatShading: true }),
      win: new THREE.MeshStandardMaterial({ color: "#ffcf6e", emissive: "#ffb347", emissiveIntensity: 2 }),
      pole: mat("#2f3138", { metalness: 0.6, roughness: 0.4 }),
      bulb: new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#ffd98a", emissiveIntensity: 3 }),
      drift: mat("#eef3fa", { roughness: 1 }),
      star: new THREE.MeshStandardMaterial({ color: "#ffd36b", emissive: "#ffc400", emissiveIntensity: 2.5 }),
    }),
    [],
  );
  const firs = useMemo(() => scatter(17, 40, (x, z) => Math.hypot(x - 3.6, z + 5) > 2.6 && Math.hypot(x + 5.5, z + 9) > 3), []);
  const drifts = useMemo<Item[]>(() => {
    const r = rng(9);
    return Array.from({ length: 16 }, () => {
      let x = (r() * 2 - 1) * 14;
      const z = -1 - r() * 12;
      if (Math.abs(x) < 2) x += x < 0 ? -2.5 : 2.5;
      return { p: [x, 0, z], s: [0.8 + r() * 1.4, 0.3 + r() * 0.3, 0.6 + r()], r: [0, r() * 3, 0] };
    });
  }, []);
  const ball = useMemo(() => new THREE.SphereGeometry(1, 16, 10), []);
  // гирлянда на ёлке у домика
  const garland = useMemo(() => {
    const cols = ["#ff4d6d", "#ffd166", "#4cc9f0", "#80ed99"];
    return Array.from({ length: 22 }, (_, i) => {
      const k = i / 22, a = k * Math.PI * 7;
      const r = 1.1 * (1 - k * 0.85);
      return { p: [Math.cos(a) * r, 0.7 + k * 2.6, Math.sin(a) * r] as [number, number, number], m: new THREE.MeshStandardMaterial({ color: cols[i % 4], emissive: cols[i % 4], emissiveIntensity: 2 }) };
    });
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    garland.forEach((g, i) => (g.m.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 2 + i * 1.7)) * 2.2));
    lights.current?.children.forEach((c) => {
      if ((c as THREE.PointLight).isPointLight) (c as THREE.PointLight).intensity = 1.2 + live.night * 6;
    });
  });
  return (
    <group>
      <Ground color="#e9eef6" />
      <Firs items={firs} green="#245a40" snow />
      <Inst geo={ball} material={m.drift} items={drifts} />
      {/* замёрзший пруд */}
      <mesh rotation-x={-Math.PI / 2} position={[3.6, 0.012, -5]} scale={[2.2, 1.5, 1]} material={m.ice} receiveShadow>
        <circleGeometry args={[1, 32]} />
      </mesh>
      {/* снеговик */}
      <group position={[1.9, 0, -1]} rotation-y={-0.4}>
        <mesh position={[0, 0.32, 0]} scale={0.36} geometry={ball} material={m.snowman} castShadow />
        <mesh position={[0, 0.82, 0]} scale={0.26} geometry={ball} material={m.snowman} castShadow />
        <mesh position={[0, 1.18, 0]} scale={0.18} geometry={ball} material={m.snowman} castShadow />
        <mesh position={[0, 1.18, 0.2]} rotation-x={Math.PI / 2} material={m.carrot}>
          <coneGeometry args={[0.035, 0.18, 8]} />
        </mesh>
        {[-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 1.24, 0.16]} scale={0.022} geometry={ball} material={m.coal} />
        ))}
        {[0.72, 0.84, 0.96].map((y) => (
          <mesh key={y} position={[0, y, 0.25]} scale={0.02} geometry={ball} material={m.coal} />
        ))}
        <mesh position={[0, 1.03, 0]} rotation-x={Math.PI / 2} material={m.scarf}>
          <torusGeometry args={[0.16, 0.04, 6, 16]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.38, 0.92, 0]} rotation-z={s * -1.0} material={m.stick}>
            <cylinderGeometry args={[0.012, 0.015, 0.45, 5]} />
          </mesh>
        ))}
      </group>
      {/* домик с тёплым окном */}
      <group position={[-5.5, 0, -9]} rotation-y={0.3}>
        <mesh position={[0, 1, 0]} material={m.wall} castShadow receiveShadow>
          <boxGeometry args={[3, 2, 2.4]} />
        </mesh>
        <mesh position={[0, 2.55, 0]} rotation-y={Math.PI / 4} scale={[2.35, 1.1, 2.0]} material={m.roof} castShadow>
          <coneGeometry args={[1, 1, 4]} />
        </mesh>
        <mesh position={[0.5, 1.1, 1.21]} material={m.win}>
          <planeGeometry args={[0.6, 0.55]} />
        </mesh>
        <mesh position={[-0.7, 1.1, 1.21]} material={m.win}>
          <planeGeometry args={[0.5, 0.55]} />
        </mesh>
        <pointLight position={[0, 1.2, 2]} color="#ffb347" intensity={2} distance={5} decay={1.6} />
      </group>
      {/* ёлка с гирляндой и звездой */}
      <group position={[-1.8, 0, -5]}>
        <Firs items={[{ x: 0, z: 0, s: 1.25 }]} green="#1f6b4a" snow />
        {garland.map((g, i) => (
          <mesh key={i} position={g.p} material={g.m}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 3.75, 0]} material={m.star}>
          <octahedronGeometry args={[0.2, 0]} />
        </mesh>
      </group>
      {/* фонарь */}
      <group ref={lights} position={[-2.8, 0, -1.6]}>
        <mesh position={[0, 1.5, 0]} material={m.pole} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 3, 8]} />
        </mesh>
        <mesh position={[0, 3.05, 0]} material={m.bulb}>
          <sphereGeometry args={[0.15, 12, 8]} />
        </mesh>
        <pointLight position={[0, 2.9, 0]} color="#ffd98a" distance={8} decay={1.5} />
      </group>
    </group>
  );
}
