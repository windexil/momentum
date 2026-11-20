// Связывает звуки комнаты со сценой: следит за персонажем, котом, часами и светом
// и вовремя вызывает sfx. Громкость зависит от расстояния до персонажа,
// лево/право — от того, где источник на экране.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { sfx } from "../audio/roomSfx";
import { useRoom } from "../roomStore";
import { hero } from "./Character";
import { petInfo } from "./Pet";
import { CHAIR, ROOM } from "./Room";
import { props } from "./sceneState";

const CLOCK = new THREE.Vector3(2.7, 2.78, -ROOM);
const RUG_R = 1.5;
const right = new THREE.Vector3();
const rel = new THREE.Vector3();

export function RoomSounds() {
  const camera = useThree((s) => s.camera);
  const st = useRef({
    stepIdx: 0,
    sec: -1,
    lamp: props.lampOn,
    sit: 0,
    lie: 0,
    desk: 0,
    mode: "",
    nextMeow: 25 + Math.random() * 30,
  });

  /** громкость и панорама для точки в комнате */
  const place = (p: THREE.Vector3, base: number, falloff = 0.5) => {
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    rel.subVectors(p, camera.position);
    const pan = rel.lengthSq() > 1e-4 ? rel.normalize().dot(right) * 0.85 : 0;
    const d = Math.hypot(p.x - hero.pos.x, p.z - hero.pos.z);
    return [base / (1 + d * falloff), pan] as const;
  };

  // настольная лампа щёлкает при включении/выключении
  useEffect(
    () =>
      useRoom.subscribe((s, prev) => {
        if (s.deskLamp.on !== prev.deskLamp.on) sfx.click(0.45, 0.2);
      }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    sfx.setDuck(hero.listening ? 0.35 : 1);

    // ---- шаги: каждый раз, когда нога касается пола (полупериод цикла ходьбы)
    const idx = Math.floor(hero.walk / Math.PI);
    if (idx !== s.stepIdx) {
      s.stepIdx = idx;
      if (hero.moveAmt > 0.15 && hero.sit < 0.1 && hero.lie < 0.1) {
        const onRug = Math.hypot(hero.pos.x - CHAIR.x - 0.2, hero.pos.z - CHAIR.z - 0.2) < RUG_R;
        const [v, pan] = place(hero.pos, 0.55 * (0.5 + hero.moveAmt * 0.5));
        sfx.step(onRug, v, pan + (idx % 2 ? 0.08 : -0.08));
      }
    }

    // ---- часы: тик-так раз в секунду
    const sec = Math.floor(performance.now() / 1000);
    if (sec !== s.sec) {
      s.sec = sec;
      const [v, pan] = place(CLOCK, 0.16, 0.35);
      sfx.tick(sec % 2 === 1, v, pan);
    }

    // ---- торшер
    if (props.lampOn !== s.lamp) {
      s.lamp = props.lampOn;
      const [v, pan] = place(hero.pos, 0.5);
      sfx.click(v, pan);
    }

    // ---- кресло, стул, кровать
    const [hv, hpan] = place(hero.pos, 0.6);
    if (hero.sit > 0.6 && s.sit <= 0.6) sfx.sitSoft(hv, hpan);
    if (hero.desk > 0.6 && s.desk <= 0.6) sfx.sitWood(hv, hpan);
    if (hero.lie > 0.3 && s.lie <= 0.3) sfx.rustle(hv, hpan);
    if (hero.lie < 0.7 && s.lie >= 0.7) sfx.rustle(hv * 0.8, hpan);
    s.sit = hero.sit;
    s.desk = hero.desk;
    s.lie = hero.lie;

    // ---- кот
    if (petInfo.present) {
      const [cv, cpan] = place(petInfo.pos, 0.7, 0.45);
      if (petInfo.mode !== s.mode) {
        const was = s.mode;
        s.mode = petInfo.mode;
        if (was) {
          if (petInfo.mode === "called") sfx.meow("meow", cv, cpan);
          else if (petInfo.mode === "petting") sfx.meow("trill", cv * 0.8, cpan);
          else if (petInfo.mode === "petWait") sfx.meow("mew", cv * 0.8, cpan);
        }
      }
      // иногда мяукает сам по себе (но не во сне)
      s.nextMeow -= dt;
      if (s.nextMeow <= 0) {
        s.nextMeow = 40 + Math.random() * 60;
        if (petInfo.mode !== "nap" && petInfo.mode !== "petting") sfx.meow(Math.random() < 0.6 ? "mew" : "meow", cv * 0.8, cpan);
      }
      // мурчит, пока гладят (и ещё немного после)
      sfx.setPurr(petInfo.pet * cv, cpan, performance.now() / 1000);
    }
  });

  return null;
}
