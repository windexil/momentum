// Альбом на столе. Клик открывает книгу (обложка поворачивается)
// и показывает развороты в интерфейсе.

import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoom } from "../roomStore";
import { AlbumBook } from "../ui/AlbumBook";
import { useHeroUI } from "./heroControl";
import * as THREE from "three";
import { useStore } from "../store";
import { DESK } from "./Room";
import { live } from "./live";

/** Кожаная обложка с золотой рамкой и надписью пользователя. */
function drawCover(canvas: HTMLCanvasElement, text: string) {
  const g = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  const grd = g.createRadialGradient(W * 0.45, H * 0.4, 20, W / 2, H / 2, W * 0.75);
  grd.addColorStop(0, "#7a4a2c");
  grd.addColorStop(1, "#3e2516");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // фактура кожи: мелкие пятна и потёртости
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,220,180"},${Math.random() * 0.06})`;
    const r = Math.random() * 2.2;
    g.beginPath();
    g.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgba(0,0,0,.25)";
  g.lineWidth = 10;
  g.strokeRect(5, 5, W - 10, H - 10);
  // тиснёная золотая рамка с уголками
  g.strokeStyle = "#d8b26a";
  g.lineWidth = 3;
  g.strokeRect(34, 34, W - 68, H - 68);
  g.lineWidth = 1.5;
  g.strokeRect(44, 44, W - 88, H - 88);
  g.fillStyle = "#d8b26a";
  for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) {
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    g.fillRect(-9, -9, 18, 18);
    g.restore();
  }
  // орнамент под надписью
  g.beginPath();
  g.moveTo(W * 0.3, H * 0.64);
  g.quadraticCurveTo(W / 2, H * 0.6, W * 0.7, H * 0.64);
  g.stroke();
  // надпись
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 92;
  g.font = `700 ${size}px Caveat, cursive`;
  while (g.measureText(text).width > W - 140 && size > 36) {
    size -= 4;
    g.font = `700 ${size}px Caveat, cursive`;
  }
  g.fillStyle = "rgba(0,0,0,.45)";
  g.fillText(text, W / 2 + 2, H * 0.46 + 3);
  g.fillStyle = "#e9c77f";
  g.fillText(text, W / 2, H * 0.46);
  g.font = "600 22px Nunito, sans-serif";
  g.fillStyle = "rgba(233,199,127,.75)";
  g.fillText("ФОТОАЛЬБОМ  ·  ВОСПОМИНАНИЯ", W / 2, H * 0.74);
}

export function Album3D() {
  const cover = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const open = useStore((s) => s.panel === "album");
  const setPanel = useStore((s) => s.setPanel);
  const phase = useStore((s) => s.phase);
  // за столом альбом листается прямо на столе, а не во всплывающем окне
  const atDesk = useHeroUI((s) => s.pose === "desk");

  const coverText = useRoom((s) => s.coverText);
  const coverTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 620;
    c.height = 460;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => {
    const draw = () => {
      drawCover(coverTex.image as HTMLCanvasElement, coverText || " ");
      coverTex.needsUpdate = true;
    };
    draw();
    // перерисовать, когда догрузится рукописный шрифт
    document.fonts?.ready.then(draw);
  }, [coverText, coverTex]);

  const mats = useMemo(
    () => ({
      cover: new THREE.MeshStandardMaterial({ color: "#4e2f1c", roughness: 0.75 }),
      coverTop: new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.7 }),
      ribbon: new THREE.MeshStandardMaterial({ color: "#8e1f24", roughness: 0.5 }),
      pages: new THREE.MeshStandardMaterial({ color: "#e6d3aa", roughness: 0.95 }),
      gold: new THREE.MeshStandardMaterial({ color: "#e0b25b", roughness: 0.3, metalness: 0.7, emissive: "#e0b25b", emissiveIntensity: 0.1 }),
      glow: new THREE.MeshBasicMaterial({ color: "#ffe2a8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    }),
    [],
  );

  useFrame(({ clock }, dt) => {
    // шарнир справа: обложка поднимается вверх и ложится вправо, не задевая стол
    const target = open ? -Math.PI * 0.96 : 0;
    cover.current!.rotation.z += (target - cover.current!.rotation.z) * (1 - Math.exp(-6 * dt));
    const pulse = phase === "idle" && !open ? 0.25 + Math.sin(clock.elapsedTime * 2.2) * 0.12 : 0;
    mats.glow.opacity += ((hovered ? 0.55 : pulse) - mats.glow.opacity) * (1 - Math.exp(-8 * dt));
    mats.cover.color.set("#4e2f1c").lerp(live.palette[3], 0.08);
  });

  return (
    <group
      position={[DESK.x - 0.22, 0.8, DESK.z + 0.08]}
      rotation-y={-0.15}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 6) return;
        setPanel(open ? "none" : "album");
      }}
    >
      {/* ореол-подсказка */}
      <mesh ref={glow} position={[0, 0.002, 0]} rotation-x={-Math.PI / 2} material={mats.glow}>
        <planeGeometry args={[0.95, 0.75]} />
      </mesh>
      {/* задняя обложка + блок страниц */}
      <mesh position={[0, 0.012, 0]} castShadow material={mats.cover}>
        <boxGeometry args={[0.62, 0.02, 0.46]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow material={mats.pages}>
        <boxGeometry args={[0.59, 0.06, 0.44]} />
      </mesh>
      {/* корешок и обложка на шарнире справа */}
      <mesh position={[0.31, 0.048, 0]} castShadow material={mats.cover}>
        <boxGeometry args={[0.02, 0.095, 0.46]} />
      </mesh>
      <group ref={cover} position={[0.31, 0.087, 0]}>
        <mesh position={[-0.31, 0, 0]} castShadow material={mats.cover}>
          <boxGeometry args={[0.62, 0.02, 0.46]} />
        </mesh>
        {/* кожа с тиснением и надписью */}
        <mesh position={[-0.31, 0.0105, 0]} rotation-x={-Math.PI / 2} material={mats.coverTop}>
          <planeGeometry args={[0.6, 0.445]} />
        </mesh>
        {/* металлические уголки */}
        {[[-0.6, -0.21], [-0.6, 0.21], [-0.02, -0.21], [-0.02, 0.21]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.004, z]} rotation-y={Math.PI / 4} material={mats.gold}>
            <boxGeometry args={[0.05, 0.026, 0.05]} />
          </mesh>
        ))}
        {/* застёжка-ремешок */}
        <mesh position={[-0.6, 0.0, 0]} material={mats.cover}>
          <boxGeometry args={[0.1, 0.03, 0.07]} />
        </mesh>
        <mesh position={[-0.64, 0.004, 0]} material={mats.gold}>
          <boxGeometry args={[0.025, 0.035, 0.05]} />
        </mesh>
      </group>
      {/* лента-закладка свисает из блока страниц */}
      <mesh position={[-0.05, 0.03, 0.24]} rotation-x={0.25} material={mats.ribbon}>
        <boxGeometry args={[0.025, 0.004, 0.12]} />
      </mesh>
      {open && atDesk && (
        <Html transform position={[0.31, 0.1, 0]} rotation-x={-Math.PI / 2} scale={0.029} zIndexRange={[20, 0]}>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <AlbumBook onDesk />
          </div>
        </Html>
      )}
      {hovered && !open && (
        <Html position={[0, 0.35, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
          <div className="tag">Альбом воспоминаний</div>
        </Html>
      )}
    </group>
  );
}
