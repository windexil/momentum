import type { Atmosphere } from "./atmosphere/types";
import type { SynthPreset } from "./audio/synth";

export interface MusicSource {
  kind: "file" | "url" | "synth";
  /** Название песни для страницы альбома. */
  name: string;
  blob?: Blob;
  url?: string;
  preset?: SynthPreset;
}

export interface Memory {
  id: string;
  /** ISO-дата дня */
  date: string;
  title: string;
  text: string;
  /** Фото в виде data URL (уменьшенные до 1280px). */
  photos: string[];
  music: MusicSource;
  atmosphere: Atmosphere;
  atmosphereSource: "claude" | "local";
  demo?: boolean;
  createdAt: number;
}

/** Этапы сцены: персонаж идёт к креслу, садится, надевает наушники, слушает, встаёт. */
export type Phase = "idle" | "walking" | "sitting" | "listening" | "unwinding";
