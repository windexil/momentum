// Фигурка рыжего котёнка в белых наушниках и с розовым бантиком.
// Формы строятся в коде: тело — профиль вращения, голова — деформированная
// сфера с пухлыми щеками, полоски «табби» и светлая мордочка — цветами
// вершин, шерсть — рельефом из процедурной текстуры коротких штрихов.

import { useMemo } from "react";
import * as THREE from "three";

const FUR = new THREE.Color("#eab98c");
const STRIPE = new THREE.Color("#c98856");
const LIGHT = new THREE.Color("#f7dfc4");
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Цвет вершины: полоски табби + светлые зоны (мордочка, грудка). */
function paint(g: THREE.BufferGeometry, fn: (p: THREE.Vector3) => { stripe: number; light: number }) {
  const pos = g.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const { stripe, light } = fn(p);
    c.copy(FUR).lerp(STRIPE, THREE.MathUtils.clamp(stripe, 0, 1)).lerp(LIGHT, THREE.MathUtils.clamp(light, 0, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Мягкие волнистые полосы, как у рыжего полосатого кота */
const tabby = (p: THREE.Vector3, freq: number) => {
  const a = Math.atan2(p.x, p.z);
  const w = Math.sin(p.y * freq + Math.sin(a * 3) * 1.6 + Math.sin(a * 7 + p.y * 40) * 0.4);
  return smooth(0.35, 0.95, w) * 0.75;
};

/** Рельеф шерсти: много коротких штрихов вдоль UV-«меридианов» */
function furBump() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S, y = rnd() * S, len = 4 + rnd() * 7, ang = Math.PI / 2 + (rnd() - 0.5) * 0.7;
    g.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.25 + rnd() * 0.3})` : `rgba(0,0,0,${0.2 + rnd() * 0.3})`;
    g.lineWidth = 1 + rnd() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 4);
  return t;
}

function buildBody() {
  // сидящий котёнок: широкий низ, грудка чуть вперёд, короткая шея
  const prof = [
    [0.0, 0.0], [0.036, 0.0], [0.05, 0.007], [0.055, 0.02], [0.053, 0.036], [0.047, 0.052],
    [0.04, 0.066], [0.033, 0.078], [0.026, 0.086], [0.0, 0.09],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 48);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.z *= v.z > 0 ? 0.86 : 1.0;
    if (v.z > 0) v.z += smooth(0.02, 0.07, v.y) * 0.01;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return paint(g, (p) => ({
    stripe: p.z < 0.01 ? tabby(p, 150) : tabby(p, 150) * 0.35,
    // светлая грудка спереди
    light: smooth(0.015, 0.045, p.z) * smooth(0.02, 0.06, p.y) * (1 - smooth(0.012, 0.03, Math.abs(p.x))) * 0.8,
  }));
}

function buildHead() {
  const R = 0.056;
  const g = new THREE.SphereGeometry(R, 64, 48);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    v.x *= 1.1;
    v.y *= 0.93;
    v.z *= 0.95;
    // пухлые щёчки внизу по бокам
    const cheek = smooth(0.1, -0.5, n.y) * smooth(0.2, 0.65, Math.abs(n.x)) * smooth(-0.3, 0.3, n.z);
    v.x += Math.sign(n.x) * cheek * 0.009;
    v.y -= cheek * 0.004;
    // маленькая мордочка-«подушечка» под носом
    const muzzle = Math.max(0, n.dot(new THREE.Vector3(0, -0.35, 0.94).normalize()));
    v.addScaledVector(n, smooth(0.86, 0.98, muzzle) * 0.006);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const muzzleDir = new THREE.Vector3(0, -0.4, 0.92).normalize();
  return paint(g, (p) => {
    n.copy(p).normalize();
    const face = n.dot(muzzleDir);
    return {
      // полоски на лбу и затылке, мордочка без полос
      stripe: tabby(p, 170) * (1 - smooth(0.55, 0.8, face)) * (n.y > -0.2 ? 1 : 0.4),
      light: smooth(0.72, 0.92, face) * 0.85 + smooth(-0.5, -0.85, n.y) * 0.4,
    };
  });
}

function buildTail() {
  // хвост выходит сзади у основания и поднимается завитком вверх
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.012, -0.045),
    new THREE.Vector3(0.006, 0.016, -0.07),
    new THREE.Vector3(0.01, 0.04, -0.088),
    new THREE.Vector3(0.008, 0.07, -0.088),
    new THREE.Vector3(0.004, 0.088, -0.074),
    new THREE.Vector3(0.0, 0.09, -0.06),
  ]);
  const segs = 64, radial = 14;
  const g = new THREE.TubeGeometry(curve, segs, 0.011, radial, false);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const ring: number[] = [];
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const k = 1 - (i / segs) * 0.35;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * k, c.y + (pos.getY(idx) - c.y) * k, c.z + (pos.getZ(idx) - c.z) * k);
      ring[idx] = i / segs;
    }
  }
  g.computeVertexNormals();
  let idx = 0;
  return paint(g, () => ({ stripe: smooth(0.2, 0.8, Math.sin(ring[idx++] * 26)) * 0.8, light: 0 }));
}

export function KittenFigurine({ position }: { position: [number, number, number] }) {
  const m = useMemo(() => {
    const bump = furBump();
    const fur = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, bumpMap: bump, bumpScale: 1.2 });
    const furPlain = new THREE.MeshStandardMaterial({ color: new THREE.Color(FUR).lerp(STRIPE, 0.22), roughness: 0.62, bumpMap: bump, bumpScale: 1.2 });
    const furLight = new THREE.MeshStandardMaterial({ color: LIGHT, roughness: 0.62, bumpMap: bump, bumpScale: 1 });
    const eye = new THREE.MeshPhysicalMaterial({ color: "#0d0b0c", roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 });
    const shine = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const pink = new THREE.MeshStandardMaterial({ color: "#f19aa6", roughness: 0.45 });
    const earIn = new THREE.MeshStandardMaterial({ color: "#f0b9a8", roughness: 0.6 });
    const mouth = new THREE.MeshStandardMaterial({ color: "#8a5a48", roughness: 0.5 });
    const bow = new THREE.MeshPhysicalMaterial({ color: "#f7a0b4", roughness: 0.35, clearcoat: 0.6 });
    const plastic = new THREE.MeshPhysicalMaterial({ color: "#f3f1ee", roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const cushion = new THREE.MeshStandardMaterial({ color: "#e4e0da", roughness: 0.7 });
    return { body: buildBody(), head: buildHead(), tail: buildTail(), fur, furPlain, furLight, eye, shine, pink, earIn, mouth, bow, plastic, cushion };
  }, []);

  return (
    // userData.dynamic: не склеиваем с комнатой — у фигурки цвета вершин
    <group position={position} rotation-y={-0.35} scale={0.95} userData={{ dynamic: true }}>
      <mesh geometry={m.body} material={m.fur} castShadow receiveShadow />
      {/* задние лапы-«бёдра» по бокам */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.036, 0.021, -0.006]} scale={[0.7, 0.8, 1.2]} material={m.furPlain} castShadow>
          <sphereGeometry args={[0.027, 28, 20]} />
        </mesh>
      ))}
      {/* передние лапки и пальчики */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.017, 0, 0.045]}>
          <mesh position={[0, 0.028, -0.004]} rotation-x={-0.1} material={m.furPlain} castShadow>
            <capsuleGeometry args={[0.0115, 0.034, 8, 16]} />
          </mesh>
          <mesh position={[0, 0.007, 0.004]} scale={[1.08, 0.66, 1.3]} material={m.furLight} castShadow>
            <sphereGeometry args={[0.0125, 20, 14]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={m.tail} material={m.fur} castShadow />

      {/* голова */}
      <group position={[0, 0.128, 0.006]}>
        <mesh geometry={m.head} material={m.fur} castShadow />
        {/* уши */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.036, 0.046, 0.008]} rotation={[-0.15, 0, -s * 0.48]}>
            <mesh scale={[1, 1, 0.55]} material={m.furPlain} castShadow>
              <coneGeometry args={[0.022, 0.038, 20]} />
            </mesh>
            <mesh position={[0, -0.003, 0.007]} scale={[0.6, 0.7, 0.3]} material={m.earIn}>
              <coneGeometry args={[0.022, 0.038, 16]} />
            </mesh>
          </group>
        ))}
        {/* большие блестящие глаза */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.022, 0.003, 0.046]} rotation-y={s * 0.3}>
            <mesh scale={[1, 1.05, 0.6]} material={m.eye}>
              <sphereGeometry args={[0.0125, 28, 20]} />
            </mesh>
            <mesh position={[0.004, 0.0045, 0.0065]} material={m.shine}>
              <sphereGeometry args={[0.0026, 10, 8]} />
            </mesh>
            <mesh position={[-0.0035, -0.004, 0.0068]} material={m.shine}>
              <sphereGeometry args={[0.0012, 8, 6]} />
            </mesh>
          </group>
        ))}
        {/* розовый нос и ротик «w» */}
        <mesh position={[0, -0.011, 0.0605]} rotation={[-Math.PI / 2 - 0.2, 0, Math.PI]} scale={[1.3, 1, 0.65]} material={m.pink}>
          <coneGeometry args={[0.0052, 0.005, 3]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.0042, -0.0178, 0.0595]} rotation-z={Math.PI} material={m.mouth}>
            <torusGeometry args={[0.0042, 0.0008, 6, 12, Math.PI]} />
          </mesh>
        ))}
        {/* бантик сверху справа */}
        <group position={[0.018, 0.047, 0.026]} rotation={[0.5, 0.1, -0.25]}>
          <mesh scale={[1, 0.9, 0.7]} material={m.bow}>
            <sphereGeometry args={[0.0058, 14, 10]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.011, 0, 0]} rotation-z={s * Math.PI / 2} scale={[1.05, 1, 0.42]} material={m.bow}>
              <coneGeometry args={[0.0105, 0.02, 20]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.004, -0.009, -0.001]} rotation-z={s * 0.35} scale={[1, 1, 0.4]} material={m.bow}>
              <boxGeometry args={[0.005, 0.012, 0.004]} />
            </mesh>
          ))}
        </group>
        {/* белые наушники: дужка и чашки с мягкими амбушюрами */}
        <mesh position={[0, 0.0, -0.004]} material={m.plastic} castShadow>
          <torusGeometry args={[0.066, 0.0058, 12, 48, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.064, -0.002, -0.004]} rotation-z={Math.PI / 2}>
            <mesh material={m.plastic} castShadow>
              <cylinderGeometry args={[0.027, 0.027, 0.02, 36]} />
            </mesh>
            <mesh position={[0, s * -0.012, 0]} material={m.cushion}>
              <cylinderGeometry args={[0.023, 0.024, 0.006, 36]} />
            </mesh>
            <mesh position={[0, s * 0.0105, 0]} rotation-x={Math.PI / 2} material={m.plastic}>
              <torusGeometry args={[0.02, 0.0025, 8, 32]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
