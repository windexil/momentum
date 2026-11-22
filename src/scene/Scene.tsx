import { Canvas, useThree } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import { useQuality, useQualitySettings } from "./quality";
import * as THREE from "three";
import { Album3D } from "./Album3D";
import { AtmosphereRig } from "./AtmosphereRig";
import { Character } from "./Character";
import { CameraFollow, Interact } from "./Interact";
import { Particles } from "./Particles";
import { PhotoStrip } from "./PhotoStrip";
import { Garland } from "./Garland";
import { RoomSounds } from "./RoomSounds";
import { Pet } from "./Pet";
import { Room } from "./Room";
import { Locations } from "./Locations";
import { useStore } from "../store";
import { diag } from "../diag";

export function Scene() {
  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={1}
      camera={{ position: [9.6, 7.9, 9.6], fov: 36, near: 0.1, far: 80 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => {
        // видеокарта может «потеряться» (сбой драйвера) — сообщаем интерфейсу
        const ctx = gl.getContext();
        const ri = ctx.getExtension("WEBGL_debug_renderer_info");
        diag(`GPU: ${ri ? ctx.getParameter(ri.UNMASKED_RENDERER_WEBGL) : "?"}, canvas ${gl.domElement.width}×${gl.domElement.height}`);
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          const info = gl.info;
          diag(`✖ контекст потерян: ${(e as WebGLContextEvent).statusMessage || "без причины"}; кадров ${info.render.frame}, геометрий ${info.memory.geometries}, текстур ${info.memory.textures}, программ ${info.programs?.length ?? "?"}, треугольников ${info.render.triangles}`);
          window.dispatchEvent(new Event("arttech-gl-lost"));
        });
      }}
    >
      <QualityRig />
      <ShadowDiet />
      <FrameLimiter />
      <Suspense fallback={null}>
        <AtmosphereRig />
        <RoomOnly>
          <Room />
          <Album3D />
          <PhotoStrip />
          <Garland />
        </RoomOnly>
        <Locations />
        <RoomSounds />
        <Character />
        <Pet />
        <InRoom>
          <Interact />
        </InRoom>
        <CameraFollow />
        <Particles />
        {import.meta.env.DEV && <DevHandle />}
      </Suspense>
      <OrbitControls
        makeDefault
        target={[0.3, 1.0, 0.1]}
        enablePan={false}
        minDistance={4.5}
        maxDistance={18}
        minPolarAngle={0.55}
        maxPolarAngle={1.25}
        minAzimuthAngle={-0.15}
        maxAzimuthAngle={Math.PI / 2 + 0.15}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}

/** Комната прячется, пока персонаж в локации воспоминания (но не выгружается). */
function RoomOnly({ children }: { children: ReactNode }) {
  const inRoom = useStore((s) => s.place === "room");
  return <group visible={inRoom}>{children}</group>;
}

/** Клики по мебели работают только в комнате. */
function InRoom({ children }: { children: ReactNode }) {
  const inRoom = useStore((s) => s.place === "room");
  return inRoom ? <>{children}</> : null;
}

/**
 * Мелкие предметы (книжки, листики, кнопки) почти не дают заметной тени,
 * а в проходе теней каждый — отдельный вызов отрисовки. Выключаем им тени
 * после загрузки сцены и после каждого переноса в локацию.
 */
function ShadowDiet() {
  const scene = useThree((s) => s.scene);
  const place = useStore((s) => s.place);
  useEffect(() => {
    const sphere = new THREE.Sphere();
    const scale = new THREE.Vector3();
    const prune = () =>
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.castShadow || (m as THREE.InstancedMesh).isInstancedMesh) return;
        const g = m.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        sphere.copy(g.boundingSphere!);
        m.getWorldScale(scale);
        if (sphere.radius * Math.max(scale.x, scale.y, scale.z) < 0.09) m.castShadow = false;
      });
    const ids = [1500, 6000].map((ms) => window.setTimeout(prune, ms));
    return () => ids.forEach((i) => window.clearTimeout(i));
  }, [scene, place]);
  return null;
}

/** Только в режиме разработки: доступ к камере из консоли и тестов. */
function DevHandle() {
  const state = useThree();
  (window as unknown as { __three: unknown }).__three = state;
  return null;
}

/** Подстраивает размер кадра под качество и следит за FPS в режиме «авто». */
function QualityRig() {
  const { dpr } = useQualitySettings();
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, dpr));
  }, [dpr, setDpr]);
  const q = useQuality.getState;
  return (
    <PerformanceMonitor
      bounds={() => [28, 50]}
      flipflops={3}
      onDecline={() => {
        // при открытом дневнике кадров специально меньше — это не повод снижать качество
        if (useStore.getState().panel === "none") q().decline();
      }}
      onIncline={() => q().incline()}
      onFallback={() => useQuality.setState({ autoLevel: "medium" })}
    />
  );
}

/**
 * Не больше 60 кадров в секунду: на мониторах 120–165 Гц это вдвое
 * снижает нагрузку на видеокарту, а глазу разницы почти не видно.
 */
function FrameLimiter() {
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef(0);
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      id = requestAnimationFrame(tick);
      // пока открыт дневник, форма записи или настройки, комната почти не видна —
      // хватит 20 кадров в секунду, видеокарта и процессор отдыхают
      const fps = useStore.getState().panel !== "none" ? 20 : 60;
      if (now - last.current >= 1000 / fps - 2) {
        last.current = now;
        invalidate();
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [invalidate]);
  return null;
}
