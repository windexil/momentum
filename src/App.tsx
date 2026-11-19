import { useEffect } from "react";
import { Scene } from "./scene/Scene";
import { useStore } from "./store";
import { AlbumBook } from "./ui/AlbumBook";
import { CustomizePanel } from "./ui/CustomizePanel";
import { Hud } from "./ui/Hud";
import { NewMemoryForm } from "./ui/NewMemoryForm";

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const panel = useStore((s) => s.panel);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="app">
      <Scene />
      {loaded && <Hud />}
      {loaded && panel === "album" && <AlbumBook />}
      {loaded && panel === "create" && <NewMemoryForm />}
      {loaded && panel === "custom" && <CustomizePanel />}
    </div>
  );
}
