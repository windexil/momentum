// Песня по ссылке: определяем сервис и строим адрес официального
// встраиваемого плеера. Сам звук мы не скачиваем и не анализируем —
// атмосферу строим по тексту записи. Название и обложку берём из oEmbed.

export type MusicService = "youtube" | "spotify" | "yandex";

export interface ParsedLink {
  service: MusicService;
  /** Исходная ссылка, как её вставил пользователь */
  url: string;
  /** Адрес для <iframe> официального плеера */
  embedUrl: string;
  /** Высота плеера в карточке */
  height: number;
}

export const SERVICE_RU: Record<MusicService, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  yandex: "Яндекс Музыка",
};

/** Принимает ссылку или HTML-код виджета («Поделиться → HTML-код»). */
export function parseMusicLink(raw: string): ParsedLink | null {
  let input = raw.trim();
  if (!input) return null;
  // HTML-код виджета: достаём src из <iframe>
  const iframe = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(input);
  if (iframe) input = iframe[1].replace(/&amp;/g, "&");
  if (input.startsWith("//")) input = "https:" + input;
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");

  // YouTube и YouTube Music
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (u.searchParams.get("v")) id = u.searchParams.get("v")!;
    else {
      const m = /^\/(?:embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname);
      if (m) id = m[1];
    }
    id = id.split(/[/?&]/)[0];
    if (!/^[\w-]{6,}$/.test(id)) return null;
    return { service: "youtube", url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`, height: 200 };
  }

  // Spotify: трек, альбом, плейлист, выпуск подкаста
  if (host === "open.spotify.com") {
    const m = /^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/.exec(u.pathname);
    if (!m) return null;
    return {
      service: "spotify",
      url: `https://open.spotify.com/${m[1]}/${m[2]}`,
      embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
      height: m[1] === "track" || m[1] === "episode" ? 152 : 352,
    };
  }

  // Яндекс Музыка: ссылка на трек или альбом, либо готовый виджет
  if (/^music\.yandex\.(ru|com|kz|by|uz)$/.test(host)) {
    if (u.pathname.startsWith("/iframe")) {
      return { service: "yandex", url: input, embedUrl: input, height: 180 };
    }
    const t = /\/album\/(\d+)\/track\/(\d+)/.exec(u.pathname);
    if (t) {
      return { service: "yandex", url: input, embedUrl: `https://music.yandex.ru/iframe/#track/${t[2]}/${t[1]}`, height: 180 };
    }
    const a = /\/album\/(\d+)/.exec(u.pathname);
    if (a) return { service: "yandex", url: input, embedUrl: `https://music.yandex.ru/iframe/#album/${a[1]}`, height: 450 };
    return null;
  }
  return null;
}

/** Прямая ссылка на аудиофайл (старый режим) */
export function isDirectAudio(raw: string) {
  return /^https?:\/\/\S+\.(mp3|m4a|ogg|wav|aac)(\?\S*)?$/i.test(raw.trim());
}

export interface OEmbedInfo {
  title?: string;
  artist?: string;
  cover?: string;
}

/** Название, исполнитель и обложка через открытый oEmbed (YouTube, Spotify). */
export async function fetchOEmbed(link: ParsedLink): Promise<OEmbedInfo> {
  const tries: string[] = [];
  const enc = encodeURIComponent(link.url);
  if (link.service === "youtube") {
    tries.push(`https://www.youtube.com/oembed?format=json&url=${enc}`, `https://noembed.com/embed?url=${enc}`);
  } else if (link.service === "spotify") {
    tries.push(`https://open.spotify.com/oembed?url=${enc}`);
  } else {
    return {};
  }
  for (const api of tries) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(api, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string; error?: string };
      if (j.error) continue;
      return { title: j.title, artist: j.author_name, cover: j.thumbnail_url };
    } catch {
      /* пробуем следующий источник */
    }
  }
  return {};
}
