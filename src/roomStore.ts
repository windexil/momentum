// Личные вещи комнаты, которые пользователь меняет сам: снимки на ленте
// над столом и надпись на обложке альбома. Хранятся в IndexedDB браузера.

import { createStore, get, set } from "idb-keyval";
import { create } from "zustand";
import { thumbnail } from "./atmosphere/color";

export const STRIP_SLOTS = 6;
const db = createStore("arttech-room", "items");

interface RoomState {
  strip: (string | null)[];
  coverText: string;
  /** Какой снимок ленты сейчас редактируется (null — никакой) */
  editing: number | null;
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
  async load() {
    try {
      const [strip, cover] = await Promise.all([get<(string | null)[]>("strip", db), get<string>("cover", db)]);
      setState({
        strip: Array.from({ length: STRIP_SLOTS }, (_, i) => strip?.[i] ?? null),
        coverText: cover ?? DEFAULT_COVER,
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
