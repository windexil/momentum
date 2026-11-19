// Настольная лампа: клик открывает маленькое меню у самой лампы —
// выбор тона света и выключатель. Выбор сохраняется в roomStore.

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { LAMP_TONES, useRoom } from "../roomStore";
import { live } from "./live";

const ghost = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
const tmp = new THREE.Color();

/** Итоговый цвет лампы с учётом выбранного тона. */
export function deskLampColor(out: THREE.Color) {
  const { tone } = useRoom.getState().deskLamp;
  const t = LAMP_TONES.find((x) => x.id === tone);
  return t && t.color ? out.set(t.color) : out.copy(live.lampColor);
}

export function DeskLampControl() {
  const [menu, setMenu] = useState(false);
  const lamp = useRoom((s) => s.deskLamp);
  const setLamp = useRoom((s) => s.setDeskLamp);

  // клик мимо меню закрывает его
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.(".lamp-menu")) setMenu(false);
    };
    const id = setTimeout(() => window.addEventListener("pointerdown", close), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", close);
    };
  }, [menu]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    setMenu((m) => !m);
  };

  return (
    <>
      <mesh
        position={[0, 0.27, 0]}
        material={ghost}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <cylinderGeometry args={[0.19, 0.19, 0.56, 12]} />
      </mesh>
      {menu && (
        <Html position={[0, 0.62, 0.05]} center zIndexRange={[40, 30]}>
          <div className="lamp-menu" onPointerDown={(e) => e.stopPropagation()}>
            <div className="lamp-menu-title">Настольная лампа</div>
            <div className="lamp-tones">
              {LAMP_TONES.map((t) => {
                const sw = t.color || "#" + tmp.copy(live.lampColor).getHexString();
                return (
                  <button
                    key={t.id}
                    className={"lamp-tone" + (lamp.tone === t.id ? " active" : "")}
                    title={t.name}
                    onClick={() => setLamp({ tone: t.id, on: true })}
                  >
                    <span className={"sw" + (t.id === "auto" ? " auto" : "")} style={{ background: sw }} />
                    <span className="nm">{t.name}</span>
                  </button>
                );
              })}
            </div>
            <button className={"lamp-power" + (lamp.on ? " on" : "")} onClick={() => setLamp({ on: !lamp.on })}>
              {lamp.on ? "Выключить" : "Включить"}
            </button>
          </div>
        </Html>
      )}
    </>
  );
}
