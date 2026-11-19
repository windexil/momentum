// Управление персонажем в интерфейсе: джойстик (телефон и мышь),
// кнопки действий и подсказка по клавишам.

import { useEffect, useRef, useState } from "react";
import { control, heroCmd, useHeroUI } from "../scene/heroControl";
import { useStore } from "../store";

export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

  function update(e: React.PointerEvent) {
    const r = base.current!.getBoundingClientRect();
    const R = r.width / 2;
    let dx = e.clientX - (r.left + R);
    let dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    const nx = dx / R, ny = -dy / R;
    // небольшая мёртвая зона
    const m = Math.hypot(nx, ny);
    control.stick.set(m < 0.12 ? 0 : nx, m < 0.12 ? 0 : ny);
    setKnob({ x: dx, y: dy, active: true });
  }
  function end() {
    control.stick.set(0, 0);
    setKnob({ x: 0, y: 0, active: false });
  }

  return (
    <div
      ref={base}
      className={`joystick ${knob.active ? "active" : ""}`}
      aria-label="Джойстик: перемещение персонажа"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => knob.active && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export function ActionBar() {
  const { pose, hp } = useHeroUI();
  const phase = useStore((s) => s.phase);
  const stop = useStore((s) => s.stopReliving);
  const listening = phase === "listening";

  return (
    <div className="actions">
      {pose !== "sit" && <button onClick={() => heroCmd.sit()}>🪑 Сесть</button>}
      {pose !== "lie" && <button onClick={() => heroCmd.lie()}>🛏 Лечь</button>}
      {pose !== "stand" && <button onClick={() => heroCmd.stand()}>🚶 Встать</button>}
      {hp === "table" && <button onClick={() => heroCmd.takeHp()}>🎧 Взять наушники</button>}
      {hp === "neck" && <button onClick={() => heroCmd.wearHp()}>🎧 Надеть</button>}
      {hp === "head" && (
        <button onClick={() => (listening ? stop() : heroCmd.removeHp())}>🎧 Снять</button>
      )}
      {hp !== "table" && !listening && <button onClick={() => heroCmd.putBackHp()}>↩ Положить на столик</button>}
    </div>
  );
}

export function KeyHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), 12000);
    return () => window.clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="keyhint">
      <b>WASD</b> или <b>стрелки</b> — ходить · клик по полу — идти туда · клик по креслу, кровати, столику — действие
    </div>
  );
}
