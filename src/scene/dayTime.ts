// Время суток в комнате идёт по настенным часам. Стартуют с реального
// времени, клик по часам переводит их на час вперёд. От времени зависят
// солнце, небо за окном и свет, пока не играет воспоминание.

import { NEUTRAL_ATMOSPHERE, type Atmosphere } from "../atmosphere/types";

const now = new Date();
export const gameClock = {
  /** Часы 0..24 */
  hours: now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600,
  /** Сколько ещё «прокрутить» вперёд (часы), стрелки бегут быстро */
  pending: 0,
};

export function stepClock(dt: number) {
  let add = dt / 3600;
  if (gameClock.pending > 0) {
    const fast = Math.min(gameClock.pending, dt * 1.2); // час за ~0.8 с
    gameClock.pending -= fast;
    add += fast;
  }
  gameClock.hours = (gameClock.hours + add) % 24;
}

export function advanceClock(h = 1) {
  gameClock.pending += h;
}

/** Вечер или ночь: пора выключать торшер перед сном. */
export function isEvening(h = gameClock.hours) {
  return h >= 19 || h < 6;
}

export function partOfDay(h = gameClock.hours) {
  if (h < 5) return "ночь";
  if (h < 11) return "утро";
  if (h < 17) return "день";
  if (h < 21.5) return "вечер";
  return "ночь";
}

type Key = {
  h: number;
  key: string;
  keyI: number;
  amb: string;
  ambI: number;
  sky: string;
  elev: number;
  angle: number;
  lamp: string;
  night: boolean;
  haze: number;
  warmth: number;
};

// Опорные точки суток; между ними плавная интерполяция
const KEYS: Key[] = [
  { h: 0, key: "#8fa3d6", keyI: 0.35, amb: "#4a5a8c", ambI: 0.45, sky: "#141a36", elev: 30, angle: 300, lamp: "#ffc98a", night: true, haze: 0.15, warmth: -0.3 },
  { h: 5, key: "#9db0e0", keyI: 0.4, amb: "#4f5e94", ambI: 0.45, sky: "#1d2648", elev: 8, angle: 90, lamp: "#ffc98a", night: true, haze: 0.2, warmth: -0.2 },
  { h: 6.5, key: "#ffc49a", keyI: 1.0, amb: "#c9b8c8", ambI: 0.45, sky: "#f3b69a", elev: 10, angle: 80, lamp: "#ffd9a0", night: false, haze: 0.25, warmth: 0.4 },
  { h: 9, key: "#fff0d8", keyI: 1.5, amb: "#d9e2ec", ambI: 0.55, sky: "#a9d2f0", elev: 35, angle: 60, lamp: "#ffd9a0", night: false, haze: 0.1, warmth: 0.1 },
  { h: 13, key: "#fff6e8", keyI: 1.8, amb: "#dfe8f0", ambI: 0.6, sky: "#8fc3ec", elev: 65, angle: 30, lamp: "#ffd9a0", night: false, haze: 0.08, warmth: 0.05 },
  { h: 17, key: "#ffe0b0", keyI: 1.5, amb: "#e6d6c6", ambI: 0.5, sky: "#f2c890", elev: 25, angle: 345, lamp: "#ffd29a", night: false, haze: 0.15, warmth: 0.45 },
  { h: 19.5, key: "#ff9a6a", keyI: 1.0, amb: "#a888a8", ambI: 0.4, sky: "#e07a6a", elev: 8, angle: 330, lamp: "#ffc98a", night: false, haze: 0.25, warmth: 0.6 },
  { h: 21, key: "#8a90d0", keyI: 0.45, amb: "#55558c", ambI: 0.45, sky: "#2a2856", elev: 20, angle: 310, lamp: "#ffc98a", night: true, haze: 0.18, warmth: -0.1 },
  { h: 24, key: "#8fa3d6", keyI: 0.35, amb: "#4a5a8c", ambI: 0.45, sky: "#141a36", elev: 30, angle: 300, lamp: "#ffc98a", night: true, haze: 0.15, warmth: -0.3 },
];

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, t: number) =>
  "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const tod: Atmosphere = { ...NEUTRAL_ATMOSPHERE, particles: { ...NEUTRAL_ATMOSPHERE.particles } };

/** Атмосфера комнаты «без воспоминания» для текущего часа. Объект переиспользуется. */
export function timeOfDayAtmosphere(h = gameClock.hours): Atmosphere {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
  tod.keyLightColor = mixHex(a.key, b.key, t);
  tod.keyIntensity = lerp(a.keyI, b.keyI, t);
  tod.ambientColor = mixHex(a.amb, b.amb, t);
  tod.ambientIntensity = lerp(a.ambI, b.ambI, t);
  tod.skyColor = mixHex(a.sky, b.sky, t);
  tod.lightElevation = lerp(a.elev, b.elev, t);
  // угол по кратчайшей дуге
  const da = ((b.angle - a.angle + 540) % 360) - 180;
  tod.lightAngle = (a.angle + da * t + 360) % 360;
  tod.lampColor = mixHex(a.lamp, b.lamp, t);
  tod.haze = lerp(a.haze, b.haze, t);
  tod.warmth = lerp(a.warmth, b.warmth, t);
  tod.nightSky = t < 0.5 ? a.night : b.night;
  tod.particles.type = tod.nightSky ? "stars" : "dust";
  tod.particles.count = tod.nightSky ? 50 : 70;
  tod.mood = partOfDay(h);
  return tod;
}
