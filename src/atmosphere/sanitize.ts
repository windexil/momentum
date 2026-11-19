// Приводит любой ответ (от модели или из базы) к допустимым значениям,
// чтобы сцена никогда не получила NaN или неверный цвет.

import { NEUTRAL_ATMOSPHERE, PARTICLE_TYPES, type Atmosphere, type ParticleType } from "./types";

const clamp = (v: unknown, a: number, b: number, d: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(b, Math.max(a, n));
};
const hex = (v: unknown, d: string) => {
  if (typeof v !== "string") return d;
  const s = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return ("#" + s.slice(1).split("").map((c) => c + c).join("")).toLowerCase();
  return d;
};

export function sanitizeAtmosphere(raw: Partial<Atmosphere> | null | undefined): Atmosphere {
  const d = NEUTRAL_ATMOSPHERE;
  const r = (raw ?? {}) as Partial<Atmosphere>;
  const p = (r.particles ?? {}) as Partial<Atmosphere["particles"]>;
  const palette = Array.isArray(r.palette) ? r.palette.map((c, i) => hex(c, d.palette[i % 5])) : d.palette;
  while (palette.length < 5) palette.push(d.palette[palette.length]);
  const type: ParticleType = PARTICLE_TYPES.includes(p.type as ParticleType) ? (p.type as ParticleType) : "dust";
  return {
    mood: typeof r.mood === "string" && r.mood.trim() ? r.mood.trim().slice(0, 60) : d.mood,
    description: typeof r.description === "string" ? r.description.trim().slice(0, 240) : d.description,
    palette: palette.slice(0, 5),
    keyLightColor: hex(r.keyLightColor, d.keyLightColor),
    keyIntensity: clamp(r.keyIntensity, 0.2, 3, d.keyIntensity),
    ambientColor: hex(r.ambientColor, d.ambientColor),
    ambientIntensity: clamp(r.ambientIntensity, 0.1, 2, d.ambientIntensity),
    skyColor: hex(r.skyColor, d.skyColor),
    haze: clamp(r.haze, 0, 1, d.haze),
    contrast: clamp(r.contrast, 0, 1, d.contrast),
    warmth: clamp(r.warmth, -1, 1, d.warmth),
    lightAngle: clamp(r.lightAngle, 0, 360, d.lightAngle),
    lightElevation: clamp(r.lightElevation, 5, 85, d.lightElevation),
    particles: {
      type,
      count: Math.round(clamp(p.count, 0, 600, d.particles.count)),
      speed: clamp(p.speed, 0.1, 3, d.particles.speed),
      size: clamp(p.size, 0.5, 3, d.particles.size),
      color: hex(p.color, d.particles.color),
    },
    animSpeed: clamp(r.animSpeed, 0.2, 2, d.animSpeed),
    musicReactivity: clamp(r.musicReactivity, 0, 1, d.musicReactivity),
    glow: clamp(r.glow, 0, 2, d.glow),
    lampColor: hex(r.lampColor, d.lampColor),
    nightSky: typeof r.nightSky === "boolean" ? r.nightSky : d.nightSky,
  };
}
