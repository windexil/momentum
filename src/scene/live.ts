// «Живая» атмосфера: плавно перетекает к целевой каждый кадр.
// Хранится вне React, чтобы не перерисовывать дерево 60 раз в секунду.

import * as THREE from "three";
import { NEUTRAL_ATMOSPHERE, type Atmosphere } from "../atmosphere/types";

const c = (hex: string) => new THREE.Color(hex);

export const live = {
  palette: NEUTRAL_ATMOSPHERE.palette.map(c),
  keyLightColor: c(NEUTRAL_ATMOSPHERE.keyLightColor),
  keyIntensity: NEUTRAL_ATMOSPHERE.keyIntensity,
  ambientColor: c(NEUTRAL_ATMOSPHERE.ambientColor),
  ambientIntensity: NEUTRAL_ATMOSPHERE.ambientIntensity,
  skyColor: c(NEUTRAL_ATMOSPHERE.skyColor),
  haze: NEUTRAL_ATMOSPHERE.haze,
  contrast: NEUTRAL_ATMOSPHERE.contrast,
  lightAngle: NEUTRAL_ATMOSPHERE.lightAngle,
  lightElevation: NEUTRAL_ATMOSPHERE.lightElevation,
  particleCount: NEUTRAL_ATMOSPHERE.particles.count,
  particleSpeed: NEUTRAL_ATMOSPHERE.particles.speed,
  particleSize: NEUTRAL_ATMOSPHERE.particles.size,
  particleColor: c(NEUTRAL_ATMOSPHERE.particles.color),
  animSpeed: NEUTRAL_ATMOSPHERE.animSpeed,
  musicReactivity: NEUTRAL_ATMOSPHERE.musicReactivity,
  glow: NEUTRAL_ATMOSPHERE.glow,
  lampColor: c(NEUTRAL_ATMOSPHERE.lampColor),
  night: 0,
  /** Сглаженный уровень музыки 0..1 */
  level: 0,
  bass: 0,
};

const tmp = new THREE.Color();

/** Экспоненциальное сглаживание: rate — «скорость» перехода (1/сек). */
export function stepLive(target: Atmosphere, dt: number, rate: number) {
  const k = 1 - Math.exp(-rate * dt);
  const n = (a: number, b: number) => a + (b - a) * k;
  const col = (cur: THREE.Color, hex: string) => cur.lerp(tmp.set(hex), k);

  target.palette.forEach((h, i) => live.palette[i] && col(live.palette[i], h));
  col(live.keyLightColor, target.keyLightColor);
  col(live.ambientColor, target.ambientColor);
  col(live.skyColor, target.skyColor);
  col(live.particleColor, target.particles.color);
  col(live.lampColor, target.lampColor);
  live.keyIntensity = n(live.keyIntensity, target.keyIntensity);
  live.ambientIntensity = n(live.ambientIntensity, target.ambientIntensity);
  live.haze = n(live.haze, target.haze);
  live.contrast = n(live.contrast, target.contrast);
  // угол — по кратчайшей дуге
  let da = ((target.lightAngle - live.lightAngle + 540) % 360) - 180;
  live.lightAngle = (live.lightAngle + da * k + 360) % 360;
  live.lightElevation = n(live.lightElevation, target.lightElevation);
  live.particleCount = n(live.particleCount, target.particles.count);
  live.particleSpeed = n(live.particleSpeed, target.particles.speed);
  live.particleSize = n(live.particleSize, target.particles.size);
  live.animSpeed = n(live.animSpeed, target.animSpeed);
  live.musicReactivity = n(live.musicReactivity, target.musicReactivity);
  live.glow = n(live.glow, target.glow);
  live.night = n(live.night, target.nightSky ? 1 : 0);
}
