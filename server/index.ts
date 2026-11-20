// Небольшой сервер: держит ключ Claude API (в браузер он не попадает),
// анализирует воспоминание и отдаёт параметры атмосферы.
// В продакшене также раздаёт собранный фронтенд из dist/.

import { MOODS } from "../src/atmosphere/moods";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PARTICLE_TYPES, type AnalyzeInput } from "../src/atmosphere/types";
import { sanitizeAtmosphere } from "../src/atmosphere/sanitize";

loadDotEnv();

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasKey ? new Anthropic() : null;

const AtmosphereSchema = z.object({
  mood: z.string().describe("Короткое название настроения по-русски, 2–4 слова"),
  description: z.string().describe("Одна образная фраза по-русски: почему комната выглядит именно так"),
  palette: z.array(z.string()).describe("Ровно 5 цветов #rrggbb, от светлого к тёмному"),
  keyLightColor: z.string().describe("#rrggbb основного света"),
  keyIntensity: z.number().describe("0.2..3"),
  ambientColor: z.string().describe("#rrggbb рассеянного света"),
  ambientIntensity: z.number().describe("0.1..2"),
  skyColor: z.string().describe("#rrggbb неба за окном"),
  haze: z.number().describe("0..1 дымка"),
  contrast: z.number().describe("0..1"),
  warmth: z.number().describe("-1 холодно .. 1 тепло"),
  lightAngle: z.number().describe("азимут света 0..360"),
  lightElevation: z.number().describe("высота солнца 5..85; 10-20 = закат"),
  particles: z.object({
    type: z.enum(PARTICLE_TYPES),
    count: z.number().describe("0..600"),
    speed: z.number().describe("0.1..3"),
    size: z.number().describe("0.5..3"),
    color: z.string().describe("#rrggbb"),
  }),
  animSpeed: z.number().describe("0.2..2"),
  musicReactivity: z.number().describe("0..1"),
  glow: z.number().describe("0..2 сила свечения"),
  lampColor: z.string().describe("#rrggbb настольной лампы"),
  nightSky: z.boolean(),
});

const SYSTEM = `Ты — художник по свету и атмосфере в интерактивном 3D-дневнике воспоминаний.
Комната всегда одна и та же (стол, кресло, кровать, окно, полки, растения). Меняются только свет, палитра, небо за окном, дымка, частицы и скорость анимаций.
По тексту воспоминания, фотографиям и характеристикам музыки подбери параметры так, чтобы человек снова почувствовал этот день.
Опирайся на конкретные детали: время суток и сезон из текста, реальные цвета с фотографий, темп и громкость музыки. Не выбирай шаблон, а выводи каждый параметр из входных данных.
Тексты (mood, description) пиши по-русски, коротко и образно, без кавычек.
Палитру (palette) бери из этого списка: определи главное настроение воспоминания и верни ровно его 5 цветов в указанном порядке (от светлого к тёмному). В mood начни с названия выбранного настроения.
${Object.values(MOODS).map((m) => `- ${m.name}: ${m.palette.join(", ")}`).join("\n")}`;

const app = express();
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: hasKey, model: hasKey ? MODEL : null });
});

app.post("/api/analyze", async (req, res) => {
  if (!client) {
    res.status(503).json({ error: "no_api_key" });
    return;
  }
  const input = req.body as AnalyzeInput;
  const content: Anthropic.ContentBlockParam[] = [];
  for (const thumb of (input.photoThumbs ?? []).slice(0, 3)) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(thumb);
    if (m) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] },
      });
    }
  }
  content.push({
    type: "text",
    text: [
      `Название дня: ${input.title || "(без названия)"}`,
      `Текст воспоминания:\n${input.text || "(пусто)"}`,
      `Песня: ${input.songName || "(не указана)"}`,
      `Доминирующие цвета фото: ${(input.photoColors ?? []).join(", ") || "нет фото"}`,
      input.audio
        ? `Музыка: громкость ${input.audio.energy.toFixed(2)}, яркость звука ${input.audio.brightness.toFixed(2)}, темп ~${Math.round(input.audio.bpm)} BPM, длительность ${Math.round(input.audio.duration)} c`
        : "Характеристики музыки неизвестны.",
    ].join("\n\n"),
  });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(AtmosphereSchema) },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      res.status(422).json({ error: "no_result", stop_reason: response.stop_reason });
      return;
    }
    res.json({ atmosphere: sanitizeAtmosphere(response.parsed_output), source: "claude" });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "rate_limited" });
    } else if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      res.status(502).json({ error: "api_error", status: err.status });
    } else {
      console.error(err);
      res.status(500).json({ error: "internal" });
    }
  }
});

// Продакшен: раздаём собранный фронтенд.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`ArtTech API: http://localhost:${PORT}  (Claude: ${hasKey ? MODEL : "нет ключа, работает локальный анализатор"})`);
});

function loadDotEnv() {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
