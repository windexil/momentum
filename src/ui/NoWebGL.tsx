// Если браузер не дал запустить 3D (выключено аппаратное ускорение, видеокарта
// «упала» или вкладка исчерпала лимит WebGL), вместо пустого тёмного экрана
// показываем понятную записку и кнопку «Попробовать снова».

import { Component, type ReactNode } from "react";
import { diagLog } from "../diag";

/** Можно ли вообще создать WebGL-контекст в этом браузере */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    // сразу отпускаем пробный контекст, чтобы не занимать лимит браузера
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Ловит падение 3D-сцены, чтобы не исчезал весь интерфейс */
export class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("3D-сцена не запустилась", err);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function NoWebGL({ lost }: { lost?: boolean }) {
  return (
    <div className="nogl">
      <div className="nogl-card">
        <h2>{lost ? "3D-комната погасла" : "3D-комната не запустилась"}</h2>
        <p>
          {lost
            ? "Браузер остановил видеокарту для этой вкладки. Обычно помогает просто обновить страницу."
            : "Браузер не дал включить 3D-графику (WebGL). Альбом и записи работают, но комнату показать не получится."}
        </p>
        <ul>
          <li>Обновите страницу или перезапустите браузер.</li>
          <li>
            В Chrome: Настройки → Система → включите «Использовать аппаратное ускорение» и перезапустите браузер.
          </li>
          <li>Закройте другие вкладки с 3D или играми и попробуйте снова.</li>
        </ul>
        <button onClick={() => location.reload()}>Попробовать снова</button>
        {diagLog.length > 0 && (
          <details className="nogl-diag" open>
            <summary>Технические подробности (пришлите скриншот разработчику)</summary>
            <pre>{diagLog.slice(-14).join("\n")}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
