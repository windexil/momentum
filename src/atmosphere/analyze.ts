// Клиент анализа: сначала пробуем Claude через наш сервер,
// при любой ошибке (нет ключа, нет сети) используем локальный анализатор.

import { analyzeLocally } from "./localAnalyzer";
import { sanitizeAtmosphere } from "./sanitize";
import type { AnalyzeInput, AnalyzeResult } from "./types";

let aiAvailable: boolean | null = null;

export async function checkAi(): Promise<boolean> {
  if (aiAvailable !== null) return aiAvailable;
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    aiAvailable = Boolean(j.ai);
  } catch {
    aiAvailable = false;
  }
  return aiAvailable;
}

export async function analyzeMemory(input: AnalyzeInput): Promise<AnalyzeResult> {
  if (await checkAi()) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        const j = await r.json();
        return { atmosphere: sanitizeAtmosphere(j.atmosphere), source: "claude" };
      }
    } catch (e) {
      console.warn("Claude недоступен, используем локальный анализ", e);
    }
  }
  return { atmosphere: sanitizeAtmosphere(analyzeLocally(input)), source: "local" };
}
