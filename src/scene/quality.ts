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
  medium: { dpr: 1.4, msaa: 4, ao: true, aoQuality: "low", shadowSize: 2048, bloom: true },
  low: { dpr: 1, msaa: 2, ao: false, aoQuality: "performance", shadowSize: 1024, bloom: true },
};

const ORDER: QualityLevel[] = ["high", "medium", "low"];
const KEY = "arttech-quality";

function readMode(): QualityMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "auto" || v === "high" || v === "medium" || v === "low") return v;
  } catch {
    /* нет доступа к хранилищу */
  }
  return "auto";
}

function startLevel(): QualityLevel {
  // телефоны и планшеты сразу начинают со среднего
  return "high";
}

const SAFE_KEY = "arttech-gpu-safe";
function readSafe(): boolean {
  try {
    return localStorage.getItem(SAFE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Щадящий режим для слабых или капризных видеокарт: включается сам, если
 * браузер «потерял» WebGL. Без сглаживания, затенения и свечения, тени мельче.
 */
const SAFE: QualitySettings = { dpr: 1, msaa: 0, ao: false, aoQuality: "performance", shadowSize: 512, bloom: false };

interface QualityState {
  /** щадящий режим после сбоя видеокарты */
  safe: boolean;
  setSafe: (v: boolean) => void;
  /** без готовых 3D-моделей (котёнок, наушники): на некоторых ПК их загрузка роняет WebGL */
  noModels: boolean;
  mode: QualityMode;
  /** текущий уровень в режиме «авто» */
  autoLevel: QualityLevel;
  level: () => QualityLevel;
  setMode: (m: QualityMode) => void;
  decline: () => void;
  incline: () => void;
}

export const useQuality = create<QualityState>((set, get) => ({
  safe: readSafe(),
  noModels: false,
  setSafe(safe) {
    set({ safe });
    try {
      if (safe) localStorage.setItem(SAFE_KEY, "1");
      else localStorage.removeItem(SAFE_KEY);
    } catch {
      /* ignore */
    }
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
    // авто опускается не ниже среднего; низкое — только вручную
    if (get().autoLevel === "high") set({ autoLevel: "medium" });
  },
  incline() {
    const i = ORDER.indexOf(get().autoLevel);
    if (i > 0) set({ autoLevel: ORDER[i - 1] });
  },
}));

/** Текущие настройки (реактивно). */
export function useQualitySettings() {
  const lvl = useQuality((s) => (s.mode === "auto" ? s.autoLevel : s.mode));
  const safe = useQuality((s) => s.safe);
  return safe ? { level: "low" as QualityLevel, safe, ...SAFE } : { level: lvl, safe, ...QUALITY[lvl] };
}
