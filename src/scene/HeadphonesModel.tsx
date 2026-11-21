// Наушники персонажа — модель «Headphones» (Valerij Dančenko, CC BY 4.0), упрощённая:
// без мелких деталей (винтиков), ~4,5 тыс. треугольников, дужка укорочена под большую голову.
// Цвета берутся из настроек персонажа: корпус — mats.hp, подушки — mats.hpPad.

import { useGLTF } from "@react-three/drei";
import { useQuality } from "./quality";
import { useMemo } from "react";
import * as THREE from "three";
import url from "../assets/headphones.glb?url";

export function HeadphonesModel(props: Parameters<typeof HeadphonesModelInner>[0]) {
  const off = useQuality((q) => q.noModels);
  if (off || import.meta.env.VITE_NOGLB) return null;
  return <HeadphonesModelInner {...props} />;
}

function HeadphonesModelInner({ body, pads }: { body: THREE.Material; pads: THREE.Material }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.material = (m.material as THREE.Material).name === "Cussion" ? pads : body;
    });
    return o;
  }, [scene, body, pads]);
  // подогнано под голову (r=0.3), чуть шире — чашки ложатся поверх капюшона
  return <primitive object={obj} scale={1.1} />;
}

