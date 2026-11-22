// Экран загрузки в стиле дневника: кожаная обложка, перо выводит надпись,
// страницы перелистываются, пока грузятся комната, шрифты и модели.

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useStore } from "../store";

const LINES = ["Сдуваем пыль с альбома…", "Расставляем фотографии…", "Завариваем какао…", "Зажигаем лампу…"];
const MIN_MS = 1800;

export function Loader() {
  const loaded = useStore((s) => s.loaded);
  const { active, progress } = useProgress();
  const [t0] = useState(() => performance.now());
  const [line, setLine] = useState(0);
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    const id = window.setInterval(() => setLine((i) => (i + 1) % LINES.length), 1400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== "show" || !loaded || active) return;
    const wait = Math.max(0, MIN_MS - (performance.now() - t0));
    const id = window.setTimeout(async () => {
      await document.fonts?.ready;
      setPhase("leave");
      window.setTimeout(() => setPhase("gone"), 900);
    }, wait);
    return () => window.clearTimeout(id);
  }, [loaded, active, phase, t0]);

  if (phase === "gone") return null;
  const pct = loaded && !active ? 100 : Math.round(Math.min(99, progress || 30));

  return (
    <div className={"loader" + (phase === "leave" ? " leave" : "")} aria-live="polite">
      <div className="loader-book">
        <div className="loader-page left">
          <svg className="loader-ink" viewBox="0 0 300 90" aria-hidden>
            <text x="150" y="60" textAnchor="middle">Momentum</text>
          </svg>
          <div className="loader-sub">комната воспоминаний</div>
        </div>
        <div className="loader-page right" />
        <div className="loader-leaf l1" />
        <div className="loader-leaf l2" />
        <div className="loader-leaf l3" />
        <div className="loader-spine" />
      </div>
      <div className="loader-line" key={line}>{LINES[line]}</div>
      <div className="loader-bar"><i style={{ width: pct + "%" }} /></div>
    </div>
  );
}
