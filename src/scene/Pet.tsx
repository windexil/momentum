// Домашний питомец: кот, собака или кролик. Ходит за персонажем,
// во время музыки садится рядом с креслом и реагирует на настроение
// воспоминания (или на настроение, выбранное вручную).

import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { moodOf, useAvatar, type Mood, type PetKind } from "../avatar";
import { useStore } from "../store";
import { hero } from "./Character";
import { CHAIR } from "./Room";
import { live } from "./live";

const SPOT = new THREE.Vector3(CHAIR.x + 1.05, 0, CHAIR.z - 0.45);
const angleTo = (from: number, to: number) => ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const clay = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });

type PetState = Mood | "idle";
const BUBBLE: Record<PetState, string> = { idle: "", happy: "♥", playful: "♪", sleepy: "z z z", sad: "💧" };

export function Pet() {
  const kind = useAvatar((s) => s.avatar.pet);
  if (kind === "none") return null;
  return <PetBody kind={kind} />;
}

function PetBody({ kind }: { kind: Exclude<PetKind, "none"> }) {
  const petColor = useAvatar((s) => s.avatar.petColor);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Group>(null);
  const earR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group[]>([]);
  const [bubble, setBubble] = useState<PetState>("idle");
  const st = useMemo(() => ({ pos: new THREE.Vector3(HOME_OFFSET.x + 1.4, 0, -1.4 + HOME_OFFSET.z), rot: 0, walk: 0, moving: 0, lie: 0, mood: "idle" as PetState }), []);

  const mats = useMemo(
    () => ({
      fur: clay(petColor),
      light: clay("#fff6ea"),
      dark: clay("#2a2224"),
      pink: clay("#ff9fb4"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    mats.fur.color.set(petColor);
  }, [petColor, mats]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const chosen = useAvatar.getState().avatar.petMood;
    const { active } = useStore.getState();
    const nearChair = hero.sub === "listen" || hero.sub === "wear" || hero.sub === "sit" || hero.sub === "turn";
    const mood: PetState = chosen !== "auto" ? chosen : hero.listening ? moodOf(active?.atmosphere) : "idle";
    if (mood !== st.mood) {
      st.mood = mood;
      setBubble(mood);
    }

    // Куда идти
    let target: THREE.Vector3;
    if (nearChair) target = SPOT;
    else {
      // держимся чуть позади и сбоку от персонажа
      tmp.set(-0.55, 0, -0.45).applyAxisAngle(THREE.Object3D.DEFAULT_UP, hero.rot).add(hero.pos);
      target = tmp;
    }
    const d = new THREE.Vector3().subVectors(target, st.pos);
    d.y = 0;
    const dist = d.length();
    let moving = 0;
    if (dist > (nearChair ? 0.05 : 0.35)) {
      const speed = Math.min(2.2, 0.8 + dist * 1.2);
      st.rot += angleTo(st.rot, Math.atan2(d.x, d.z)) * (1 - Math.exp(-8 * dt));
      st.pos.addScaledVector(d.normalize(), Math.min(dist, speed * dt));
      moving = 1;
    } else {
      // смотрим на персонажа
      const look = new THREE.Vector3().subVectors(hero.pos, st.pos);
      st.rot += angleTo(st.rot, Math.atan2(look.x, look.z) + (mood === "playful" ? Math.sin(t * 3) * 0.6 : 0)) * (1 - Math.exp(-4 * dt));
    }
    st.moving += (moving - st.moving) * (1 - Math.exp(-10 * dt));
    st.walk += dt * 14 * st.moving;

    const lying = !moving && mood === "sleepy" ? 1 : 0;
    st.lie += (lying - st.lie) * (1 - Math.exp(-4 * dt));

    // Анимация по настроению
    const beat = t * Math.PI * 2 * (0.8 + live.animSpeed * 0.6);
    let hop = 0, wag = Math.sin(t * 2) * 0.3, headX = 0, earDroop = 0, tilt = 0;
    if (!moving) {
      if (mood === "happy") {
        hop = Math.abs(Math.sin(beat * 0.5)) * (0.06 + live.level * 0.1);
        wag = Math.sin(t * 14) * 0.6;
        tilt = Math.sin(t * 1.5) * 0.15;
      } else if (mood === "playful") {
        hop = Math.abs(Math.sin(beat)) * (0.08 + live.level * 0.12);
        wag = Math.sin(t * 18) * 0.7;
        tilt = Math.sin(beat) * 0.25;
      } else if (mood === "sad") {
        headX = 0.45;
        earDroop = 0.9;
        wag = Math.sin(t * 0.8) * 0.08 - 0.4;
      } else if (mood === "sleepy") {
        headX = 0.2;
        wag = Math.sin(t * 0.6) * 0.1;
      }
    }

    const r = root.current!;
    r.position.set(st.pos.x, hop, st.pos.z);
    r.rotation.y = st.rot;
    body.current!.scale.set(1, 1 - st.lie * 0.3 + Math.sin(t * (mood === "sleepy" ? 1.2 : 2.5)) * 0.02, 1);
    body.current!.position.y = -st.lie * 0.08 + Math.abs(Math.sin(st.walk)) * 0.03 * st.moving;
    body.current!.rotation.z = tilt;
    head.current!.rotation.x = headX + st.lie * 0.35;
    head.current!.rotation.z = tilt * 0.6 + (mood === "idle" ? Math.sin(t * 0.7) * 0.15 : 0);
    tail.current!.rotation.y = wag;
    const droopBase = kind === "dog" ? 0.25 : 0;
    earL.current!.rotation.z = 0.25 + earDroop * 0.8 + droopBase;
    earR.current!.rotation.z = -0.25 - earDroop * 0.8 - droopBase;
    eyes.current!.scale.y = mood === "sleepy" ? 0.15 : (Math.sin(t * 0.9) > 0.985 ? 0.15 : 1);
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = Math.sin(st.walk + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 * st.moving;
    });
  });

  const ears =
    kind === "cat" ? (
      <>
        <group ref={earL} position={[-0.09, 0.12, 0]}>
          <mesh material={mats.fur} position={[0, 0.05, 0]}><coneGeometry args={[0.055, 0.11, 4]} /></mesh>
          <mesh material={mats.pink} position={[0, 0.045, 0.02]} scale={[0.6, 0.65, 0.4]}><coneGeometry args={[0.055, 0.11, 4]} /></mesh>
        </group>
        <group ref={earR} position={[0.09, 0.12, 0]}>
          <mesh material={mats.fur} position={[0, 0.05, 0]}><coneGeometry args={[0.055, 0.11, 4]} /></mesh>
          <mesh material={mats.pink} position={[0, 0.045, 0.02]} scale={[0.6, 0.65, 0.4]}><coneGeometry args={[0.055, 0.11, 4]} /></mesh>
        </group>
      </>
    ) : kind === "dog" ? (
      <>
        <group ref={earL} position={[-0.13, 0.08, 0]}>
          <mesh material={mats.fur} position={[0, -0.07, 0]} scale={[0.45, 1, 0.8]}><sphereGeometry args={[0.08, 12, 10]} /></mesh>
        </group>
        <group ref={earR} position={[0.13, 0.08, 0]}>
          <mesh material={mats.fur} position={[0, -0.07, 0]} scale={[0.45, 1, 0.8]}><sphereGeometry args={[0.08, 12, 10]} /></mesh>
        </group>
      </>
    ) : (
      <>
        <group ref={earL} position={[-0.06, 0.12, 0]}>
          <mesh material={mats.fur} position={[0, 0.12, 0]}><capsuleGeometry args={[0.035, 0.18, 6, 10]} /></mesh>
          <mesh material={mats.pink} position={[0, 0.12, 0.025]} scale={[0.55, 0.85, 0.4]}><capsuleGeometry args={[0.035, 0.18, 6, 10]} /></mesh>
        </group>
        <group ref={earR} position={[0.06, 0.12, 0]}>
          <mesh material={mats.fur} position={[0, 0.12, 0]}><capsuleGeometry args={[0.035, 0.18, 6, 10]} /></mesh>
          <mesh material={mats.pink} position={[0, 0.12, 0.025]} scale={[0.55, 0.85, 0.4]}><capsuleGeometry args={[0.035, 0.18, 6, 10]} /></mesh>
        </group>
      </>
    );

  return (
    <group ref={root}>
      <group ref={body}>
        {/* тело */}
        <mesh position={[0, 0.2, -0.04]} castShadow material={mats.fur} scale={[0.9, 0.85, 1.15]}>
          <sphereGeometry args={[0.16, 20, 16]} />
        </mesh>
        <mesh position={[0, 0.19, 0.06]} material={mats.light} scale={[0.6, 0.65, 0.5]}>
          <sphereGeometry args={[0.15, 16, 12]} />
        </mesh>
        {/* лапки */}
        {[[-0.08, 0.08], [0.08, 0.08], [-0.08, -0.14], [0.08, -0.14]].map(([x, z], i) => (
          <group key={i} ref={(el) => { if (el) legs.current[i] = el; }} position={[x, 0.1, z]}>
            <mesh position={[0, -0.05, 0]} castShadow material={i < 2 ? mats.light : mats.fur}>
              <capsuleGeometry args={[0.04, 0.05, 4, 8]} />
            </mesh>
          </group>
        ))}
        {/* хвост */}
        <group ref={tail} position={[0, 0.22, -0.2]}>
          {kind === "bunny" ? (
            <mesh material={mats.light} position={[0, 0, -0.02]}><sphereGeometry args={[0.06, 12, 10]} /></mesh>
          ) : kind === "cat" ? (
            [0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} material={i === 4 ? mats.light : mats.fur} position={[0, i * 0.05 + Math.sin(i * 0.6) * 0.02, -0.03 - i * 0.03 + i * i * 0.006]}>
                <sphereGeometry args={[0.035 - i * 0.002, 10, 8]} />
              </mesh>
            ))
          ) : (
            <mesh material={mats.fur} position={[0, 0.06, -0.03]} rotation-x={-0.7}><capsuleGeometry args={[0.03, 0.1, 4, 8]} /></mesh>
          )}
        </group>
        {/* голова */}
        <group ref={head} position={[0, 0.4, 0.12]}>
          <mesh castShadow material={mats.fur} scale={[1.1, 1, 1]}>
            <sphereGeometry args={[0.14, 22, 18]} />
          </mesh>
          {/* мордочка */}
          <mesh position={[0, -0.04, 0.1]} material={mats.light} scale={[1, 0.75, kind === "dog" ? 1.1 : 0.7]}>
            <sphereGeometry args={[0.07, 14, 12]} />
          </mesh>
          <mesh position={[0, -0.015, kind === "dog" ? 0.17 : 0.145]} material={kind === "dog" ? mats.dark : mats.pink}>
            <sphereGeometry args={[kind === "dog" ? 0.025 : 0.017, 10, 8]} />
          </mesh>
          <group ref={eyes}>
            {[-0.055, 0.055].map((x) => (
              <mesh key={x} position={[x, 0.025, 0.125]} material={mats.dark} scale={[0.8, 1, 0.5]}>
                <sphereGeometry args={[0.022, 10, 8]} />
              </mesh>
            ))}
          </group>
          {ears}
          {BUBBLE[bubble] && (
            <Html position={[0, 0.32, 0]} center distanceFactor={7} zIndexRange={[5, 0]}>
              <div className={`pet-bubble mood-${bubble}`}>{BUBBLE[bubble]}</div>
            </Html>
          )}
        </group>
      </group>
    </group>
  );
}

const HOME_OFFSET = { x: -0.6, z: 0.4 };
