// Одна постоянная комната в духе «кукольного домика»: две стены, пол,
// окно, кровать, стол, кресло, полки, растения. Геометрия не меняется,
// а акцентные материалы (ковёр, плед, подушки, постеры) мягко
// подкрашиваются палитрой воспоминания.

import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { live } from "./live";
import { props } from "./sceneState";
import { advanceClock, gameClock } from "./dayTime";
import { fabricTextures, plasterTextures, woodTextures } from "./textures";

export const ROOM = 4; // от центра до стен (слева и сзади)
/** Открытые стороны «кукольного домика» чуть дальше: комната шире. */
export const ROOM_X = 5;
export const ROOM_Z = 5;
export const WARDROBE = { x: 4.3, z: -3.64 };
export const WALL_H = 3.4;
export const WINDOW = { x: 0.6, y: 2.0, w: 2.4, h: 1.6 };
export const CHAIR = { x: -1.3, z: 0.9, rot: Math.PI / 4 };
export const SIDE_TABLE = { x: -2.15, z: 1.75 }; // слева от кресла
export const FLOOR_LAMP = { x: -3.6, z: 0.15 }; // между кроватью и полкой, у стены
export const DESK = { x: 2.3, z: -3.35 };

const std = (color: string, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });

type Tex = { map: THREE.Texture; bump: THREE.Texture };
/** Материал с фактурой: карта цвета + лёгкий рельеф. */
const textured = (color: string, rough: number, t: Tex, bump: number) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, map: t.map, bumpMap: t.bump, bumpScale: bump });

export function Room() {
  const mats = useMemo(
    () => ({
      floor: std("#c89f74", 0.7),
      floorDark: std("#a77f57", 0.7),
      wall: textured("#efe3d2", 0.92, plasterTextures(), 1.2),
      wall2: textured("#e6d6c1", 0.92, plasterTextures(), 1.2),
      trim: std("#fbf6ee"),
      wood: textured("#9b6b43", 0.55, woodTextures(11), 0.6),
      woodLight: textured("#c99a6b", 0.55, woodTextures(12), 0.6),
      white: std("#f6f1ea"),
      metal: new THREE.MeshStandardMaterial({ color: "#3a3a40", roughness: 0.35, metalness: 0.6 }),
      leaf: std("#4d8a55"),
      leaf2: std("#6aa86b"),
      pot: std("#d0764f"),
      soil: std("#4a3426", 0.95),
      cactus: std("#5f9a5a"),
      spine: std("#fff6df", 0.5),
      flower: std("#ff7aa8", 0.6),
      pages: std("#f7f0de", 0.95),
      gold: new THREE.MeshStandardMaterial({ color: "#e0b25b", roughness: 0.35, metalness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
      // акценты, следуют палитре
      rug: textured("#c9b79c", 0.97, fabricTextures(), 1.5),
      blanket: textured("#8fa39a", 0.95, fabricTextures(), 1.2),
      cushion: textured("#e9dccb", 0.95, fabricTextures(), 1.2),
      chair: textured("#5d6b73", 0.95, fabricTextures(), 1.2),
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
      <Plant position={[0.85, 0, -3.15]} mats={mats} scale={1.0} />
      <Plant position={[-3.3, 0, 2.9]} mats={mats} scale={0.85} />
      <FloorLamp mats={mats} />
      <Wardrobe mats={mats} />
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
    cactus: THREE.MeshStandardMaterial; spine: THREE.MeshStandardMaterial; flower: THREE.MeshStandardMaterial;
    pages: THREE.MeshStandardMaterial; gold: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial;
    rug: THREE.MeshStandardMaterial; blanket: THREE.MeshStandardMaterial; cushion: THREE.MeshStandardMaterial;
    chair: THREE.MeshStandardMaterial; poster1: THREE.MeshStandardMaterial; poster2: THREE.MeshStandardMaterial;
    books: THREE.MeshStandardMaterial[];
  };
}

function Floor({ mats }: { mats: Mats }) {
  // паркет полосами
  const planks = [];
  const depth = ROOM + ROOM_Z;
  // у каждой доски своя фаза волокон и стыков, чтобы пол не выглядел «штампом»
  const plankMats = useMemo(() => {
    const out: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < (ROOM + ROOM_X) / 0.5; i++) {
      const t = woodTextures(i % 4, true);
      const m = new THREE.MeshStandardMaterial({
        color: (i % 2 ? mats.floor : mats.floorDark).color.clone().offsetHSL(0, 0, ((i * 37) % 7) * 0.006 - 0.018),
        roughness: 0.48 + ((i * 13) % 5) * 0.03,
        map: t.map.clone(),
        bumpMap: t.bump.clone(),
        bumpScale: 0.8,
      });
      for (const tx of [m.map!, m.bumpMap!]) {
        tx.repeat.set(1, 2.6);
        tx.offset.set(0, ((i * 0.618) % 1));
        tx.needsUpdate = true;
      }
      out.push(m);
    }
    return out;
  }, [mats]);
  for (let i = 0; i < (ROOM + ROOM_X) / 0.5; i++) {
    planks.push(
      <mesh key={i} position={[-ROOM + 0.25 + i * 0.5, -0.05, (ROOM_Z - ROOM) / 2]} receiveShadow material={plankMats[i]}>
        <boxGeometry args={[0.49, 0.1, depth]} />
      </mesh>,
    );
  }
  return (
    <group>
      {planks}
      {/* «срез» пола, как у кукольного домика */}
      <mesh position={[(ROOM_X - ROOM) / 2, -0.25, (ROOM_Z - ROOM) / 2]} material={mats.wood}>
        <boxGeometry args={[ROOM + ROOM_X + 0.3, 0.3, ROOM + ROOM_Z + 0.3]} />
      </mesh>
    </group>
  );
}

function Walls({ mats }: { mats: Mats }) {
  const t = 0.2;
  const { x, y, w, h } = WINDOW;
  const left = x - w / 2 + ROOM; // ширина стены слева от окна
  const right = ROOM_X - (x + w / 2);
  return (
    <group>
      {/* задняя стена с проёмом под окно */}
      <group position={[0, 0, -ROOM - t / 2]}>
        <mesh position={[-ROOM + left / 2, WALL_H / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[left, WALL_H, t]} />
        </mesh>
        <mesh position={[ROOM_X - right / 2, WALL_H / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[right, WALL_H, t]} />
        </mesh>
        <mesh position={[x, (y - h / 2) / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[w, y - h / 2, t]} />
        </mesh>
        <mesh position={[x, (WALL_H + y + h / 2) / 2, 0]} receiveShadow castShadow material={mats.wall}>
          <boxGeometry args={[w, WALL_H - y - h / 2, t]} />
        </mesh>
        {/* плинтус */}
        <mesh position={[(ROOM_X - ROOM) / 2, 0.08, t / 2 + 0.02]} material={mats.trim}>
          <boxGeometry args={[ROOM + ROOM_X, 0.16, 0.04]} />
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
        {/* картина над кроватью, часы над лентой со снимками */}
        <Painting position={[-2.85, 2.15, t / 2]} mats={mats} />
        <WallClock position={[2.7, 2.78, t / 2]} mats={mats} />
      </group>
      {/* левая стена */}
      <mesh position={[-ROOM - t / 2, WALL_H / 2, (ROOM_Z - ROOM) / 2]} receiveShadow castShadow material={mats.wall2}>
        <boxGeometry args={[t, WALL_H, ROOM + ROOM_Z + t * 2]} />
      </mesh>
      <mesh position={[-ROOM + 0.02, 0.08, (ROOM_Z - ROOM) / 2]} material={mats.trim}>
        <boxGeometry args={[0.04, 0.16, ROOM + ROOM_Z]} />
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
      {/* книги стоят рядком между двумя подпорками, корешками в комнату */}
      <DeskBooks mats={mats} />
      {/* фигурка ворчливого кота слева от лампы */}
      <DeskCat position={[0.64, 0.795, -0.27]} />
      {/* стул: выдвигается, когда персонаж садится за стол */}
      <DeskChair mats={mats} />
    </group>
  );
}

function DeskBooks({ mats }: { mats: Mats }) {
  const TOP = 0.795;
  const row = [];
  let x = -0.93;
  const sizes = [
    [0.05, 0.24, 0.17], [0.035, 0.21, 0.16], [0.06, 0.26, 0.18], [0.04, 0.22, 0.16],
    [0.03, 0.19, 0.15], [0.055, 0.25, 0.18], [0.045, 0.23, 0.17],
  ];
  for (let i = 0; i < sizes.length; i++) {
    const [w, h, d] = sizes[i];
    x += w / 2;
    // последняя книга чуть завалилась на подпорку
    const lean = i === sizes.length - 1 ? 0.14 : 0;
    row.push(
      // поворот -π/2: корешок (локальный +x книги) смотрит в комнату (+z)
      <group key={i} position={[x + (lean ? 0.012 : 0), TOP, -0.3 + (0.18 - d) / 2]} rotation-y={-Math.PI / 2}>
        <group rotation-x={-lean}>
          <Book w={w} h={h} d={d} cover={mats.books[(i * 3 + 1) % mats.books.length]} mats={mats} />
        </group>
      </group>,
    );
    x += w / 2 + 0.003;
  }
  const end = (px: number) => (
    <group position={[px, TOP, -0.3]}>
      <mesh position={[0, 0.006, 0]} castShadow material={mats.metal}>
        <boxGeometry args={[0.07, 0.012, 0.15]} />
      </mesh>
      <mesh position={[0, 0.09, -0.02]} castShadow material={mats.metal}>
        <boxGeometry args={[0.012, 0.17, 0.11]} />
      </mesh>
    </group>
  );
  return (
    <group>
      {end(-0.94)}
      {row}
      {end(x + 0.03)}
    </group>
  );
}

/** Маленькая керамическая фигурка сидящего хмурого кота. */
function DeskCat({ position }: { position: [number, number, number] }) {
  const m = useMemo(() => {
    const glaze = (color: string, rough = 0.3) =>
      new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.8, clearcoatRoughness: 0.25 });
    return {
      cream: glaze("#efe2cc"),
      mask: glaze("#5b4232"),
      pink: glaze("#d99a95"),
      eye: glaze("#7fb6e6", 0.15),
      dark: glaze("#201814", 0.4),
      base: new THREE.MeshStandardMaterial({ color: "#3e2b1e", roughness: 0.5 }),
    };
  }, []);
  return (
    <group position={position} rotation-y={-0.35}>
      <mesh position={[0, 0.006, 0]} castShadow receiveShadow material={m.base}>
        <cylinderGeometry args={[0.065, 0.068, 0.012, 28]} />
      </mesh>
      <group position={[0, 0.012, 0]}>
        {/* туловище «грушей» */}
        <mesh position={[0, 0.05, -0.005]} scale={[1, 1.12, 0.92]} castShadow material={m.cream}>
          <sphereGeometry args={[0.05, 24, 18]} />
        </mesh>
        {/* передние лапки */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.019, 0.012, 0.036]} scale={[1, 0.8, 1.35]} castShadow material={m.cream}>
            <sphereGeometry args={[0.013, 14, 10]} />
          </mesh>
        ))}
        {/* хвост обвивает лапы */}
        <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, -0.4]} castShadow material={m.mask}>
          <torusGeometry args={[0.048, 0.008, 10, 28, Math.PI * 1.05]} />
        </mesh>
        {/* голова: широкая, чуть приплюснутая */}
        <group position={[0, 0.122, 0.006]}>
          <mesh scale={[1.18, 0.94, 0.96]} castShadow material={m.cream}>
            <sphereGeometry args={[0.045, 26, 20]} />
          </mesh>
          {/* тёмная «маска» мордочки */}
          <mesh position={[0, -0.002, 0.026]} scale={[1.35, 1.0, 0.62]} material={m.mask}>
            <sphereGeometry args={[0.03, 22, 16]} />
          </mesh>
          {/* уши */}
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.031, 0.036, -0.004]} rotation-z={-sx * 0.38}>
              <mesh castShadow material={m.mask}>
                <coneGeometry args={[0.017, 0.032, 14]} />
              </mesh>
              <mesh position={[0, -0.002, 0.008]} scale={[0.6, 0.7, 0.4]} material={m.pink}>
                <coneGeometry args={[0.017, 0.032, 12]} />
              </mesh>
            </group>
          ))}
          {/* щёчки и нос */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.009, -0.014, 0.043]} material={m.cream}>
              <sphereGeometry args={[0.0105, 14, 10]} />
            </mesh>
          ))}
          <mesh position={[0, -0.004, 0.048]} scale={[1.3, 0.8, 1]} material={m.pink}>
            <sphereGeometry args={[0.005, 10, 8]} />
          </mesh>
          {/* светлый подбородок и хмурый рот «дугой вниз» */}
          <mesh position={[0, -0.027, 0.034]} scale={[1.45, 0.75, 0.8]} material={m.cream}>
            <sphereGeometry args={[0.012, 16, 12]} />
          </mesh>
          <mesh position={[0, -0.032, 0.0425]} rotation-x={-0.35} material={m.dark}>
            <torusGeometry args={[0.0105, 0.0014, 6, 18, Math.PI]} />
          </mesh>
          {/* глаза с тяжёлыми веками: внутренние края опущены */}
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.019, 0.011, 0.039]}>
              <mesh scale={[1, 0.75, 0.6]} material={m.eye}>
                <sphereGeometry args={[0.0075, 14, 10]} />
              </mesh>
              <mesh position={[0, 0, 0.003]} scale={[0.35, 0.75, 0.4]} material={m.dark}>
                <sphereGeometry args={[0.0075, 10, 8]} />
              </mesh>
              <mesh position={[0, 0.004, 0.002]} rotation-z={sx * 0.42} material={m.mask}>
                <boxGeometry args={[0.02, 0.006, 0.008]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

function DeskChair({ mats }: { mats: Mats }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.z = 0.75 + props.deskChair;
  });
  return (
    <group>
      <group ref={ref} position={[-0.1, 0, 0.75]}>
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
    </group>
  );
}

function Book({ w, h, d, cover, mats, lean = 0 }: { w: number; h: number; d: number; cover: THREE.Material; mats: Mats; lean?: number }) {
  // Корешок смотрит в комнату (+x), обложки по бокам, блок страниц чуть утоплен
  const c = 0.012;
  return (
    <group rotation-x={lean}>
      <mesh position={[0, h / 2, -w / 2 + c / 2]} castShadow material={cover}>
        <boxGeometry args={[d, h, c]} />
      </mesh>
      <mesh position={[0, h / 2, w / 2 - c / 2]} castShadow material={cover}>
        <boxGeometry args={[d, h, c]} />
      </mesh>
      <mesh position={[d / 2 - c / 2, h / 2, 0]} castShadow material={cover}>
        <boxGeometry args={[c, h, w]} />
      </mesh>
      <mesh position={[-c / 2, h / 2 - 0.006, 0]} material={mats.pages}>
        <boxGeometry args={[d - c * 1.5, h - 0.018, w - c * 2]} />
      </mesh>
      {/* полоски на корешке */}
      <mesh position={[d / 2 + 0.001, h * 0.8, 0]} material={mats.gold}>
        <boxGeometry args={[0.004, 0.012, w * 0.8]} />
      </mesh>
      <mesh position={[d / 2 + 0.001, h * 0.2, 0]} material={mats.gold}>
        <boxGeometry args={[0.004, 0.012, w * 0.8]} />
      </mesh>
    </group>
  );
}

function Shelves({ mats }: { mats: Mats }) {
  const shelf = (y: number, seed: number) => {
    const books = [];
    let z = -0.75;
    for (let i = 0; z < 0.45; i++) {
      const w = 0.07 + ((i * 7 + seed) % 5) * 0.02;
      const h = 0.28 + ((i * 3 + seed) % 4) * 0.05;
      const d = 0.2 + ((i + seed) % 3) * 0.02;
      // последняя книга в ряду чуть наклонена
      const lean = z + w > 0.38 ? 0.22 : 0;
      books.push(
        <group key={i} position={[0, y + 0.025, z + w / 2 + (lean ? 0.04 : 0)]}>
          <Book w={w} h={h} d={d} lean={lean} cover={mats.books[(i + seed) % mats.books.length]} mats={mats} />
        </group>,
      );
      z += w + 0.006;
    }
    // стопка лёжа: видно обрез страниц
    const stack = [0, 1, 2].map((k) => (
      <group key={"s" + k} position={[0, y + 0.025 + k * 0.055, 0.62]} rotation-x={Math.PI / 2} rotation-z={(k - 1) * 0.12}>
        <group position={[0, -0.13, 0]}>
          <Book w={0.05} h={0.26} d={0.19} cover={mats.books[(k * 2 + seed + 1) % mats.books.length]} mats={mats} />
        </group>
      </group>
    ));
    return (
      <group key={y}>
        <mesh position={[0, y, 0]} castShadow receiveShadow material={mats.woodLight}>
          <boxGeometry args={[0.32, 0.05, 1.7]} />
        </mesh>
        {books}
        {seed === 0 && stack}
      </group>
    );
  };
  // колючки кактуса
  const spines = useMemo(() => {
    const out: { p: [number, number, number]; r: [number, number, number] }[] = [];
    for (let row = 0; row < 6; row++)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + (row % 2) * 0.4;
        const y = 0.12 + row * 0.035;
        const rad = row === 5 ? 0.03 : 0.047;
        out.push({ p: [Math.cos(a) * rad, y, Math.sin(a) * rad], r: [0, -a, -Math.PI / 2 + (row === 5 ? 0.6 : 0)] });
      }
    return out;
  }, []);
  return (
    <group position={[-ROOM + 0.17, 0, 1.9]}>
      {shelf(1.5, 0)}
      {shelf(2.2, 2)}
      {/* маленький кактус на полке: рёбра, колючки и цветок */}
      <group position={[0, 2.22, 0.68]}>
        <mesh position={[0, 0.07, 0]} material={mats.pot}>
          <cylinderGeometry args={[0.07, 0.055, 0.13, 12]} />
        </mesh>
        <mesh position={[0, 0.135, 0]} rotation-x={-Math.PI / 2} material={mats.soil}>
          <circleGeometry args={[0.065, 12]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={mats.cactus}>
          <capsuleGeometry args={[0.045, 0.12, 4, 10]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh key={k} position={[Math.cos((k / 6) * Math.PI * 2) * 0.04, 0.2, Math.sin((k / 6) * Math.PI * 2) * 0.04]} material={mats.leaf}>
            <capsuleGeometry args={[0.012, 0.12, 3, 6]} />
          </mesh>
        ))}
        {spines.map((sp, i) => (
          <mesh key={i} position={sp.p} rotation={sp.r} material={mats.spine}>
            <coneGeometry args={[0.004, 0.028, 4]} />
          </mesh>
        ))}
        <mesh position={[0, 0.275, 0]} material={mats.flower}>
          <sphereGeometry args={[0.018, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

function Wardrobe({ mats }: { mats: Mats }) {
  const W = 1.3, H = 2.3, D = 0.68;
  return (
    <group position={[WARDROBE.x, 0, WARDROBE.z]}>
      <mesh position={[0, H / 2 + 0.06, 0]} castShadow receiveShadow material={mats.wood}>
        <boxGeometry args={[W, H, D]} />
      </mesh>
      {/* карниз и цоколь */}
      <mesh position={[0, H + 0.09, 0.01]} castShadow material={mats.woodLight}>
        <boxGeometry args={[W + 0.08, 0.06, D + 0.06]} />
      </mesh>
      <mesh position={[0, 0.03, 0.01]} material={mats.woodLight}>
        <boxGeometry args={[W - 0.06, 0.06, D - 0.04]} />
      </mesh>
      {/* две дверцы с филёнками и ручками */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (W / 4), 0, D / 2]}>
          <mesh position={[0, 1.36, 0.012]} castShadow material={mats.woodLight}>
            <boxGeometry args={[W / 2 - 0.05, 1.7, 0.025]} />
          </mesh>
          <mesh position={[0, 1.62, 0.028]} material={mats.wood}>
            <boxGeometry args={[W / 2 - 0.2, 0.9, 0.01]} />
          </mesh>
          <mesh position={[0, 0.85, 0.028]} material={mats.wood}>
            <boxGeometry args={[W / 2 - 0.2, 0.45, 0.01]} />
          </mesh>
          <mesh position={[-s * (W / 4 - 0.07), 1.3, 0.05]} material={mats.metal}>
            <sphereGeometry args={[0.025, 10, 8]} />
          </mesh>
        </group>
      ))}
      {/* выдвижной ящик внизу */}
      <mesh position={[0, 0.3, D / 2 + 0.012]} castShadow material={mats.woodLight}>
        <boxGeometry args={[W - 0.08, 0.36, 0.025]} />
      </mesh>
      <mesh position={[0, 0.3, D / 2 + 0.04]} rotation-z={Math.PI / 2} material={mats.metal}>
        <capsuleGeometry args={[0.012, 0.16, 4, 8]} />
      </mesh>
      {/* коробка и плюшевый мяч наверху */}
      <mesh position={[-0.25, H + 0.24, 0]} rotation-y={0.2} castShadow material={mats.cushion}>
        <boxGeometry args={[0.45, 0.24, 0.4]} />
      </mesh>
      <mesh position={[0.3, H + 0.22, 0.05]} castShadow material={mats.poster2}>
        <sphereGeometry args={[0.1, 16, 12]} />
      </mesh>
    </group>
  );
}

function makePaintingTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 360;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, "#f6c8a6");
  sky.addColorStop(0.55, "#f9e2c2");
  sky.addColorStop(1, "#cfe0dc");
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 360);
  g.fillStyle = "#fff4d6";
  g.beginPath();
  g.arc(360, 120, 46, 0, Math.PI * 2);
  g.fill();
  const hill = (y: number, amp: number, color: string, ph: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 360);
    for (let x = 0; x <= 512; x += 8) g.lineTo(x, y + Math.sin(x / 70 + ph) * amp + Math.sin(x / 31 + ph * 2) * amp * 0.3);
    g.lineTo(512, 360);
    g.fill();
  };
  hill(205, 22, "#a7c3b6", 0.4);
  hill(245, 18, "#7fa58f", 1.7);
  hill(290, 14, "#5e8a6e", 3.1);
  // мазки, будто масло
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 512, Math.random() * 360, 10 + Math.random() * 18, 2 + Math.random() * 3);
  }
  // домик и дерево
  g.fillStyle = "#d9775a";
  g.fillRect(120, 250, 38, 28);
  g.beginPath();
  g.moveTo(114, 252);
  g.lineTo(139, 230);
  g.lineTo(164, 252);
  g.fill();
  g.fillStyle = "#3f5d4a";
  g.beginPath();
  g.arc(205, 250, 18, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Painting({ position, mats }: { position: [number, number, number]; mats: Mats }) {
  const art = useMemo(() => new THREE.MeshStandardMaterial({ map: makePaintingTexture(), roughness: 0.8 }), []);
  const W = 1.3, H = 0.92;
  return (
    <group position={position}>
      {/* рама */}
      <mesh position={[0, 0, 0.03]} castShadow material={mats.woodLight}>
        <boxGeometry args={[W + 0.14, H + 0.14, 0.06]} />
      </mesh>
      <mesh position={[0, 0, 0.061]} material={mats.white}>
        <planeGeometry args={[W + 0.02, H + 0.02]} />
      </mesh>
      <mesh position={[0, 0, 0.063]} material={art}>
        <planeGeometry args={[W - 0.08, H - 0.08]} />
      </mesh>
    </group>
  );
}

function WallClock({ position, mats }: { position: [number, number, number]; mats: Mats }) {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  const second = useRef<THREE.Group>(null);
  useFrame(() => {
    // реальное время
    // время комнаты: от него зависят солнце и небо (dayTime.ts)
    const total = gameClock.hours;
    const h = total % 12;
    const m = (total * 60) % 60;
    const s = (total * 3600) % 60;
    second.current!.rotation.z = -(s / 60) * Math.PI * 2;
    minute.current!.rotation.z = -(m / 60) * Math.PI * 2;
    hour.current!.rotation.z = -(h / 12) * Math.PI * 2;
  });
  const R = 0.34;
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        advanceClock(1);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0, 0.035]} rotation-x={Math.PI / 2} castShadow material={mats.wood}>
        <cylinderGeometry args={[R + 0.04, R + 0.04, 0.07, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.071]} material={mats.white}>
        <circleGeometry args={[R, 40]} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const big = i % 3 === 0;
        return (
          <mesh key={i} position={[Math.sin(a) * (R - 0.05), Math.cos(a) * (R - 0.05), 0.074]} rotation-z={-a} material={mats.metal}>
            <boxGeometry args={[big ? 0.022 : 0.012, big ? 0.06 : 0.035, 0.004]} />
          </mesh>
        );
      })}
      <group ref={hour} position={[0, 0, 0.078]}>
        <mesh position={[0, 0.08, 0]} material={mats.metal}>
          <boxGeometry args={[0.024, 0.17, 0.006]} />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.083]}>
        <mesh position={[0, 0.12, 0]} material={mats.metal}>
          <boxGeometry args={[0.016, 0.25, 0.006]} />
        </mesh>
      </group>
      <group ref={second} position={[0, 0, 0.088]}>
        <mesh position={[0, 0.1, 0]} material={mats.pot}>
          <boxGeometry args={[0.006, 0.26, 0.004]} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.092]} material={mats.pot}>
        <circleGeometry args={[0.018, 16]} />
      </mesh>
      {/* стекло */}
      <mesh position={[0, 0, 0.095]} material={mats.glass}>
        <circleGeometry args={[R, 40]} />
      </mesh>
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
    <group position={[FLOOR_LAMP.x, 0, FLOOR_LAMP.z]}>
      <mesh position={[0, 0.02, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 20]} />
      </mesh>
      <mesh position={[0, 0.8, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.02, 0.02, 1.6, 8]} />
      </mesh>
      {/* держатель абажура; сам светящийся абажур — в AtmosphereRig */}
      <mesh position={[0, 1.62, 0]} material={mats.metal}>
        <torusGeometry args={[0.05, 0.008, 6, 16]} />
      </mesh>
    </group>
  );
}
