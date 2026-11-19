// Управление персонажем в интерфейсе: кнопки действий и подсказка.
// Ходьба только кликом или тапом по полу.

import { useEffect, useState } from "react";
import { heroCmd, useHeroUI } from "../scene/heroControl";
import { useStore } from "../store";

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
      <b>Клик</b> или <b>тап</b> по полу — идти туда · по креслу, кровати, столику с наушниками — действие
    </div>
  );
}
