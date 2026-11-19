// Лента со снимками на прищепках над письменным столом.
// Клик по снимку открывает выбор фото из галереи (ui/StripEditor.tsx).

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { STRIP_SLOTS, useRoom } from "../roomStore";
import { ROOM } from "./Room";

const X0 = 1.95, X1 = 3.45, Y = 1.74, SAG = 0.08; // ниже, на уровне взгляда сидящего за столом
const Z = -ROOM + 0.03;
const W = 0.2, H = 0.25, PHOTO = 0.17;

const stringY = (x: number) => {
  const t = (x - X0) / (X1 - X0);
  return Y - Math.sin(t * Math.PI) * SAG;
};

const mats = {
  string: new THREE.MeshStandardMaterial({ color: "#e8dcc4", roughness: 0.9 }),
  frame: new THREE.MeshStandardMaterial({ color: "#fbf7ee", roughness: 0.85 }),
  empty: new THREE.MeshStandardMaterial({ color: "#9fb2a8", roughness: 0.9 }),
  pin: new THREE.MeshStandardMaterial({ color: "#b07a48", roughness: 0.6 }),
  nail: new THREE.MeshStandardMaterial({ color: "#3a3a40", roughness: 0.4, metalness: 0.6 }),
};

export function PhotoStrip() {
  const strip = useRoom((s) => s.strip);
  const load = useRoom((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

  const curve = useMemo(() => {
    const pts = Array.from({ length: 24 }, (_, i) => {
      const x = X0 + ((X1 - X0) * i) / 23;
      return new THREE.Vector3(x, stringY(x), Z + 0.02);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.005, 5, false);
  }, []);

  return (
    <group>
      <mesh geometry={curve} material={mats.string} />
      {[X0, X1].map((x) => (
        <mesh key={x} position={[x, Y, Z + 0.01]} rotation-x={Math.PI / 2} material={mats.nail}>
          <cylinderGeometry args={[0.012, 0.012, 0.04, 8]} />
        </mesh>
      ))}
      {Array.from({ length: STRIP_SLOTS }, (_, i) => {
        const x = X0 + ((X1 - X0) * (i + 0.5)) / STRIP_SLOTS;
        return <Polaroid key={i} index={i} x={x} url={strip[i]} />;
      })}
    </group>
  );
}

function Polaroid({ index, x, url }: { index: number; x: number; url: string | null }) {
  const ref = useRef<THREE.Group>(null);
  const edit = useRoom((s) => s.edit);
  const seed = useMemo(() => Math.sin(index * 12.9898) * 43758.5453 % 1, [index]);
  const photoMat = useMemo(() => {
    if (!url) return mats.empty;
    const m = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      // как object-fit: cover — обрезаем под квадрат
      const img = tex.image as { width: number; height: number };
      const a = img.width / img.height;
      if (a > 1) {
        tex.repeat.set(1 / a, 1);
        tex.offset.set((1 - 1 / a) / 2, 0);
      } else {
        tex.repeat.set(1, a);
        tex.offset.set(0, (1 - a) / 2);
      }
      m.map = tex;
      m.needsUpdate = true;
    });
    return m;
  }, [url]);
  useEffect(() => () => {
    if (photoMat !== mats.empty) {
      photoMat.map?.dispose();
      photoMat.dispose();
    }
  }, [photoMat]);

  useFrame(({ clock }) => {
    // лёгкое покачивание на прищепке
    if (ref.current) ref.current.rotation.z = (seed - 0.5) * 0.12 + Math.sin(clock.elapsedTime * 0.9 + index * 1.7) * 0.012;
  });

  const y = stringY(x);
  return (
    <group position={[x, y, Z + 0.025]}>
      <group
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 6) return; // это был поворот взгляда, а не клик
          edit(index);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <mesh position={[0, -H / 2 - 0.01, 0]} castShadow material={mats.frame}>
          <boxGeometry args={[W, H, 0.004]} />
        </mesh>
        <mesh position={[0, -0.01 - (W - PHOTO) / 2 - PHOTO / 2, 0.0025]} material={photoMat}>
          <planeGeometry args={[PHOTO, PHOTO]} />
        </mesh>
        {/* прищепка */}
        <group position={[0, 0.005, 0.012]}>
          <mesh position={[0, 0, -0.005]} castShadow material={mats.pin}>
            <boxGeometry args={[0.03, 0.085, 0.009]} />
          </mesh>
          <mesh position={[0, 0, 0.005]} castShadow material={mats.pin}>
            <boxGeometry args={[0.03, 0.085, 0.009]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
