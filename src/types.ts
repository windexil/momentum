import type { Atmosphere } from "./atmosphere/types";
import type { SynthPreset } from "./audio/synth";
import type { MusicService } from "./audio/embed";

export interface MusicSource {
  /** embed — официальный плеер сервиса (YouTube, Spotify, Яндекс Музыка) */
  kind: "file" | "url" | "synth" | "embed";
  /** Название песни для страницы альбома. */
  name: string;
  /** Исполнитель (для ссылок на сервисы) */
  artist?: string;
  blob?: Blob;
  url?: string;
  preset?: SynthPreset;
  service?: MusicService;
  /** Адрес iframe официального плеера */
  embedUrl?: string;
  embedHeight?: number;
  /** Ссылка на обложку из oEmbed (сама картинка не сохраняется) */
  cover?: string;
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
