// Процедурные фактуры на canvas: дерево, штукатурка, ткань.
// Карты почти белые: цвет по-прежнему задаёт material.color (и палитра),
// а фактура лишь добавляет волокна, неровности и плетение.

import * as THREE from "three";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function toTex(c: HTMLCanvasElement, color: boolean, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = new Map<string, { map: THREE.Texture; bump: THREE.Texture }>();

/** Дерево: волокна идут вдоль оси V (по длине доски). */
export function woodTextures(seed = 1, seams = false) {
  const key = `wood${seed}${seams}`;
  if (cache.has(key)) return cache.get(key)!;
  const W = 256, H = 1024;
  const [c, g] = canvas(W, H);
  const [b, gb] = canvas(W, H);
  const r = rng(seed);
  g.fillStyle = "#f2f2f2";
  g.fillRect(0, 0, W, H);
  gb.fillStyle = "#808080";
  gb.fillRect(0, 0, W, H);
  // длинные волокна с лёгким изгибом
  for (let i = 0; i < 260; i++) {
    const x0 = r() * W;
    const amp = 2 + r() * 6;
    const fr = 0.002 + r() * 0.006;
    const ph = r() * 6.28;
    const dark = r() < 0.25;
    g.strokeStyle = dark ? `rgba(90,55,30,${0.10 + r() * 0.14})` : `rgba(140,100,60,${0.05 + r() * 0.08})`;
    g.lineWidth = dark ? 1 + r() * 1.6 : 0.6 + r();
    gb.strokeStyle = `rgba(40,40,40,${0.15 + r() * 0.2})`;
    gb.lineWidth = g.lineWidth;
    g.beginPath();
    gb.beginPath();
    for (let y = 0; y <= H; y += 8) {
      const x = x0 + Math.sin(y * fr + ph) * amp;
      if (y === 0) {
        g.moveTo(x, y);
        gb.moveTo(x, y);
      } else {
        g.lineTo(x, y);
        gb.lineTo(x, y);
      }
    }
    g.stroke();
    gb.stroke();
  }
  // пара сучков
  for (let k = 0; k < 2; k++) {
    const cx = 30 + r() * (W - 60), cy = r() * H;
    for (let j = 6; j > 0; j--) {
      g.strokeStyle = `rgba(80,45,22,${0.06 + j * 0.02})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(cx, cy, j * 3.2, j * 9, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // мелкий шум
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // стыки досок
  if (seams) {
    for (const y of [r() * H * 0.5, H * 0.5 + r() * H * 0.5]) {
      g.fillStyle = "rgba(60,35,18,0.55)";
      g.fillRect(0, y, W, 3);
      gb.fillStyle = "#202020";
      gb.fillRect(0, y, W, 3);
    }
  }
  // боковые фаски тёмные — доски читаются отдельно
  const edge = g.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, "rgba(50,30,15,0.45)");
  edge.addColorStop(0.03, "rgba(50,30,15,0)");
  edge.addColorStop(0.97, "rgba(50,30,15,0)");
  edge.addColorStop(1, "rgba(50,30,15,0.45)");
  if (seams) {
    g.fillStyle = edge;
    g.fillRect(0, 0, W, H);
  }
  const out = { map: toTex(c, true), bump: toTex(b, false) };
  cache.set(key, out);
  return out;
}

/** Штукатурка: мягкие пятна и мелкая шероховатость. */
export function plasterTextures() {
  const key = "plaster";
  if (cache.has(key)) return cache.get(key)!;
  const S = 512;
  const [c, g] = canvas(S, S);
  const [b, gb] = canvas(S, S);
  const r = rng(7);
  g.fillStyle = "#f4f4f4";
  g.fillRect(0, 0, S, S);
  gb.fillStyle = "#808080";
  gb.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 80;
    const shade = r() < 0.5 ? "0,0,0" : "255,255,255";
    for (const [ctx, a] of [[g, 0.035], [gb, 0.12]] as const) {
      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${shade},${a})`);
      grd.addColorStop(1, `rgba(${shade},0)`);
      ctx.fillStyle = grd;
      // повторяем у краёв, чтобы фактура была бесшовной
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        ctx.restore();
      }
    }
  }
  for (const ctx of [g, gb]) {
    const img = ctx.getImageData(0, 0, S, S);
    const amt = ctx === g ? 10 : 60;
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * amt;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
  const out = { map: toTex(c, true, 3, 2), bump: toTex(b, false, 3, 2) };
  cache.set(key, out);
  return out;
}

/** Ткань: плетение нитей. */
export function fabricTextures() {
  const key = "fabric";
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const [c, g] = canvas(S, S);
  const [b, gb] = canvas(S, S);
  const r = rng(3);
  g.fillStyle = "#f0f0f0";
  g.fillRect(0, 0, S, S);
  gb.fillStyle = "#808080";
  gb.fillRect(0, 0, S, S);
  const step = 4;
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      const over = ((x + y) / step) % 2 === 0;
      const v = (over ? 255 : 205) - r() * 22;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, step, step);
      const bv = over ? 170 : 90;
      gb.fillStyle = `rgb(${bv},${bv},${bv})`;
      gb.fillRect(x + 0.5, y + 0.5, step - 1, step - 1);
    }
  }
  // редкие ворсинки
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 3, 1);
  }
  const out = { map: toTex(c, true, 6, 6), bump: toTex(b, false, 6, 6) };
  cache.set(key, out);
  return out;
}
