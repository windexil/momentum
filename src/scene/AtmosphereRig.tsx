// Всё, что делает атмосферу: свет из окна, рассеянный свет, лампы,
// небо за окном, луч света с пылью, туман, свечение и виньетка.
// Каждый кадр «живые» параметры подтягиваются к целевым.

import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { audio } from "../audio/engine";
import { useStore } from "../store";
import { DESK, ROOM, WINDOW } from "./Room";
import { live, stepLive } from "./live";

type EffectWithIntensity = { intensity: number };
type VignetteEffectLike = { darkness: number; offset: number };
type BCEffectLike = { contrast: number; brightness: number };
type HSEffectLike = { saturation: number };

export function AtmosphereRig() {
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const floorLamp = useRef<THREE.PointLight>(null);
  const bloom = useRef<EffectWithIntensity>(null);
  const vignette = useRef<VignetteEffectLike>(null);
  const bc = useRef<BCEffectLike>(null);
  const hs = useRef<HSEffectLike>(null);
  const { scene } = useThree();

  const fog = useMemo(() => new THREE.FogExp2("#9cc6e8", 0.01), []);
  const bg = useMemo(() => new THREE.Color("#1b1d26"), []);
  scene.fog = fog;
  scene.background = bg;

  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Color("#6fa8dc") },
          bottom: { value: new THREE.Color("#cfe6ff") },
          sun: { value: new THREE.Color("#fff1dc") },
          sunPos: { value: new THREE.Vector2(0.7, 0.6) },
          night: { value: 0 },
          time: { value: 0 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          varying vec2 vUv; uniform vec3 top; uniform vec3 bottom; uniform vec3 sun; uniform vec2 sunPos; uniform float night; uniform float time;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          void main(){
            vec3 c = mix(bottom, top, smoothstep(0.0, 1.0, vUv.y));
            float d = distance(vUv, sunPos);
            c += sun * (smoothstep(0.16, 0.0, d) * 0.9 + smoothstep(0.6, 0.0, d) * 0.25);
            vec2 g = floor(vUv * vec2(90.0, 60.0));
            float s = step(0.985, hash(g)) * (0.6 + 0.4 * sin(time * 2.0 + hash(g + 1.0) * 40.0));
            c += vec3(s) * night;
            // далёкие холмы / крыши
            float hills = 0.18 + 0.05 * sin(vUv.x * 9.0) + 0.03 * sin(vUv.x * 23.0 + 1.0);
            c = mix(c, bottom * 0.45 + top * 0.15, step(vUv.y, hills) * 0.85);
            gl_FragColor = vec4(c, 1.0);
          }`,
        toneMapped: false,
      }),
    [],
  );

  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color("#fff1dc") }, opacity: { value: 0.2 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform vec3 color; uniform float opacity;
          void main(){ float a = smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x)*(1.0-vUv.y*0.9); gl_FragColor=vec4(color, a*opacity); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const lampShade = useMemo(
    // двусторонний: абажур не «пропадает», когда камера смотрит сверху или сбоку
    () => new THREE.MeshStandardMaterial({ color: "#ffe2b0", emissive: "#ffd9a0", emissiveIntensity: 1.2, roughness: 0.6, side: THREE.DoubleSide }),
    [],
  );
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const { target, preview, phase } = useStore.getState();
    // Во время перелистывания альбома даём «намёк» на атмосферу страницы.
    const goal = phase === "idle" && preview ? preview : target;
    const rate = phase === "listening" ? 0.9 : phase === "unwinding" ? 0.45 : preview ? 1.2 : 0.8;
    stepLive(goal, dt, rate);

    const a = audio.sample();
    live.level = a.level;
    live.bass = a.bass;
    const pulse = 1 + live.level * live.musicReactivity * 0.5;

    // Свет из окна
    const az = THREE.MathUtils.degToRad(live.lightAngle);
    const el = THREE.MathUtils.degToRad(live.lightElevation);
    const k = key.current!;
    k.position.set(WINDOW.x + Math.cos(az) * 4, 1 + Math.sin(el) * 9, -ROOM - 5 - Math.abs(Math.sin(az)) * 2);
    k.target.position.set(WINDOW.x * 0.5, 0, 0.5);
    k.target.updateMatrixWorld();
    k.color.copy(live.keyLightColor);
    k.intensity = live.keyIntensity * (1 - live.night * 0.55) * 2.2;

    const h = hemi.current!;
    h.color.copy(live.ambientColor);
    h.groundColor.copy(live.palette[4]).lerp(tmp.set("#3a2a20"), 0.5);
    h.intensity = live.ambientIntensity * 1.6;

    lamp.current!.color.copy(live.lampColor);
    lamp.current!.intensity = (1.2 + live.night * 4) * pulse * (1 + Math.sin(t * 7) * 0.01);
    floorLamp.current!.color.copy(live.lampColor);
    floorLamp.current!.intensity = (0.6 + live.night * 3.5) * pulse;
    lampShade.emissive.copy(live.lampColor);
    lampShade.emissiveIntensity = 0.6 + live.night * 1.4 + live.level * 0.8;

    // Небо
    sky.uniforms.top.value.copy(live.skyColor).multiplyScalar(0.85);
    sky.uniforms.bottom.value.copy(live.skyColor).lerp(live.keyLightColor, 0.45);
    sky.uniforms.sun.value.copy(live.keyLightColor).multiplyScalar(1 - live.night * 0.4);
    sky.uniforms.sunPos.value.set(0.5 + Math.cos(az) * 0.3, 0.15 + (live.lightElevation / 90) * 0.8);
    sky.uniforms.night.value = live.night;
    sky.uniforms.time.value = t;

    // Луч света из окна
    beamMat.uniforms.color.value.copy(live.keyLightColor);
    beamMat.uniforms.opacity.value = (0.06 + live.haze * 0.22) * (1 - live.night * 0.6) * pulse;

    // Туман и фон
    fog.color.copy(live.skyColor).lerp(live.ambientColor, 0.5).multiplyScalar(0.5 + (1 - live.night) * 0.3);
    fog.density = 0.004 + live.haze * 0.03;
    bg.copy(live.palette[4]).multiplyScalar(0.35 + (1 - live.night) * 0.15);

    // Пост-обработка
    if (bloom.current) bloom.current.intensity = live.glow * (0.8 + live.level * live.musicReactivity * 1.5);
    if (vignette.current) vignette.current.darkness = 0.35 + live.contrast * 0.5;
    if (bc.current) {
      bc.current.contrast = (live.contrast - 0.35) * 0.35;
      bc.current.brightness = -live.night * 0.04;
    }
    if (hs.current) hs.current.saturation = (live.palette[1].getHSL({ h: 0, s: 0, l: 0 }).s - 0.4) * 0.25;
  });

  const beamGeo = useMemo(() => {
    // Трапеция от окна к полу
    const g = new THREE.BufferGeometry();
    const w = WINDOW.w * 0.48, top = WINDOW.y + WINDOW.h / 2 - 0.1, bot = WINDOW.y - WINDOW.h / 2;
    const z0 = -ROOM + 0.02;
    const v = new Float32Array([
      WINDOW.x - w, top, z0, WINDOW.x + w, top, z0, WINDOW.x - w + 0.6, 0.02, z0 + 3.4, WINDOW.x + w + 0.6, 0.02, z0 + 3.4,
      WINDOW.x - w, bot, z0, WINDOW.x + w, bot, z0,
    ]);
    const uv = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1, 0, 0.1, 1, 0.1]);
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex([0, 2, 1, 1, 2, 3, 4, 2, 5, 5, 2, 3]);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <>
      <hemisphereLight ref={hemi} args={["#d9e2ec", "#5a4636", 0.8]} />
      <directionalLight
        ref={key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      {/* настольная лампа */}
      <group position={[DESK.x + 0.88, 0.8, DESK.z - 0.26]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.04, 16]} />
          <meshStandardMaterial color="#3a3a40" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
          <meshStandardMaterial color="#3a3a40" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.42, 0]} material={lampShade}>
          <cylinderGeometry args={[0.1, 0.17, 0.18, 20, 1, true]} />
        </mesh>
        <pointLight ref={lamp} position={[0, 0.35, 0]} distance={5} decay={1.6} castShadow={false} />
      </group>
      <pointLight ref={floorLamp} position={[-3.2, 1.55, 1.0]} distance={5} decay={1.6} />
      <group position={[-3.2, 1.65, 1.0]}>
        <mesh material={lampShade}>
          <cylinderGeometry args={[0.17, 0.27, 0.3, 24, 1, true]} />
        </mesh>
        {/* кант по краям и лампочка внутри */}
        <mesh position={[0, 0.15, 0]} rotation-x={Math.PI / 2} material={lampShade}>
          <torusGeometry args={[0.17, 0.012, 6, 24]} />
        </mesh>
        <mesh position={[0, -0.15, 0]} rotation-x={Math.PI / 2} material={lampShade}>
          <torusGeometry args={[0.27, 0.012, 6, 24]} />
        </mesh>
        <mesh position={[0, -0.04, 0]} material={lampShade}>
          <sphereGeometry args={[0.06, 14, 10]} />
        </mesh>
      </group>
      {/* небо за окном */}
      <mesh position={[WINDOW.x, WINDOW.y, -ROOM - 0.3]} material={sky}>
        <planeGeometry args={[WINDOW.w + 0.5, WINDOW.h + 0.4]} />
      </mesh>
      <mesh geometry={beamGeo} material={beamMat} />
      <EffectComposer multisampling={4}>
        <Bloom ref={bloom as never} intensity={0.4} luminanceThreshold={0.62} luminanceSmoothing={0.3} mipmapBlur />
        <HueSaturation ref={hs as never} saturation={0} />
        <BrightnessContrast ref={bc as never} contrast={0} brightness={0} />
        <Vignette ref={vignette as never} offset={0.28} darkness={0.5} />
      </EffectComposer>
    </>
  );
}
