// Восемь демонстрационных воспоминаний с заметно разной атмосферой.
// Картинки нарисованы в SVG прямо здесь, музыка синтезируется, так что
// всё содержимое демо собственное и без проблем с лицензиями.
// Атмосфера считается тем же анализатором, что и для новых записей.

import { analyzeLocally } from "../atmosphere/localAnalyzer";
import type { Memory } from "../types";
import { PRESETS, type SynthPreset } from "../audio/synth";

const svg = (body: string) =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${body}</svg>`);

const beach = svg(`
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb86b"/><stop offset=".55" stop-color="#ffd9a1"/><stop offset="1" stop-color="#fff0c9"/></linearGradient>
<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2bb3c0"/><stop offset="1" stop-color="#127c9e"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#s)"/>
<circle cx="290" cy="120" r="46" fill="#fff4c2"/><circle cx="290" cy="120" r="70" fill="#fff4c2" opacity=".25"/>
<rect y="160" width="400" height="70" fill="url(#w)"/>
<path d="M0 170 Q50 162 100 170 T200 170 T300 170 T400 170" stroke="#bff3f0" stroke-width="3" fill="none" opacity=".8"/>
<path d="M0 230 Q120 205 400 222 L400 300 L0 300Z" fill="#f2cf8f"/>
<g transform="translate(70 200)"><path d="M0 40 L6 -60" stroke="#7a4b2a" stroke-width="6"/><path d="M6 -60 q-40 -10 -60 14 M6 -60 q40 -14 60 6 M6 -60 q-14 -30 -46 -30 M6 -60 q20 -30 52 -26" stroke="#2f8f4e" stroke-width="10" fill="none" stroke-linecap="round"/></g>
<g transform="translate(240 236)"><path d="M0 0 L50 0 L25 -50Z" fill="#ff6f61"/><path d="M25 -50 L25 10" stroke="#fff" stroke-width="2"/></g>`);

const friends = svg(`
<rect width="400" height="300" fill="#ffcf7a"/>
<circle cx="80" cy="60" r="90" fill="#ffe6ad"/>
<g fill="#ff8a5b"><circle cx="140" cy="170" r="34"/><rect x="108" y="200" width="64" height="100" rx="26"/></g>
<g fill="#4fb3a9"><circle cx="250" cy="160" r="34"/><rect x="218" y="190" width="64" height="110" rx="26"/></g>
<g fill="#fff6dc"><circle cx="128" cy="166" r="4"/><circle cx="152" cy="166" r="4"/><circle cx="238" cy="156" r="4"/><circle cx="262" cy="156" r="4"/></g>
<path d="M128 182 q12 10 24 0 M238 172 q12 10 24 0" stroke="#5a2d1a" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#fff" opacity=".8"><circle cx="330" cy="60" r="5"/><circle cx="350" cy="90" r="3"/><circle cx="60" cy="230" r="4"/><circle cx="310" cy="250" r="3"/></g>`);

const rainWindow = svg(`
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d5d78"/><stop offset="1" stop-color="#2a3347"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#g)"/>
<g fill="#36415a"><rect x="20" y="150" width="60" height="150"/><rect x="90" y="120" width="50" height="180"/><rect x="300" y="140" width="80" height="160"/></g>
<g fill="#ffd27a" opacity=".85"><rect x="34" y="170" width="10" height="12"/><rect x="104" y="140" width="10" height="12"/><rect x="320" y="170" width="12" height="12"/><rect x="350" y="200" width="12" height="12"/></g>
<rect x="0" y="0" width="400" height="300" fill="none" stroke="#1d2433" stroke-width="22"/>
<path d="M200 0 V300 M0 150 H400" stroke="#1d2433" stroke-width="10"/>
<g stroke="#b9cbe8" stroke-width="2" opacity=".55" stroke-linecap="round">
${Array.from({ length: 40 }, (_, i) => `<path d="M${(i * 53) % 400} ${(i * 97) % 300} l-4 18"/>`).join("")}</g>
<g transform="translate(150 230)"><rect x="0" y="0" width="34" height="36" rx="5" fill="#e7d7c6"/><path d="M34 8 q14 2 0 18" stroke="#e7d7c6" stroke-width="5" fill="none"/><path d="M10 -6 q4 -10 0 -18 M22 -6 q4 -10 0 -18" stroke="#fff" stroke-width="2" opacity=".5" fill="none"/></g>`);

const winterNight = svg(`
<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1840"/><stop offset="1" stop-color="#2c3f86"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#n)"/>
<circle cx="320" cy="60" r="26" fill="#f4f1d6"/>
<g fill="#fff">${Array.from({ length: 50 }, (_, i) => `<circle cx="${(i * 71) % 400}" cy="${(i * 37) % 200}" r="${(i % 3) + 1}" opacity=".8"/>`).join("")}</g>
<path d="M0 230 Q100 200 200 225 T400 215 V300 H0Z" fill="#e8f0ff"/>
<g transform="translate(110 120)"><path d="M40 0 L80 60 H60 L95 110 H70 L105 160 H-25 L10 110 H-15 L20 60 H0Z" fill="#1e6b4f"/><rect x="32" y="160" width="16" height="20" fill="#6b4226"/>
<g fill="#ffd36b"><circle cx="40" cy="40" r="5"/><circle cx="25" cy="85" r="5"/><circle cx="62" cy="95" r="5"/><circle cx="15" cy="135" r="5"/><circle cx="70" cy="140" r="5"/></g><path d="M40 -10 l5 10 -10 0z" fill="#ffd36b"/></g>
<g transform="translate(260 180)"><rect width="80" height="56" fill="#7d4b3a"/><path d="M-8 0 L40 -36 L88 0Z" fill="#e8f0ff"/><rect x="28" y="16" width="22" height="18" fill="#ffcf6e"/></g>`);

const forestWalk = svg(`
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe8b0"/><stop offset="1" stop-color="#7fb069"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#f)"/>
<circle cx="300" cy="70" r="40" fill="#fff6c8" opacity=".9"/>
<g fill="#2f6b3a">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 48 + 10} 230 l26 -${110 + (i % 3) * 25} l26 ${110 + (i % 3) * 25}z"/>`).join("")}</g>
<path d="M170 300 Q200 240 215 205 L235 205 Q240 250 260 300Z" fill="#c9a36b"/>
<g transform="translate(120 250)"><rect x="-3" y="0" width="6" height="14" fill="#f3e6cf"/><ellipse cx="0" cy="0" rx="14" ry="8" fill="#d2453b"/></g>
<g fill="#fff6a8">${Array.from({ length: 12 }, (_, i) => `<circle cx="${(i * 67) % 400}" cy="${150 + ((i * 41) % 120)}" r="3" opacity=".8"/>`).join("")}</g>`);

const cityNight = svg(`
<rect width="400" height="300" fill="#1b1f3a"/>
<g fill="#2b3157">${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 52}" y="${80 + ((i * 37) % 70)}" width="46" height="220"/>`).join("")}</g>
<g fill="#ffd27a">${Array.from({ length: 40 }, (_, i) => `<rect x="${(i * 13) % 52 + Math.floor(i / 5) * 52 + 6}" y="${110 + ((i * 29) % 140)}" width="7" height="9" opacity="${0.5 + (i % 3) * 0.2}"/>`).join("")}</g>
<rect y="250" width="400" height="50" fill="#14172b"/>
<g><rect x="70" y="150" width="4" height="100" fill="#555"/><circle cx="72" cy="148" r="9" fill="#ffe3a0"/><circle cx="72" cy="148" r="30" fill="#ffe3a0" opacity=".18"/></g>
<g><rect x="300" y="150" width="4" height="100" fill="#555"/><circle cx="302" cy="148" r="9" fill="#ffe3a0"/><circle cx="302" cy="148" r="30" fill="#ffe3a0" opacity=".18"/></g>
<rect x="180" y="120" width="70" height="20" rx="4" fill="#ff5fa2" opacity=".85"/>`);

const concertNight = svg(`
<rect width="400" height="300" fill="#140f24"/>
<path d="M120 0 L40 220 L90 220 Z" fill="#ff4fa3" opacity=".35"/><path d="M200 0 L160 220 L240 220 Z" fill="#4fc3ff" opacity=".35"/><path d="M280 0 L310 220 L360 220 Z" fill="#b77bff" opacity=".35"/>
<rect x="40" y="150" width="320" height="40" fill="#24203a"/><rect x="40" y="148" width="320" height="4" fill="#ff4fa3"/>
<rect x="120" y="70" width="160" height="70" rx="4" fill="#ff8fc4" opacity=".7"/>
<g fill="#0a0814">${Array.from({ length: 18 }, (_, i) => `<circle cx="${12 + i * 22}" cy="${238 + (i % 3) * 6}" r="13"/><rect x="${2 + i * 22}" y="${246 + (i % 3) * 6}" width="20" height="60" rx="8"/>`).join("")}</g>
<rect x="96" y="214" width="3" height="20" fill="#7dffb0"/><rect x="250" y="210" width="3" height="20" fill="#7dffb0"/>`);

const villageDay = svg(`
<rect width="400" height="300" fill="#bfe3ff"/><circle cx="330" cy="60" r="30" fill="#fff3b0"/>
<rect y="180" width="400" height="120" fill="#86b55a"/><rect y="170" width="400" height="16" fill="#e0c060"/>
<rect x="60" y="110" width="130" height="80" fill="#b77a45"/><path d="M50 112 L125 60 L200 112 Z" fill="#b5483d"/>
<rect x="80" y="130" width="34" height="30" fill="#ffe7a6" stroke="#f3ead8" stroke-width="5"/><rect x="138" y="130" width="34" height="30" fill="#ffe7a6" stroke="#f3ead8" stroke-width="5"/>
<g stroke="#b58a5a" stroke-width="6">${Array.from({ length: 22 }, (_, i) => `<line x1="${8 + i * 18}" y1="200" x2="${8 + i * 18}" y2="232"/>`).join("")}</g>
<g>${[250, 280, 310, 340].map((x) => `<line x1="${x}" y1="200" x2="${x}" y2="130" stroke="#5d8f3a" stroke-width="4"/><circle cx="${x}" cy="128" r="14" fill="#f2c12e"/><circle cx="${x}" cy="128" r="6" fill="#4a3020"/>`).join("")}</g>`);

const mountainsView = svg(`
<rect width="400" height="300" fill="#9fd0f0"/>
<path d="M0 210 L70 90 L130 170 L200 60 L270 160 L330 100 L400 190 L400 300 L0 300 Z" fill="#6f7a8c"/>
<path d="M200 60 L178 98 L196 92 L210 102 L224 90 Z M70 90 L55 116 L72 110 L86 118 Z M330 100 L316 124 L332 118 L346 126 Z" fill="#f5f8fc"/>
<path d="M0 240 Q100 200 200 230 T400 225 L400 300 L0 300 Z" fill="#7f9a5a"/>
<ellipse cx="260" cy="262" rx="70" ry="14" fill="#4f9cc4"/>
<path d="M60 250 L80 220 L100 250 Z" fill="#f08a24"/>`);

interface DemoSpec {
  id: string;
  date: string;
  title: string;
  text: string;
  photos: string[];
  /** Доминирующие цвета нарисованных фото (для SVG считаем заранее). */
  photoColors: string[];
  preset: SynthPreset;
}

const SPECS: DemoSpec[] = [
  {
    id: "demo-summer",
    date: "2025-07-14",
    title: "Море с друзьями",
    text: "Самый солнечный день лета! Мы с друзьями сбежали на море, жарило солнце, смеялись до слёз, плавали до заката и ели арбуз прямо на пляже. Счастье в чистом виде.",
    photos: [beach, friends],
    photoColors: ["#ffb86b", "#2bb3c0", "#f2cf8f", "#ff8a5b"],
    preset: "summer",
  },
  {
    id: "demo-rain",
    date: "2025-10-03",
    title: "Дождь за окном",
    text: "Весь вечер шёл дождь. Я сидел у окна с чаем, было немного грустно и тихо. Вспоминал старый двор и думал о том, как давно не видел бабушку. Город светился мокрыми огнями.",
    photos: [rainWindow],
    photoColors: ["#4d5d78", "#2a3347", "#ffd27a", "#b9cbe8"],
    preset: "rain",
  },
  {
    id: "demo-winter",
    date: "2024-12-31",
    title: "Новогодняя ночь",
    text: "Ночь перед Новым годом, за окном падает снег и горят гирлянды. Тихо, звёзды, мороз рисует узоры. Ждём полночь, внутри тепло и немного волшебно.",
    photos: [winterNight],
    photoColors: ["#0d1840", "#2c3f86", "#e8f0ff", "#ffd36b"],
    preset: "winter",
  },
  {
    id: "demo-forest",
    date: "2025-08-23",
    title: "Поход в лес",
    text: "Ушли с друзьями в поход: тропинка через лес, запах хвои, грибы под каждым деревом. Вечером у костра пели песни, а вокруг летали светлячки. Тишина и природа.",
    photos: [forestWalk],
    photoColors: ["#cfe8b0", "#7fb069", "#2f6b3a", "#c9a36b"],
    preset: "summer",
  },
  {
    id: "demo-city",
    date: "2025-11-08",
    title: "Огни ночного города",
    text: "Гуляли до полуночи по ночному городу: мокрые улицы, огни витрин, неон над кафе и фонари вдоль проспекта. Говорили обо всём и не хотели расходиться.",
    photos: [cityNight],
    photoColors: ["#1b1f3a", "#2b3157", "#ffd27a", "#ff5fa2"],
    preset: "rain",
  },
  {
    id: "demo-concert",
    date: "2025-09-20",
    title: "Концерт любимой группы",
    text: "Наконец попали на концерт! Стояли у самой сцены в толпе, прожекторы били в небо, весь зал пел вместе с музыкантами. Голос сорван, но это того стоило.",
    photos: [concertNight],
    photoColors: ["#140f24", "#ff4fa3", "#4fc3ff", "#b77bff"],
    preset: "summer",
  },
  {
    id: "demo-village",
    date: "2025-06-28",
    title: "Лето у бабушки",
    text: "Неделя у бабушки в деревне: парное молоко, огород, подсолнухи у забора и яблоки прямо с дерева. Вечером пахло сеном и дымом из печной трубы.",
    photos: [villageDay],
    photoColors: ["#86b55a", "#f2c12e", "#b5483d", "#bfe3ff"],
    preset: "summer",
  },
  {
    id: "demo-mountains",
    date: "2025-08-02",
    title: "На вершине",
    text: "Поднялись в горы до самого перевала. Внизу горное озеро, вокруг снежные вершины и скалы, ветер свистит. Устали, но вид стоил каждого шага.",
    photos: [mountainsView],
    photoColors: ["#9fd0f0", "#6f7a8c", "#f5f8fc", "#4f9cc4"],
    preset: "winter",
  },
];

export function buildDemoMemories(): Memory[] {
  return SPECS.map((s, i) => {
    const preset = PRESETS[s.preset];
    const atmosphere = analyzeLocally({
      title: s.title,
      text: s.text,
      songName: preset.name,
      photoColors: s.photoColors,
      photoThumbs: [],
      audio: preset.features,
    });
    return {
      id: s.id,
      date: s.date,
      title: s.title,
      text: s.text,
      photos: s.photos,
      music: { kind: "synth", name: preset.name, preset: s.preset },
      atmosphere,
      atmosphereSource: "local",
      demo: true,
      createdAt: i,
    };
  });
}
