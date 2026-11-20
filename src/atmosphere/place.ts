// Где прошёл день: по словам в тексте выбираем локацию воспоминания.
// Если день явно прошёл дома (у окна, с чаем) или место не названо — остаёмся в комнате.

import type { Place } from "./types";

const WORDS: Record<Exclude<Place, "room">, string[]> = {
  beach: ["море", "морск", "пляж", "океан", "берег", "волн", "загар", "песок", "песк", "чайк", "beach", "sea", "ocean"],
  forest: ["лес", "лесн", "поход", "палатк", "костер", "грибы", "гриб", "деревь", "тропинк", "природ", "парк", "forest", "camp", "hike"],
  city: ["город", "улиц", "метро", "огни", "неон", "проспект", "площад", "кафе", "фонар", "мост", "city", "street", "downtown"],
  winter: ["зим", "снег", "снеж", "сугроб", "мороз", "новогод", "новым год", "новый год", "каток", "лыж", "санк", "winter", "snow"],
};
/** признаки того, что день прошёл в четырёх стенах */
const HOME = ["окн", "дома", "комнат", "чай", "плед", "кроват", "диван", "home"];

function count(t: string, words: string[]) {
  let n = 0;
  for (const w of words) {
    let i = t.indexOf(w);
    while (i !== -1) {
      n++;
      i = t.indexOf(w, i + w.length);
    }
  }
  return n;
}

export function detectPlace(text: string): Place {
  const t = ` ${text.toLowerCase().replace(/ё/g, "е")} `;
  let best: Place = "room", score = 0;
  for (const [place, words] of Object.entries(WORDS) as [Place, string[]][]) {
    const n = count(t, words);
    if (n > score) (best = place), (score = n);
  }
  const home = count(t, HOME);
  return score >= 2 && score > home ? best : "room";
}
