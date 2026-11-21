// Параметры визуальной сцены, которые AI (или локальный анализатор)
// выводит из воспоминания. Геометрия комнаты не меняется, меняется только это.

export const PARTICLE_TYPES = [
  "dust",
  "fireflies",
  "snow",
  "rain",
  "petals",
  "sparks",
  "bubbles",
  "stars",
] as const;
export type ParticleType = (typeof PARTICLE_TYPES)[number];

/** Куда переносится персонаж, чтобы пережить день; room — остаться в комнате. */
export const PLACES = ["room", "beach", "forest", "city", "winter", "mountains", "park", "village", "concert", "desert", "fair"] as const;
export type Place = (typeof PLACES)[number];

export interface Atmosphere {
  /** Короткое название настроения: «тёплая ностальгия», «летняя эйфория». */
  mood: string;
  /** Одна образная фраза, объясняющая выбор атмосферы. */
  description: string;
  /** 5 цветов палитры воспоминания (hex). */
  palette: string[];
  /** Цвет основного («солнечного») света. */
  keyLightColor: string;
  /** 0..3 */
  keyIntensity: number;
  /** Цвет заполняющего света. */
  ambientColor: string;
  /** 0..2 */
  ambientIntensity: number;
  /** Цвет неба за окном и тумана. */
  skyColor: string;
  /** 0..1, насколько густой туман/дымка. */
  haze: number;
  /** 0..1, контраст (сильнее тени и виньетка). */
  contrast: number;
  /** -1 холодный .. 1 тёплый */
  warmth: number;
  /** Азимут основного света, градусы 0..360. */
  lightAngle: number;
  /** Высота основного света, градусы 5..85 (низкое солнце — закат). */
  lightElevation: number;
  particles: {
    type: ParticleType;
    /** 0..600 */
    count: number;
    /** 0.1..3 */
    speed: number;
    /** 0.5..3 */
    size: number;
    color: string;
  };
  /** Скорость визуальных анимаций 0.2..2 */
  animSpeed: number;
  /** 0..1, насколько сцена «дышит» под музыку. */
  musicReactivity: number;
  /** 0..2, сила свечения (bloom). */
  glow: number;
  /** Цвет лампы на столе. */
  lampColor: string;
  /** Звёзды за окном. */
  nightSky: boolean;
  /** Локация воспоминания (у старых записей может не быть). */
  place?: Place;
}

export const NEUTRAL_ATMOSPHERE: Atmosphere = {
  mood: "обычный день",
  description: "Комната ждёт, пока вы откроете альбом.",
  palette: ["#e9dccb", "#c9b79c", "#8fa39a", "#5d6b73", "#3a3f4b"],
  keyLightColor: "#fff1dc",
  keyIntensity: 1.6,
  ambientColor: "#d9e2ec",
  ambientIntensity: 0.55,
  skyColor: "#9cc6e8",
  haze: 0.1,
  contrast: 0.35,
  warmth: 0.1,
  lightAngle: 40,
  lightElevation: 45,
  particles: { type: "dust", count: 70, speed: 0.4, size: 1, color: "#fff4dd" },
  animSpeed: 1,
  musicReactivity: 0.3,
  glow: 0.4,
  lampColor: "#ffd9a0",
  nightSky: false,
};

export interface AudioFeatures {
  /** 0..1 средняя громкость */
  energy: number;
  /** 0..1 «яркость» звука (доля высоких частот) */
  brightness: number;
  /** ударов в минуту, оценка */
  bpm: number;
  /** длительность, секунды */
  duration: number;
}

export interface AnalyzeInput {
  title: string;
  text: string;
  songName: string;
  /** Доминирующие цвета фотографий (hex), посчитанные в браузере. */
  photoColors: string[];
  /** Уменьшенные фото (data URL jpeg) для анализа моделью. */
  photoThumbs: string[];
  audio: AudioFeatures | null;
}

export interface AnalyzeResult {
  atmosphere: Atmosphere;
  source: "claude" | "local";
}
