// Управление персонажем в интерфейсе: кнопки действий и подсказка.
// Ходьба только кликом или тапом по полу.

import { useEffect, useState } from "react";
import { useStore } from "../store";

/** Справа только кнопка возврата из воспоминания. В комнате всё делается кликом по предметам. */
export function ActionBar() {
  const stop = useStore((s) => s.stopReliving);
  const inRoom = useStore((s) => s.place === "room");
  if (inRoom) return null;
  return (
    <div className="actions">
      <button onClick={() => stop()}>🏠 Вернуться в комнату</button>
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
      <b>Клик</b> или <b>тап</b> по полу — идти туда · по креслу, кровати, столу, торшеру, наушникам, кружке или питомцу — действие · клик по часам — +1 час
    </div>
  );
}
