// Архив воспоминаний в IndexedDB браузера (фото и аудиофайлы тоже там).
// Для командной версии этот модуль можно заменить на Supabase: интерфейс тот же.

import { createStore, del, get, set, values } from "idb-keyval";
import type { Memory } from "./types";

const store = createStore("arttech-memories", "memories");

export async function loadMemories(): Promise<Memory[]> {
  try {
    const all = (await values(store)) as Memory[];
    return all.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export async function saveMemory(m: Memory) {
  await set(m.id, m, store);
}

export async function deleteMemory(id: string) {
  await del(id, store);
}

export async function hasSeeded(): Promise<boolean> {
  try {
    return Boolean(await get("__seeded__", createStore("arttech-meta", "meta")));
  } catch {
    return false;
  }
}

export async function markSeeded() {
  try {
    await set("__seeded__", true, createStore("arttech-meta", "meta"));
  } catch {
    /* приватный режим: просто покажем демо снова */
  }
}
