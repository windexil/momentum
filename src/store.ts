import { create } from "zustand";
import { NEUTRAL_ATMOSPHERE, type Atmosphere } from "./atmosphere/types";
import { audio } from "./audio/engine";
import { buildDemoMemories } from "./data/demo";
import { deleteMemory, hasSeeded, loadMemories, markSeeded, saveMemory } from "./storage";
import type { Memory, Phase } from "./types";

type Panel = "none" | "album" | "create" | "custom";

interface State {
  memories: Memory[];
  loaded: boolean;
  panel: Panel;
  phase: Phase;
  /** Воспоминание, которое сейчас «проживается». */
  active: Memory | null;
  /** Целевая атмосфера; сцена плавно перетекает к ней. */
  target: Atmosphere;
  /** Предпросмотр при перелистывании альбома (лёгкий намёк на атмосферу). */
  preview: Atmosphere | null;
  hint: string | null;
  /** Счётчик запросов «пережить день»: персонаж готовится к прослушиванию. */
  request: number;

  init: () => Promise<void>;
  setPanel: (p: Panel) => void;
  setPreview: (a: Atmosphere | null) => void;
  relive: (m: Memory) => void;
  stopReliving: () => void;
  setPhase: (p: Phase) => void;
  addMemory: (m: Memory) => Promise<void>;
  removeMemory: (id: string) => Promise<void>;
  restoreDemos: () => Promise<void>;
  setHint: (h: string | null) => void;
}

export const useStore = create<State>((set, get) => ({
  memories: [],
  loaded: false,
  panel: "none",
  phase: "idle",
  active: null,
  target: NEUTRAL_ATMOSPHERE,
  preview: null,
  hint: null,
  request: 0,

  init: async () => {
    let memories = await loadMemories();
    if (!memories.length && !(await hasSeeded())) {
      const demos = buildDemoMemories();
      await Promise.all(demos.map(saveMemory)).catch(() => undefined);
      await markSeeded();
      memories = demos;
    } else {
      // демо всегда берём свежие, чтобы улучшения анализатора были видны сразу
      const fresh = new Map(buildDemoMemories().map((d) => [d.id, d]));
      memories = memories.map((m) => (m.demo && fresh.get(m.id)) || m);
    }
    set({ memories, loaded: true });
    audio.onEnded = () => get().stopReliving();
  },

  setPanel: (panel) => set({ panel, preview: panel === "album" ? get().preview : null }),
  setPreview: (preview) => set({ preview }),
  setHint: (hint) => set({ hint }),

  relive: (m) => {
    // Звук разблокируем сразу, в обработчике клика.
    audio.unlock();
    audio.stop(0.3);
    set({ active: m, panel: "none", preview: null, phase: "walking", request: get().request + 1 });
  },

  setPhase: (phase) => {
    const { active } = get();
    if (phase === "listening" && active) {
      set({ phase, target: active.atmosphere });
      audio.play(active.music).catch(() => {
        set({ hint: "Браузер не дал запустить звук. Нажмите «Слушать» ещё раз." });
      });
      return;
    }
    if (phase === "idle") {
      set({ phase, active: null, target: NEUTRAL_ATMOSPHERE });
      return;
    }
    set({ phase });
  },

  stopReliving: () => {
    const { phase } = get();
    if (phase === "idle" || phase === "unwinding") return;
    audio.stop(2);
    set({ phase: "unwinding", target: NEUTRAL_ATMOSPHERE });
  },

  addMemory: async (m) => {
    await saveMemory(m);
    set({ memories: [...get().memories.filter((x) => x.id !== m.id), m].sort((a, b) => a.date.localeCompare(b.date)) });
  },

  removeMemory: async (id) => {
    await deleteMemory(id);
    set({ memories: get().memories.filter((m) => m.id !== id) });
  },

  restoreDemos: async () => {
    const demos = buildDemoMemories();
    await Promise.all(demos.map(saveMemory));
    const ids = new Set(demos.map((d) => d.id));
    set({ memories: [...get().memories.filter((m) => !ids.has(m.id)), ...demos].sort((a, b) => a.date.localeCompare(b.date)) });
  },
}));
if (import.meta.env.DEV) (window as unknown as { __store: unknown }).__store = useStore;
