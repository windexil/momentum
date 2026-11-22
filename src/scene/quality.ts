// Уровень качества графики. «auto» начинает с высокого и сам опускается,
// если кадров в секунду не хватает. Выбор пользователя хранится в localStorage.

import { create } from "zustand";

export type QualityMode = "auto" | "high" | "medium" | "low";
export type QualityLevel = "high" | "medium" | "low";

export interface QualitySettings {
  dpr: number;
  msaa: number;
  ao: boolean;
  aoQuality: "performance" | "low" | "medium";
  shadowSize: number;
  bloom: boolean;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  high: { dpr: 1.75, msaa: 4, ao: true, aoQuality: "medium", shadowSize: 2048, bloom: true },
  // почти как высокое: те же эффекты, только чуть меньше кадр и затенение попроще
  // затенение N8AO перерисовывает всю сцену ещё раз — на среднем его нет, это главный выигрыш в скорости
  medium: { dpr: 1.25, msaa: 2, ao: false, aoQuality: "low", shadowSize: 2048, bloom: true },
  low: { dpr: 1, msaa: 2, ao: false, aoQuality: "performance", shadowSize: 1024, bloom: true },
};

const ORDER: QualityLevel[] = ["high", "medium", "low"];
const KEY = "arttech-quality";

/** Выбора качества в интерфейсе больше нет — всегда «авто», он сам подстраивается под FPS. */
function readMode(): QualityMode {
  return "auto";
}

function startLevel(): QualityLevel {
  // «авто» начинает со среднего: красиво и без лишних проходов по сцене
  return "medium";
}

// Раньше был «щадящий» режим: после сбоя видеокарты он запоминался и включал
// низкое качество. Режим убран — один раз сбрасываем то, что он сохранил.
try {
  if (localStorage.getItem("arttech-gpu-safe")) {
    localStorage.removeItem("arttech-gpu-safe");
    localStorage.setItem(KEY, "auto");
  }
} catch {
  /* нет доступа к хранилищу */
}

const FX_KEY = "arttech-gpu-fx";
function readFx(): number {
  try {
    const v = Number(localStorage.getItem(FX_KEY));
    return v === 1 || v === 2 ? v : 0;
  } catch {
    return 0;
  }
}

interface QualityState {
  /**
   * Что выключено после сбоя видеокарты (запоминается для этого браузера):
   * 0 — всё включено, 1 — без отражений окружения, 2 — ещё и без постобработки.
   */
  fx: number;
  /** сбой видеокарты: выключаем следующую тяжёлую часть графики */
  fxDown: () => number;
  mode: QualityMode;
  /** текущий уровень в режиме «авто» */
  autoLevel: QualityLevel;
  level: () => QualityLevel;
  setMode: (m: QualityMode) => void;
  decline: () => void;
  incline: () => void;
}

export const useQuality = create<QualityState>((set, get) => ({
  fx: readFx(),
  fxDown() {
    const fx = Math.min(2, get().fx + 1);
    set({ fx });
    try {
      localStorage.setItem(FX_KEY, String(fx));
    } catch {
      /* ignore */
    }
    return fx;
  },
  mode: readMode(),
  autoLevel: startLevel(),
  level() {
    const { mode, autoLevel } = get();
    return mode === "auto" ? autoLevel : mode;
  },
  setMode(mode) {
    set({ mode });
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
  },
  decline() {
    // если тормозит — на ступень ниже (выбора в интерфейсе нет, всё решает «авто»)
    const i = ORDER.indexOf(get().autoLevel);
    if (i < ORDER.length - 1) set({ autoLevel: ORDER[i + 1] });
  },
  incline() {
    // подниматься можно только до среднего: высокое заметно тяжелее, а разница в картинке мала
    if (get().autoLevel === "low") set({ autoLevel: "medium" });
  },
}));

/** Текущие настройки (реактивно). */
export function useQualitySettings() {
  const lvl = useQuality((s) => (s.mode === "auto" ? s.autoLevel : s.mode));
  return { level: lvl, ...QUALITY[lvl] };
}
