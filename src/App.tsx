import { useEffect, useState } from "react";
import { Scene } from "./scene/Scene";
import { useStore } from "./store";
import { AlbumBook } from "./ui/AlbumBook";
import { CustomizePanel } from "./ui/CustomizePanel";
import { Hud } from "./ui/Hud";
import { Loader } from "./ui/Loader";
import { MemoryTransition } from "./ui/MemoryTransition";
import { LocationTravel } from "./ui/LocationTravel";
import { NewMemoryForm } from "./ui/NewMemoryForm";
import { StripEditor } from "./ui/StripEditor";
import { useHeroUI } from "./scene/heroControl";
import { hasWebGL, NoWebGL, SceneBoundary } from "./ui/NoWebGL";
import { useQuality } from "./scene/quality";
import { diag } from "./diag";

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const panel = useStore((s) => s.panel);
  const atDesk = useHeroUI((s) => s.pose === "desk");

  // 3D может не запуститься (нет WebGL) или погаснуть посреди работы
  const [gl, setGl] = useState<"ok" | "none" | "lost" | "retry">(() => (hasWebGL() ? "ok" : "none"));
  // после сбоя видеокарты сами перезапускаем сцену (до двух раз)
  const [sceneKey, setSceneKey] = useState(0);
  useEffect(() => {
    let tries = 0;
    const lost = () => {
      if (tries++ < 2) {
        // по очереди выключаем то, что чаще всего роняет видеокарту: отражения, потом постобработку
        const fx = useQuality.getState().fxDown();
        diag(`перезапуск 3D, выключено: ${fx >= 2 ? "отражения и постобработка" : "отражения"}`);
        setGl("retry");
        window.setTimeout(() => {
          setSceneKey((k) => k + 1);
          setGl("ok");
        }, 800);
      } else setGl("lost");
    };
    window.addEventListener("arttech-gl-lost", lost);
    return () => window.removeEventListener("arttech-gl-lost", lost);
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="app">
      {gl === "ok" && (
        <SceneBoundary key={sceneKey} onFail={() => setGl("none")}>
          <Scene />
        </SceneBoundary>
      )}
      {loaded && <Hud />}
      {loaded && panel === "album" && <AlbumBook key={atDesk ? "desk" : "room"} onDesk={atDesk} />}
      {loaded && panel === "create" && <NewMemoryForm />}
      {loaded && panel === "custom" && <CustomizePanel />}
      {loaded && <StripEditor />}
      <MemoryTransition />
      <LocationTravel />
      {gl === "ok" ? <Loader /> : gl === "retry" ? null : <NoWebGL lost={gl === "lost"} />}
    </div>
  );
}
