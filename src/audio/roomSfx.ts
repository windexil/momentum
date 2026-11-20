// Звуки комнаты: шаги, часы, щелчки выключателей, кресло и кровать, голоса питомцев.
// Всё синтезируется на лету через Web Audio — никаких файлов, сайт не тяжелеет.
// Свой AudioContext, отдельный от музыки: звуки комнаты не влияют на «дыхание» света и пылинок.
// Общий принцип — мягко: плавные атаки, срезанные верха, негромко.

import { create } from "zustand";
import type { PetKind } from "../avatar";

const KEY = "arttech-sfx";
export type Pet = Exclude<PetKind, "none">;

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
const MASTER = 0.7;

/** Простой однополюсный фильтр нижних частот — для заготовки буферов. */
function lowpass(d: Float32Array, k: number) {
  let y = 0;
  for (let i = 0; i < d.length; i++) d[i] = y += (d[i] - y) * k;
}

class RoomSfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private loop: { kind: Pet; gain: GainNode; pan: StereoPannerNode; src: AudioBufferSourceNode } | null = null;
  private duck = 1;
  private enabled = loadOn();

  /** Браузер даёт звук только после действия пользователя — создаём контекст по первому клику. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.setup(new AC());
    }
    if (this.ctx!.state === "suspended") void this.ctx!.resume();
  }

  /** Отдельно, чтобы можно было отрендерить звуки в OfflineAudioContext для проверки. */
  setup(ctx: BaseAudioContext) {
    this.ctx = ctx as AudioContext;
    this.loop = null;
    this.out = ctx.createGain();
    this.out.gain.value = this.enabled ? MASTER : 0;
    // общий «тёплый» фильтр: никаких резких верхов
    const warm = ctx.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 5200;
    warm.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    this.out.connect(warm).connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, len);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === "running" && this.enabled;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(on ? MASTER * this.duck : 0, this.ctx.currentTime, 0.05);
  }

  /** Во время воспоминания звуки комнаты приглушаются, чтобы не мешать музыке. */
  setDuck(k: number) {
    if (Math.abs(k - this.duck) < 0.01 || !this.out || !this.ctx) return;
    this.duck = k;
    if (this.enabled) this.out.gain.setTargetAtTime(MASTER * k, this.ctx.currentTime, 0.4);
  }

  // ---------- строительные блоки ----------

  private chain(vol: number, pan: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan)) * 0.7;
    g.connect(p).connect(this.out!);
    return g;
  }

  /** Короткий всплеск шума через фильтр, с плавной атакой и затуханием. */
  private burst(dest: AudioNode, t: number, o: { type: BiquadFilterType; f: number; q?: number; dur: number; peak: number; attack?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rnd(0.85, 1.15);
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.value = o.f * rnd(0.9, 1.1);
    f.Q.value = o.q ?? 0.7;
    const g = ctx.createGain();
    const a = o.attack ?? 0.008;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.peak, t + a);
    g.gain.setTargetAtTime(0, t + a, o.dur / 3);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + a + o.dur * 1.5);
  }

  /** Мягкий тон (синус/треугольник) со скольжением высоты. */
  private tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.01) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, dur / 3);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur * 1.5);
  }

  private now() {
    return this.ctx!.currentTime + 0.01;
  }

  // ---------- комната ----------

  /** Шаг: по дереву — мягкий глухой «тук», по ковру — едва слышно. */
  step(soft: boolean, vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.now();
    const d = this.chain(vol, pan);
    if (soft) {
      this.burst(d, t, { type: "lowpass", f: 320, dur: 0.1, peak: 0.25, attack: 0.02 });
    } else {
      this.burst(d, t, { type: "lowpass", f: rnd(600, 800), dur: 0.07, peak: 0.35, attack: 0.006 });
      this.tone(d, t, "sine", rnd(95, 115), 60, 0.07, 0.25, 0.005);
    }
  }

  /** Тик-так настенных часов: деревянный, приглушённый. */
  tick(tock: boolean, vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.now();
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "bandpass", f: tock ? 1300 : 1600, q: 2, dur: 0.02, peak: 0.5, attack: 0.002 });
    this.tone(d, t, "sine", tock ? 900 : 1100, tock ? 850 : 1050, 0.025, 0.15, 0.002);
  }

  /** Щелчок выключателя: мягкий «тык». */
  click(vol = 0.5, pan = 0) {
    if (!this.ready) return;
    const t = this.now();
    const d = this.chain(vol * 0.7, pan);
    this.burst(d, t, { type: "bandpass", f: 1500, q: 1.2, dur: 0.015, peak: 0.6, attack: 0.002 });
    this.burst(d, t + 0.05, { type: "bandpass", f: 1100, q: 1.2, dur: 0.02, peak: 0.35, attack: 0.002 });
  }

  /** Садимся в мягкое кресло: тихое «пфф» подушки. */
  sitSoft(vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.now();
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "lowpass", f: 500, dur: 0.35, peak: 0.45, attack: 0.07 });
  }

  /** Деревянный стул: глухой стук ножек. */
  sitWood(vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.now();
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "lowpass", f: 700, dur: 0.08, peak: 0.4, attack: 0.005 });
    this.tone(d, t, "sine", 140, 90, 0.08, 0.25, 0.004);
    this.burst(d, t + 0.09, { type: "lowpass", f: 600, dur: 0.06, peak: 0.2, attack: 0.005 });
  }

  /** Шорох одеяла. */
  rustle(vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.now();
    const d = this.chain(vol, pan);
    this.burst(d, t, { type: "bandpass", f: 1100, q: 0.5, dur: 0.45, peak: 0.18, attack: 0.18 });
    this.burst(d, t + 0.3, { type: "bandpass", f: 850, q: 0.5, dur: 0.4, peak: 0.12, attack: 0.15 });
  }

  // ---------- питомцы ----------

  /**
   * Голос питомца на событие:
   * call — позвали, greet — подошли погладить, idle — сам по себе.
   */
  petVoice(kind: Pet, ev: "call" | "greet" | "idle", vol: number, pan: number) {
    if (!this.ready) return;
    const t = this.now();
    const d = this.chain(vol, pan);
    if (kind === "cat") {
      if (ev === "call") this.meow(d, t, rnd(0.5, 0.65), rnd(400, 450), true);
      else if (ev === "greet") this.trill(d, t);
      else this.meow(d, t, rnd(0.28, 0.36), rnd(430, 480), false);
    } else if (kind === "dog") {
      if (ev === "call") {
        this.boof(d, t);
        this.boof(d, t + rnd(0.28, 0.34), 0.75);
      } else if (ev === "greet") this.whine(d, t);
      else this.huff(d, t);
    } else {
      // кролики почти не издают звуков: шмыгают носом и мягко прыгают
      if (ev === "call") {
        this.thump(d, t);
        this.thump(d, t + 0.22, 0.8);
        this.sniff(d, t + 0.45, 3);
      } else this.sniff(d, t, ev === "greet" ? 4 : 3);
    }
  }

  /**
   * Мягкое «мяу»: голос из треугольника с примесью приглушённой пилы,
   * широкие форманты «и → а → у», низкий тон без писка.
   */
  private meow(d: AudioNode, t: number, dur: number, base: number, full: boolean) {
    const ctx = this.ctx!;
    const voice = ctx.createGain();
    const mkOsc = (type: OscillatorType, lvl: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      const f = o.frequency;
      f.setValueAtTime(base * 0.9, t);
      f.linearRampToValueAtTime(base * 1.18, t + dur * 0.35);
      f.linearRampToValueAtTime(base * (full ? 0.82 : 1.05), t + dur);
      const g = ctx.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(voice);
      o.start(t);
      o.stop(t + dur + 0.3);
      return o;
    };
    const tri = mkOsc("triangle", 0.8);
    const saw = mkOsc("sawtooth", 0.18);
    // лёгкое вибрато
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = base * 0.012;
    vib.connect(vg);
    vg.connect(tri.frequency);
    vg.connect(saw.frequency);
    vib.start(t);
    vib.stop(t + dur + 0.3);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.3, t + 0.09);
    amp.gain.setValueAtTime(0.3, t + dur * 0.6);
    amp.gain.linearRampToValueAtTime(0, t + dur + 0.12);
    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 2200;
    voice.connect(soft).connect(amp);

    const mix = ctx.createGain();
    mix.gain.value = 0.9;
    // прямой мягкий голос + два широких форманта
    amp.connect(mix);
    const formants: [number, number, number, number][] = [
      [600, 950, 500, 1.4],
      [1700, 1350, 850, 0.7],
    ];
    for (const [fi, fa, fu, lv] of formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(fi, t);
      bp.frequency.linearRampToValueAtTime(fa, t + dur * 0.35);
      bp.frequency.linearRampToValueAtTime(full ? fu : fa, t + dur);
      const g = ctx.createGain();
      g.gain.value = lv;
      amp.connect(bp).connect(g).connect(mix);
    }
    mix.connect(d);
  }

  /** Кошачье «мрр?» — тихая трель с вопросительной интонацией. */
  private trill(d: AudioNode, t: number) {
    const ctx = this.ctx!;
    const dur = 0.38;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(330, t);
    o.frequency.linearRampToValueAtTime(420, t + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.25, t + 0.06);
    amp.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    // «ррр» — мягкое дрожание громкости
    const tr = ctx.createOscillator();
    tr.frequency.value = 24;
    const tg = ctx.createGain();
    tg.gain.value = 0.2;
    tr.connect(tg).connect(amp.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    o.connect(lp).connect(amp).connect(d);
    o.start(t);
    tr.start(t);
    o.stop(t + dur + 0.2);
    tr.stop(t + dur + 0.2);
  }

  /** Собачье приглушённое «буф». */
  private boof(d: AudioNode, t: number, k = 1) {
    this.tone(d, t, "triangle", rnd(210, 240), 150, 0.13, 0.45 * k, 0.015);
    this.burst(d, t, { type: "bandpass", f: 600, q: 0.8, dur: 0.12, peak: 0.25 * k, attack: 0.015 });
    this.burst(d, t, { type: "lowpass", f: 300, dur: 0.1, peak: 0.3 * k, attack: 0.01 });
  }

  /** Радостное поскуливание — низкое и короткое, не визг. */
  private whine(d: AudioNode, t: number) {
    const ctx = this.ctx!;
    const dur = 0.5;
    const o = ctx.createOscillator();
    o.type = "sine";
    const f = o.frequency;
    f.setValueAtTime(480, t);
    f.linearRampToValueAtTime(600, t + dur * 0.4);
    f.linearRampToValueAtTime(470, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.08);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(d);
    o.start(t);
    o.stop(t + dur + 0.1);
    this.burst(d, t, { type: "bandpass", f: 900, q: 0.8, dur: 0.3, peak: 0.06, attack: 0.08 });
  }

  /** Собака вздыхает «пфф» носом. */
  private huff(d: AudioNode, t: number) {
    this.burst(d, t, { type: "bandpass", f: 700, q: 0.6, dur: 0.35, peak: 0.25, attack: 0.04 });
  }

  /** Мягкий прыжок кролика. */
  private thump(d: AudioNode, t: number, k = 1) {
    this.tone(d, t, "sine", 85, 55, 0.08, 0.35 * k, 0.004);
    this.burst(d, t, { type: "lowpass", f: 250, dur: 0.06, peak: 0.25 * k, attack: 0.004 });
  }

  /** Кролик шмыгает носом: несколько тихих коротких вдохов. */
  private sniff(d: AudioNode, t: number, n: number) {
    for (let i = 0; i < n; i++) this.burst(d, t + i * rnd(0.09, 0.12), { type: "bandpass", f: 2200, q: 1.2, dur: 0.04, peak: 0.12, attack: 0.012 });
  }

  // ---------- звук, пока питомца гладят ----------

  /**
   * Заранее собираем петлю:
   * кот — мурчание: ~25 мягких «толчков» в секунду, на вдохе тише, на выдохе ниже и громче;
   * собака — довольное частое дыхание;
   * кролик — тихое «зубное мурчание» (мелкое пощёлкивание).
   */
  private loopBuffer(kind: Pet) {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * (kind === "cat" ? 3.4 : kind === "dog" ? 1.6 : 2));
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    if (kind === "cat") {
      const inhale = 1.3; // сек
      let t = 0.02;
      while (t < len / sr - 0.05) {
        const exh = t > inhale;
        const ph = exh ? (t - inhale) / (len / sr - inhale) : t / inhale;
        const env = Math.sin(Math.PI * Math.min(1, ph)) ** 0.6 * (exh ? 1 : 0.55);
        const rate = exh ? 23 : 26;
        // один «толчок»: короткая мягкая волна низкого шума
        const start = Math.floor(t * sr);
        const glen = Math.floor(sr * 0.03);
        for (let i = 0; i < glen && start + i < len; i++) {
          const x = i / glen;
          d[start + i] += (Math.random() * 2 - 1) * Math.sin(Math.PI * x) ** 2 * env * rnd(0.85, 1);
        }
        t += 1 / rate + rnd(-0.002, 0.002);
      }
      // мягкий бархатный гул: без шипения, но слышен и в динамиках ноутбука/телефона
      lowpass(d, 0.08);
      lowpass(d, 0.12);
    } else if (kind === "dog") {
      // 4 вдоха-выдоха, «хах-хах»
      for (let k = 0; k < 4; k++) {
        const s0 = Math.floor(sr * (k * 0.4 + 0.02));
        const n = Math.floor(sr * 0.18);
        for (let i = 0; i < n && s0 + i < len; i++) {
          const x = i / n;
          d[s0 + i] += (Math.random() * 2 - 1) * Math.sin(Math.PI * x) ** 1.5 * (k % 2 ? 0.7 : 1);
        }
      }
      lowpass(d, 0.25);
    } else {
      let t = 0.05;
      while (t < len / sr - 0.05) {
        const s0 = Math.floor(t * sr);
        const n = Math.floor(sr * 0.006);
        for (let i = 0; i < n && s0 + i < len; i++) d[s0 + i] += (Math.random() * 2 - 1) * (1 - i / n) * rnd(0.4, 1);
        t += rnd(0.06, 0.11);
      }
      lowpass(d, 0.35);
    }
    // нормируем
    let pk = 0;
    for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i]));
    if (pk > 0) for (let i = 0; i < len; i++) d[i] /= pk;
    return buf;
  }

  /** Вызывается каждый кадр: громкость «довольного» звука питомца (0 — тишина). */
  setContent(kind: Pet, level: number, pan: number) {
    if (!this.ctx || !this.out) return;
    const ctx = this.ctx;
    if (this.loop && this.loop.kind !== kind) {
      this.loop.src.stop();
      this.loop = null;
    }
    if (!this.loop) {
      if (level <= 0.001) return;
      const src = ctx.createBufferSource();
      src.buffer = this.loopBuffer(kind);
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const p = ctx.createStereoPanner();
      let node: AudioNode = src;
      if (kind === "cat") {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 520;
        lp.Q.value = 0.5;
        node = node.connect(lp);
      } else if (kind === "dog") {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1000;
        bp.Q.value = 0.6;
        node = node.connect(bp);
      } else {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1800;
        bp.Q.value = 0.9;
        node = node.connect(bp);
      }
      node.connect(gain).connect(p).connect(this.out);
      src.start();
      this.loop = { kind, gain, pan: p, src };
    }
    const vol = kind === "cat" ? 3 : kind === "dog" ? 1.2 : 1;
    const now = ctx.currentTime;
    this.loop.gain.gain.setTargetAtTime(this.enabled ? level * vol : 0, now, 0.25);
    this.loop.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)) * 0.7, now, 0.1);
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
