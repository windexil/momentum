// Частицы атмосферы: пыль, светлячки, снег, дождь, лепестки, искры,
// пузырьки, звёзды. Тип меняется через затухание, количество/скорость/
// цвет плавно перетекают. Музыка слегка «раскачивает» поле.

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ParticleType } from "../atmosphere/types";
import { useStore } from "../store";
import { live } from "./live";

const MAX = 600;
const BOX = { x: 4.3, y: 3.3, z: 4.3, cx: 0.5, cz: 0.5 }; // центр смещён: комната шире к открытым сторонам

function makeTexture(kind: "soft" | "streak" | "petal" | "star") {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  if (kind === "soft") {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.6)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  } else if (kind === "streak") {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.7, "rgba(255,255,255,0.9)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(s / 2 - 2, 0, 4, s);
  } else if (kind === "petal") {
    g.fillStyle = "white";
    g.beginPath();
    g.ellipse(s / 2, s / 2, s * 0.22, s * 0.38, 0.6, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = "white";
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.1 : s * 0.48;
      const a = (i / 8) * Math.PI * 2;
      g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
    }
    g.fill();
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 3);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const STYLE: Record<ParticleType, { tex: "soft" | "streak" | "petal" | "star"; additive: boolean; base: number }> = {
  dust: { tex: "soft", additive: true, base: 0.05 },
  fireflies: { tex: "soft", additive: true, base: 0.12 },
  snow: { tex: "soft", additive: false, base: 0.07 },
  rain: { tex: "streak", additive: true, base: 0.16 },
  petals: { tex: "petal", additive: false, base: 0.08 },
  sparks: { tex: "star", additive: true, base: 0.09 },
  bubbles: { tex: "soft", additive: true, base: 0.1 },
  stars: { tex: "star", additive: true, base: 0.08 },
};

export function Particles() {
  const ref = useRef<THREE.Points>(null);
  const textures = useMemo(
    () => ({ soft: makeTexture("soft"), streak: makeTexture("streak"), petal: makeTexture("petal"), star: makeTexture("star") }),
    [],
  );
  const { geo, pos, seed } = useMemo(() => {
    const pos = new Float32Array(MAX * 3);
    const seed = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) {
      pos[i * 3] = BOX.cx + (Math.random() * 2 - 1) * BOX.x;
      pos[i * 3 + 1] = Math.random() * BOX.y;
      pos[i * 3 + 2] = BOX.cz + (Math.random() * 2 - 1) * BOX.z;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo, pos, seed };
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.05,
        map: textures.soft,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        opacity: 0,
      }),
    [textures],
  );
  const state = useRef({ type: "dust" as ParticleType, fade: 0, on: 0 });

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const target = useStore.getState().target.particles.type;
    const s = state.current;

    // Смена типа: гасим, меняем, зажигаем
    if (target !== s.type) {
      s.fade = Math.max(0, s.fade - dt * 1.2);
      if (s.fade === 0) {
        s.type = target;
        const st = STYLE[target];
        mat.map = textures[st.tex];
        mat.blending = st.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
        mat.needsUpdate = true;
      }
    } else {
      s.fade = Math.min(1, s.fade + dt * 0.6);
    }

    const style = STYLE[s.type];
    const speed = live.particleSpeed * (1 + live.level * live.musicReactivity * 1.5);
    // пылинки и прочие частицы видны только пока воспроизводится воспоминание
    const { phase } = useStore.getState();
    const playing = phase === "listening" || phase === "unwinding";
    s.on += ((playing ? 1 : 0) - s.on) * (1 - Math.exp(-(playing ? 1.2 : 2.5) * dt));
    const count = s.on < 0.01 ? 0 : Math.min(MAX, Math.round(live.particleCount * s.on));
    geo.setDrawRange(0, count);

    for (let i = 0; i < count; i++) {
      const k = i * 3;
      const r = seed[i];
      let x = pos[k], y = pos[k + 1], z = pos[k + 2];
      switch (s.type) {
        case "rain":
          y -= dt * (6 + r * 3) * (0.5 + speed * 0.5);
          x -= dt * 0.6;
          break;
        case "snow":
          y -= dt * (0.25 + r * 0.25) * speed;
          x += Math.sin(t * 0.7 + r * 20) * dt * 0.25;
          z += Math.cos(t * 0.5 + r * 15) * dt * 0.2;
          break;
        case "petals":
          y -= dt * (0.2 + r * 0.2) * speed;
          x += (Math.sin(t * 0.9 + r * 30) * 0.35 + 0.15) * dt * speed;
          z += Math.cos(t * 0.6 + r * 10) * dt * 0.25;
          break;
        case "fireflies":
          x += Math.sin(t * (0.4 + r) + r * 40) * dt * 0.3 * speed;
          y += Math.cos(t * (0.5 + r * 0.7) + r * 10) * dt * 0.2 * speed;
          z += Math.sin(t * (0.3 + r * 0.5) + r * 25) * dt * 0.3 * speed;
          break;
        case "bubbles":
          y += dt * (0.2 + r * 0.3) * speed;
          x += Math.sin(t * 1.5 + r * 30) * dt * 0.15;
          break;
        case "sparks":
          y += dt * (0.25 + r * 0.5) * speed;
          x += Math.sin(t * 2 + r * 50) * dt * 0.2 * speed;
          z += Math.cos(t * 2 + r * 30) * dt * 0.2 * speed;
          break;
        case "stars":
          x += Math.sin(t * 0.2 + r * 10) * dt * 0.05;
          y += Math.cos(t * 0.15 + r * 10) * dt * 0.05;
          break;
        default: // пыль в луче света
          x += Math.sin(t * 0.3 + r * 20) * dt * 0.08 * speed;
          y += Math.sin(t * 0.25 + r * 9) * dt * 0.06 * speed;
          z += Math.cos(t * 0.2 + r * 14) * dt * 0.08 * speed;
      }
      // зацикливание в объёме комнаты
      if (y < 0) { y = BOX.y; x = BOX.cx + (Math.random() * 2 - 1) * BOX.x; z = BOX.cz + (Math.random() * 2 - 1) * BOX.z; }
      if (y > BOX.y) { y = 0.05; x = BOX.cx + (Math.random() * 2 - 1) * BOX.x; z = BOX.cz + (Math.random() * 2 - 1) * BOX.z; }
      if (x < BOX.cx - BOX.x) x = BOX.cx + BOX.x;
      if (x > BOX.cx + BOX.x) x = BOX.cx - BOX.x;
      if (z < BOX.cz - BOX.z) z = BOX.cz + BOX.z;
      if (z > BOX.cz + BOX.z) z = BOX.cz - BOX.z;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;

    const twinkle = s.type === "fireflies" || s.type === "stars" ? 0.75 + Math.sin(t * 3) * 0.25 : 1;
    mat.size = style.base * live.particleSize * (1 + live.bass * live.musicReactivity * 0.8);
    mat.color.copy(live.particleColor);
    mat.opacity = s.fade * twinkle * (style.additive ? 0.9 : 0.85);
  });

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}
