// Локальный анализатор атмосферы. Работает без сети и без ключей,
// поэтому демо никогда не «ломается». Логика прозрачная:
//   текст  -> темы (лето, дождь, ночь, праздник…) + валентность и энергия
//   фото   -> доминирующие цвета, их средний тон, насыщенность, светлота
//   музыка -> громкость, «яркость» и темп
// Из этих сигналов выводятся все параметры сцены, а не выбирается готовая тема.

import { clamp, lerp } from "../util";
import { hexToRgb, hsl, mixHex, rgbToHsl, tint } from "./color";
import type { AnalyzeInput, Atmosphere, ParticleType } from "./types";

interface Theme {
  id: string;
  label: string;
  words: string[];
  valence: number; // -1..1
  energy: number; // 0..1
  warmth: number; // -1..1
  night?: boolean;
  hue?: number;
  particle?: ParticleType;
  /** Погода и время суток физически видны в комнате, поэтому весят больше. */
  weather?: boolean;
}

const THEMES: Theme[] = [
  { id: "summer", label: "лето", words: ["лет", "солнц", "жар", "пляж", "море", "морск", "загар", "каникул", "summer", "sun", "beach", "sea"], valence: 0.8, energy: 0.7, warmth: 0.9, hue: 38, particle: "sparks", weather: true },
  { id: "sunset", label: "закат", words: ["закат", "рассвет", "вечер", "золот", "sunset", "dawn", "golden"], valence: 0.5, energy: 0.35, warmth: 0.8, hue: 20, particle: "dust" },
  { id: "rain", label: "дождь", words: ["дожд", "ливен", "лужи", "лужа", "зонт", "гроз", "сыро", "rain", "storm"], valence: -0.2, energy: 0.3, warmth: -0.5, hue: 215, particle: "rain", weather: true },
  { id: "winter", label: "зима", words: ["зим", "снег", "снеж", "мороз", "новый год", "новогод", "ёлк", "елк", "лёд", "лед", "winter", "snow", "christmas"], valence: 0.4, energy: 0.35, warmth: -0.6, hue: 205, particle: "snow", weather: true },
  { id: "night", label: "ночь", words: ["ноч", "звёзд", "звезд", "луна", "лунн", "темн", "полноч", "night", "stars", "moon"], valence: 0.1, energy: 0.25, warmth: -0.3, night: true, hue: 240, particle: "stars", weather: true },
  { id: "spring", label: "весна", words: ["весн", "цвет", "сакур", "сирен", "сад", "май", "spring", "bloom", "flower"], valence: 0.7, energy: 0.5, warmth: 0.3, hue: 330, particle: "petals" },
  { id: "love", label: "любовь", words: ["любл", "любов", "свидан", "поцел", "обним", "сердц", "нежн", "love", "kiss", "date"], valence: 0.8, energy: 0.45, warmth: 0.6, hue: 345, particle: "petals" },
  { id: "party", label: "праздник", words: ["праздн", "вечерин", "концерт", "танц", "день рожд", "др ", "фестив", "салют", "клуб", "party", "concert", "dance", "birthday"], valence: 0.9, energy: 0.95, warmth: 0.4, hue: 290, particle: "sparks" },
  { id: "forest", label: "природа", words: ["лес", "поход", "палатк", "костёр", "костер", "горы", "гора", "озер", "река", "трав", "forest", "camp", "mountain", "lake"], valence: 0.6, energy: 0.45, warmth: 0.3, hue: 120, particle: "fireflies" },
  { id: "water", label: "вода", words: ["плав", "волн", "бассейн", "океан", "нырн", "swim", "ocean", "wave"], valence: 0.6, energy: 0.55, warmth: 0, hue: 190, particle: "bubbles" },
  { id: "sad", label: "грусть", words: ["груст", "печал", "скуча", "одинок", "плак", "прощ", "потер", "расстал", "тоск", "sad", "lonely", "miss", "cry"], valence: -0.8, energy: 0.2, warmth: -0.4, hue: 225, particle: "rain" },
  { id: "nostalgia", label: "ностальгия", words: ["детств", "бабушк", "дедушк", "помню", "вспомин", "старый", "давно", "школ", "дача", "дачу", "childhood", "remember", "old"], valence: 0.35, energy: 0.25, warmth: 0.7, hue: 32, particle: "dust" },
  { id: "calm", label: "спокойствие", words: ["тих", "спокой", "уют", "чай", "книг", "плед", "отдых", "медлен", "calm", "quiet", "cozy", "tea"], valence: 0.45, energy: 0.15, warmth: 0.5, hue: 30, particle: "dust" },
  { id: "joy", label: "радость", words: ["счаст", "радост", "весел", "смея", "смех", "ура", "восторг", "лучший", "happy", "joy", "fun", "best"], valence: 0.9, energy: 0.75, warmth: 0.5, hue: 48, particle: "fireflies" },
  { id: "city", label: "город", words: ["город", "улиц", "метро", "огни", "неон", "крыш", "city", "street", "neon"], valence: 0.3, energy: 0.6, warmth: -0.1, night: true, hue: 270, particle: "sparks" },
  { id: "anxiety", label: "тревога", words: ["страх", "страш", "тревог", "волн", "экзам", "стресс", "fear", "stress", "exam"], valence: -0.5, energy: 0.65, warmth: -0.3, hue: 260, particle: "dust" },
];

function detectThemes(text: string) {
  const t = ` ${text.toLowerCase().replace(/ё/g, "е")} `;
  const hits: { theme: Theme; score: number }[] = [];
  for (const theme of THEMES) {
    let score = 0;
    for (const w of theme.words) {
      const needle = w.replace(/ё/g, "е");
      let idx = t.indexOf(needle);
      while (idx !== -1) {
        score++;
        idx = t.indexOf(needle, idx + needle.length);
      }
    }
    if (score > 0) hits.push({ theme, score: theme.weather ? score * 2 : score });
  }
  return hits.sort((a, b) => b.score - a.score);
}

function circularMeanHue(items: { hue: number; w: number }[]): number | null {
  let x = 0, y = 0, tw = 0;
  for (const { hue, w } of items) {
    x += Math.cos((hue * Math.PI) / 180) * w;
    y += Math.sin((hue * Math.PI) / 180) * w;
    tw += w;
  }
  if (tw === 0) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function analyzeLocally(input: AnalyzeInput): Atmosphere {
  const text = `${input.title}. ${input.text}. ${input.songName}`;
  const hits = detectThemes(text);
  const total = hits.reduce((s, h) => s + h.score, 0) || 1;

  // Текст: средневзвешенные валентность, энергия, теплота.
  let valence = 0.2, energy = 0.4, warmth = 0.1, nightVotes = 0;
  if (hits.length) {
    valence = hits.reduce((s, h) => s + h.theme.valence * h.score, 0) / total;
    energy = hits.reduce((s, h) => s + h.theme.energy * h.score, 0) / total;
    warmth = hits.reduce((s, h) => s + h.theme.warmth * h.score, 0) / total;
    nightVotes = hits.reduce((s, h) => s + (h.theme.night ? h.score : 0), 0) / total;
  }
  const exclam = (input.text.match(/!/g) || []).length;
  energy = clamp(energy + exclam * 0.04, 0, 1);

  // Фото: средний тон, насыщенность и светлота доминирующих цветов.
  const photoHsl = input.photoColors.map((c) => rgbToHsl(hexToRgb(c)));
  const photoSat = photoHsl.length ? photoHsl.reduce((s, c) => s + c[1], 0) / photoHsl.length : 0.4;
  const photoLight = photoHsl.length ? photoHsl.reduce((s, c) => s + c[2], 0) / photoHsl.length : 0.5;
  if (photoHsl.length) {
    // Тёплые оттенки фото добавляют тепла, синие — холода.
    const photoWarm = photoHsl.reduce((s, [h, sat]) => s + Math.cos(((h - 35) * Math.PI) / 180) * sat, 0) / photoHsl.length;
    warmth = clamp(warmth * 0.65 + photoWarm * 0.6, -1, 1);
    if (photoLight < 0.3) nightVotes += 0.4;
  }

  // Музыка: громкость и темп поднимают энергию, «яркость» — свет.
  if (input.audio) {
    const a = input.audio;
    const tempo = clamp((a.bpm - 60) / 100, 0, 1);
    energy = clamp(energy * 0.5 + (a.energy * 0.5 + tempo * 0.5) * 0.5, 0, 1);
    valence = clamp(valence + (a.brightness - 0.5) * 0.3, -1, 1);
  }

  const night = nightVotes >= 0.35;
  // Пасмурная погода: серое небо и приглушённое солнце.
  const overcast = hits.some((h) => h.theme.id === "rain" && h.score >= total * 0.25);

  // Основной тон: из тем и из фото.
  const hueSources = [
    // квадрат веса: доминирующая тема задаёт тон, остальные лишь сдвигают его
    ...hits.filter((h) => h.theme.hue !== undefined).map((h) => ({ hue: h.theme.hue!, w: h.score * h.score })),
    ...photoHsl.filter((c) => c[1] > 0.15).map(([h, s]) => ({ hue: h, w: s * 1.5 })),
  ];
  const baseHue = circularMeanHue(hueSources) ?? (warmth > 0 ? 35 : 210);

  const sat = clamp(0.35 + Math.abs(valence) * 0.25 + photoSat * 0.3 + energy * 0.15, 0.25, 0.9);
  const light = clamp(night ? 0.32 : 0.55 + valence * 0.1 + (photoLight - 0.5) * 0.2, 0.25, 0.75);
  const spread = 18 + energy * 40;
  const palette = [
    hsl(baseHue, sat, clamp(light + 0.22, 0, 0.92)),
    hsl(baseHue + spread, sat, light + 0.05),
    hsl(baseHue - spread, sat * 0.9, light),
    hsl(baseHue + 180 * (energy > 0.6 ? 1 : 0.25), sat * 0.7, light - 0.12),
    hsl(baseHue, sat * 0.6, clamp(light - 0.3, 0.06, 1)),
  ];
  if (input.photoColors[0]) palette[1] = mixHex(palette[1], input.photoColors[0], 0.5);
  if (input.photoColors[1]) palette[2] = mixHex(palette[2], input.photoColors[1], 0.5);

  // Частицы: самая сильная тема с частицами; иначе по энергии.
  const particleType: ParticleType =
    hits.find((h) => h.theme.weather && h.theme.id !== "night" && h.theme.particle)?.theme.particle ??
    hits.find((h) => h.theme.particle)?.theme.particle ?? (energy > 0.65 ? "sparks" : night ? "stars" : "dust");

  const particleColor =
    particleType === "rain" ? "#a9c7ff" :
    particleType === "snow" ? "#ffffff" :
    particleType === "petals" ? hsl(340, 0.7, 0.8) :
    particleType === "fireflies" ? hsl(55, 0.95, 0.65) :
    particleType === "bubbles" ? hsl(190, 0.6, 0.85) :
    particleType === "stars" ? "#fff6d8" :
    palette[0];

  const keyLight = tint(night ? hsl(225, 0.45, 0.72) : overcast ? hsl(210, 0.25, 0.8) : hsl(baseHue, 0.55, 0.82), warmth);
  const intensity = (night ? 0.55 + energy * 0.4 : 1.1 + valence * 0.5 + energy * 0.5) * (overcast ? 0.55 : 1);

  const moodWords = hits.slice(0, 2).map((h) => h.theme.label);
  const tone = valence > 0.5 ? "светлое" : valence > 0 ? "спокойное" : valence > -0.4 ? "задумчивое" : "грустное";
  const mood = moodWords.length ? `${tone}: ${moodWords.join(" и ")}` : `${tone} воспоминание`;

  return {
    mood,
    description: describe(valence, energy, warmth, night, moodWords),
    palette,
    keyLightColor: keyLight,
    keyIntensity: clamp(intensity, 0.3, 2.8),
    ambientColor: tint(hsl(baseHue + 20, 0.35, night ? 0.35 : 0.7), warmth * 0.5),
    ambientIntensity: clamp(night ? 0.25 : 0.4 + valence * 0.15, 0.15, 1.2),
    skyColor: night ? hsl(235, 0.5, 0.12) : overcast ? hsl(215, 0.18, 0.5) : tint(hsl(baseHue + (warmth > 0.3 ? -10 : 180), 0.5, 0.62), warmth),
    haze: clamp(0.15 + (1 - energy) * 0.35 + (valence < 0 ? 0.2 : 0) + (overcast ? 0.25 : 0), 0, 1),
    contrast: clamp(0.25 + energy * 0.4 + (valence < -0.3 ? 0.25 : 0), 0, 1),
    warmth,
    lightAngle: (baseHue + 30) % 360,
    lightElevation: night ? 60 : clamp(lerp(12, 70, (valence + 1) / 2 * 0.6 + energy * 0.4), 8, 80),
    particles: {
      type: particleType,
      count: Math.round(clamp(80 + energy * 320 + (particleType === "rain" || particleType === "snow" ? 150 : 0), 40, 600)),
      speed: clamp(0.3 + energy * 1.8, 0.15, 3),
      size: clamp(particleType === "petals" ? 1.8 : 0.8 + (1 - energy) * 0.8, 0.5, 3),
      color: particleColor,
    },
    animSpeed: clamp(0.4 + energy * 1.4, 0.2, 2),
    musicReactivity: clamp(0.25 + energy * 0.7, 0, 1),
    glow: clamp(0.35 + (night ? 0.6 : 0) + energy * 0.5, 0, 2),
    lampColor: tint(hsl(baseHue, 0.7, 0.72), warmth),
    nightSky: night,
  };
}

function describe(valence: number, energy: number, warmth: number, night: boolean, themes: string[]): string {
  const light = night ? "ночной полумрак" : warmth > 0.3 ? "тёплый золотистый свет" : warmth < -0.3 ? "холодный прозрачный свет" : "мягкий дневной свет";
  const pace = energy > 0.65 ? "быстрые искры и движение" : energy > 0.35 ? "неспешное движение воздуха" : "почти неподвижный воздух";
  const feel = valence > 0.4 ? "чтобы вернуть ощущение счастья" : valence < -0.2 ? "чтобы бережно прожить эту грусть" : "чтобы задержаться в этом моменте";
  const about = themes.length ? `В тексте слышны ${themes.join(", ")}: ` : "";
  return `${about}${light}, ${pace}, ${feel}.`;
}
