import { useSfx } from "../audio/roomSfx";
import { SERVICE_RU } from "../audio/embed";
import { useEffect, useState } from "react";
import { useStore } from "../store";
import { PARTICLE_RU } from "./NewMemoryForm";
import { ActionBar, KeyHint } from "./Controls";
import { advanceClock, gameClock, partOfDay } from "../scene/dayTime";

const PHASE_TEXT: Record<string, string> = {
  walking: "Готовлюсь слушать…",
  unwinding: "Снимаю наушники…",
};

export function Hud() {
  const phase = useStore((s) => s.phase);
  const active = useStore((s) => s.active);
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const stop = useStore((s) => s.stopReliving);
  const hint = useStore((s) => s.hint);
  const setHint = useStore((s) => s.setHint);
  const memories = useStore((s) => s.memories);
  const restoreDemos = useStore((s) => s.restoreDemos);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 5000);
    return () => window.clearTimeout(t);
  }, [hint, setHint]);

  const a = active?.atmosphere;
  const showNow = active && (phase === "listening" || phase === "walking");

  return (
    <>
      <header className="brand">
        <TimeChip />
        <SoundChip />
        <ClockChip />
      </header>

      {phase === "idle" && panel === "none" && (
        <div className="onboard">Нажмите на <b>альбом на столе</b>, чтобы выбрать день</div>
      )}

      {PHASE_TEXT[phase] && <div className="phase">{PHASE_TEXT[phase]}</div>}

      {showNow && a && (
        <div className="now" style={{ borderColor: a.palette[1] }}>
          <div className="now-head">
            <div className="eq" aria-hidden>
              <i /><i /><i /><i />
            </div>
            <div>
              <div className="now-title">{active.title}</div>
              <div className="now-song">
                ♪ {active.music.name}
                {active.music.artist ? ` — ${active.music.artist}` : ""}
              </div>
            </div>
          </div>
          {active.music.kind === "embed" && active.music.embedUrl && phase === "listening" && (
            <div className="now-player">
              <iframe
                title={active.music.name}
                src={active.music.embedUrl}
                height={active.music.embedHeight ?? 160}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
              <small>Официальный плеер {active.music.service ? SERVICE_RU[active.music.service] : ""}. Если музыка не началась, нажмите ▶ в плеере.</small>
            </div>
          )}
          <div className="swatches">{a.palette.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
          <div className="now-mood">{a.mood}</div>
          <div className="now-desc">{a.description}</div>
          <div className="now-tags">
            <span>{PARTICLE_RU[a.particles.type]}</span>
            <span>{a.nightSky ? "ночь" : a.lightElevation < 22 ? "закатное солнце" : "дневной свет"}</span>
            <span>{a.warmth > 0.2 ? "тёплая палитра" : a.warmth < -0.2 ? "холодная палитра" : "нейтральная палитра"}</span>
          </div>
          <button className="primary" onClick={stop}>■ Снять наушники</button>
        </div>
      )}

      <nav className="dock">
        <button className={panel === "album" ? "on" : ""} onClick={() => setPanel(panel === "album" ? "none" : "album")}>📖 Альбом</button>
        <button className={panel === "create" ? "on" : ""} onClick={() => setPanel("create")}>✎ Новая запись</button>
        <button className={panel === "custom" ? "on" : ""} onClick={() => setPanel(panel === "custom" ? "none" : "custom")}>👕 Персонаж</button>
        {!memories.some((m) => m.demo) && (
          <button onClick={restoreDemos}>Вернуть демо</button>
        )}
      </nav>

      {panel === "none" && <ActionBar />}
      {panel === "none" && <KeyHint />}
      {hint && <div className="toast">{hint}</div>}
    </>
  );
}

/** Время в комнате (как на настенных часах); клик — на час вперёд. */

function SoundChip() {
  const on = useSfx((s) => s.on);
  return (
    <button className="ai-badge time-chip" title="Звуки комнаты: шаги, часы, кот" onClick={() => useSfx.getState().toggle()}>
      {on ? "🔊 Звуки" : "🔇 Звуки выкл."}
    </button>
  );
}

function ClockChip() {
  const clock = useSfx((s) => s.clock);
  return (
    <button className="ai-badge time-chip" title="Тиканье настенных часов" onClick={() => useSfx.getState().toggleClock()}>
      {clock ? "🕰 Тиканье" : "🕰 Тиканье выкл."}
    </button>
  );
}

function TimeChip() {
  const [h, setH] = useState(gameClock.hours);
  useEffect(() => {
    const t = window.setInterval(() => setH(gameClock.hours), 250);
    return () => window.clearInterval(t);
  }, []);
  const hh = Math.floor(h), mm = Math.floor((h * 60) % 60);
  return (
    <button className="ai-badge time-chip" title="Время в комнате. Нажмите, чтобы перевести часы на час вперёд" onClick={() => advanceClock(1)}>
      🕰 {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")} · {partOfDay(h)}
    </button>
  );
}
