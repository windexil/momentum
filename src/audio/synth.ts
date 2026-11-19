// Процедурная музыка для демо-воспоминаний. Всё синтезируется в браузере
// через Web Audio, поэтому для демонстрации не нужны треки с лицензией.

import type { AudioFeatures } from "../atmosphere/types";

export type SynthPreset = "summer" | "rain" | "winter";

interface PresetDef {
  name: string;
  bpm: number;
  /** Аккорды: MIDI-ноты */
  chords: number[][];
  lead: "pluck" | "keys" | "bell";
  drums: boolean;
  rainNoise: boolean;
  features: AudioFeatures;
}

export const PRESETS: Record<SynthPreset, PresetDef> = {
  summer: {
    name: "Солнечный берег (синтез)",
    bpm: 116,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [67, 71, 74, 77]],
    lead: "pluck",
    drums: true,
    rainNoise: false,
    features: { energy: 0.78, brightness: 0.72, bpm: 116, duration: 0 },
  },
  rain: {
    name: "Окно и дождь (синтез)",
    bpm: 68,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [52, 55, 59, 62]],
    lead: "keys",
    drums: false,
    rainNoise: true,
    features: { energy: 0.28, brightness: 0.3, bpm: 68, duration: 0 },
  },
  winter: {
    name: "Снежная шкатулка (синтез)",
    bpm: 92,
    chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 67]],
    lead: "bell",
    drums: false,
    rainNoise: false,
    features: { energy: 0.45, brightness: 0.85, bpm: 92, duration: 0 },
  },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class SynthPlayer {
  private ctx: AudioContext;
  private out: GainNode;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private def: PresetDef;
  private noise: AudioBufferSourceNode | null = null;
  private reverb: ConvolverNode;
  private wet: GainNode;

  constructor(ctx: AudioContext, destination: AudioNode, preset: SynthPreset) {
    this.ctx = ctx;
    this.def = PRESETS[preset];
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx, preset === "summer" ? 1.4 : 3.2);
    this.wet = ctx.createGain();
    this.wet.gain.value = preset === "summer" ? 0.18 : 0.42;
    this.reverb.connect(this.wet).connect(this.out);
  }

  start() {
    const t = this.ctx.currentTime;
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(0.8, t + 1.5);
    this.nextTime = t + 0.1;
    this.step = 0;
    if (this.def.rainNoise) this.startRain();
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stop(fade = 1.2) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fade);
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    window.setTimeout(() => {
      this.noise?.stop();
      this.out.disconnect();
    }, fade * 1000 + 100);
  }

  private schedule() {
    const sixteenth = 60 / this.def.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private playStep(step: number, t: number, s16: number) {
    const bar = Math.floor(step / 16) % this.def.chords.length;
    const pos = step % 16;
    const chord = this.def.chords[bar];

    // Пэд на каждый такт
    if (pos === 0) chord.forEach((n) => this.pad(mtof(n - 12), t, s16 * 16));
    // Бас
    if (pos === 0 || (this.def.drums && pos === 8)) this.bass(mtof(chord[0] - 24), t, s16 * 6);

    // Мелодия/арпеджио
    if (this.def.lead === "pluck" && pos % 2 === 0) {
      const n = chord[(pos / 2 + bar) % chord.length] + (pos % 8 === 6 ? 12 : 0);
      this.pluck(mtof(n), t, 0.25);
    } else if (this.def.lead === "keys" && [0, 6, 10, 14].includes(pos)) {
      const n = chord[[0, 2, 1, 3][[0, 6, 10, 14].indexOf(pos)]] + 12;
      this.keys(mtof(n), t, s16 * 6);
    } else if (this.def.lead === "bell" && pos % 4 === 0) {
      const seq = [3, 2, 1, 2];
      const n = chord[seq[(pos / 4) % 4]] + 12 + (bar % 2 && pos === 12 ? 12 : 0);
      this.bell(mtof(n), t);
    }

    if (this.def.drums) {
      if (pos % 4 === 0) this.kick(t);
      if (pos % 4 === 2) this.hat(t, 0.05);
      if (pos === 4 || pos === 12) this.snap(t);
    }
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private voice(type: OscillatorType, f: number, t: number, a: number, peak: number, d: number, send = 0.5, filter = 4000) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filter;
    const g = this.ctx.createGain();
    this.env(g, t, a, peak, d);
    o.connect(lp).connect(g);
    g.connect(this.out);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverb);
    }
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  private pad(f: number, t: number, len: number) {
    this.voice("triangle", f, t, len * 0.3, 0.035, len * 0.8, 0.8, 1400);
    this.voice("sine", f * 1.004, t, len * 0.3, 0.03, len * 0.8, 0.8, 1200);
  }
  private bass(f: number, t: number, len: number) {
    this.voice("sine", f, t, 0.01, 0.16, len, 0, 500);
  }
  private pluck(f: number, t: number, len: number) {
    this.voice("square", f, t, 0.005, 0.045, len, 0.4, 2600);
  }
  private keys(f: number, t: number, len: number) {
    this.voice("triangle", f, t, 0.01, 0.09, len, 0.7, 2000);
    this.voice("sine", f * 2, t, 0.01, 0.02, len * 0.5, 0.7, 3000);
  }
  private bell(f: number, t: number) {
    this.voice("sine", f, t, 0.003, 0.08, 1.6, 0.8, 8000);
    this.voice("sine", f * 2.76, t, 0.003, 0.025, 0.8, 0.8, 8000);
    this.voice("sine", f * 5.4, t, 0.003, 0.01, 0.4, 0.8, 9000);
  }
  private kick(t: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    this.env(g, t, 0.003, 0.35, 0.25);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.3);
  }
  private noiseBurst(t: number, len: number, peak: number, hp: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, peak, len);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + len + 0.05);
  }
  private hat(t: number, len: number) {
    this.noiseBurst(t, len, 0.05, 7000);
  }
  private snap(t: number) {
    this.noiseBurst(t, 0.12, 0.08, 1800);
  }
  private startRain() {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2500;
    bp.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(this.out);
    src.start();
    this.noise = src;
  }
}

let cachedNoise: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext) {
  if (cachedNoise && cachedNoise.sampleRate === ctx.sampleRate) return cachedNoise;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  cachedNoise = buf;
  return buf;
}

function makeImpulse(ctx: AudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  return buf;
}
