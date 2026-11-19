// Визуализация музыки: звуковые волны расходятся от чашек наушников,
// над головой «звуковая дорожка» (живая форма волны) и всплывающие ноты.

import { useFrame } from "@react-three/fiber";
import { Billboard, Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { audio } from "../audio/engine";
import { hero } from "./Character";
import { live } from "./live";

let visibility = 0; // общая «видимость» эффектов, плавно 0..1
let visFrame = -1;
function updateVisibility(frame: number, dt: number) {
  if (frame === visFrame) return visibility;
  visFrame = frame;
  visibility += ((hero.listening ? 1 : 0) - visibility) * (1 - Math.exp(-3 * dt));
  return visibility;
}

/** Три кольца, расходящиеся от чашки наушников наружу. */
export function SoundWaves({ side }: { side: number }) {
  const rings = useRef<THREE.Mesh[]>([]);
  const phases = useRef([0, 0.33, 0.66]);
  const mats = useMemo(
    () =>
      [0, 1, 2].map(
        () =>
          new THREE.MeshBasicMaterial({
            color: "#ffffff",
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            side: THREE.DoubleSide,
          }),
      ),
    [],
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const vis = updateVisibility(Math.floor(clock.elapsedTime * 1000), dt);
    const speed = (0.45 + live.level * 1.6) * (0.6 + live.animSpeed * 0.5);
    phases.current.forEach((p, i) => {
      let np = p + dt * speed;
      if (np > 1) np -= 1;
      phases.current[i] = np;
      const m = rings.current[i];
      if (!m) return;
      m.position.x = side * (0.07 + np * 0.32);
      m.scale.setScalar(0.7 + np * 1.5);
      mats[i].color.copy(live.palette[0]).lerp(live.particleColor, 0.4);
      mats[i].opacity = Math.sin(np * Math.PI) * 0.75 * vis * (0.5 + live.level);
    });
  });

  return (
    <>
      {mats.map((mat, i) => (
        <mesh key={i} ref={(el) => { if (el) rings.current[i] = el; }} rotation-y={Math.PI / 2} material={mat}>
          <torusGeometry args={[0.12, 0.012, 6, 32]} />
        </mesh>
      ))}
    </>
  );
}

const N = 72;
const WIDTH = 1.0;

function noteTexture(ch: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "white";
  g.font = "bold 52px Nunito, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(ch, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Звуковая дорожка над головой: форма волны + ноты. */
export function Waveform() {
  const line = useRef<{ geometry: { setPositions: (a: number[] | Float32Array) => void }; material: { color: THREE.Color; opacity: number } } | null>(null);
  const echo = useRef<typeof line.current>(null);
  const data = useMemo(() => new Float32Array(N), []);
  const smoothData = useMemo(() => new Float32Array(N), []);
  const pts = useMemo(() => new Float32Array(N * 3), []);
  const pts2 = useMemo(() => new Float32Array(N * 3), []);
  const init = useMemo(() => Array.from({ length: N }, (_, i) => [(i / (N - 1) - 0.5) * WIDTH, 0, 0] as [number, number, number]), []);

  const notes = useRef<THREE.Sprite[]>([]);
  const noteState = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ p: i / 5, x: 0, drift: 0 })), []);
  const noteMats = useMemo(() => {
    const tex = [noteTexture("♪"), noteTexture("♫"), noteTexture("♪"), noteTexture("♬"), noteTexture("♫")];
    return tex.map((map) => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0, toneMapped: false }));
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const vis = updateVisibility(Math.floor(t * 1000), dt);
    audio.waveform(data);
    for (let i = 0; i < N; i++) {
      const win = Math.sin((i / (N - 1)) * Math.PI); // края дорожки сходятся в точку
      // лёгкая «синусоида» даже на тихих местах, чтобы дорожка жила
      const idle = Math.sin(i * 0.35 + t * 4) * 0.03 * (0.4 + live.level);
      const v = THREE.MathUtils.clamp(data[i] * 3.5, -1, 1) * 0.2 + idle;
      smoothData[i] += (v * win - smoothData[i]) * 0.5;
      pts[i * 3] = init[i][0];
      pts[i * 3 + 1] = smoothData[i] * vis;
      pts2[i * 3] = init[i][0];
      pts2[i * 3 + 1] = -smoothData[i] * 0.6 * vis;
    }
    if (line.current) {
      line.current.geometry.setPositions(pts);
      line.current.material.color.copy(live.palette[0]).lerp(new THREE.Color("#ffffff"), 0.35);
      line.current.material.opacity = vis;
    }
    if (echo.current) {
      echo.current.geometry.setPositions(pts2);
      echo.current.material.color.copy(live.particleColor);
      echo.current.material.opacity = vis * 0.45;
    }

    // ноты всплывают от наушников
    const speed = 0.25 + live.level * 0.6;
    noteState.forEach((n, i) => {
      n.p += dt * speed * (0.7 + i * 0.08);
      if (n.p > 1) {
        n.p = 0;
        n.x = (Math.random() - 0.5) * 0.9;
        n.drift = (Math.random() - 0.5) * 0.4;
      }
      const s = notes.current[i];
      if (!s) return;
      s.position.set(n.x + n.drift * n.p + Math.sin(t * 2 + i) * 0.05, -0.35 + n.p * 0.9, 0.05);
      s.scale.setScalar(0.12 + Math.sin(n.p * Math.PI) * 0.06);
      noteMats[i].color.copy(live.palette[i % 3]).lerp(new THREE.Color("#ffffff"), 0.3);
      noteMats[i].opacity = Math.sin(n.p * Math.PI) * vis * 0.95;
    });
  });

  return (
    <Billboard>
      <Line ref={line as never} points={init} lineWidth={3} transparent opacity={0} toneMapped={false} color="#ffffff" />
      <Line ref={echo as never} points={init} lineWidth={1.5} transparent opacity={0} toneMapped={false} color="#ffffff" />
      {noteMats.map((m, i) => (
        <sprite key={i} ref={(el) => { if (el) notes.current[i] = el; }} material={m} />
      ))}
    </Billboard>
  );
}
