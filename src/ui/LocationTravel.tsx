// Перенос в локацию воспоминания: когда наушники надеты и музыка пошла,
// экран мягко заливается светом, персонаж с питомцем оказываются там,
// где прошёл день (море, лес, город, зима), и свет расходится.
// Когда воспоминание заканчивается — так же возвращаемся в комнату.

import { useEffect, useState } from "react";
import * as THREE from "three";
import { placeOf, useStore } from "../store";
import { control, SPOTS } from "../scene/heroControl";
import { petCmd } from "../scene/Pet";
import { nearestFree } from "../scene/nav";
import type { Place } from "../atmosphere/types";

/** Где стоит персонаж в локации (локации строятся вокруг начала координат) */
const LOC_HERO = new THREE.Vector3(0, 0, 0);
const LOC_PET = new THREE.Vector3(0.62, 0, -0.18);
const VEIL_MS = 750;

function go(place: Place) {
  const st = useStore.getState();
  if (place === "room") {
    control.teleport = { pos: SPOTS.chairFront.clone(), rot: Math.PI / 4 };
    petCmd.teleport(nearestFree(SPOTS.chairFront.x + 0.6, SPOTS.chairFront.z + 0.2, 0.14));
  } else {
    // лицом к камере
    control.teleport = { pos: LOC_HERO.clone(), rot: Math.PI / 4 };
    petCmd.teleport(LOC_PET);
  }
  st.setPlace(place);
}

export function LocationTravel() {
  const phase = useStore((s) => s.phase);
  const active = useStore((s) => s.active);
  const [veil, setVeil] = useState(false);

  useEffect(() => {
    const { place } = useStore.getState();
    let want: Place | null = null;
    if (phase === "listening" && active && place === "room") want = placeOf(active);
    else if ((phase === "unwinding" || phase === "idle") && place !== "room") want = "room";
    if (!want || want === place) return;
    setVeil(true);
    // таймер не отменяем: перенос должен случиться, даже если фаза уже сменилась
    window.setTimeout(() => {
      const s = useStore.getState();
      // пока экран светлел, воспоминание могли выключить — тогда остаёмся дома
      const target = want !== "room" && s.phase !== "listening" ? "room" : want!;
      if (target !== s.place) go(target);
      window.setTimeout(() => setVeil(false), 120);
    }, VEIL_MS);
  }, [phase, active]);

  return <div className={`travel-veil${veil ? " on" : ""}`} aria-hidden />;
}
