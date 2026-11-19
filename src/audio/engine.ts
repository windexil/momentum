// Аудио-движок: один AudioContext, анализатор для «дыхания» сцены,
// воспроизведение загруженного файла, прямой ссылки или синтеза.

import type { AudioFeatures } from "../atmosphere/types";
import type { MusicSource } from "../types";
import { SynthPlayer } from "./synth";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private master: GainNode | null = null;
  private buf: Uint8Array<ArrayBuffer> | null = null;
  private el: HTMLAudioElement | null = null;
  private elSource: MediaElementAudioSourceNode | null = null;
  private synth: SynthPlayer | null = null;
  private objectUrl: string | null = null;
  private level = 0;
  onEnded: (() => void) | null = null;

  /** Нужно вызвать в обработчике клика: браузер разрешает звук только после действия пользователя. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.75;
      this.master.connect(this.analyser).connect(this.ctx.destination);
      this.buf = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    // Готовим <audio> внутри жеста пользователя, чтобы потом play() не заблокировали.
    if (!this.el) {
      this.el = new Audio();
      this.el.crossOrigin = "anonymous";
      this.el.preload = "auto";
      this.elSource = this.ctx.createMediaElementSource(this.el);
      this.elSource.connect(this.master!);
      this.el.addEventListener("ended", () => this.onEnded?.());
    }
  }

  async play(music: MusicSource) {
    this.unlock();
    this.stop(0.1);
    const ctx = this.ctx!;
    if (music.kind === "synth" && music.preset) {
      this.synth = new SynthPlayer(ctx, this.master!, music.preset);
      this.synth.start();
      return;
    }
    let src = music.url ?? "";
    if (music.kind === "file" && music.blob) {
      this.objectUrl = URL.createObjectURL(music.blob);
      src = this.objectUrl;
    }
    if (!src) return;
    const el = this.el!;
    el.src = src;
    el.volume = 1;
    try {
      await el.play();
    } catch (e) {
      console.warn("Не удалось запустить аудио", e);
      throw e;
    }
  }

  stop(fade = 1.2) {
    this.synth?.stop(fade);
    this.synth = null;
    if (this.el && !this.el.paused) {
      const el = this.el;
      const start = el.volume;
      const t0 = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / (fade * 1000));
        el.volume = start * (1 - k);
        if (k < 1) requestAnimationFrame(tick);
        else el.pause();
      };
      if (fade <= 0.15) el.pause();
      else tick();
    }
    if (this.objectUrl) {
      const u = this.objectUrl;
      this.objectUrl = null;
      window.setTimeout(() => URL.revokeObjectURL(u), fade * 1000 + 200);
    }
  }

  private wave: Uint8Array<ArrayBuffer> | null = null;
  /** Форма волны (-1..1) для «звуковой дорожки»; при тишине — нули. */
  waveform(out: Float32Array) {
    if (!this.analyser) {
      out.fill(0);
      return;
    }
    if (!this.wave) this.wave = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.analyser.getByteTimeDomainData(this.wave);
    const step = this.wave.length / out.length;
    for (let i = 0; i < out.length; i++) out[i] = (this.wave[Math.floor(i * step)] - 128) / 128;
  }

  /** Сглаженная громкость 0..1 и доля баса — для реакции сцены на музыку. */
  sample(): { level: number; bass: number } {
    if (!this.analyser || !this.buf) return { level: 0, bass: 0 };
    this.analyser.getByteFrequencyData(this.buf);
    let sum = 0, bass = 0;
    for (let i = 0; i < this.buf.length; i++) {
      sum += this.buf[i];
      if (i < 12) bass += this.buf[i];
    }
    const raw = sum / this.buf.length / 255;
    this.level = this.level * 0.8 + Math.min(1, raw * 2.2) * 0.2;
    return { level: this.level, bass: Math.min(1, bass / 12 / 255 * 1.4) };
  }
}

export const audio = new AudioEngine();

/** Простые характеристики трека: громкость, «яркость» и примерный темп. */
export async function analyzeAudioBlob(blob: Blob): Promise<AudioFeatures | null> {
  try {
    const arr = await blob.arrayBuffer();
    const OfflineCtx = window.OfflineAudioContext;
    const tmp = new OfflineCtx(1, 44100, 44100);
    const buffer = await tmp.decodeAudioData(arr);
    const data = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    // Берём до 60 секунд из середины трека.
    const len = Math.min(data.length, sr * 60);
    const offset = Math.max(0, Math.floor((data.length - len) / 2));
    const win = Math.floor(sr * 0.05);
    const energies: number[] = [];
    let zc = 0, total = 0;
    for (let i = offset; i + win < offset + len; i += win) {
      let e = 0;
      for (let j = 0; j < win; j++) {
        const v = data[i + j];
        e += v * v;
        if (j > 0 && (v >= 0) !== (data[i + j - 1] >= 0)) zc++;
      }
      total += win;
      energies.push(Math.sqrt(e / win));
    }
    const mean = energies.reduce((a, b) => a + b, 0) / (energies.length || 1);
    // Темп: автокорреляция огибающей «вспышек» громкости.
    const onset = energies.map((e, i) => Math.max(0, e - (energies[i - 1] ?? e)));
    const fps = 1 / 0.05;
    let bestLag = 0, best = -Infinity;
    for (let bpm = 60; bpm <= 180; bpm++) {
      const lag = Math.round((60 / bpm) * fps);
      let s = 0;
      for (let i = lag; i < onset.length; i++) s += onset[i] * onset[i - lag];
      if (s > best) { best = s; bestLag = lag; }
    }
    const bpm = bestLag ? (60 * fps) / bestLag : 100;
    const zcr = zc / (total || 1);
    return {
      energy: Math.min(1, mean * 4),
      brightness: Math.min(1, zcr * 12),
      bpm,
      duration: buffer.duration,
    };
  } catch (e) {
    console.warn("Не удалось проанализировать аудио", e);
    return null;
  }
}
