// Гирлянда-огоньки над лентой со снимками: тёплые лампочки мерцают и
// подсвечивают фотографии, чтобы их было хорошо видно даже вечером.
// Клик по гирлянде включает и выключает её.

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sfx } from "../audio/roomSfx";
import { ROOM } from "./Room";
import { live } from "./live";

const X0 = 1.82, X1 = 3.58, Y = 2.06, Z = -ROOM + 0.05;
const SCALLOPS = 3, SAG = 0.07, BULBS = 27;

const ghost = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
const wireMat = new THREE.MeshStandardMaterial({ color: "#2d3a2a", roughness: 0.6 });
const bulbMat = new THREE.MeshBasicMaterial({ toneMapped: false });
const WARM = new THREE.Color("#ffc46b");
const OFF = new THREE.Color("#5a4a3a");

function at(t: number) {
  const x = X0 + (X1 - X0) * t;
  const y = Y - Math.abs(Math.sin(t * Math.PI * SCALLOPS)) * SAG;
  return new THREE.Vector3(x, y, Z);
}

export function Garland() {
  const [on, setOn] = useState(true);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const k = useRef(1);
  const tmp = useMemo(() => new THREE.Color(), []);
  const seeds = useMemo(() => Array.from({ length: BULBS }, (_, i) => (Math.sin(i * 91.7) * 1000) % 1), []);

  const wire = useMemo(() => {
    const pts = Array.from({ length: 60 }, (_, i) => at(i / 59));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.004, 5, false);
  }, []);

  useLayoutEffect(() => {
    const m = bulbs.current!;
    const o = new THREE.Object3D();
    for (let i = 0; i < BULBS; i++) {
      const p = at((i + 0.5) / BULBS);
      o.position.set(p.x, p.y - 0.018, p.z + 0.006);
      o.scale.set(1, 1.35, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, WARM);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(({ clock }, dt) => {
    k.current += ((on ? 1 : 0) - k.current) * (1 - Math.exp(-6 * Math.min(dt, 0.05)));
    const t = clock.elapsedTime;
    const m = bulbs.current!;
    for (let i = 0; i < BULBS; i++) {
      // мягкое мерцание волной вдоль провода
      const tw = 0.75 + 0.25 * Math.sin(t * 1.6 + i * 0.7 + seeds[i] * 6);
      tmp.copy(OFF).lerp(WARM, k.current).multiplyScalar(0.6 + k.current * tw * 1.6);
      m.setColorAt(i, tmp);
    }
    m.instanceColor!.needsUpdate = true;
    // вечером подсветка заметнее, днём — лёгкая
    light.current!.intensity = k.current * (0.5 + live.night * 1.4);
  });

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    sfx.click(0.35, 0.4);
    setOn((v) => !v);
  };

  return (
    <group>
      <mesh geometry={wire} material={wireMat} />
      <instancedMesh ref={bulbs} args={[undefined, undefined, BULBS]} material={bulbMat} frustumCulled={false}>
        <sphereGeometry args={[0.011, 10, 8]} />
      </instancedMesh>
      <pointLight ref={light} position={[(X0 + X1) / 2, Y - 0.15, Z + 0.45]} color="#ffcf8a" distance={1.8} decay={1.8} />
      <mesh
        position={[(X0 + X1) / 2, Y - 0.04, Z + 0.03]}
        material={ghost}
        onClick={toggle}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <boxGeometry args={[X1 - X0, 0.12, 0.06]} />
      </mesh>
    </group>
  );
}
