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

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const panel = useStore((s) => s.panel);
  const atDesk = useHeroUI((s) => s.pose === "desk");

  // 3D может не запуститься (нет WebGL) или погаснуть посреди работы
  const [gl, setGl] = useState<"ok" | "none" | "lost">(() => (hasWebGL() ? "ok" : "none"));
  useEffect(() => {
    const lost = () => setGl("lost");
    window.addEventListener("arttech-gl-lost", lost);
    return () => window.removeEventListener("arttech-gl-lost", lost);
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="app">
      {gl === "ok" && (
        <SceneBoundary onFail={() => setGl("none")}>
          <Scene />
        </SceneBoundary>
      )}
      {loaded && <Hud />}
      {loaded && panel === "album" && !atDesk && <AlbumBook />}
      {loaded && panel === "create" && <NewMemoryForm />}
      {loaded && panel === "custom" && <CustomizePanel />}
      {loaded && <StripEditor />}
      <MemoryTransition />
      <LocationTravel />
      {gl === "ok" ? <Loader /> : <NoWebGL lost={gl === "lost"} />}
    </div>
  );
}
