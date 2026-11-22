// Форма новой записи: текст, фото и музыка. После сохранения
// анализируем всё вместе и показываем, какую атмосферу получил день.

import { useEffect, useState } from "react";
import { fetchOEmbed, isDirectAudio, parseMusicLink, SERVICE_RU, type OEmbedInfo } from "../audio/embed";
import { analyzeMemory } from "../atmosphere/analyze";
import { dominantColors, thumbnail } from "../atmosphere/color";
import type { AudioFeatures } from "../atmosphere/types";
import { analyzeAudioBlob } from "../audio/engine";
import { useStore } from "../store";
import type { Memory, MusicSource } from "../types";
import { uid } from "../util";

const MAX_PHOTOS = 4;
const RIGHTS_KEY = "arttech-audio-rights";
const AUDIO_ACCEPT = ".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac";

function rightsConfirmedBefore() {
  try {
    return localStorage.getItem(RIGHTS_KEY) === "1";
  } catch {
    return false;
  }
}

export function NewMemoryForm() {
  const setPanel = useStore((s) => s.setPanel);
  const addMemory = useStore((s) => s.addMemory);
  const relive = useStore((s) => s.relive);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [musicMode, setMusicMode] = useState<"file" | "url">("file");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicUrl, setMusicUrl] = useState("");
  const [songName, setSongName] = useState("");
  const [artist, setArtist] = useState("");
  const [linkInfo, setLinkInfo] = useState<OEmbedInfo | null>(null);
  const [rightsBefore] = useState(rightsConfirmedBefore);
  const [rights, setRights] = useState(false);
  const link = musicMode === "url" ? parseMusicLink(musicUrl) : null;

  // По ссылке подтягиваем название, исполнителя и обложку (oEmbed)
  useEffect(() => {
    setLinkInfo(null);
    if (!link) return;
    let alive = true;
    void fetchOEmbed(link).then((info) => {
      if (!alive) return;
      setLinkInfo(info);
      if (info.title) setSongName((v) => v || info.title!);
      if (info.artist) setArtist((v) => v || info.artist!);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.embedUrl]);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPhotos(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    const urls = await Promise.all(list.map(async (f) => thumbnail(await readAsDataUrl(f), 1280)));
    setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
  }

  async function submit() {
    setError(null);
    if (!text.trim() && !photos.length) {
      setError("Добавьте хотя бы пару предложений или фото.");
      return;
    }
    try {
      setBusy("Смотрю на фотографии…");
      const colors = (await Promise.all(photos.map((p) => dominantColors(p, 3)))).flat();
      const thumbs = await Promise.all(photos.slice(0, 3).map((p) => thumbnail(p, 320)));

      let audioFeatures: AudioFeatures | null = null;
      let music: MusicSource;
      if (musicMode === "file" && musicFile && !rightsBefore && !rights) {
        setError("Подтвердите, что можете использовать этот аудиофайл.");
        return;
      }
      if (musicMode === "url" && musicUrl.trim() && !link && !isDirectAudio(musicUrl)) {
        setError("Не узнаю ссылку. Подойдут YouTube, Spotify, Яндекс Музыка (ссылка или HTML-код виджета) или прямая ссылка на mp3.");
        return;
      }
      if (musicMode === "file" && musicFile) {
        try {
          localStorage.setItem(RIGHTS_KEY, "1");
        } catch {
          /* ignore */
        }
        setBusy("Слушаю музыку…");
        audioFeatures = await analyzeAudioBlob(musicFile);
        music = { kind: "file", name: songName || musicFile.name.replace(/\.[^.]+$/, ""), artist: artist || undefined, blob: musicFile };
      } else if (musicMode === "url" && link) {
        // официальный плеер; храним только ссылку, название и исполнителя
        music = {
          kind: "embed",
          name: songName || linkInfo?.title || `трек из ${SERVICE_RU[link.service]}`,
          artist: artist || linkInfo?.artist || undefined,
          url: link.url,
          service: link.service,
          embedUrl: link.embedUrl,
          embedHeight: link.height,
          cover: linkInfo?.cover,
        };
      } else if (musicMode === "url" && musicUrl.trim()) {
        music = { kind: "url", name: songName || musicUrl.split("/").pop() || "трек по ссылке", url: musicUrl.trim() };
      } else {
        // Без музыки подставим подходящий синтез по настроению позже
        music = { kind: "synth", name: songName || "Мелодия комнаты (синтез)", preset: "summer" };
      }

      setBusy("Подбираю свет и цвета…");
      const result = await analyzeMemory({
        title,
        text,
        songName: music.name,
        photoColors: colors,
        photoThumbs: thumbs,
        audio: audioFeatures,
        date,
      });

      if (music.kind === "synth") {
        const a = result.atmosphere;
        music.preset = a.particles.type === "snow" || a.nightSky ? "winter" : a.warmth < 0 || a.animSpeed < 0.7 ? "rain" : "summer";
      }

      const memory: Memory = {
        id: uid(),
        date,
        title: title.trim() || result.atmosphere.title || "Без названия",
        text: text.trim(),
        photos,
        music,
        atmosphere: result.atmosphere,
        atmosphereSource: result.source,
        createdAt: Date.now(),
      };
      await addMemory(memory);
      setSaved(memory);
    } catch (e) {
      console.error(e);
      setError("Не получилось сохранить запись. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  if (saved) {
    const a = saved.atmosphere;
    return (
      <div className="modal-wrap">
        <div className="modal">
          <h2>День сохранён в альбом</h2>
          <div className="result">
            <p className="folder-name">📁 Папка дня: <b>«{saved.title}»</b></p>
            <div className="swatches big">{a.palette.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
            <p><b>{a.mood}</b></p>
            <p className="muted">{a.description}</p>
            <ul className="params">
              <li>Свет: {a.warmth > 0.2 ? "тёплый" : a.warmth < -0.2 ? "холодный" : "нейтральный"}, {a.nightSky ? "ночь" : `солнце на ${Math.round(a.lightElevation)}°`}</li>
              <li>Частицы: {PARTICLE_RU[a.particles.type]}, {a.particles.count} шт.</li>
              <li>Темп анимаций: ×{a.animSpeed.toFixed(1)}, дымка {Math.round(a.haze * 100)}%</li>
              <li>Источник: {saved.atmosphereSource === "claude" ? "Claude (текст, фото и музыка)" : "локальный анализ (текст, цвета фото, музыка)"}</li>
            </ul>
          </div>
          <div className="row end">
            <button className="ghost" onClick={() => setPanel("none")}>Закрыть</button>
            <button className="primary" onClick={() => relive(saved)}>▶ Пережить сейчас</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-wrap" onClick={() => !busy && setPanel("none")}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новая запись</h2>
        <div className="row">
          <label className="field small">
            <span>Дата</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Название дня</span>
            <input value={title} placeholder="Оставьте пустым — система придумает сама" onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Что произошло и что вы чувствовали</span>
          <textarea rows={4} value={text} placeholder="Пара предложений: где вы были, какая была погода, с кем, какое настроение…" onChange={(e) => setText(e.target.value)} />
        </label>

        <div className="field">
          <span>Фотографии (до {MAX_PHOTOS})</span>
          <div className="thumbs">
            {photos.map((p, i) => (
              <button key={i} className="thumb" title="Убрать" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}>
                <img src={p} alt="" />
              </button>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="thumb add">
                +
                <input type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        <div className="field">
          <span>Музыка</span>
          <div className="tabs">
            <button className={musicMode === "file" ? "on" : ""} onClick={() => setMusicMode("file")}>Файл</button>
            <button className={musicMode === "url" ? "on" : ""} onClick={() => setMusicMode("url")}>Ссылка на песню</button>
          </div>
          {musicMode === "file" ? (
            <>
              <input type="file" accept={AUDIO_ACCEPT} onChange={(e) => setMusicFile(e.target.files?.[0] ?? null)} />
              <small className="muted">mp3 или m4a. Файл хранится только в вашем браузере, свет и пылинки двигаются в такт музыке.</small>
              {musicFile && !rightsBefore && (
                <label className="rights">
                  <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                  <span>Я подтверждаю, что могу использовать этот файл</span>
                </label>
              )}
            </>
          ) : (
            <>
              <input
                value={musicUrl}
                placeholder="Ссылка на YouTube, Spotify или Яндекс Музыку"
                onChange={(e) => setMusicUrl(e.target.value)}
              />
              <small className="muted">Для Яндекс Музыки подойдёт ссылка на трек или HTML-код из «Поделиться». Играет официальный плеер сервиса, атмосфера строится по тексту записи.</small>
              {link && (
                <div className="link-preview">
                  {linkInfo?.cover && <img src={linkInfo.cover} alt="" />}
                  <div>
                    <b>{linkInfo?.title ?? SERVICE_RU[link.service]}</b>
                    <small>{linkInfo?.artist ? `${linkInfo.artist} · ` : ""}{SERVICE_RU[link.service]} ✓</small>
                  </div>
                </div>
              )}
            </>
          )}
          <input value={songName} placeholder="Название песни" onChange={(e) => setSongName(e.target.value)} />
          <input value={artist} placeholder="Исполнитель" onChange={(e) => setArtist(e.target.value)} />
          <small className="muted">Без музыки комната сыграет собственную мелодию под настроение.</small>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="row end">
          <button className="ghost" disabled={!!busy} onClick={() => setPanel("none")}>Отмена</button>
          <button className="primary" disabled={!!busy} onClick={submit}>{busy ?? "Сохранить и подобрать атмосферу"}</button>
        </div>
      </div>
    </div>
  );
}

export const PARTICLE_RU: Record<string, string> = {
  dust: "пылинки в луче",
  fireflies: "светлячки",
  snow: "снег",
  rain: "дождь",
  petals: "лепестки",
  sparks: "искры",
  bubbles: "пузырьки",
  stars: "звёзды",
};

function readAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}
