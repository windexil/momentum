// Настройки внешности персонажа и питомца. Хранятся в localStorage
// браузера (это личная настройка зрителя), при ошибке — просто по умолчанию.

import { create } from "zustand";
import type { Atmosphere } from "./atmosphere/types";

export type TopKind = "hoodie" | "tshirt" | "sweater";
export type HeadphoneKind = "classic" | "cat";
export type PetKind = "none" | "cat" | "dog" | "bunny";
export type PetMood = "auto" | "happy" | "sleepy" | "sad" | "playful";
export type Mood = Exclude<PetMood, "auto">;

export interface Avatar {
  top: TopKind;
  topColor: string;
  pantsColor: string;
  shoesColor: string;
  headphones: HeadphoneKind;
  headphonesColor: string;
  padsColor: string;
  hairColor: string;
  skinColor: string;
  pet: PetKind;
  petColor: string;
  petMood: PetMood;
}

export const DEFAULT_AVATAR: Avatar = {
  top: "hoodie",
  topColor: "#f28c28",
  pantsColor: "#3f6fb5",
  shoesColor: "#f28c28",
  headphones: "classic",
  headphonesColor: "#2b2b31",
  padsColor: "#f28c28",
  hairColor: "#2b2220",
  skinColor: "#f6d3b5",
  pet: "cat",
  petColor: "#f2a65a",
  petMood: "auto",
};

const KEY = "arttech-avatar";

function load(): Avatar {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_AVATAR, ...JSON.parse(raw) };
  } catch {
    /* хранилище недоступно */
  }
  return DEFAULT_AVATAR;
}

interface AvatarState {
  avatar: Avatar;
  set: (patch: Partial<Avatar>) => void;
  reset: () => void;
}

export const useAvatar = create<AvatarState>((set, get) => ({
  avatar: load(),
  set: (patch) => {
    const avatar = { ...get().avatar, ...patch };
    set({ avatar });
    try {
      localStorage.setItem(KEY, JSON.stringify(avatar));
    } catch {
      /* ок, просто не запомним */
    }
  },
  reset: () => get().set(DEFAULT_AVATAR),
}));

/** Настроение, которое музыка воспоминания вызывает у персонажа и питомца. */
export function moodOf(a: Atmosphere | null | undefined): Mood {
  if (!a) return "happy";
  const m = a.mood.toLowerCase();
  if (/груст|печал|тоск|одинок|задумч/.test(m) || (a.particles.type === "rain" && a.animSpeed < 0.9)) return "sad";
  if (a.animSpeed >= 1.15 || a.particles.type === "sparks") return "playful";
  if (a.animSpeed < 0.8 || a.nightSky) return "sleepy";
  return "happy";
}

export const MOOD_RU: Record<Mood, string> = {
  happy: "радуется",
  sleepy: "дремлет",
  sad: "грустит",
  playful: "танцует",
};
