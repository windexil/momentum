import { useEffect, useState } from "react";
import { checkAi } from "../atmosphere/analyze";
import { useStore } from "../store";
import { PARTICLE_RU } from "./NewMemoryForm";

const PHASE_TEXT: Record<string, string> = {
  walking: "Иду к креслу…",
  sitting: "Надеваю наушники…",
  unwinding: "Возвращаюсь в обычный день…",
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
  const [ai, setAi] = useState<boolean | null>(null);

  useEffect(() => {
    checkAi().then(setAi);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 5000);
    return () => window.clearTimeout(t);
  }, [hint, setHint]);

  const a = active?.atmosphere;
  const showNow = active && (phase === "listening" || phase === "sitting" || phase === "walking");

  return (
    <>
      <header className="brand">
        <div className="logo">ArtTech</div>
        <div className="sub">комната воспоминаний</div>
        <div className={`ai-badge ${ai ? "on" : ""}`} title={ai ? "Атмосферу подбирает Claude на сервере" : "Сервер без ключа: работает локальный анализатор"}>
          {ai === null ? "…" : ai ? "AI: Claude" : "AI: локальный анализ"}
        </div>
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
              <div className="now-song">♪ {active.music.name}</div>
            </div>
          </div>
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
        {!memories.some((m) => m.demo) && (
          <button onClick={restoreDemos}>Вернуть демо</button>
        )}
      </nav>

      {hint && <div className="toast">{hint}</div>}
    </>
  );
}
