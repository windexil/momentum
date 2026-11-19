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
  high: { dpr: 1.5, msaa: 4, ao: true, aoQuality: "medium", shadowSize: 2048, bloom: true },
  medium: { dpr: 1.15, msaa: 2, ao: true, aoQuality: "performance", shadowSize: 1024, bloom: true },
  low: { dpr: 0.85, msaa: 0, ao: false, aoQuality: "performance", shadowSize: 1024, bloom: false },
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
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  return touch ? "medium" : "high";
}

interface QualityState {
  mode: QualityMode;
  /** текущий уровень в режиме «авто» */
  autoLevel: QualityLevel;
  level: () => QualityLevel;
  setMode: (m: QualityMode) => void;
  decline: () => void;
  incline: () => void;
}

export const useQuality = create<QualityState>((set, get) => ({
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
    const i = ORDER.indexOf(get().autoLevel);
    if (i < ORDER.length - 1) set({ autoLevel: ORDER[i + 1] });
  },
  incline() {
    const i = ORDER.indexOf(get().autoLevel);
    if (i > 0) set({ autoLevel: ORDER[i - 1] });
  },
}));

/** Текущие настройки (реактивно). */
export function useQualitySettings() {
  const lvl = useQuality((s) => (s.mode === "auto" ? s.autoLevel : s.mode));
  return { level: lvl, ...QUALITY[lvl] };
}
