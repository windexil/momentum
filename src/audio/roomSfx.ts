// Звуки комнаты: шаги, часы, щелчки выключателей, кресло и кровать, кот (мяу и мурчание).
// Всё синтезируется на лету через Web Audio — никаких файлов, сайт не тяжелеет.
// Свой AudioContext, отдельный от музыки: звуки комнаты не влияют на «дыхание» света и пылинок.

import { create } from "zustand";

const KEY = "arttech-sfx";

function loadOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** Включены ли звуки комнаты (кнопка в шапке). */
export const useSfx = create<{ on: boolean; toggle: () => void }>((set, get) => ({
  on: loadOn(),
  toggle() {
    const on = !get().on;
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* приватный режим — просто не запоминаем */
    }
    set({ on });
    sfx.setEnabled(on);
  },
}));

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

class RoomSfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private purr: { gain: GainNode; pan: StereoPannerNode } | null = null;
  private duck = 1;
  private enabled = loadOn();

  /** Браузер даёт звук только после действия пользователя — создаём контекст по первому клику. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.enabled ? 1 : 0;
      // мягкий компрессор, чтобы мяу рядом с камерой не било по ушам
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      this.out.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === "running" && this.enabled;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(on ? this.duck : 0, this.ctx.currentTime, 0.05);
  }

  /** Во время воспоминания звуки комнаты приглушаются, чтобы не мешать музыке. */
  setDuck(k: number) {
    if (Math.abs(k - this.duck) < 0.01 || !this.out || !this.ctx) return;
    this.duck = k;
    if (this.enabled) this.out.gain.setTargetAtTime(k, this.ctx.currentTime, 0.4);
  }

  // ---------- строительные блоки ----------

  private chain(vol: number, pan: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.out!);
    return g;
  }

  /** Короткий всплеск шума через фильтр. */
  private burst(dest: AudioNode, t: number, o: { type: BiquadFilterType; f: number; q?: number; dur: number; peak: number; attack?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rnd(0.8, 1.2);
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.value = o.f;
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + a + o.dur + 0.05);
  }

  private tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- звуки ----------

  /** Шаг: по дереву — стук каблука и скрип доски, по ковру — глухо. */
  step(soft: boolean, vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.005;
    const d = this.chain(vol, pan);
    if (soft) {
      this.burst(d, t, { type: "lowpass", f: rnd(380, 520), dur: 0.12, peak: 0.5, attack: 0.012 });
      this.tone(d, t, "sine", 75, 45, 0.08, 0.25);
    } else {
      this.burst(d, t, { type: "bandpass", f: rnd(750, 1100), q: 1.3, dur: 0.08, peak: 0.55 });
      this.burst(d, t + 0.012, { type: "highpass", f: 2500, dur: 0.03, peak: 0.12 });
      this.tone(d, t, "sine", rnd(105, 125), 55, 0.09, 0.45);
    }
  }

  /** Тик-так настенных часов. */
  tick(tock: boolean, vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.005;
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "highpass", f: tock ? 2600 : 3400, dur: 0.018, peak: 0.6, attack: 0.001 });
    this.tone(d, t, "triangle", tock ? 1750 : 2300, tock ? 1600 : 2100, 0.03, 0.25);
  }

  /** Щелчок выключателя. */
  click(vol = 0.5, pan = 0) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.005;
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "bandpass", f: 2800, q: 2, dur: 0.012, peak: 0.9, attack: 0.001 });
    this.burst(d, t + 0.045, { type: "bandpass", f: 1900, q: 2, dur: 0.015, peak: 0.6, attack: 0.001 });
    this.tone(d, t, "sine", 180, 90, 0.03, 0.2);
  }

  /** Садимся в мягкое кресло: «пфф» подушки и лёгкий скрип. */
  sitSoft(vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.005;
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "lowpass", f: 650, dur: 0.35, peak: 0.6, attack: 0.05 });
    this.creak(d, t + 0.12, 0.35, 0.18);
  }

  /** Деревянный стул за столом. */
  sitWood(vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.005;
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "bandpass", f: 500, q: 1.5, dur: 0.1, peak: 0.9 });
    this.creak(d, t + 0.05, 0.45, 0.6);
  }

  private creak(dest: AudioNode, t: number, dur: number, peak: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f0 = rnd(95, 130);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * rnd(0.75, 0.9), t + dur);
    // дрожание скрипа
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rnd(28, 40);
    const lg = ctx.createGain();
    lg.gain.value = f0 * 0.12;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = rnd(650, 900);
    f.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** Шорох одеяла. */
  rustle(vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.005;
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "bandpass", f: 1800, q: 0.6, dur: 0.5, peak: 0.35, attack: 0.15 });
    this.burst(d, t + 0.35, { type: "bandpass", f: 1300, q: 0.6, dur: 0.45, peak: 0.25, attack: 0.1 });
    this.burst(d, t + 0.1, { type: "lowpass", f: 300, dur: 0.3, peak: 0.4, attack: 0.05 });
  }

  /**
   * Мяу котёнка: голосовой источник (пила) с подвижной высотой
   * и два форманта, которые «открывают рот»: и → а → у.
   */
  meow(kind: "meow" | "mew" | "trill", vol: number, pan: number) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.01;
    const d = this.chain(vol, pan);
    const dur = kind === "meow" ? rnd(0.55, 0.8) : kind === "mew" ? rnd(0.22, 0.32) : rnd(0.35, 0.45);
    const base = rnd(560, 700) * (kind === "mew" ? 1.15 : 1);

    const src = ctx.createOscillator();
    src.type = "sawtooth";
    const f = src.frequency;
    f.setValueAtTime(base * 0.85, t);
    f.linearRampToValueAtTime(base * 1.3, t + dur * 0.3);
    f.linearRampToValueAtTime(base * 1.15, t + dur * 0.6);
    f.linearRampToValueAtTime(base * 0.7, t + dur);
    // лёгкое вибрато — живой голос
    const vib = ctx.createOscillator();
    vib.frequency.value = rnd(5, 7);
    const vg = ctx.createGain();
    vg.gain.value = base * 0.02;
    vib.connect(vg).connect(f);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(0.55, t + 0.05);
    amp.gain.setValueAtTime(0.55, t + dur * 0.7);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    // «мррр» в начале трели: дрожание громкости
    if (kind === "trill") {
      const tr = ctx.createOscillator();
      tr.frequency.value = 28;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.4, t);
      tg.gain.linearRampToValueAtTime(0, t + dur * 0.55);
      tr.connect(tg).connect(amp.gain);
      tr.start(t);
      tr.stop(t + dur + 0.05);
    }

    const mix = ctx.createGain();
    mix.gain.value = 0.7;
    const formants: [number, number, number, number, number][] = [
      // f(и), f(а), f(у), Q, громкость
      [500, 1000, 450, 6, 1],
      [2300, 1600, 900, 8, 0.6],
      [3500, 3000, 2600, 10, 0.25],
    ];
    for (const [fi, fa, fu, q, lv] of formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = q;
      bp.frequency.setValueAtTime(fi, t);
      bp.frequency.linearRampToValueAtTime(fa, t + dur * 0.35);
      bp.frequency.linearRampToValueAtTime(kind === "mew" ? fa : fu, t + dur);
      const g = ctx.createGain();
      g.gain.value = lv * 2.2;
      amp.connect(bp).connect(g).connect(mix);
    }
    // немного дыхания
    this.burst(mix, t, { type: "highpass", f: 3000, dur: dur * 0.8, peak: 0.04, attack: 0.05 });
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4200;
    src.connect(amp);
    mix.connect(lp).connect(d);
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  /** Мурчание: низкий шум, «пульсирующий» ~26 раз в секунду. Громкость задаётся каждый кадр. */
  setPurr(level: number, pan: number, time: number) {
    if (!this.ctx || !this.out) return;
    const ctx = this.ctx;
    if (!this.purr) {
      if (level <= 0.001) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 320;
      lp.Q.value = 2;
      const body = ctx.createGain();
      body.gain.value = 0.6;
      // пульс мурчания
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 26;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg).connect(body.gain);
      // низкий гул в такт
      const hum = ctx.createOscillator();
      hum.frequency.value = 52;
      const hg = ctx.createGain();
      hg.gain.value = 0.25;
      hum.connect(hg).connect(body);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      src.connect(lp).connect(body).connect(gain).connect(pan).connect(this.out);
      src.start();
      lfo.start();
      hum.start();
      this.purr = { gain, pan };
    }
    // вдох-выдох: на выдохе мурчание громче и чуть ниже
    const breath = 0.55 + 0.45 * Math.pow(Math.sin((time * Math.PI) / 1.8), 2);
    const now = ctx.currentTime;
    this.purr.gain.gain.setTargetAtTime(this.enabled ? level * breath * 1.6 : 0, now, 0.08);
    this.purr.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.1);
  }
}

export const sfx = new RoomSfx();
if (import.meta.env.DEV) (window as unknown as { __sfx: unknown }).__sfx = sfx;

// первый жест пользователя включает звук
if (typeof window !== "undefined") {
  const go = () => sfx.unlock();
  window.addEventListener("pointerdown", go, { capture: true });
  window.addEventListener("keydown", go, { capture: true });
}
