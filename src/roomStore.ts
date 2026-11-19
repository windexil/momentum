// Личные вещи комнаты, которые пользователь меняет сам: снимки на ленте
// над столом и надпись на обложке альбома. Хранятся в IndexedDB браузера.

import { createStore, get, set } from "idb-keyval";
import { create } from "zustand";
import { thumbnail } from "./atmosphere/color";

export const STRIP_SLOTS = 6;

/** Тона настольной лампы. «auto» — цвет задаёт атмосфера воспоминания. */
export const LAMP_TONES = [
  { id: "auto", name: "Авто", color: "" },
  { id: "candle", name: "Свеча", color: "#ff9a4a" },
  { id: "warm", name: "Тёплый", color: "#ffc27a" },
  { id: "day", name: "Дневной", color: "#fff3df" },
  { id: "cool", name: "Холодный", color: "#bcd6ff" },
  { id: "rose", name: "Розовый", color: "#ffa6c4" },
  { id: "mint", name: "Мятный", color: "#a8f0cf" },
] as const;
export type LampTone = (typeof LAMP_TONES)[number]["id"];
export interface DeskLamp {
  on: boolean;
  tone: LampTone;
}
const db = createStore("arttech-room", "items");

interface RoomState {
  strip: (string | null)[];
  coverText: string;
  /** Какой снимок ленты сейчас редактируется (null — никакой) */
  editing: number | null;
  deskLamp: DeskLamp;
  setDeskLamp: (patch: Partial<DeskLamp>) => void;
  load: () => Promise<void>;
  setStripPhoto: (i: number, file: File | null) => Promise<void>;
  setCoverText: (t: string) => void;
  edit: (i: number | null) => void;
}

const DEFAULT_COVER = "Мои дни";

export const useRoom = create<RoomState>((setState, getState) => ({
  strip: Array(STRIP_SLOTS).fill(null),
  coverText: DEFAULT_COVER,
  editing: null,
  deskLamp: { on: true, tone: "auto" },
  setDeskLamp(patch) {
    const deskLamp = { ...getState().deskLamp, ...patch };
    setState({ deskLamp });
    set("deskLamp", deskLamp, db).catch(() => {});
  },
  async load() {
    try {
      const [strip, cover, lamp] = await Promise.all([
        get<(string | null)[]>("strip", db),
        get<string>("cover", db),
        get<DeskLamp>("deskLamp", db),
      ]);
      setState({
        strip: Array.from({ length: STRIP_SLOTS }, (_, i) => strip?.[i] ?? null),
        coverText: cover ?? DEFAULT_COVER,
        ...(lamp ? { deskLamp: { on: lamp.on !== false, tone: LAMP_TONES.some((t) => t.id === lamp.tone) ? lamp.tone : "auto" } } : {}),
      });
    } catch {
      /* приватный режим без IndexedDB: остаются значения по умолчанию */
    }
  },
  async setStripPhoto(i, file) {
    let url: string | null = null;
    if (file) {
      const raw = URL.createObjectURL(file);
      try {
        url = await thumbnail(raw, 640);
      } finally {
        URL.revokeObjectURL(raw);
      }
    }
    const strip = getState().strip.slice();
    strip[i] = url;
    setState({ strip });
    set("strip", strip, db).catch(() => {});
  },
  setCoverText(t) {
    const text = t.slice(0, 40);
    setState({ coverText: text });
    set("cover", text, db).catch(() => {});
  },
  edit(i) {
    setState({ editing: i });
  },
}));
