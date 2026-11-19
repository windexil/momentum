// Одна постоянная комната в духе «кукольного домика»: две стены, пол,
// окно, кровать, стол, кресло, полки, растения. Геометрия не меняется,
// а акцентные материалы (ковёр, плед, подушки, постеры) мягко
// подкрашиваются палитрой воспоминания.

import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { live } from "./live";

export const ROOM = 4; // полуразмер комнаты
export const WALL_H = 3.4;
export const WINDOW = { x: 0.6, y: 2.0, w: 2.4, h: 1.6 };
export const CHAIR = { x: -1.3, z: 0.9, rot: Math.PI / 4 };
export const SIDE_TABLE = { x: -2.35, z: 0.1 };
export const DESK = { x: 2.3, z: -3.35 };

const std = (color: string, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });

export function Room() {
  const mats = useMemo(
    () => ({
      floor: std("#c89f74", 0.7),
      floorDark: std("#a77f57", 0.7),
      wall: std("#efe3d2"),
      wall2: std("#e6d6c1"),
      trim: std("#fbf6ee"),
      wood: std("#9b6b43", 0.6),
      woodLight: std("#c99a6b", 0.6),
      white: std("#f6f1ea"),
      metal: new THREE.MeshStandardMaterial({ color: "#3a3a40", roughness: 0.35, metalness: 0.6 }),
      leaf: std("#4d8a55"),
      leaf2: std("#6aa86b"),
      pot: std("#d0764f"),
      soil: std("#4a3426", 0.95),
      // акценты, следуют палитре
      rug: std("#c9b79c"),
      blanket: std("#8fa39a"),
      cushion: std("#e9dccb"),
      chair: std("#5d6b73", 0.9),
      poster1: new THREE.MeshStandardMaterial({ color: "#e9dccb", roughness: 0.9 }),
      poster2: new THREE.MeshStandardMaterial({ color: "#8fa39a", roughness: 0.9 }),
      books: [std("#c0504d"), std("#4f81bd"), std("#9bbb59"), std("#f2c14e"), std("#8064a2")],
    }),
    [],
  );

  const base = useMemo(
    () => ({
      wall: new THREE.Color("#efe3d2"),
      wall2: new THREE.Color("#e6d6c1"),
      chair: new THREE.Color("#5d6b73"),
    }),
    [],
  );

  useFrame(() => {
    const p = live.palette;
    mats.rug.color.copy(p[1]);
    mats.blanket.color.copy(p[2]);
    mats.cushion.color.copy(p[0]);
    mats.poster1.color.copy(p[3]);
    mats.poster2.color.copy(p[1]);
    mats.chair.color.copy(base.chair).lerp(p[3], 0.35);
    // стены лишь слегка окрашиваются, чтобы комната оставалась узнаваемой
    mats.wall.color.copy(base.wall).lerp(p[0], 0.18);
    mats.wall2.color.copy(base.wall2).lerp(p[0], 0.18);
  });

  return (
    <group>
      <Floor mats={mats} />
      <Walls mats={mats} />
      <Bed mats={mats} />
      <Desk mats={mats} />
      <Armchair mats={mats} />
      <SideTable mats={mats} />
      <Shelves mats={mats} />
      <Plant position={[3.3, 0, -1.6]} mats={mats} scale={1.1} />
      <Plant position={[-3.3, 0, 2.9]} mats={mats} scale={0.85} />
      <FloorLamp mats={mats} />
      {/* круглый ковёр под креслом */}
      <mesh position={[CHAIR.x + 0.2, 0.012, CHAIR.z + 0.2]} rotation-x={-Math.PI / 2} receiveShadow material={mats.rug}>
        <circleGeometry args={[1.5, 48]} />
      </mesh>
      <mesh position={[CHAIR.x + 0.2, 0.014, CHAIR.z + 0.2]} rotation-x={-Math.PI / 2} receiveShadow material={mats.cushion}>
        <ringGeometry args={[1.25, 1.32, 48]} />
      </mesh>
    </group>
  );
}

type Mats = ReturnType<typeof useMatsType>;
// Только для вывода типа материалов.
function useMatsType() {
  return {} as {
    floor: THREE.MeshStandardMaterial; floorDark: THREE.MeshStandardMaterial; wall: THREE.MeshStandardMaterial;
    wall2: THREE.MeshStandardMaterial; trim: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial;
    woodLight: THREE.MeshStandardMaterial; white: THREE.MeshStandardMaterial; metal: THREE.MeshStandardMaterial;
    leaf: THREE.MeshStandardMaterial; leaf2: THREE.MeshStandardMaterial; pot: THREE.MeshStandardMaterial; soil: THREE.MeshStandardMaterial;
    rug: THREE.MeshStandardMaterial; blanket: THREE.MeshStandardMaterial; cushion: THREE.MeshStandardMaterial;
    chair: THREE.MeshStandardMaterial; poster1: THREE.MeshStandardMaterial; poster2: THREE.MeshStandardMaterial;
    books: THREE.MeshStandardMaterial[];
  };
}

function Floor({ mats }: { mats: Mats }) {
  // паркет полосами
  const planks = [];
  for (let i = 0; i < 16; i++) {
    planks.push(
      <mesh key={i} position={[-ROOM + 0.25 + i * 0.5, -0.05, 0]} receiveShadow material={i % 2 ? mats.floor : mats.floorDark}>
        <boxGeometry args={[0.49, 0.1, ROOM * 2]} />
      </mesh>,
    );
  }
  return (
    <group>
      {planks}
      {/* «срез» пола, как у кукольного домика */}
      <mesh position={[0, -0.25, 0]} material={mats.wood}>
        <boxGeometry args={[ROOM * 2 + 0.3, 0.3, ROOM * 2 + 0.3]} />
      </mesh>
    </group>
  );
}

function Walls({ mats }: { mats: Mats }) {
  const t = 0.2;
  const { x, y, w, h } = WINDOW;
  const left = x - w / 2 + ROOM; // ширина стены слева от окна
  const right = ROOM - (x + w / 2);
  return (
    <group>
      {/* задняя стена с проёмом под окно */}
      <group position={[0, 0, -ROOM - t / 2]}>
        <mesh position={[-ROOM + left / 2, WALL_H / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[left, WALL_H, t]} />
        </mesh>
        <mesh position={[ROOM - right / 2, WALL_H / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[right, WALL_H, t]} />
        </mesh>
        <mesh position={[x, (y - h / 2) / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[w, y - h / 2, t]} />
        </mesh>
        <mesh position={[x, (WALL_H + y + h / 2) / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[w, WALL_H - y - h / 2, t]} />
        </mesh>
        {/* плинтус */}
        <mesh position={[0, 0.08, t / 2 + 0.02]} material={mats.trim}>
          <boxGeometry args={[ROOM * 2, 0.16, 0.04]} />
        </mesh>
        {/* рама окна */}
        <group position={[x, y, t / 2]}>
          {[
            [0, h / 2, w + 0.16, 0.08],
            [0, -h / 2, w + 0.3, 0.1],
            [-w / 2, 0, 0.08, h],
            [w / 2, 0, 0.08, h],
            [0, 0, 0.05, h],
            [0, 0.1, w, 0.05],
          ].map(([px, py, sx, sy], i) => (
            <mesh key={i} position={[px, py, 0]} castShadow material={mats.trim}>
              <boxGeometry args={[sx, sy, 0.12]} />
            </mesh>
          ))}
          {/* подоконник */}
          <mesh position={[0, -h / 2 - 0.04, 0.16]} material={mats.trim} castShadow>
            <boxGeometry args={[w + 0.4, 0.06, 0.34]} />
          </mesh>
        </group>
        {/* постеры */}
        <mesh position={[-2.4, 2.1, t / 2 + 0.01]} material={mats.poster1}>
          <planeGeometry args={[0.9, 1.2]} />
        </mesh>
        <mesh position={[-2.4, 2.1, t / 2 + 0.005]} material={mats.white}>
          <planeGeometry args={[1.0, 1.3]} />
        </mesh>
        <mesh position={[3.0, 2.35, t / 2 + 0.01]} material={mats.poster2}>
          <circleGeometry args={[0.36, 32]} />
        </mesh>
      </group>
      {/* левая стена */}
      <mesh position={[-ROOM - t / 2, WALL_H / 2, 0]} receiveShadow castShadow material={mats.wall2}>
        <boxGeometry args={[t, WALL_H, ROOM * 2 + t * 2]} />
      </mesh>
      <mesh position={[-ROOM + 0.02, 0.08, 0]} material={mats.trim}>
        <boxGeometry args={[0.04, 0.16, ROOM * 2]} />
      </mesh>
    </group>
  );
}

function Bed({ mats }: { mats: Mats }) {
  return (
    <group position={[-2.85, 0, -2.3]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={mats.wood}>
        <boxGeometry args={[1.9, 0.4, 3.1]} />
      </mesh>
      <RoundedBox args={[1.8, 0.28, 2.95]} radius={0.08} position={[0, 0.58, 0.02]} castShadow receiveShadow material={mats.white} />
      {/* плед */}
      <RoundedBox args={[1.86, 0.1, 1.8]} radius={0.04} position={[0, 0.74, 0.6]} castShadow receiveShadow material={mats.blanket} />
      {/* подушки */}
      <RoundedBox args={[0.75, 0.2, 0.45]} radius={0.09} position={[-0.42, 0.82, -1.1]} castShadow material={mats.cushion} />
      <RoundedBox args={[0.75, 0.2, 0.45]} radius={0.09} position={[0.42, 0.82, -1.1]} castShadow material={mats.white} />
      {/* изголовье */}
      <mesh position={[0, 0.75, -1.55]} castShadow material={mats.wood}>
        <boxGeometry args={[1.95, 1.1, 0.1]} />
      </mesh>
    </group>
  );
}

function Desk({ mats }: { mats: Mats }) {
  return (
    <group position={[DESK.x, 0, DESK.z]}>
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow material={mats.woodLight}>
        <boxGeometry args={[2.0, 0.07, 0.85]} />
      </mesh>
      {[[-0.92, -0.36], [0.92, -0.36], [-0.92, 0.36], [0.92, 0.36]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.37, z]} castShadow material={mats.wood}>
          <boxGeometry args={[0.07, 0.74, 0.07]} />
        </mesh>
      ))}
      {/* ящик */}
      <mesh position={[0.55, 0.6, 0.05]} castShadow material={mats.woodLight}>
        <boxGeometry args={[0.7, 0.24, 0.72]} />
      </mesh>
      {/* стопка книг */}
      <mesh position={[-0.75, 0.84, -0.15]} castShadow material={mats.books[1]}>
        <boxGeometry args={[0.32, 0.07, 0.42]} />
      </mesh>
      <mesh position={[-0.73, 0.91, -0.15]} rotation-y={0.2} castShadow material={mats.books[3]}>
        <boxGeometry args={[0.3, 0.07, 0.4]} />
      </mesh>
      {/* стул */}
      <group position={[-0.1, 0, 0.75]}>
        <mesh position={[0, 0.46, 0]} castShadow material={mats.wood}>
          <boxGeometry args={[0.5, 0.06, 0.5]} />
        </mesh>
        <mesh position={[0, 0.8, 0.23]} castShadow material={mats.wood}>
          <boxGeometry args={[0.5, 0.6, 0.05]} />
        </mesh>
        {[[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.22, z]} material={mats.wood}>
            <boxGeometry args={[0.05, 0.44, 0.05]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Armchair({ mats }: { mats: Mats }) {
  return (
    <group position={[CHAIR.x, 0, CHAIR.z]} rotation-y={CHAIR.rot}>
      <RoundedBox args={[1.1, 0.42, 1.0]} radius={0.12} position={[0, 0.3, 0]} castShadow receiveShadow material={mats.chair} />
      <RoundedBox args={[0.9, 0.14, 0.82]} radius={0.06} position={[0, 0.56, 0.05]} castShadow material={mats.cushion} />
      <RoundedBox args={[1.1, 0.9, 0.24]} radius={0.12} position={[0, 0.8, -0.42]} castShadow receiveShadow material={mats.chair} />
      <RoundedBox args={[0.2, 0.38, 0.95]} radius={0.09} position={[-0.52, 0.68, 0]} castShadow material={mats.chair} />
      <RoundedBox args={[0.2, 0.38, 0.95]} radius={0.09} position={[0.52, 0.68, 0]} castShadow material={mats.chair} />
    </group>
  );
}

function SideTable({ mats }: { mats: Mats }) {
  return (
    <group position={[SIDE_TABLE.x, 0, SIDE_TABLE.z]}>
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow material={mats.woodLight}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 32]} />
      </mesh>
      <mesh position={[0, 0.29, 0]} castShadow material={mats.wood}>
        <cylinderGeometry args={[0.04, 0.06, 0.56, 12]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={mats.wood}>
        <cylinderGeometry args={[0.22, 0.24, 0.04, 24]} />
      </mesh>
      {/* кружка какао, как на референсе */}
      <group position={[0.14, 0.61, 0.12]}>
        <mesh castShadow material={mats.white}>
          <cylinderGeometry args={[0.065, 0.06, 0.13, 20]} />
        </mesh>
        <mesh position={[0.07, 0.07, 0]} material={mats.white}>
          <torusGeometry args={[0.035, 0.012, 8, 16]} />
        </mesh>
        <mesh position={[0, 0.125, 0]} rotation-x={-Math.PI / 2} material={mats.wood}>
          <circleGeometry args={[0.058, 20]} />
        </mesh>
      </group>
    </group>
  );
}

function Shelves({ mats }: { mats: Mats }) {
  const shelf = (y: number, seed: number) => {
    const books = [];
    let z = -0.75;
    for (let i = 0; z < 0.6; i++) {
      const w = 0.07 + ((i * 7 + seed) % 5) * 0.02;
      const h = 0.28 + ((i * 3 + seed) % 4) * 0.05;
      books.push(
        <mesh key={i} position={[0, y + h / 2 + 0.03, z + w / 2]} castShadow material={mats.books[(i + seed) % mats.books.length]}>
          <boxGeometry args={[0.24, h, w]} />
        </mesh>,
      );
      z += w + 0.01;
    }
    return (
      <group key={y}>
        <mesh position={[0, y, 0]} castShadow receiveShadow material={mats.woodLight}>
          <boxGeometry args={[0.32, 0.05, 1.7]} />
        </mesh>
        {books}
      </group>
    );
  };
  return (
    <group position={[-ROOM + 0.17, 0, 1.9]}>
      {shelf(1.5, 0)}
      {shelf(2.2, 2)}
      {/* маленький кактус на полке */}
      <group position={[0, 2.22, 0.75]}>
        <mesh position={[0, 0.07, 0]} material={mats.pot}>
          <cylinderGeometry args={[0.07, 0.055, 0.13, 12]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={mats.leaf}>
          <capsuleGeometry args={[0.045, 0.12, 4, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function Plant({ position, mats, scale = 1 }: { position: [number, number, number]; mats: Mats; scale?: number }) {
  const ref = useRef<THREE.Group>(null);
  // Листья растут из земли внутри горшка и тянутся вверх,
  // поэтому не проходят сквозь стенки и не торчат далеко в стороны.
  const leaves = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        rot: (i / 11) * Math.PI * 2 + (i % 2) * 0.3,
        tilt: 0.12 + (i % 3) * 0.14,
        stem: 0.22 + (i % 4) * 0.07,
        base: 0.04 + (i % 3) * 0.035,
      })),
    [],
  );
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 * live.animSpeed) * 0.025;
  });
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={mats.pot}>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 24]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} material={mats.pot}>
        <torusGeometry args={[0.275, 0.03, 8, 28]} />
      </mesh>
      {/* земля */}
      <mesh position={[0, 0.485, 0]} rotation-x={-Math.PI / 2} material={mats.soil}>
        <circleGeometry args={[0.26, 24]} />
      </mesh>
      <group ref={ref} position={[0, 0.49, 0]}>
        {leaves.map((l, i) => (
          <group key={i} rotation={[0, l.rot, 0]}>
            <group position={[0, 0, l.base]} rotation-x={l.tilt}>
              <mesh position={[0, l.stem / 2, 0]} material={mats.leaf}>
                <cylinderGeometry args={[0.008, 0.012, l.stem, 5]} />
              </mesh>
              {/* лист: вытянутый овал, слегка наклонён наружу */}
              <group position={[0, l.stem, 0]} rotation-x={0.35}>
                <mesh position={[0, 0.17, 0]} scale={[0.1, 0.18, 0.022]} castShadow material={i % 2 ? mats.leaf : mats.leaf2}>
                  <sphereGeometry args={[1, 14, 10]} />
                </mesh>
              </group>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

function FloorLamp({ mats }: { mats: Mats }) {
  return (
    <group position={[-3.2, 0, 1.0]}>
      <mesh position={[0, 0.02, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 20]} />
      </mesh>
      <mesh position={[0, 0.8, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.02, 0.02, 1.6, 8]} />
      </mesh>
      <mesh position={[0, 1.65, 0]} material={mats.cushion}>
        <cylinderGeometry args={[0.18, 0.28, 0.32, 20, 1, true]} />
      </mesh>
    </group>
  );
}
