import { useEffect } from "react";
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

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const panel = useStore((s) => s.panel);
  const atDesk = useHeroUI((s) => s.pose === "desk");

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="app">
      <Scene />
      {loaded && <Hud />}
      {loaded && panel === "album" && !atDesk && <AlbumBook />}
      {loaded && panel === "create" && <NewMemoryForm />}
      {loaded && panel === "custom" && <CustomizePanel />}
      {loaded && <StripEditor />}
      <MemoryTransition />
      <LocationTravel />
      <Loader />
    </div>
  );
}
