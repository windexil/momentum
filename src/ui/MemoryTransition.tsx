// Переход «вход в воспоминание»: края экрана темнеют виньеткой, камера наезжает,
// по центру проступает дата и название дня, затем виньетка мягко раскрывается
// и остаётся лёгкой рамкой, пока звучит воспоминание.

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { formatDate } from "../util";

type Stage = "off" | "prep" | "enter" | "steady" | "exit";

export function MemoryTransition() {
  const phase = useStore((s) => s.phase);
  const active = useStore((s) => s.active);
  const [stage, setStage] = useState<Stage>("off");

  useEffect(() => {
    let id = 0;
    if (phase === "walking" && active) setStage("prep");
    else if (phase === "listening") {
      setStage("enter");
      id = window.setTimeout(() => setStage("steady"), 3200);
    } else if (phase === "unwinding" || phase === "idle") {
      setStage((s) => (s === "off" ? "off" : "exit"));
      id = window.setTimeout(() => setStage("off"), 1200);
    }
    return () => window.clearTimeout(id);
  }, [phase, active]);

  if (stage === "off") return null;
  return (
    <div className={`mem-transition ${stage}`} aria-hidden>
      <div className="mem-vignette" />
      <div className="mem-grain" />
      {stage === "enter" && active && (
        <div className="mem-card">
          <div className="mem-card-date">{formatDate(active.date)}</div>
          <div className="mem-card-title">{active.title}</div>
        </div>
      )}
    </div>
  );
}
